// Step test: add STEP_RPM requests a minute every 90 s (30 s ramp, 60 s hold)
// up to TOP_RPM, with writes alongside at a steady rate. Stops itself past 5%
// failures. Replace visit() and write() with what your pages really call.
//
//   docker run --rm --network mimic_default --cpuset-cpus 8-11 --memory 2g \
//     -v $PWD:/rig:ro -v $PWD/out:/out -e BASE_URL=http://lb -e CLIENT_IPS=60 \
//     grafana/k6:<version> run -q --out csv=/out/run.csv /rig/breakpoint.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';

const BASE = __ENV.BASE_URL || 'http://lb';
const STEP = Number(__ENV.STEP_RPM || 500);
const TOP = Number(__ENV.TOP_RPM || 6000);
const WRITES = Number(__ENV.WRITES_PER_MIN || 30);
const REQUESTS_PER_VISIT = 8;
const RUN = __ENV.RUN_ID || `${Date.now()}`;
// Simulated carrier addresses, shared by many users, as on mobile data. Only
// meaningful when nothing between k6 and the app rewrites the header.
const CLIENT_IPS = Number(__ENV.CLIENT_IPS || 0);

function headers(extra) {
  const h = Object.assign({}, extra || {});
  if (CLIENT_IPS > 0) {
    const n = exec.vu.idInTest % CLIENT_IPS;
    h['X-Forwarded-For'] = `100.64.${Math.floor(n / 250)}.${(n % 250) + 1}`;
  }
  return h;
}

const get = (path, name) => http.get(`${BASE}${path}`, { headers: headers(), tags: { name } });

export function visit() {
  const list = get('/api/v1/listings/?limit=12', 'list');
  check(list, { 'list 200': (r) => r.status === 200 });
  get('/api/v1/listings/featured/', 'featured');
  get('/api/v1/lookups/amenities/', 'amenities');
  get('/api/v1/flags/', 'flags');
  get('/api/v1/auth/me/', 'me');
  let ids = [];
  try { ids = (list.json('results') || []).map((r) => r.id); } catch (e) { ids = []; }
  if (ids.length) get(`/api/v1/listings/${ids[Math.floor(Math.random() * ids.length)]}/`, 'detail');
  get(`/api/v1/listings/?search=${['flat', 'duplex', 'lekki'][Math.floor(Math.random() * 3)]}`, 'search');
  get('/api/v1/lookups/countries/', 'countries');
  sleep(Math.random() * 2);
}

export function write() {
  const n = exec.scenario.iterationInTest;
  const res = http.post(`${BASE}/api/v1/auth/register/`, JSON.stringify({
    email: `loadtest+${RUN}-${n}@example.test`, password: 'Long-enough-2026', first_name: 'Load', last_name: 'Test',
  }), { headers: headers({ 'Content-Type': 'application/json' }), tags: { name: 'register' } });
  check(res, { 'register 201': (r) => r.status === 201 });
}

const stages = [];
for (let rpm = STEP; rpm <= TOP; rpm += STEP) {
  stages.push({ target: Math.round(rpm / REQUESTS_PER_VISIT), duration: '30s' });
  stages.push({ target: Math.round(rpm / REQUESTS_PER_VISIT), duration: '60s' });
}

export const options = {
  discardResponseBodies: false,
  scenarios: {
    visit: { executor: 'ramping-arrival-rate', exec: 'visit', startRate: 1, timeUnit: '1m',
      preAllocatedVUs: 100, maxVUs: 1500, stages },
    write: { executor: 'constant-arrival-rate', exec: 'write', rate: WRITES, timeUnit: '1m',
      duration: `${stages.length * 45}s`, preAllocatedVUs: 10, maxVUs: 200 },
  },
  thresholds: {
    'http_req_failed{scenario:visit}': [{ threshold: 'rate<0.05', abortOnFail: true, delayAbortEval: '60s' }],
  },
};

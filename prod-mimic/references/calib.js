// Idle timing on the copy: one user, sequential, the same endpoints you timed
// on production. Compare medians to get the copy-to-production ratio.
import http from 'k6/http';

const NAMES = ['list', 'featured', 'search', 'flags'];
export const options = {
  vus: 1, iterations: 15, summaryTrendStats: ['med', 'p(90)'],
  thresholds: Object.fromEntries(NAMES.map((n) => [`http_req_waiting{name:${n}}`, []])),
};

export default function () {
  const B = __ENV.BASE_URL;
  http.get(`${B}/api/v1/listings/?limit=12`, { tags: { name: 'list' } });
  http.get(`${B}/api/v1/listings/featured/`, { tags: { name: 'featured' } });
  http.get(`${B}/api/v1/listings/?search=lekki`, { tags: { name: 'search' } });
  http.get(`${B}/api/v1/flags/`, { tags: { name: 'flags' } });
}

export function handleSummary(d) {
  const out = {};
  for (const [k, v] of Object.entries(d.metrics)) if (k.startsWith('http_req_waiting{name:')) out[k] = v.values;
  return { stdout: JSON.stringify(out, null, 1) + '\n' };
}

---
name: prod-mimic
description: How to load-test a production web stack without touching production, by building a calibrated copy of it on one machine. Covers reading production's real shape, sizing every link the same (CPU and memory limits, a PgBouncer sidecar on the task's localhost, a capped database, a small cache, a load-balancer stand-in, network delay), seeding fake data instead of copying real users, calibrating the copy against a handful of ordinary production requests, step tests that climb until something breaks, the monitor that tells you what broke, and the symptom-to-cause table for reading the results. Distilled from a Django/gunicorn/PgBouncer/Postgres stack on ECS where the copy found the real wall (API CPU), a password hasher costing half of all CPU, a keep-alive mismatch behind daily 502s, and a worker-recycling stall. Load before any capacity question, before tuning threads or pool sizes, before an ad campaign or launch, or when asked "how much traffic can we take".
---

# Load-test a copy, never production

Production answers "how much can we take" only by falling over. A copy answers
it safely, if every link in the copy has production's size and you know how much
faster the copy is than the real thing. This skill is how to build that copy,
calibrate it, push it, and read what it tells you.

The running example is a Django API on gunicorn behind an AWS Application Load
Balancer, two ECS tasks of 0.5 vCPU and 1.5 GB each, a PgBouncer sidecar per
task, PostgreSQL on a small RDS instance and Valkey for cache. The copy found
that every tuning knob people reach for first (threads, pool size) did nothing,
and four small changes took the copy from 2,000 to 7,000 clean requests a
minute. The full story is in the findings at the end.

## Ground rules

- **Never load production**, and never "dry run" a load script against it. The
  only production traffic you send is a handful of ordinary requests to
  calibrate (step 5).
- **No real people's data in the copy.** Do not dump the production or shared
  database. Load public reference tables (data only) and seed fake records on
  a test email domain.
- **One heavy job at a time on the machine.** Ask the user what memory the run
  needs before starting (step 0) and let them close apps; stop dev servers
  yourself and restart them afterwards.
- **Build from the exact production commit**, not your working branch.
- **Tear it all down** at the end: containers, volumes, the test image.

## 0. Memory budget, before anything starts

Add up the copy's limits and tell the user the number. For the example:

| Part | Limit |
|---|---|
| 2 API containers | 1.5 GB each |
| 2 PgBouncer sidecars | 64 MB each |
| Worker (Celery) | 1 GB |
| Database | 2 GB |
| Cache | 0.5 GB |
| Load generator (k6, up to 1,500 virtual users) | 2 GB |
| Total if everything hits its limit | about 8.5 GB |

Want at least that much **available** (`free -h`, the `available` column) with
swap not in active use: a swapping copy measures the disk. Close browsers and
other heavy apps. Check whether your own session runs inside an IDE terminal
before telling the user to close the IDE (`ps -o ppid=` up the chain): closing
it ends the session.

## 1. Read production's shape, live

Never from memory or old notes; sizes drift. Read-only calls only:

```bash
aws ecs describe-task-definition --task-definition <api-task> \
  --query 'taskDefinition.{cpu:cpu,mem:memory,c:containerDefinitions[].{n:name,cmd:command,env:environment}}'
aws ecs describe-services --cluster <cluster> --services <api> --query 'services[0].desiredCount'
aws rds describe-db-instances --query 'DBInstances[].[DBInstanceClass,EngineVersion,AllocatedStorage]'
aws elasticache describe-cache-clusters --query 'CacheClusters[].[CacheNodeType,Engine,EngineVersion]'
aws elbv2 describe-load-balancer-attributes --load-balancer-arn <alb> \
  --query 'Attributes[?Key==`idle_timeout.timeout_seconds`]'
```

Also note the app server's real command line (workers, threads, keep-alive,
max-requests), the pooler's mode and pool size, and the database's
`max_connections` (RDS derives it from instance memory).

## 2. Build the image from the production commit

```bash
git -C <backend> archive <prod-sha> | docker build -t app:mimic-<sha> -
```

`git archive` gives a clean tree with no local `.env` and no stray files, and
needs no worktree.

## 3. Size every link like production

[`references/compose.yaml`](references/compose.yaml) is the template. The
mapping that matters:

| Production | Stand-in | Why this way |
|---|---|---|
| API task, 0.5 vCPU / 1.5 GB | `cpus: 0.5`, `mem_limit` 1.5 GB | A CPU quota throttles like the task limit does |
| Sidecar on the task's `localhost` (awsvpc) | `network_mode: service:api1` | Shares the API container's network namespace, exactly like a task |
| RDS, 2 vCPU / 2 GB | Postgres capped at 2 CPU / 2 GB, `max_connections` set to production's | A laptop database is otherwise far bigger than production's |
| Cache node | Valkey/Redis with `maxmemory` and a memory cap | |
| The database one network hop away | `tc netem delay 1ms` on the database's interface | Localhost is zero; every query in production pays a round trip |
| Application Load Balancer | nginx, [`references/nginx.conf`](references/nginx.conf) | Round robin, never marks a target down, passes the client address on |
| Load generator | k6 pinned to its own cores (`--cpuset-cpus`) | It must not steal CPU from the thing being measured |

Pin the copy to one set of cores (`cpuset: "0-7"`) and k6 to the rest.

Network delay, applied from a throwaway container in the database's namespace:

```bash
docker run --rm --net container:<db-container> --cap-add NET_ADMIN alpine:3.20 \
  sh -c 'apk add -q iproute2-tc && tc qdisc add dev eth0 root netem delay 1ms'
```

### The stand-in must outsize what it replaces

The first run in the example returned 500s. They came from nginx running out of
file descriptors (`accept4() failed (24: No file descriptors available)`), then
marking both API containers down. The load balancer it stood in for does
neither. Give the stand-in `ulimits: nofile: 65536`, `worker_rlimit_nofile`,
`max_fails=0` on every upstream and `proxy_next_upstream off`. Any error that
starts in the rig's own parts means you are measuring the rig: check the
stand-in's logs before believing a failure.

### PgBouncer as a sidecar

[`references/pgbouncer.sh`](references/pgbouncer.sh) writes the ini at start
from the same credentials the app reads, listens on `127.0.0.1:6432`, transaction
mode, production's pool size. Transaction pooling has rules the app must already
follow: no server-side cursors, no session settings or startup options (send a
statement timeout per statement), and migrations connect directly
(`DB_DIRECT=1`-style switch).

## 4. Data: fake people, real reference tables

1. Run every migration on an empty database, from the production image.
2. Copy **only public reference tables**, data only:
   `pg_dump --data-only -t <locations> -t <types> -t <amenities> …`. A newer
   `pg_dump` writes `\restrict` lines and `SET transaction_timeout` that an
   older server rejects; strip them before loading.
3. Seed fake records with a script that refuses to run anywhere but the copy
   (assert on the database host). The example made 100 fake landlords and 1,000
   published listings with 5 photos each, all on a test domain, published
   long enough ago to clear any visibility embargo.
4. Set feature flags to production's values.
5. `VACUUM ANALYZE`.

Size the data at or above production's. A copy with less data than production
flatters every list query.

## 5. Calibrate against production

A laptop core is not a cloud core. Measure the same endpoints on both, at idle,
and carry the ratio into every conclusion.

On production, a handful of ordinary requests over **one kept-alive
connection**, so the TLS handshake is paid once. The time from request sent to
first byte, minus one round trip, is server time:

```bash
args=(); for i in $(seq 8); do args+=("$URL" -o /dev/null); done
curl -s -w '%{time_connect} %{time_pretransfer} %{time_starttransfer}\n' "${args[@]}" \
  | awk 'NR==1{rtt=$1} {printf "%d ", ($3-$2)*1000} END{printf "| rtt %d ms\n", rtt*1000}'
```

A trivial endpoint (feature flags, health) tells you the round trip; subtract
it. On the copy, [`references/calib.js`](references/calib.js) times the same
endpoints from inside the network. In the example production took about twice
as long (80 ms against 41 for the list, 140 against 64 for search), so every
throughput number from the copy was halved before it said anything about
production.

Do not calibrate from the load balancer's average response time: it is
dominated by cheap requests and says nothing per endpoint.

## 6. The load: a step test, not a fixed rate

A fixed rate past the limit only tells you it is past the limit. Climb in steps
and read where it bends. [`references/breakpoint.js`](references/breakpoint.js)
adds a fixed amount every 90 seconds (30 s ramp, 60 s hold), runs sign-ups or
other writes alongside at a steady rate, and stops itself past 5% failures.

- Model a real visit: every request a page actually makes, plus think time.
- Spread requests over simulated client addresses (`X-Forwarded-For`) when k6
  talks to the stand-in directly, so per-IP rate limits behave as they do for
  people sharing mobile carrier IPs. Through a real proxy that header cannot be
  forged; that is the point.
- Writes go to a mail backend that does not send, on a domain that never
  receives mail.
- Record every request (`--out csv=`) and summarise per step with
  [`references/analyze.py`](references/analyze.py): offered and served per
  minute, p50/p95/p99, failures, 429s, 5xx, write latency.

## 7. Watch while it runs

[`references/monitor.sh`](references/monitor.sh) samples every 10 seconds:

- container CPU and memory (`docker stats`; at a 0.5 CPU limit, 50% means full);
- the pooler: `SHOW POOLS` (`cl_waiting` above 0 for long = pool too small);
- database connections (`pg_stat_activity`);
- host memory available and swap.

When CPU looks fine but latency is bad, read the CPU throttle counters:
`/sys/fs/cgroup/system.slice/docker-<id>.scope/cpu.stat` (`nr_throttled`,
`throttled_usec`). A snapshot percentage hides bursts.

Watch for low memory and stop the run before the machine does it for you.

## 8. Read the results

Find the knee: the last step where served matches offered and p95 holds. Then
name what failed first.

| Symptom | Usually | Check |
|---|---|---|
| API containers pinned at their limit, served falls behind offered | CPU is the wall | Per-endpoint median time at low load × request share: what eats the CPU |
| `cl_waiting` > 0, database busy | Pool or database | Database CPU and connections; pool size against `max_connections` |
| p99 spikes of seconds at **low** CPU, in bursts | Workers restarting (`--max-requests`) or a stall | Line spikes up with "Autorestarting worker" / "Booting worker" log lines |
| 500/502 with nothing in the app log | The rig's stand-in, or keep-alive mismatch | The stand-in's error log; app keep-alive against the balancer's idle timeout |
| Memory climbing only once overloaded | Requests queued in flight, not a leak | Does it hold flat below the knee? Does a worker recycle bring it down? |
| Many 429s | Rate limits too tight for shared carrier IPs | Which limit, at what per-IP rate |
| One write endpoint dominates time | A deliberately slow primitive (password hashing, PDF, image work) | Its parameters against your CPU and memory limits |

### Comparing configurations

Run the same step test per configuration, changing one thing. Make the knobs
environment variables in the compose file and recreate the API and its sidecars
together (a sidecar in `network_mode: service:` must be recreated with its
host). Use `${VAR-default}`, not `${VAR:-default}`, for a knob whose "off" value
is empty: `:-` treats empty as unset and silently brings the default back. In
the example that turned a "direct to the database" run into a second PgBouncer
run.

Re-run after every fix. A fix moves the wall, and the next wall is often one
nobody predicted.

## What the example found

Useful as a checklist for any Django/gunicorn stack on small tasks:

1. **Threads do not add capacity on half a core.** Threads help when requests
   wait (far database, outside APIs). A database 1 ms away leaves little
   waiting; Python runs one thread's code at a time per process. Past the knee,
   threaded workers degraded worse than sync workers.
2. **Password hashing at library defaults.** Django 5.2's Argon2 defaults
   (100 MiB, 2 passes, 8 lanes) took 780 ms per registration on a half core and
   about 81 MB each while running; ten at once could kill a 1.5 GB task. OWASP's
   minimum (19 MiB, 2 passes, 1 lane) took 85 ms and 19 MB. Old hashes keep
   verifying (settings live in the hash) and are rewritten on the next correct
   sign-in. A custom hasher must **replace** the stock entry: both answer to
   `argon2`.
3. **Identical anonymous answers, computed per visitor.** Shared for 30 s per
   query (never for signed-in users, logged searches or private responses,
   failing open if the cache is down), list and search went from 43–61 ms to
   3–7 ms.
4. **Keep-alive shorter than the balancer's idle timeout.** gunicorn closed idle
   connections at 5 s, the ALB kept them 60 s: the daily handful of ELB 502s.
   Keep-alive must outlast the balancer (65 s).
5. **Limits counted in requests fire faster when requests get cheaper.**
   `--max-requests 1000` recycled a worker every few seconds somewhere in the
   fleet once requests were cheap; each fresh worker stalled its neighbours on
   half a core. 10,000 with jitter 1,000 removed the stalls; memory held at
   about 650 MB below the knee.

## Teardown

```bash
docker compose -p mimic down -v      # volumes too: the seeded data goes
docker rmi app:mimic-<sha>
```

Restart whatever dev containers you stopped, and record the results (per-step
tables and monitor logs) somewhere the next session will find them.

## Files

- [`references/compose.yaml`](references/compose.yaml): the copy, production-sized.
- [`references/nginx.conf`](references/nginx.conf): the load-balancer stand-in.
- [`references/pgbouncer.sh`](references/pgbouncer.sh): the sidecar's start script.
- [`references/breakpoint.js`](references/breakpoint.js): the step test.
- [`references/calib.js`](references/calib.js): idle timing on the copy.
- [`references/analyze.py`](references/analyze.py): per-step summary from k6's CSV.
- [`references/monitor.sh`](references/monitor.sh): containers, pool, connections, memory every 10 s.

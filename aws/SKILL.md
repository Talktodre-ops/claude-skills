---
name: aws
description: Running a small production web app on AWS for the least money without losing stability, proven on a Django, Celery, Next.js and MQTT stack on ECS on EC2. Covers right-sizing (Graviton hosts, bridge mode for workers, single-AZ RDS, fck-nat instead of a NAT gateway, Cloud Map instead of an internal load balancer, Postgres instead of a search cluster), how deploys must work on packed hosts (in-place rollouts, binpack, one service at a time), moving and retiring ECS hosts, and a long list of non-obvious traps (ENI limits, capacity provider scale-in, AZ rebalancing, run-task placement, drain delays, Elastic IP boot races, client IPs behind a load balancer, credits that post late). Use when designing, cutting the cost of, reviewing, deploying to or operating AWS infrastructure of this kind.
---

# Lean production on AWS

How to run a small but real production app on AWS at a fraction of the default bill, and what goes wrong once the hosts are packed. Distilled from a cut from about $350 to about $135 a month that also made the app more resilient (one API task became two across two zones).

- [`README.md`](README.md): the concrete deployment this came from, every service it uses, the costs and the trade-offs.
- [`terraform/SKILL.md`](terraform/SKILL.md): keeping Terraform, state and the live account consistent.
- [`../infra/SKILL.md`](../infra/SKILL.md): the general Terraform and CI layout (environments, toggles, OIDC, migrate-then-roll).

## How to cut the bill

Measure first. Pull 30 days of CloudWatch utilisation and the bill by usage type before changing anything. In the source system the API averaged 1.7% CPU, the database 4% with 5 connections, the cache held 10 MB, and one of four hosts ran nothing. The waste is usually in idle capacity, not in the architecture.

Then work down this list, cheapest risk first:

1. **Settings, no code.** RDS Multi-AZ off if a zone failure can cost a few minutes of downtime (the standby doubles the database bill). Cache node sized to what it holds. Bastion stopped when idle. Stale hosted zones deleted.
2. **Fewer, cheaper hosts.** Graviton (t4g) is the same vCPU and memory as t3 for about a fifth less. Workers that take no inbound traffic go to `bridge` networking so they do not spend a network interface each (see the ENI trap).
3. **Replace per-hour managed glue.** A NAT gateway for low traffic becomes a fck-nat instance. An internal load balancer in front of one task becomes a Cloud Map DNS name.
4. **Remove a second copy of data.** A search cluster indexing a few thousand rows is a second database to keep in sync. Postgres with `pg_trgm` answers at that size. Compare live results from both before switching.
5. **Commit last.** Savings Plans and reserved instances only after a month on the new shape. Committing first locks in the oversizing.

Spend some of the saving on stability: two API tasks across two zones cost nothing extra once the hosts are packed well.

## How deploys must work once hosts are packed

A packed host has no room for a second copy of a big task. The default ECS rollout (100 / 200: start new, then stop old) needs that room, so the capacity provider adds a host. Managed scaling only removes **empty** hosts, and placement after the rollout usually leaves a task on every host. Result: every deploy quietly ratchets the host count up.

Rules:

- Multi-task services replace one task at a time: `minimum_healthy_percent = 50`, `maximum_percent = 100`.
- Single-task services that can stop briefly (workers, schedulers) replace in place: 0 / 100. A scheduler must never run twice anyway.
- Single-task services that must not stop (the frontend) keep 100 / 200, and the free room must fit one copy of them.
- Placement: binpack on memory, after an AZ spread for the multi-task service. A host added for a scale-out then empties and scales in.
- Turn AZ rebalancing off on those services. It is on by default and refuses both binpack and a 100% ceiling.
- Roll services one at a time in the deploy script: the big one first, wait for its rollout, then the rest. Concurrent rollouts let a small task take the room a big one just freed.
- Wait on the deployment's `rolloutState` and the old deployment being gone, not on `runningCount == desiredCount`. During a one-at-a-time rollout the counts match almost the whole time.
- After every deploy, check the host count went back down.

## Moving or retiring hosts

An Auto Scaling instance refresh never finishes under ECS managed termination protection: hosts running tasks are protected, and the refresh will not terminate them. Do it by hand, one host at a time:

1. Raise the group's max if the tasks need room to land.
2. Set the container instance to `DRAINING`.
3. Wait for 0 running tasks on it, and the services to be steady.
4. Remove its scale-in protection.
5. `terminate-instance-in-auto-scaling-group --should-decrement-desired-capacity`.

Pick which host to drain by memory arithmetic, not by age: work out where each task will land under the placement rules. A task that needs 1.5 GB in a zone where no host has 1.5 GB free goes to the other zone (spread is a preference, not a rule) or waits for a new host.

## Traps that are not obvious

**Networking and capacity**

- **ENI slots, not memory, can be the limit.** Every `awsvpc` task takes a network interface. A t3/t4g.medium has three, one for the host, so it runs two `awsvpc` tasks with gigabytes of memory free. ENI trunking would lift it, but t3, t3a and t4g do not support trunking at all, whatever older notes say.
- **A host registers less memory than it has.** A 4 GB t4g.medium registers about 3835 MB to ECS. Do the fitting arithmetic with the registered figure.
- **`run-task --launch-type EC2` bypasses the capacity provider.** When no host has room it neither waits nor adds a host: it returns no task and a `failures` list, with exit code 0. Run one-off tasks (migrations) with the service's capacity provider strategy and only the memory they need, and fail the script when no task ARN comes back.
- **Draining a host moves its single-task services with a gap.** A 0 / 100 service on that host is down until it starts elsewhere (the broker: about a minute of chat reconnects).
- **Target group deregistration delay defaults to 300 seconds.** For a single task deployed stop-first, that is five minutes with nothing serving. Set it to seconds for such services.

**Load balancer and clients**

- **Behind an ALB, `REMOTE_ADDR` is the balancer.** Anything keyed on client IP (rate limits, audit logs, geo) must read `X-Forwarded-For`, taking the address the known number of proxies from the right. Rate limits keyed on `REMOTE_ADDR` put every visitor in one bucket and lock out the whole site.
- **Adding CloudFront adds a proxy.** The number of trusted proxies changes in the same change as the DNS move, never before.
- **Mobile carriers put many users behind one IP.** Per-IP limits on sign-in and sign-up must be wide; add per-account (per-email) limits to stop brute force.

**NAT**

- **fck-nat claims its Elastic IP only at boot.** If the old NAT gateway still holds the address, the claim fails and nothing retries. Release the address first, or attach it by hand.
- **Attach the Elastic IP to the instance's primary interface,** not the static interface that carries the route. Egress leaves from the primary. Check from inside the VPC that the outbound IP is the Elastic IP.
- **A NAT instance is a single point for outbound calls.** If it dies, payments, email and other partner calls fail for a minute or two while the group replaces it. Inbound traffic is unaffected. Make those calls retry.

**Data stores**

- **ElastiCache node type changes replace the node.** If it is also the Celery broker, whatever is queued at that moment is lost. Pause the scheduler, let the worker drain, resize at the quietest hour.
- **Without `apply_immediately`, RDS and ElastiCache changes wait for the maintenance window,** and plans look applied when they are not.
- **RDS `max_connections` is set by instance size** (181 on db.t4g.small). Count connections per task times tasks before adding threads or tasks.
- **A transaction-mode pooler breaks session state.** Row-level security set per connection with `SET` leaks between clients through PgBouncer in transaction mode. Use transaction-scoped settings, or a pool inside the app.
- **Search clients can refuse the server.** The Elasticsearch Python client from 7.14 refuses to talk to OpenSearch, while CI against real Elasticsearch stays green.

**Single-node services**

- **Some brokers license clustering.** EMQX from 5.9 is free for one node; two nodes form a cluster and need a licence. Keep it at one task, deployed 0 / 100.
- **Anything scheduled must run exactly once.** Celery beat at 100 / 200 briefly runs twice and fires every due job twice.

**Images and CI**

- **Graviton needs arm64 images for everything,** including third-party ones (check the broker image has arm64). Build multi-arch on native runners and push one manifest; then the host architecture is a variable.
- **The ECS AMI lookup must follow the instance architecture.** An x86 AMI in a t4g launch template fails to launch the host at all.
- **GitHub environment secrets reach only jobs that declare the environment.** A build job split out of the deploy job loses the OIDC role.
- **Workers pinned to `latest` drift.** A restart between deploys pulls whatever `latest` is now. Pin every service to the commit sha.

**Money**

- **Credits post days late.** Early in a month Cost Explorer can show usage with no credit lines, which reads as "credits are spent" when they are not. Group by `RECORD_TYPE`, and read the balance in Billing, which the API does not expose.
- **Public IPv4 addresses are billed by the hour,** including the ALB's. Count them.
- **Monitoring stacks cost a host.** A self-hosted Grafana, Loki and Prometheus box can cost more than the app it watches; CloudWatch alarms on the ALB, RDS and Route 53 health checks cover a small app.

## Operating discipline

- Every change through Terraform; nothing from the console except reads and emergencies, and an emergency change is written back to code the same day.
- Production writes from a terminal: one command at a time, read the result, read the state back.
- Never "dry run" a script against production by editing its text. Test the read half alone, or against another account.
- Before switching a read path (search, a new database query), compare old and new on live data, read-only, for every filter.
- After a cost cut, check what the next deploy does to the host count, not only that it succeeded.

## Non-negotiables

- Measure before cutting; commit to reservations last.
- Deploys on packed hosts replace in place, one service at a time, with binpack placement.
- Hosts are retired by draining, never by instance refresh under termination protection.
- Client IP comes from `X-Forwarded-For` with a known proxy count.
- The outbound Elastic IP is verified from inside the VPC after any NAT change.
- Anything scheduled runs on exactly one task.

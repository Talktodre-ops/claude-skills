# Production runs on two Graviton hosts and no spare managed parts

Date: 2026-10-08. Status: accepted. Source: Dre, after the cost review: "we want
to complete all the infra cost cut now... except the 1 year commitment thing",
and on placement: "for the bridge mode, how about we have min 2 and max 4?"

## Decision

- Two t4g.medium ECS hosts (min 2, max 4 only while a deploy or refresh needs
  room), images built for amd64 and arm64.
- The API runs two tasks, one per zone. Celery worker and beat use bridge
  networking; the API, frontend and EMQX stay on awsvpc.
- RDS single-AZ with backups and point-in-time restore kept; Valkey
  cache.t4g.micro.
- fck-nat on a t4g.nano in place of the NAT gateway, keeping the same Elastic IP.
- EMQX reached by Cloud Map (`emqx.heimly-prod.internal`) in place of the
  internal NLB; one task, 15 second drain on its wss target.
- OpenSearch removed; see [[2026-10-08-search-runs-on-postgres]].
- One-year commitments wait a month.

How it runs: `Infra-Heimly/infra/docs/PRODUCTION-ARCHITECTURE.md`.

## Why

Prod cost about $345 a month on demand for a load four t3 hosts carried at a
quarter full. The estimate after the cut is about $135. Each removed part was
paying for resilience or scale we do not use yet: Multi-AZ for a database whose
recovery costs minutes, an NLB to name one task, a NAT gateway for a few calls
an hour. The API gained resilience in the same change: two tasks instead of
one. On t3 and t4g, ECS cannot trunk network interfaces, so each host takes
only two awsvpc tasks. Bridge mode for Celery, which takes no inbound traffic,
is what makes two hosts enough.

## Rejected

- Bridge mode for the API and frontend: Dre preferred extra hosts during deploys
  over giving up per-task addressing behind the ALB.
- One VPS for everything: no managed database, no rolling deploys.
- One-year commitments now: sizing must hold for a month first.

## Revisit when

Downtime has a contractual cost (Multi-AZ back), traffic needs a third host at
steady state, or EMQX needs more than one node (licence question from 5.9).

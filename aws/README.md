# How Heimly production runs on AWS, and why it costs what it does

The account of record for the production shape after the October 2026 cost cut, written so the next person can rebuild it, run it, or argue with it. Two skills sit beside this file:

- [`SKILL.md`](SKILL.md): the AWS skill. The rules for running a small production app on ECS cheaply, and the traps that are not obvious until they bite.
- [`terraform/SKILL.md`](terraform/SKILL.md): the Terraform skill. How to keep the code, the state and the live account consistent, and the Terraform traps we hit.

The general Terraform and CI layout (environment roots, module toggles, OIDC, the migrate-then-roll deploy) lives in [`../infra/SKILL.md`](../infra/SKILL.md). This folder does not repeat it.

Account ids, IP addresses, interface and instance ids, bucket names and every secret are left out on purpose. They live in the infra repo and in SSM, not in a public skills repo.

## The outcome

| | Before (2026-10-03) | After (2026-10-09) |
|---|---|---|
| Monthly bill, on demand | about $345 to $360 | about $135 (estimate) |
| ECS hosts | 4 x t3.medium, one empty | 2 x t4g.medium (Graviton) |
| API tasks | 1 (a single point of failure) | 2, one per zone |
| Search | OpenSearch, 2 nodes, 1,310 documents | Postgres |
| Outbound internet | NAT gateway | fck-nat on a t4g.nano |
| Broker discovery | internal NLB | Cloud Map DNS name |
| Database | RDS Multi-AZ | RDS single-AZ, 30-day point-in-time restore |
| Cache and Celery broker | cache.t4g.small | cache.t4g.micro |

The app ended up more resilient than before, not less: the API went from one task to two across two zones while the bill fell by more than half.

Prices were read from the AWS Pricing API and our own Cost Explorer on 2026-10-03. They are estimates for us-east-1 at that date. Re-read them before quoting them anywhere.

## The shape

```
                    Internet
                       |
                Route 53 (apex + www)
                       |
        Application Load Balancer (public, HTTPS, ACM cert)
        /              |                   \
    /api/*         /mqtt (wss)          everything else
      |                |                     |
   API x2           EMQX x1              Frontend x1        <- awsvpc tasks
      |   \            ^                 (Next.js)
      |    \  MQTT 1883 via Cloud Map DNS
      |     \__________/
      |
      +-- RDS Postgres 16, db.t4g.small, single-AZ     <- all reads, all search
      +-- ElastiCache Valkey, cache.t4g.micro          <- cache + Celery broker
                       ^
         Celery worker x1, Celery beat x1               <- bridge-mode tasks

  Private subnets reach the internet through fck-nat (t4g.nano, ASG of one)
  holding the same Elastic IP the NAT gateway had, so partner allowlists hold.
```

One ECS cluster, two EC2 hosts in two zones, everything in private subnets except the load balancer and the NAT instance.

## Every AWS service in use, and what it does for us

| Service | What runs on it | Notes |
|---|---|---|
| **ECS on EC2** | API, frontend, Celery worker and beat, EMQX | One cluster, one capacity provider with managed scaling (target 100) and managed termination protection. |
| **EC2 Auto Scaling** | The two ECS hosts (t4g.medium, min 2, max 4); the NAT instance (ASG of one) | Max 4 is headroom for scale-outs and host moves, not steady state. |
| **ECS-optimised AMI (Amazon Linux 2023)** | Host OS | Looked up by architecture, so moving between x86 and Graviton is a variable change. |
| **Application Load Balancer** | HTTPS for the site, the API and browser MQTT over wss | The only public entry point. Path rules split `/api/*`, `/mqtt` and the rest. |
| **ACM** | The TLS certificate on the ALB (and a CloudFront switch, off) | us-east-1, which is also the region CloudFront needs. |
| **Route 53** | apex and www aliases, health checks | Health checks feed two "unreachable" alarms. |
| **RDS for PostgreSQL** | The database, and search since OpenSearch went | db.t4g.small, gp2, 30-day backups, `pg_trgm` for fuzzy search. |
| **ElastiCache (Valkey)** | Django cache and the Celery broker | Holds about 10 MB. |
| **Cloud Map** | Private DNS name for the single EMQX task | Replaced an internal NLB at about $16 a month. TTL 10 seconds. |
| **VPC** | Public and private subnets in two zones | Private subnets route `0.0.0.0/0` to the NAT instance. |
| **fck-nat** (open-source AMI, not an AWS service) | Outbound internet for private subnets | Replaced the NAT gateway. Details below. |
| **Elastic IP** | The fixed outbound address | Partners (payments, email, KYC) can allowlist it. |
| **ECR** | Images, multi-arch (amd64 + arm64) | Tagged `sha-<commit>` and `latest` as one manifest. |
| **S3** | Terraform state (native locking), app media | |
| **SSM Parameter Store and Secrets Manager** | App env, secrets injected at task start, deploy parameters | CI reads "where things live" from SSM after each infra apply. |
| **IAM with GitHub OIDC** | CI deploys with no stored keys; task and instance roles at runtime | |
| **CloudWatch** | Logs through FireLens, metrics, alarms | The self-hosted Grafana/Loki stack was torn down in June 2026; CloudWatch is what remains. |
| **SSM Session Manager** | A small bastion for read-only database access | No SSH, no open ports. |
| **CloudFront** | Built behind a switch, off | Three switches: create it, move DNS, then lock the ALB to CloudFront's header. |

## What changed, and what each change bought

| Change | Saves about a month | What we gave up |
|---|---|---|
| Four t3.medium hosts to two t4g.medium | $73 | Less spare room. Deploys now have to replace in place (see the skill). |
| OpenSearch removed, search on Postgres | $58 | Nothing measurable at our size. One bug found by comparing live results before switching. |
| RDS Multi-AZ off | $30 | A zone failure means restore or wait, not a 1 to 2 minute failover. Backups and point-in-time restore stay. |
| NAT gateway to fck-nat | $30 | If the NAT instance dies, 1 to 2 minutes with no outbound calls. Inbound is unaffected. |
| EMQX internal NLB to Cloud Map | $16 | Nothing. |
| Valkey small to micro | $9 | Nothing at 10 MB used. The resize replaced the node and dropped whatever Celery had queued at that moment. |

Deliberately not done yet: one-year Compute Savings Plan and RDS and Valkey reserved instances. Commit only after a month on the new shape proves the sizing; committing first locks in the waste. Estimated further saving about $35 a month, price to be re-read before buying.

Considered and rejected: leaving AWS for one VPS plus a hosted Postgres. It would land within $10 to $30 a month of the optimised AWS bill and give up managed backups, rolling deploys behind health checks, and two hosts. Worth revisiting only if a few hours of downtime a year matter less than that money.

## The decisions that made two hosts enough

**Why four hosts existed.** Every task used `awsvpc` networking, which gives each task its own network interface. A t3.medium or t4g.medium has three interfaces, one for the host, so it runs two `awsvpc` tasks however much memory is free. ENI trunking, which lifts that limit, is not supported on t3, t3a or t4g at all (AWS's supported-types list, read 2026-10-03). Five tasks plus deploy headroom made four hosts.

**Bridge mode for Celery.** The worker and beat take no inbound traffic, so they do not need their own interface. Moving them to `bridge` freed two slots. The API, frontend and EMQX stay on `awsvpc` because the ALB and Cloud Map register them by IP.

**Graviton.** t4g.medium has the same 2 vCPU and 4 GB as t3.medium for about a fifth less. That required multi-arch images: the BE and FE workflows build amd64 and arm64 on native runners, push by digest, and join them into one manifest in the approved deploy job.

**Two API tasks, one per zone.** The stability half of the trade. Each task peaked at about 635 MB in 30 days, so 1.5 GB each leaves headroom.

**Live memory per task (2026-10-09):** API 1536 MB x 2, frontend 1024, worker 1024, beat 512, EMQX 512. Total 6144 MB against two hosts that each register 3835 MB (not 4096: the ECS agent and OS keep the rest). It fits, but only just, and that shapes everything about how deploys must work.

## How deploys work on packed hosts

Settings live in Terraform (`modules/ecs-services`, `modules/emqx-ecs`) since Infra PRs #15, #16 and #17, and the BE deploy order since BE #195.

| Service | Deploy (min / max %) | Placement | Why |
|---|---|---|---|
| API (2 tasks) | 50 / 100 | spread by zone, then binpack memory | Replaces one task at a time in the room the old one frees. One task always serves. |
| Celery worker | 0 / 100 | binpack memory | Replaced in place; a stopping worker finishes running jobs, queued ones wait about a minute. |
| Celery beat | 0 / 100 | binpack memory | Same, and two beats never overlap (two beats run every schedule twice). |
| Frontend | 100 / 200 | binpack memory | One task, so it starts the new copy first. It fits in the free room on its own. |
| EMQX | 0 / 100 | none | One node only: two would form a cluster, which needs a commercial licence from 5.9. |

AZ rebalancing is off on the packed services: AWS refuses binpack and a 100% ceiling while it is on.

The backend deploy rolls the API first and waits for its rollout to finish, then rolls Celery. Rolling them together let a Celery task take the room the API had just freed, which added a host that could never empty.

The migration one-off task runs through the API service's capacity provider at 512 MB, not with `--launch-type EC2` at the API's full size. The latter fails silently when no host has room.

## The NAT instance, in detail

- Module `RaJiska/fck-nat/aws` 1.6.1, a t4g.nano, `ha_mode` on: an Auto Scaling group of one, so a dead instance is replaced automatically.
- A static network interface carries the private route tables' default route. The instance's **primary** interface carries the Elastic IP, and that is where traffic leaves.
- fck-nat is given the Elastic IP allocation and claims it at boot. If something else holds the address at that moment (the old NAT gateway, during the swap), the claim fails once and is not retried.
- Check after any NAT change: the address shows on the NAT instance's primary interface, and `curl checkip.amazonaws.com` from inside the VPC returns it.

## Running it

- Every change goes through Terraform in the infra repo: merge to `dev`, then dispatch the infra workflow with `environment=prod`, scoped with `targets` when the change is bounded. Nothing applies on merge.
- Never change production from the console. Several values (Multi-AZ, node types) are in code and the next apply would undo a console change.
- Production writes from a terminal: one command per call, and read the state back after each.
- To retire a host: drain it, wait for 0 tasks, remove its scale-in protection, terminate it with `--should-decrement-desired-capacity`. An Auto Scaling instance refresh does not work under managed termination protection.
- After any deploy, check the host count went back to two.

## Open items (2026-10-09)

- One-year commitments, after a month on this shape.
- CloudFront, the PgBouncer sidecar, service autoscaling and the auth email worker are built behind switches and off. Raise the host group's max to 6 before turning autoscaling on.
- EMQX 5.8.5 is on an end-of-life line; the upgrade to 6.3 is planned as its own window.
- The GitHub production environment gate did not ask for approval on the October infra applies; check its protection rules.

## Sources

- Our costs: AWS Cost Explorer, by service and usage type, April to October 2026, read 2026-10-03 and 2026-10-08.
- Prices: AWS Pricing API, us-east-1, on demand and 1-year no-upfront, read 2026-10-03.
- ENI trunking support: [AWS ECS developer guide, supported instance types](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/eni-trunking-supported-instance-types.html), read 2026-10-03.
- Live state: ECS, EC2 and Auto Scaling descriptions, 2026-10-09.
- The full review, runbook and architecture doc: `.agents/infra-cost-review-2026-10.md`, `.agents/infra-cost-runbook-2026-10.md` and `Infra-Heimly/infra/docs/PRODUCTION-ARCHITECTURE.md` in the Heimly workspace.

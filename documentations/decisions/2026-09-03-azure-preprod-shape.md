---
date: 2026-09-03
status: accepted
tags: [infrastructure, azure, pre-prod, cost]
---

# Pre-prod is one self-hosted Azure VM running the same compose stack

**Context.** Pre-prod moves to Azure (superseding the Contabo/Oracle research in
[[2026-08-27-preprod-hosting]]). Access is now real: Contributor on the
`heimly-dev` resource group in the `infocognyfai.onmicrosoft.com` tenant,
subscription `a327af31-c07a-4e6a-baa7-23b4987084b1`, region eastus. The stack to
host is the full compose set: api, celery, beat, nginx, postgres+PostGIS,
valkey, OpenSearch 3.7, EMQX, plus the frontend apps.

**Decision.** One VM, `Standard_E2as_v5` (2 vCPU, 16 GiB), one 128 GiB Standard
SSD (E10), one Standard static public IPv4, running the same docker compose
stack as local and CI. Images are built in GitHub Actions and pulled by the box,
never built on it. The VM is deallocated between test sessions.

**Why this shape.**

Self-hosting everything is not a preference, it is forced: **Azure has no
managed OpenSearch.** Azure AI Search is a different product with a different
API, not a drop-in for opensearch-py. OpenSearch must run in a container
regardless, and once it does, splitting Postgres and Redis into managed services
only adds bills and drift while leaving the hardest component on the VM anyway.

Sizing is measured, not guessed. `docker stats` on the full local stack totals
~3.9 GiB with OpenSearch alone at 2.67 GiB. Adding a real Postgres, the web,
admin and docs apps, and OS overhead puts the running footprint near 8 GiB. The
development laptop is 15.7 GiB and runs all of it including builds, which makes
16 GiB a verified working size rather than an estimate. 8 GiB is the floor with
no slack and was rejected for that reason.

E2as_v5 at $82.49/mo is the cheapest per GiB of every candidate ($5.16/GiB) and
is $27/mo less than B4as_v2 for the same memory. The stack is memory-bound, not
CPU-bound, so paying for 4 vCPUs buys nothing. E-series also gives sustained
vCPUs rather than B-series burst credits, which suit a box that runs hard in
short sessions rather than idling to accrue credit.

Building in CI rather than on the box is what makes 2 vCPU sufficient. The
laptop has 8 cores and its frontend static-generation phase used 11 workers to
finish in 22 seconds; on 2 vCPU that phase alone stretches to minutes, and three
apps built on-box would make a 15 to 25 minute deploy. Actions builds, a
registry holds, the box pulls. This also mirrors the AWS path (Actions to ECR to
ECS) so pre-prod exercises the real pipeline rather than a special one.

Standard SSD over Premium: Microsoft's own table gives E10 and P10 identical
base IOPS (500) and throughput (100 MB/s). Premium only buys burst headroom and
a 99.9% versus 99% latency target, which a test box does not need, at twice the
price.

**Deallocate, never stop.** On Azure a stopped VM still bills; only a
deallocated one does not. `az vm stop` says so in its own help text, and an
in-OS `shutdown -h` leaves the VM allocated and charging. This differs from AWS
and is the single easiest way to pay full price for a box nobody is using. The
static IP is deliberate so the address survives deallocation and DNS stays
valid.

**Cost.** ~$95.74/mo always on; ~$43/mo with deallocation between sessions
(disk and IP bill regardless, compute does not); plus ~$5/mo for a registry.
All figures verified against the Azure Retail Prices API on 2026-09-03 and
cached in `BE-heimly/.agents/research/azure-preprod-sizing-2026-09.md`.

**Rejected.** Managed Azure services per component (no managed OpenSearch makes
it incoherent). B2as_v2 8 GiB (below the measured working set once three Node
apps run). B4as_v2 (pays for CPU the workload does not use). Premium SSD (same
baseline, double the price). Spot at ~$30/mo (evictable on 30 seconds notice; a
pre-prod that vanishes mid-test costs more in confusion than it saves). Two
nginx containers (only one can hold port 80; one nginx with per-host server
blocks is the same thing without the indirection).

**Revisit when.** Pre-prod needs to be always-on for external testers, which
changes the deallocation maths, or the stack outgrows 16 GiB, at which point the
first lever is a second node for OpenSearch replicas rather than a bigger box.

**Unverified.** vCPU quota for the EASv5 family. `az vm list-usage` returns
empty because the role is RG-scoped, not subscription-scoped. A zero quota
surfaces as a clear failure on first apply and needs a quota request.

---
date: 2026-08-28
status: deferred
tags: [architecture, cost, backend, rust]
---

# Rust deferred: cost forensics beat the language argument

**Context.** Stakeholders reported the AWS "budget" nearly doubled; Dre proposed
Rust for compute-heavy services (documents, PPT) to make infra cost predictable,
replacing "power-hungry" Celery. Stakeholders like Django.

**Decision.** No Rust now. First, cost forensics; then optimize the standing
infrastructure; introduce Rust only if a bounded, isolated service later shows
measured sustained CPU where the saving beats the cost of a second toolchain.

**Why (the numbers, verified 2026-08-28 via Cost Explorer).** Usage was FALLING:
May $424 → Jun $388 → Jul $344 → Aug ~$300 projected. The "doubling" was a
credits artifact: June was the only month cash left the account ($152.95)
because credits fell $153 short; May's jump was the prod stack launching, not
users. August anatomy: ~$93 EC2 hosts, ~$51 RDS (Multi-AZ still on), ~$39
NAT+EBS, ~$29 two load balancers, ~$25 OpenSearch, ~$16 Valkey, ~$10 IPv4.
NAT data processing: $0.52. The bill is ~100% standing hours, ~0% compute work.
Rust makes work cheaper; the work is effectively free; the machines are the
cost. Language change saves nothing here; rightsizing does.

**Shape agreed for later.** IF a rewrite of the document/PPT pipeline shows hot
CPU, build it as an isolated leaf service behind a queue, and Rust becomes a
defensible choice there (contained blast radius, contained hiring risk). Never a
Django-core rewrite.

**Rejected.** Rust now (argument was built on a misread bill; team of ~1 doubles
cognitive load; Heimly is I/O-shaped and its CPU-heavy parts already run native
code under Python).

**Revisit when.** A specific service shows measured, sustained CPU cost, or
credits end and the standing-cost optimizations are exhausted.

Related: [[2026-08-28-infra-remediation-pass]]

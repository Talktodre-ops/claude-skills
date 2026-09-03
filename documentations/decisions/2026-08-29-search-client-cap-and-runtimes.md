# Search client capped at 7.13.4; runtime bumps sequenced

**Date:** 2026-08-29
**Status:** Superseded by [[2026-09-02-opensearch-3-7]]
**PRs:** BE-heimly #105, FE-heimly #85

**Context.** Dependency remediation (plan item I1) cleared the Dependabot
backlog on both repos. On the backend, one bump (elasticsearch 7.13.4 to
7.17.13, taken to unlock urllib3 2.x) would have broken production: prod
search is an AWS OpenSearch 2.11 domain, and elasticsearch-py 7.14+ refuses
non-Elastic servers through its product check. CI could not have caught it,
because CI runs a genuine Elasticsearch service container. It was caught by
querying the live domain engine.

**Decision.** `elasticsearch` stays pinned at 7.13.4 with an explicit hard-cap
comment in requirements.txt. We accept the consequence: urllib3 stays on the
end-of-line 1.26.x, leaving four high advisories (cross-origin header leak on
proxied redirects, and three decompression-bomb variants in the streaming API)
with no available fix. Practical exposure is low because server-side egress
targets a fixed set of trusted providers and an in-VPC search domain, not
attacker-controlled URLs. The clean resolution is a migration to the
opensearch-py client stack, scheduled as its own project rather than smuggled
into a dependency bump.

Runtime versions were checked at the same time. Node 20, which the frontend
Dockerfile runs, reached full end of life on 2026-04-30. Node 24 is the
current Active LTS (security support to 2028-04-30); Node 26 exists but does
not become LTS until October 2026, so it is not a production choice yet. The
GitHub Actions pins (checkout v4, setup-python v5, setup-node v4) target the
retired node20 action runtime and are being force-migrated by GitHub; the
current majors are all v7 on node24.

**Rejected.** Forcing urllib3 2.x under elasticsearch 7.13.4 (the client uses
urllib3 1.x APIs; unsupported combination). Bumping the client and pointing
CI at OpenSearch instead (does not change that 7.14+ refuses the server).
Moving the Dockerfile to Node 26 (not LTS until October).

**Revisit when.** Superseded: the opensearch-py migration shipped (client
3.2.0, django-opensearch-dsl 0.8.0), the 7.13.4 cap is gone, and the engine
is on 3.7 per [[2026-09-02-opensearch-3-7]].

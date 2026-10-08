# Heimly lessons

The things that bit us, written down so they do not bite twice. Companion to the
decision journal in `documentations/decisions/`: decisions record what we chose and
why; lessons record what went wrong or nearly did, and the rule we took from it.

- One lesson per file, named `YYYY-MM-DD-<slug>.md` (the date it bit).
- Frontmatter: `date`, `tags`. Wiki-links `[[like-this]]` to related lessons and decisions.
- Body: **What happened**, **Why it bit**, **The rule**, **How to spot it next time**.
- Facts only: real times, real names, real numbers. Never delete a lesson; if a rule
  changes, say so in the lesson and link what replaced it.

Standing rule for Claude sessions: when something bites, or nearly does, write its
lesson here in the same session and add it to the index.

## Index

- [[2026-08-29-search-client-version-must-match-opensearch]]: A newer Elasticsearch client refuses OpenSearch while CI stays green
- [[2026-10-08-a-leak-test-needs-a-control-and-a-plain-role]]: A leak test proves nothing without a control run and a role RLS applies to
- [[2026-10-08-a-prefix-on-rollback-breaks-every-atomic]]: A statement prefix must never touch transaction control
- [[2026-10-08-compare-live-before-switching]]: Compare old and new against live data before switching paths
- [[2026-10-08-empty-terraform-block-forces-replacement]]: An empty Terraform block that AWS does not store means a replacement on every plan
- [[2026-10-08-environment-secrets-only-reach-environment-jobs]]: GitHub environment secrets only reach jobs that declare the environment
- [[2026-10-08-fck-nat-elastic-ip-boot-race]]: fck-nat cannot claim an Elastic IP the NAT gateway still holds
- [[2026-10-08-indexes-do-not-help-small-tables-or-the-wrong-query-shape]]: An index helps neither a tiny table nor a query it cannot match
- [[2026-10-08-instance-refresh-stalls-under-scale-in-protection]]: An Auto Scaling instance refresh stalls under ECS managed termination protection
- [[2026-10-08-know-where-a-setting-comes-from]]: A setting can come from the client, not the server
- [[2026-10-08-lockfile-regeneration-pulls-brand-new-versions]]: Regenerating a lockfile quietly pulls brand new versions
- [[2026-10-08-measure-thresholds-on-our-data]]: Library defaults are tuned for someone else's data
- [[2026-10-08-never-dry-run-against-production]]: A dry run against production is a real run with a typo away
- [[2026-10-08-parallel-shell-calls-race-on-cwd]]: Parallel shell calls race on the working directory
- [[2026-10-08-rate-limits-behind-a-load-balancer-read-the-balancer]]: An IP rate limit behind a load balancer counts the balancer
- [[2026-10-08-saves-inside-atomic-skip-signal-side-effects]]: Side effects fired inside a transaction miss rows that are not committed yet
- [[2026-10-08-session-state-leaks-through-transaction-pooling]]: Session-level settings leak between users through a transaction pooler
- [[2026-10-08-single-task-drain-delay-is-an-outage]]: A load balancer's drain delay is downtime for a single task deployed stop first
- [[2026-10-08-stale-nginx-upstream-shows-as-cors]]: A stale nginx upstream shows up in the browser as a CORS error
- [[2026-10-08-task-definition-defaults-churn]]: ECS task definitions churn when the config omits defaults AWS fills in
- [[2026-10-08-the-api-container-does-not-reload]]: The local API does not reload Python changes
- [[2026-10-08-the-email-cap-is-the-signup-cap]]: The email provider's daily cap is the sign-up cap
- [[2026-10-08-worktree-test-runner-differs-from-the-api-container]]: A different test runner environment produces failures the code does not have

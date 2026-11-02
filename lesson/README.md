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
- [[2026-10-08-packed-hosts-break-one-off-tasks]]: Packed hosts break one-off tasks and leave rollouts scaled out
- [[2026-10-17-a-test-stand-in-must-outsize-what-it-replaces]]: A load-balancer stand-in that runs out of file descriptors measures the rig
- [[2026-10-17-cheaper-requests-fire-request-counted-limits]]: Make requests cheaper and request-counted limits fire more often
- [[2026-10-17-keep-alive-must-outlast-the-load-balancer]]: The app's keep-alive must outlast the load balancer's idle timeout
- [[2026-10-17-library-defaults-assume-more-cores]]: Library defaults assume a machine you may not have
- [[2026-10-19-review-money-paths-by-asking-who-gains]]: Six money-path defects behind 95 green tests, found by asking who gains if they lie
- [[2026-10-19-a-self-call-needs-two-base-urls]]: A service that calls itself needs an internal URL, a public URL and the internal host allowed
- [[2026-10-19-a-kill-flag-outside-the-kill-tuple-reads-as-on]]: A kill flag with inverted meaning reads as "stop" wherever flags default on
- [[2026-10-19-a-distant-database-makes-round-trips-the-cost]]: Against a distant database the cost is trips, and the slow-request log counts none of them inside atomic
- [[2026-10-19-network-inside-the-lock-stalls-every-write]]: A provider call under a row lock turns the row into a queue
- [[2026-10-19-the-test-run-shares-the-live-cache]]: pytest in the API container shares the live Redis; a busy app leaks into flag tests
- [[2026-10-19-a-rebuilt-test-database-has-no-row-level-security]]: `--create-db` with `--nomigrations` installs no policies, so the RLS test fails
- [[2026-10-19-a-field-named-property-shadows-the-builtin]]: `property = ForeignKey(...)` then `@property` breaks every import
- [[2026-10-19-an-idempotency-key-is-a-uuid-not-a-string]]: A derived key with a suffix is refused as invalid; the mock never checked
- [[2026-10-19-a-build-must-survive-a-reboot]]: Commit in slices; after a reboot bring back postgres-test and resume builders from what is on disk
- [[2026-10-19-a-scoped-upload-endpoint-cannot-serve-another-persona]]: Reuse the service, not the view; a tenant got 404 from the landlord-scoped upload
- [[2026-11-01-the-api-client-already-adds-the-prefix]]: `api` paths start after `/api/v1`; a doubled prefix is a 404
- [[2026-11-02-the-test-run-writes-to-the-shared-buckets]]: dev storage is the shared R2; tests left 11,003 documents and 20 images until a root guard
- [[2026-11-02-a-scan-that-finds-nothing-needs-a-known-positive]]: two dead-code scans returned nothing because of path forms and ugrep flag order
- [[2026-11-02-removing-code-by-pattern-cuts-the-wrong-boundary]]: a decorator left behind, a section comment taken, a method half cut; read every boundary
- [[2026-11-02-a-failed-git-add-stages-nothing]]: one bad path and the chained commit pushed only a rename; read `git status` before committing
- [[2026-11-02-a-client-number-is-not-a-fact]]: photo URLs, video URL and size, and a writable `organization`; check against what we hold
- [[2026-11-02-the-browser-run-finds-what-unit-tests-miss]]: Edge found three assistant bugs the unit tests passed; feed tests the model's real reply shape
- [[2026-11-02-a-reused-test-database-keeps-a-removed-table]]: after removing a model, `--create-db` once or transactional tests fail to truncate
- [[2026-11-02-tidying-on-load-is-not-a-change]]: the wizard adjusts fields as it mounts; a draft's baseline is the first touch

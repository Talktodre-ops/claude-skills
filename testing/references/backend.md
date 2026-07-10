# Backend testing

Async Python (FastAPI or Django), a SQL database, and background workers. The same
principles apply to any stack: exercise the real boundary, isolate data, clean up.

## Unit tests: pure logic first

Pull the decision logic out of the I/O so it can be tested without a database. A
pure function that takes values and returns a result is the easiest thing to test
exhaustively, and the most valuable to get right.

```python
def test_decide_outcome():
    rules = merge_rules({"min_score_gate_enabled": True, "min_score_gate_value": 60})
    assert decide_outcome(90, 0, [], rules) == "advanced"
    assert decide_outcome(55, 0, [], rules) == "held"
    assert decide_outcome(99, 1, [], rules) == "flagged"   # integrity beats score
```

Cover the edges and the precedence: empty inputs, boundary values, and the order in
which rules apply. If the logic is buried in an HTTP handler or a Celery task, that
is a smell; lift it into a function and test that.

## Integration tests: the real boundary

For an endpoint or a query, seed real rows, drive the real path, and assert on real
output. Two clean patterns for isolation:

- **Transaction rollback**: do everything in one session and roll it back at the end.
  Nothing is committed, so the database is left untouched and the test is repeatable.
- **Seed and delete**: when the test must span processes (a live HTTP call the server
  handles in its own session), seed with a commit, run the test, then delete the
  seeded rows in a `finally`. Use unguessable throwaway identifiers.

A standalone async test (no test runner needed) reads clearly and prints a verdict:

```python
async def main():
    async with AsyncSessionLocal() as db:
        org = Organization(name="Test Org", plan="team"); db.add(org); await db.flush()
        user = User(email="t@example.com", role="admin", organization_id=org.id)
        db.add(user); await db.flush()
        result = await some_service(db, org.id)
        assert result.ok, f"expected ok, got {result}"
        await db.rollback()          # leaves the DB clean
    print("RESULT: PASS")
```

## Live HTTP probes

For auth and cross-cutting behavior, hit the running server over HTTP so the whole
middleware stack runs (auth, CSRF, rate limits). Watch the traps:

- A slow or remote database needs a generous client timeout and a warm-up call
  before the timed assertions.
- If the app has a CSRF guard that requires an `Origin` header on unsafe methods
  when a session cookie is present, send it.
- When switching identities in one test, clear the client's cookie jar so a
  leftover session cookie does not authenticate as the wrong user.

```python
async with httpx.AsyncClient(timeout=90) as client:
    await client.get(f"{API}/health")           # warm the pool
    tok = (await client.post(f"{API}/auth/jwt/login", data=creds)).json()["access_token"]
    r = await client.get(f"{API}/api/v1/team/members", headers={"Authorization": f"Bearer {tok}"})
    assert r.status_code == 200, f"{r.status_code}: {r.text[:160]}"
```

## Contract tests

Assert the response shape the frontend depends on. A single test that a profile
endpoint returns `first_name`, `last_name`, `role`, and `avatar_url` is what stops a
model change from blanking a settings page. Keep it at the serializer or schema
level so it is fast.

## Background jobs and async fan-out

Test the job's logic directly (call the function the task wraps) for determinism,
and separately confirm the wiring end to end once: enqueue, let the worker run, and
assert the side effect (a row written, an email queued). Do not assert on a
background side effect synchronously right after the request; it may not have run yet.

## Migrations

A migration is code. Apply it against a real database in CI, confirm the new head,
and confirm the column or table exists with the expected type and nullability. For a
data migration, seed a pre-migration row and assert the post-migration shape. Never
edit an applied migration; add a new one.

## Load and resilience (where it matters)

Put a budget on the paths that carry real traffic (a dashboard aggregate, a search)
and fail the test if a change blows it. Confirm idempotency on anything retryable
(a webhook, a charge) by delivering the same event twice and asserting one effect.
Confirm graceful failure: a downstream outage should degrade, not crash, and should
leave state consistent (finish the transaction or roll it all back).

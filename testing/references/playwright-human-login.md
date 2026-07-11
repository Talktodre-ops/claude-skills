# Human-login UI tests (drive the real app as a person)

Stubbed public specs (fake the API, assert a component renders) are fast and
hermetic, but they cannot catch a broken login, a wrong post-login redirect, a
button wired to nothing, or a control pushed off-screen by a layout change. For that
you need a test that logs in through the **real form** and drives the **real app**
against the **live backend**, the way a person does. Serving software to humans means
testing it as a human uses it.

Use this in addition to, not instead of, the hermetic specs. Run it headed when you
want to watch it; run it headless in CI.

## The shape

1. **Seed a real account, idempotently.** The UI logs in for real, so the account
   must exist, be verified, and be past onboarding, or the flow bounces to a
   verify/onboarding screen. Put a small seed script in the backend (it needs the DB
   + models) and run it in the app container before the spec. Make it upsert by email
   so re-runs are safe. Read the credentials from env with sane defaults.

   ```python
   # backend/scripts/seed_recruiter.py  (run: docker compose ... exec -T backend python scripts/seed_recruiter.py)
   EMAIL = os.environ.get("E2E_RECRUITER_EMAIL", "e2e-recruiter@example.com")
   PASSWORD = os.environ.get("E2E_RECRUITER_PASSWORD", "Recruiter-Demo-Pw-2026")
   # upsert an is_verified, onboarding_completed admin whose org has whatever
   # flags the flow needs (e.g. a consent flag), then commit.
   ```

2. **Log in through the form.** Do not inject a token into localStorage or reuse a
   saved `storageState` for this test: typing into the real form is the point, so
   login itself is under test. Fill the fields, submit, and wait for the post-login
   URL.

   ```ts
   async function login(page: Page) {
     await page.goto('/login');
     await page.locator('#email').fill(EMAIL);
     await page.locator('#password').fill(PASSWORD);
     await page.getByRole('button', { name: 'Sign in', exact: true }).click();
     await page.waitForURL('**/dashboard**', { timeout: 20000 }); // onboarded -> dashboard
   }
   ```

3. **A dedicated project that always runs.** The repo's `authenticated` project is
   gated on CI credentials and reuses a stored session. Add a separate project (no
   `storageState`) that matches these specs and always runs, so they do not depend on
   CI secrets.

   ```ts
   {
     name: 'screening',
     testMatch: /screening[\\/].*\.spec\.ts/,
     use: {
       ...devices['Desktop Chrome'],
       launchOptions: { slowMo: process.env.PW_SLOWMO ? Number(process.env.PW_SLOWMO) : 0 },
     },
   }
   ```

4. **Drive the real screens and eyeball them.** Navigate the flow, open the controls
   a user would (a picker, a dropdown), assert the real UI, and screenshot for the
   cross-viewport eyeball. Keep writes cheap: a create flow that triggers an
   expensive or irreversible side effect (an LLM call, a charge, an email) should
   either be an occasional check or have that side effect stubbed at the service
   boundary, not on every run.

## Watch it run

Headed + slow-motion + one worker, so a single browser window walks the flow at a
human pace on your screen:

```
PW_SLOWMO=600 npx playwright test tests/screening/screening-login.spec.ts --project=screening --headed --workers=1
```

Headless (CI, or when you do not need to watch) is the same command without
`--headed` and `PW_SLOWMO`.

## Gotchas that bite

- **`getByText` is a case-insensitive substring match by default.** A label
  `When a candidate applies` will *also* match a description sentence like
  "What happens *when a candidate applies* to this role", so the locator resolves to
  two elements and strict mode fails, looking like the control is missing when it is
  not. Use `{ exact: true }`, or prefer `getByRole` / `getByLabel`. A failing UI
  assertion is often a selector bug, not an app bug: read the screenshot before
  "fixing" the app.
- **Wait for a state change, not a timeout.** After submit, wait for the post-login
  URL (or a dashboard element), never a fixed sleep.
- **Onboarding / verification gates.** If login lands somewhere other than the
  dashboard, the seeded user is probably unverified or not onboarded; fix the seed,
  not the test.
- **Real backend means real latency.** Give login and first-load generous timeouts;
  the dev backend is a single worker.
- **Leave no residue you cannot re-run over.** Seed idempotently; if the flow creates
  rows, either clean them up or make the assertions tolerant of prior runs.

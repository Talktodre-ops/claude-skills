# Frontend testing

The layers for a React and TypeScript app, cheapest first.

## Type-check and lint (the floor)

Run the type-check and linter on every change and keep them at **zero new errors**.
They are the fastest tests you have and catch a whole class of bugs before a test
runs. Run them where the real dependencies live (inside the app's container or the
project's toolchain), not against a partial local copy.

```
tsc --noEmit
eslint .
```

Pre-existing framework warnings (for example react-refresh on a file that exports a
constant next to a component) are acceptable; do not add new errors. If a warning is
noise, fix the file, do not disable the rule globally.

## Unit and component tests

Use the project's runner (Vitest or Jest) with React Testing Library. Test what the
user experiences, not the component's internals.

- Query by role, label, and text, the way a user or a screen reader finds things.
  Avoid test-ids except as a last resort for a non-semantic element.
- Assert on rendered output and behavior after an interaction, not on state or props.
- Cover the branches: loading, empty, error, and the populated happy path. A list
  component that only has a test for "renders rows" is half-tested.
- Keep fixtures minimal and local. A test should read top to bottom without hunting
  for setup.

```tsx
test('shows the empty state when there are no candidates', async () => {
  render(<CandidatesList />, { wrapper: withQueryClient })
  expect(await screen.findByText(/no candidates/i)).toBeVisible()
})
```

## End-to-end with Playwright

E2e proves a real flow in a real browser across the stack. Keep them few and high
value: the flows a demo would show (sign in, create a role, run the primary action).

Make authenticated specs **hermetic** so they run without live credentials and never
flake on real data. Seed auth into the browser and intercept the API:

```ts
test('settings profile renders for an admin', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('auth_token', 'e2e'))
  const json = (b: unknown) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(b) })
  // Register the broad route first; more specific routes added after win in Playwright.
  await page.route('**/api/v1/notifications**', (r) => r.fulfill(json({ items: [], unread: 0 })))
  await page.route('**/api/v1/auth/me', (r) => r.fulfill(json({ role: 'admin', email: 'a@x.com' })))
  await page.goto('/settings?tab=profile')
  await expect(page.getByText('First name')).toBeVisible({ timeout: 15000 })
})
```

Gotchas that bite:
- **Route precedence**: Playwright matches the most recently registered handler
  first. Register the catch-all before the specific routes, or the catch-all shadows
  them and your page gets the wrong data (often a blank screen).
- **Strict-mode text matches**: `getByText('Team')` throws if two elements match
  (a tab and a heading). Scope it, or match a longer, unique string.
- **Waits**: rely on web-first assertions with a timeout (`toBeVisible({ timeout })`),
  not `waitForTimeout`. Fixed sleeps are the main source of flake.

## Cross-viewport visual harness

Screenshot every changed screen at four widths and **look at the images**. A test
that only asserts an element is present will pass on a blank page; the eyeball step
is the real check.

```ts
const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 834, height: 1150 },
  { name: 'desktop', width: 1440, height: 1400 },
  { name: 'wide', width: 1920, height: 1400 },
]
for (const vp of VIEWPORTS) {
  test(`profile @ ${vp.name}`, async ({ page }) => {
    await stub(page)
    await page.setViewportSize({ width: vp.width, height: vp.height })
    await page.goto('/settings?tab=profile')
    await page.screenshot({ path: `visual-shots/profile-${vp.name}.png`, fullPage: true })
  })
}
```

Save shots to a gitignored directory and read them back. Desktop must fill the
width, mobile must stack, tablet goes two-column.

## Accessibility

Bake in the basics: every interactive element reachable and operable by keyboard, a
visible focus ring, form fields with labels, images with alt text, and sufficient
contrast. An automated axe pass in an e2e test catches the low-hanging violations;
it does not replace a keyboard-only walkthrough of a new flow.

## Guarding the API contract

Type the API responses and derive the frontend types from the same source of truth
as the backend where possible. A contract test (or a shared schema) that fails when
a field is renamed is what stops a backend change from silently blanking a page.

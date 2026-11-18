# Proving a caching change

Caching bugs pass unit tests and fresh browsers. They show up only with a cache
that has history, across a deploy. Prove every change three ways: headers per
response class, a deploy rehearsal in a real browser, and a check on the real
environment after the deploy.

## 1. Headers per class, before and after

List every class the change could touch and record its header before the
change. After the change, compare. One value everywhere means something changed
that used to differ.

```sh
BASE=https://preprod.example.com
for p in / /legal/privacy-policy /sign-in /dashboard; do
  h=$(curl -s -D - -o /dev/null "$BASE$p")
  echo "$p | $(echo "$h" | grep -i '^cache-control' | tr -d '\r') | $(echo "$h" | grep -i '^x-nextjs-cache' | tr -d '\r')"
done
chunk=$(curl -s "$BASE/" | grep -oE '/_next/static/chunks/[^"]+\.js[^"]*' | head -1)
curl -s -D - -o /dev/null "$BASE$chunk" | grep -i '^cache-control'   # expect immutable
```

What to look for:

| Class | Expect |
|---|---|
| Prerendered page | Your page rule; server cache still `HIT` |
| Dynamic or signed-in page | `no-store`, exactly as before |
| Fingerprinted asset | `public, max-age=31536000, immutable`, with the build query |
| Navigation data (`?_rsc=`) | Your page rule. Read it from a real browser, since a hand-made `_rsc` value is redirected |

## 2. Deploy rehearsal in a real browser

Build two production images, A (the code currently live) and B (the change), with different build ids. Serve them on the port the app normally uses (stop the dev server for the run, and start it again after), then:

1. **Fill the cache on A.** Use a persistent browser profile (`launchPersistentContext` with a temp folder), visit the main pages with full loads, then click between them.
2. **Swap the server to B.** Same port, same origin.
3. **Click through the same pages in the same tab,** then again after a normal load of `/`.
4. **Record for every click:**
   - the URL;
   - the build id on the page's scripts;
   - whether an error page or a 404 showed;
   - which clicks became full page loads;
   - errors in the console.
5. **Pass:** every click lands on the right page on build B, with no error page and no 404.
6. **Then run B alone with a fresh profile** and record the header of every navigation response. Copies from A's cache report A's headers, so the first run can't tell you what B sends.

Playwright outline:

```js
const context = await chromium.launchPersistentContext(profileDir, { channel: 'msedge' });
const page = context.pages()[0] ?? (await context.newPage());
page.on('request', (r) => { if (r.resourceType() === 'document') fullLoads.push(r.url()); });
page.on('response', (r) => { if (r.url().includes('_rsc=')) seen.push(r.headers()['cache-control']); });
// serve('A'); visit and click; serve('B'); click again and assert
```

Also check the two recovery nets:

- **Dead link:** a link to a page that doesn't exist, clicked inside the app, reloads exactly once and then stays on the 404 page.
- **Failing chunk:** make one chunk fail during navigation (a one-off 404 for one chunk). The page should reload once and recover. If the chunk keeps failing, the error page shows after one reload with no loop. "Try again" with the chunk back reloads to a working page.

## Traps that hide the bug

- **Request interception switches the cache off.** `page.route` in Playwright, and DevTools "Disable cache", both bypass the HTTP cache, so a rehearsal that intercepts can't reproduce a cache bug. Use interception only for the chunk-failure check, never for the cache rehearsal.
- **A fresh profile has no history.** The bug needs a cache filled by an older build. Firefox looked fine for Dre only because it had no old copies.
- **A hard reload (Ctrl+Shift+R) refreshes only the document.** Navigation fetches after it go through the cache again, so "I hard-reloaded and it came back" is a clue, not a contradiction.
- **Headless browsers don't refetch on focus by themselves.** If a check depends on a tab regaining focus, call `page.bringToFront()`.
- **`pgrep -f deploy.sh` over SSH matches its own command line.** Check for a running deploy with `ps -eo cmd | grep '^[b]ash ./deploy.sh'`.

## After the deploy

Run the header check from section 1 against the real environment, and look at one signed-in or auth page in particular. In the running example, this check caught the weakened `no-store` that the rehearsal had printed without anyone comparing it.

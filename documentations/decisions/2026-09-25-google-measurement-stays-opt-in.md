# Google measurement stays opt-in; our own count is for everyone

Date: 2026-09-25. Status: accepted. Source: Dre, after marketing reported the
GA4 events missing: "for the in-app one, no one should be able to reject the
tracking such that we can see and compare the numbers on google console and
what our own tracking actually says."

## Decision

- GA4 and Google Ads stay behind the cookie banner. A visitor who refuses sends
  Google nothing. The marketing head reads GA4 for the visitors who accepted.
- Heimly's own marketing analytics, in the admin portal's "Marketing analytics"
  section at admin.heimly.ng, counts the same events for every user and cannot
  be refused. It uses GA4's event names, so the two can be read side by side.
- The in-app count comes from server-side records and a first-party ingest that
  stores no identifier in the browser.

## Why

Making GA4 and Ads essential was the first idea. It was set aside because
Article 19 of Nigeria's GAID 2025 requires opt-in for analytics and advertising
cookies and exempts only strictly necessary ones, the published cookie policy
promises opt-in, and Google's EU user consent policy covers the diaspora
visitors from the UK and Europe. Counting our own records needs no cookie, so
the number that cannot be refused is ours, not Google's.

## Revisit when

The admin portal reaches production and the in-app section is built, or the
consent rules change.

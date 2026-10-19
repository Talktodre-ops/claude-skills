# Security: the threat table and the review

Security is the first requirement of money code. Design against the table, then have
someone who did not build it read the code against the same table before merge.

## Threat table

| Threat | Control |
|---|---|
| Forged webhook says "funded" | HMAC over the raw bytes, constant-time compare, 401 and a REJECTED row on failure. And never a webhook alone: before FUNDED, RELEASED or REFUNDED the worker fetches the transaction from the provider and moves on what the API says. |
| Replayed webhook | Timestamp within five minutes; dedupe on delivery id, event id and body hash; transitions refuse a state already passed. |
| Amount tampering | The payer total is fixed in the server-side quote; the client never sends amounts after the quote; a received amount that differs goes to suspense with an alarm, never to FUNDED; the provider's amount must be present and positive. |
| The payer decides the split | Commission from the assignment's terms, recipients from verified payout accounts, account names from the bank's name enquiry. A caller's value that disagrees is refused. |
| An agent redirects the owner's money | Invites for the owner's share go only to the owner organisation's registered contact; the enquiry name must match the owner's recorded name; a verified account is never replaced by a later invite; a change supersedes rather than edits, starts a 24 hour cooling off with no payouts, and notifies the owner organisation; an agent can never create or edit the owner's beneficiary. |
| Someone opens another person's transaction (IDOR) | Every read and action checks object-level access through the app's access rules and organisation scoping; uuids are not a security control; strangers get 404 so existence does not leak; tests per role. |
| A viewer acts for the owner | Accept, cancel, mark delivered and evidence require the right to act for the owner side, not view access. |
| Account takeover then "release" or "change bank account" | Step-up: a fresh six-digit code by email, ten minutes, single use, five attempts, three sends per ten minutes, hashed with the action and the object id so a code for one action never works for another. New-device notice on these actions. |
| Confirm or auto-release past a dispute | `expect_from` on the transition; a stale state is a no-op and the caller answers WRONG_STATE. |
| Double release from a race | Row lock in a fixed order, compare and swap on state and version, unique outbox `provider_ref`; the provider sees one reference. |
| Late payment after a local cancel | Fetch; if paid, suspense plus an alarm and a staff notice; never silently processed. |
| Insider (staff) fraud | Two different staff members for every money outcome (a database check too); staff cannot edit ledger or audit rows (triggers); every staff action audited with IP and request id; separate capabilities for configuration and for dispute outcomes. |
| Leaked provider key | Keys in a secrets store only, loaded at boot, never logged; the live key only in production; the kill switch stops new payments in seconds; webhook secret rotation accepts old and new for a short overlap; the fake's dev secret is refused once the real provider is selected. |
| Bank details leak | Account numbers encrypted (a rotatable multi-key scheme) and shown as last four only; a logging filter masks ten and eleven digit numbers; provider responses stored in `last_error` and `last_response` reviewed before launch for account details. |
| Invite link abuse | Token hashed in the database, single use, seven day expiry, throttled, generic 404 on a bad token, the link only ever emailed to the invited person. |
| Abuse and probing | Throttles on quote, create, invite, payout account and webhook endpoints; webhook body size limit; REJECTED rows store a hash and a short head only (they are append-only and would grow without bound); CSRF on every cookie-authenticated mutation. |
| A stored quote reused | A partial unique index of one live transaction per quote; instalments likewise. |
| Vulnerable dependency | Dependency audit in CI; no new dependencies in the money module without review. |

## The review (before any merge of money code)

Brief a reviewer who did not build it with the code and this table, not with the
builder's conclusions. For every endpoint and every event handler, three questions: who
may call it, what can they put in it, and where does the money go if they lie. Ask them
to quote file and line for each finding, state the concrete input and the wrong outcome,
and rank by severity. Then fix the high findings in the same branch, re-run the live flow,
and only then open the PR. On Heimly this review found six money-path defects in a branch
with 95 green tests.

## Before launch

An external review or penetration test of the payments endpoints and webhooks; the data
protection items (lawful basis and notice for third-party bank details, retention,
minimisation) signed off; alarms on webhook rejections, failed events, dead commands,
reconciliation mismatches and stuck transactions with a named owner. No alarms, no launch.

## Operational flags

`payments` (the surface and direct payments) and `payments_escrow` (the hold) ship OFF and
are turned on by allowlist first. `payments_live` is the kill switch: in the kill-switch
tuple, seeded ON, OFF stops new quotes, payments and renewals, never webhooks, reads or
releases already due. Never introduce a flag whose ON means off.

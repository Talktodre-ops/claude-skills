---
name: payment
description: Integrating Paddle Billing (a Merchant of Record) into a SaaS backend the reliable way, distilled from a real FastAPI + Celery + React system. Load when building, changing, or debugging anything money-related: checkout, subscriptions, one-off/credit purchases, webhook ingestion, invoices/transactions, entitlement gating from plan state, dunning/failed payments, refunds, revenue/MRR, or the reconciliation and dead-letter machinery. Covers the architecture (webhooks as source of truth, an inbox/outbox pipeline on a task queue), the data model, the end-to-end flows, the exact Paddle event + signature details, the edge cases (ordering, duplicates, retries, slow networks, currency), and the tradeoffs. Stack-agnostic in principle; examples use FastAPI + Celery + Redis + Postgres + a React frontend.
---

# Paddle Billing blueprint

How to take money with Paddle Billing without the integration becoming a source
of bugs. Distilled from a real FastAPI + Celery + React SaaS. The design goal is a
system that is boring under load: every state change is event-driven, idempotent,
replayable, and reconcilable, so a dropped webhook, a duplicate delivery, a slow
network, or an out-of-order event never leaves a customer on the wrong plan or the
books wrong.

Money is **integer minor units** everywhere (cents). Never float. Paddle sends
amounts as strings in minor units (`"2900"` = $29.00); parse to `int`, store `int`.

## 1. The one principle

Paddle is a **Merchant of Record**, not a raw processor like Stripe. Paddle owns
the card data (no PCI for you), computes tax/VAT per buyer location, runs fraud
checks, and runs the dunning retries on failed cards. So the job is narrow:

1. Start a checkout.
2. Ingest Paddle's webhooks reliably.
3. Project them into your own tables.
4. Gate entitlements and report revenue from that projection.
5. Reconcile against Paddle to heal any drift.

Everything follows from one rule: **webhooks are the source of truth; your
database is an eventually-consistent projection of Paddle's state; every write is
idempotent.** The corollary that catches people: **never provision a plan from the
client-side "checkout succeeded" callback.** That callback is UX only; the webhook
does the provisioning. A user who closes the tab, or a slow phone, must still end
up correct because the webhook arrives regardless.

## 2. Architecture: an inbox/outbox pipeline, not a new broker

If the stack already has a task queue (Celery + Redis, Sidekiq, BullMQ), that is
the broker. Do not add Kafka/RabbitMQ for this; it buys nothing at billing volume
and adds ops burden. The robust, tidy shape is the **inbox/outbox pattern** on top
of the DB and the queue:

- **Inbox** (a `billing_events` table): the webhook handler verifies the
  signature, inserts the raw event keyed by Paddle's `event_id` (unique
  constraint), enqueues a job, and returns `200` in well under a second. That table
  is the central record of every payment fact: the raw audit trail, the dedupe
  boundary, and the replay source when a handler has a bug.
- **Idempotent workers**: jobs read an event and apply it to projections. Safe to
  run twice; safe to run out of order (see ordering below).
- **Outbox**: your own side effects (receipt email, internal notification,
  entitlement flip) are queued, not done inline, so a mid-way failure never
  half-applies.
- **Reconciliation**: a scheduled job pulls Paddle's current state and re-drives
  dead-lettered events, healing drift from anything the webhooks missed.

Flow: `Paddle -> webhook endpoint (verify + persist + ack) -> queue -> projection
+ entitlement -> (reconcile sweep)`.

## 3. Data model (integer minor units, in the app that owns entitlements)

The billing tables live in the service that owns entitlements. A separate
reporting/admin service should read them **read-only**, never write them.

- `billing_customers`: `org_id` (or user_id) <-> `paddle_customer_id`. One per
  tenant.
- `subscriptions`: `paddle_subscription_id` (unique), owner id, `status`
  (`trialing|active|past_due|paused|canceled`), `price_id`, plan, `quantity`
  (seats), `collection_mode`, `current_period_start/end`, `scheduled_change`
  (cancel/pause at period end), `paddle_updated_at`.
- `transactions`: `paddle_transaction_id` (unique), owner id, `subscription_id`
  (nullable for one-offs), `status`, `amount_total`, `tax`, `currency`,
  `invoice_number`, `billed_at`, `origin` (subscription vs one-off), `items` jsonb.
- `billing_events` (the inbox): `event_id` (unique), `event_type`,
  `occurred_at` (Paddle's), `received_at`, `raw` jsonb, `signature_ok`, `status`
  (`pending|processed|failed|dead`), `attempts`, `last_error`, `processed_at`.
- A `credit_ledger` (append-only, positive/negative entries keyed by the source
  transaction id) if you sell one-off credit/usage packs.

Entitlements read from `subscriptions` + the owner row, never from a live Paddle
call, so the app stays fast and works even if Paddle is briefly unreachable. **A
free tier holds no subscription row.**

## 4. End-to-end flows

**Subscription checkout**
1. User picks a paid plan. Backend ensures a Paddle customer exists (correlate by
   `custom_data.org_id`, never by email), returns the `price_id`.
2. Frontend opens the Paddle.js overlay with the **client-side token**.
3. On the JS success event, the frontend shows "activating" and polls the
   entitlements endpoint. It grants nothing itself.
4. `subscription.activated` / `transaction.completed` arrive -> inbox -> worker
   upserts the subscription and flips the owner's plan + entitlements.

**One-off / credit pack**
- Same overlay, a one-time `price_id`. On `transaction.completed`, the worker adds
  credits to the ledger keyed by the transaction id (idempotent: applying the same
  completed transaction twice is a no-op).

**Webhook ingest** -> `POST /billing/webhooks/paddle`: verify signature,
`INSERT ... ON CONFLICT (event_id) DO NOTHING` (duplicate -> immediate `200`),
enqueue, `200`. No heavy work in the request.

**Reconciliation** (scheduled, e.g. hourly): list Paddle subscriptions/
transactions updated since the last run, compare to the projection, apply anything
missing, and re-drive `status='dead'` events.

## 5. Paddle specifics (verify against developer.paddle.com at build time)

Re-verify these against the live docs before relying on them; Paddle versions move.

- **API base**: sandbox `https://sandbox-api.paddle.com`, live
  `https://api.paddle.com`. Auth `Authorization: Bearer <API_KEY>` (server secret,
  `pdl_sdbx_apikey_...` in sandbox, `pdl_live_...` in production). Send a
  `Paddle-Version` header to pin the API version so an upgrade cannot silently
  change payload shapes.
- **Paddle.js** (browser): the **client-side token** (`test_...` in sandbox) is
  publishable by design. `Paddle.Environment.set('sandbox')`,
  `Paddle.Initialize({ token })`, then
  `Paddle.Checkout.open({ items: [{ priceId, quantity }], customer: { id } | { email }, customData: { org_id, ref } })`.
- **Correlation + idempotency**: attach `custom_data: { org_id, ref }` to
  checkouts/transactions. Paddle has no Stripe-style `Idempotency-Key` header, so
  make create-flows idempotent yourself: check for an existing customer/
  subscription by `custom_data` before creating, and dedupe webhooks on `event_id`.
- **Signature verification** (do this before trusting any webhook):
  - Header `Paddle-Signature: ts=<unix>;h1=<hex>` (h1 may carry multiple values
    during secret rotation).
  - Signed payload = `f"{ts}:{raw_body}"` using the **raw** request body, byte for
    byte (no re-serialization or whitespace changes, or it fails).
  - `h1` = HMAC-SHA256(secret, signed_payload), hex. The secret is the notification
    destination's endpoint secret, `pdl_ntfset_...` (one per destination), from
    Developer tools > Notifications. Compare with a timing-safe equality.
  - Reject if the timestamp is too old. Paddle's SDKs use a 5-second tolerance; see
    the tradeoff in section 8 (clock skew vs replay), and remember the inbox dedupe
    is the real idempotency guarantee.

**Events worth handling** (a subset of Paddle's full catalog):
- Subscriptions: `subscription.created`, `.activated`, `.updated`, `.trialing`,
  `.past_due`, `.paused`, `.resumed`, `.canceled`.
- Transactions: `transaction.completed` (paid: provision packs, record revenue),
  `.paid`, `.payment_failed`, `.past_due`, `.billed`, `.updated`.
- Adjustments (refunds/credits): `adjustment.created`, `.updated`.
- Customers: `customer.created`, `.updated` (keep the mapping fresh).
Store unknown event types in the inbox anyway (cheap audit + future-proofing), and
ignore the rest until a feature needs them.

## 6. Edge cases (the whole point of the design)

**Ordering** Paddle does not guarantee webhook order. Each handler compares the
entity's own `updated_at`/`occurred_at` from the payload and never regresses a
subscription to an older state (`WHERE paddle_updated_at < :incoming`). For two
events on the same subscription, take a row lock or a per-`subscription_id`
advisory lock so workers cannot interleave into a wrong final state.

**Duplicates** At-least-once delivery. Unique `event_id` makes ingest idempotent;
a duplicate returns `200` without reprocessing. Handlers are idempotent too (upsert
by Paddle id; entitlement is a set, not an increment).

**Inbound reliability / your downtime** Ack fast, work async. If you are slow or
down, Paddle retries the webhook with backoff over a long window, so you do not
lose events as long as you eventually `200`. The inbox + fast-ack is what makes
this safe.

**Slow networks / your outbound calls to Paddle** Short connect+read timeouts,
retries with exponential backoff + jitter, capped attempts. Keep outbound calls
off the user's critical path where possible; correlate via `custom_data` so a
retried create never duplicates a customer or transaction.

**Client success never round-trips** Fine by design: provisioning is keyed on the
webhook, not the JS callback. The UI shows "processing" and polls entitlements.

**A webhook is genuinely lost** The reconciliation sweep + an on-demand fetch (when
the client reports success but there is no record within N seconds, fetch the
transaction/subscription by id) close the gap.

**Payment failure / dunning** Paddle retries the card as MoR. On
`subscription.past_due` / `transaction.payment_failed`, mark the owner past_due,
open a grace window, notify in-app + email. On a later `transaction.completed`,
restore. Only after the grace window do you soft-restrict features.

**Refunds / chargebacks** `adjustment.*` records a negative transaction and adjusts
MRR; a chargeback should alert an operator. Never leave a refunded/charged-back
customer on a paid plan.

**Plan changes** Upgrades apply immediately, downgrades and cancellations at period
end (Paddle prorates; apply on `subscription.updated`/`.canceled` at the right time
using `scheduled_change`). Seat changes arrive as item quantity updates.

**Trials** A local `trial_ends_at` aligns to `subscription.trialing`.

**Currency / tax** Paddle bills in the buyer's currency and includes the tax
breakdown; store per-transaction currency + totals. Normalizing MRR to one base
currency needs an FX source, which is genuinely fuzzy: flag it, do not fake it.

**One-off / credit packs** A one-off `transaction.completed` -> ledger, idempotent
by transaction id. A duplicate delivery must not double-credit.

**Replay / backfill** Because raw events are stored, replay to rebuild a projection
after a handler fix, or backfill from Paddle's list endpoints for history.

## 7. Security, secrets, testing

- Secrets in a gitignored env file only, placeholders in the example, never logged
  or committed: `PADDLE_API_KEY` (server), `PADDLE_CLIENT_TOKEN` (browser, low
  sensitivity but still env-driven), `PADDLE_WEBHOOK_SECRET` (`pdl_ntfset_...`),
  `PADDLE_ENV` (sandbox|live), `PADDLE_API_VERSION`, and the `PADDLE_PRICE_*` ids.
  Live values differ from sandbox and are swapped in at deploy. Rotate anything
  that has leaked (chat, logs, a screenshot).
- The webhook endpoint is public but authenticated by signature. Size-limit and
  rate-limit it, and `400` on a bad signature.
- Automated tests **stub Paddle**: sign fixture payloads with a test secret and
  assert the endpoint verifies/dedupes/routes them; assert handlers are idempotent
  by applying the same event twice, and ordering-safe by applying a stale event.
  Do one real sandbox checkout with a Paddle test card as a live check, and mark
  what cannot be verified in-repo (real card flows, live webhooks) as needs-human.
- Local webhook testing needs Paddle to reach your endpoint: a public tunnel
  (ngrok/cloudflared) pointed at a notification destination, or Paddle's webhook
  simulator/replay.

## 8. Tradeoffs (stated, not hidden)

- **Inbox/outbox on the existing queue vs a dedicated broker.** Chose the former:
  durable, DB-transactional, replayable, already in the stack. Cost: a table + a
  scheduled job, not a purpose-built event bus, so very high throughput would
  eventually want partitioning. Rarely the regime for billing.
- **Provision on webhook, not on client success.** Cost: a few seconds of
  "activating" latency. Benefit: correctness under tab-close, slow networks, and
  duplicate/late events. Worth it every time.
- **Signature timestamp tolerance.** Tight (5s, Paddle's default) maximizes replay
  protection but risks rejecting valid webhooks under clock skew; widen only if you
  observe skew rejections, and rely on the `event_id` inbox dedupe as the true
  idempotency guarantee (a replayed duplicate is already a no-op).
- **Merchant of Record (Paddle) vs raw PSP (Stripe).** Paddle removes PCI, tax, and
  dunning work and simplifies global sales. Cost: less control over the checkout
  surface, Paddle's fees, and payouts on Paddle's schedule. For an early-stage SaaS
  that is usually the right trade; a high-volume business optimizing take-rate may
  outgrow it.
- **Modeled revenue until this ships.** If a reporting/admin surface shows MRR
  before real billing exists, model it from plan prices, then switch it to read the
  real `subscriptions`/`transactions` once the projection is trusted.

## 9. Build order

1. Config + secrets; a thin Paddle API client (timeouts, backoff, `custom_data`
   correlation); the signature verifier with a known-vector unit test; the data
   model + migration. No behavior yet.
2. The webhook inbox: verify, dedupe on `event_id`, persist raw, enqueue, fast-ack.
3. Subscription projection + entitlement sync (idempotent, ordering-safe).
4. Checkout initiation (backend ensure-customer + the Paddle.js overlay); success
   UX polls entitlements; only paid plans create a subscription.
5. Transactions + revenue + receipts.
6. One-off / credit packs into the ledger.
7. Failures, dunning, refunds, cancel/downgrade semantics.
8. Reconciliation, dead-letter handling, and observability (webhook lag, failed
   events, drift).

## 10. Non-negotiables

- Webhooks are the source of truth. Never provision from the client callback.
- Verify every webhook signature against the raw body; dedupe on `event_id`.
- Every handler is idempotent and refuses to regress on a stale event.
- Ack webhooks fast; do the work async so Paddle's retries and your downtime never
  lose an event.
- Integer minor units, always. Correlate Paddle entities to your owner via
  `custom_data`, never email.
- Secrets in env, gitignored; sandbox and live strictly separated.

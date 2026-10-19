# The state machine and the messaging between you and the provider

## States

CREATED, AWAITING_PAYMENT, FUNDED, AWAITING_RELEASE, RELEASING, DISPUTED, RELEASED,
REFUNDED, PARTIALLY_REFUNDED, FAILED, CANCELLED. Direct payments: CREATED,
AWAITING_PAYMENT, then RELEASED (settles straight to recipients) or FAILED.

| From | To | Trigger | Who |
|---|---|---|---|
| (new) | CREATED | quote accepted, split locked, payout accounts verified | payer, or the owner side inviting the payer |
| CREATED | AWAITING_PAYMENT | provider transaction created (outbox CREATE succeeded) | system |
| CREATED | CANCELLED | either side cancels, or the quote and invitation expire | user / system |
| AWAITING_PAYMENT | FUNDED | provider confirms payment received (event, then fetch) | provider |
| AWAITING_PAYMENT | FAILED | provider confirms failure or the link expired unpaid | provider / system |
| AWAITING_PAYMENT | CANCELLED | payer cancels before paying | user |
| FUNDED | AWAITING_RELEASE | the owner side marks delivered, or the delivery date passes | user / system |
| FUNDED | REFUNDED / PARTIALLY_REFUNDED | cancel before delivery under policy; provider confirms | staff / provider |
| AWAITING_RELEASE | RELEASING | payer confirms with a step-up code, or the deadline passes | user / system |
| AWAITING_RELEASE | DISPUTED | payer reports a problem before the deadline | user |
| AWAITING_RELEASE / RELEASING | REFUNDED / PARTIALLY_REFUNDED | provider confirms a refund (ruling or cancellation) | provider |
| RELEASING | RELEASED | provider confirms settlement | provider |
| DISPUTED | RELEASING / REFUNDED / PARTIALLY_REFUNDED | agreed outcome with two staff approvals, or the arbiter's ruling; provider confirms | staff / provider |

Add the rows the provider can actually produce (a partial refund from FUNDED, a refund
during RELEASING); a transition the table lacks retries into a dead letter.

## The transition service, the only writer of `state`

`move(txn, to_state, actor_kind, actor, reason, provider_event, expect_from)`:

1. `SELECT ... FOR UPDATE` on the transaction, then participants, then anything else,
   always in that order (no deadlocks). `SET LOCAL lock_timeout = '3s'` so a stuck lock
   fails fast with a retryable error.
2. If `expect_from` is given and the row's state differs, no-op and return the current
   state; the caller answers WRONG_STATE. This is what stops a confirm or an auto-release
   from running past a dispute that landed a moment earlier.
3. Check the table; an illegal move raises and is logged. A repeat of the same move is a
   no-op (duplicate events and double clicks are harmless).
4. Compare and swap: `UPDATE ... SET state = new, version = version + 1 WHERE id = ? AND
   state = expected AND version = v`; zero rows means someone else moved it first.
5. Write the StateTransition (audit), post the journal, write any OutboxCommand, and queue
   the after-commit task with `on_commit`. All in the one transaction.
6. Nothing in here talks to the network. The provider's status, if needed, was fetched
   before the atomic block.

Acceptance before funding: a payer-made escrow transaction waits for the owner side to
accept (the window, the dispute process and a verified payout account), and the payer's
next action is "Waiting for X to accept" until then.

## Inbox: webhooks are facts, not commands

Endpoint: read the raw body, verify the signature over the raw bytes with a constant-time
compare, reject timestamps older than five minutes, deduplicate on the delivery id, the
event id and a body hash, insert the ProviderEvent (raw body exactly as received, the
signature headers, `signature_valid`), return 200, then queue processing on commit. A bad
signature is stored as REJECTED (a hash and a short head of the body only, since rejected
rows are append-only and unbounded) and answered 401.

Processing (`process(event)`):
- Claim with a PROCESSING status and a claim time, re-takeable after ten minutes, so a task
  and the sweeper never handle one event twice.
- Parse into a normalised event (PAYMENT_RECEIVED, PAYMENT_FAILED, SETTLED,
  SETTLEMENT_FAILED, CANCELLED, REFUNDED, DISPUTE_STAGE, UNKNOWN). Unknown is stored and
  marked IGNORED, never dropped.
- Match the transaction by reference. Before FUNDED, RELEASED or REFUNDED, fetch the
  transaction from the provider and move on what the API says; require the provider's
  amount to be present and greater than zero, never fall back to the webhook's amount.
- A received amount different from the expected total goes to suspense with an alarm,
  never to FUNDED. A payment that arrives after a local FAILED or CANCELLED is fetched; if
  the provider says paid, it goes to suspense with an alarm and a staff notice.
- Out-of-order events (SETTLED before PAYMENT_RECEIVED) are held and retried. Failed or
  cancelled events are applied only when the provider's status agrees.
- Safe to run any number of times on the same event.

## Outbox: commands to the provider

OutboxCommand rows (CREATE, RELEASE, RAISE_DISPUTE, RESOLVE_DISPUTE, CANCEL,
FETCH_STATUS) with a unique `provider_ref` so a resend is recognised, PENDING → SENDING →
SUCCEEDED or FAILED with backoff (1m, 5m, 15m, 1h, 6h) then DEAD with an alarm. A provider
409 on CREATE means it exists: fetch and continue. A dispute's funds lock is queued in the
same transaction that moves to DISPUTED, so it is never skipped. A second proposal after an
approved outcome is refused, so there is one resolve command.

## Sweepers (tasks registered as scheduler rows by migration, acks_late, idempotent)

Every minute: inbox retries and outbox sends. Every five minutes: auto-release past the
deadline. Every fifteen: release reminders, stuck-transaction polls. Daily: reconciliation,
quote and invitation expiry. The after-commit catch-up re-runs any transition whose task
never stamped it after two minutes.

## Side effects after commit

Notifications, emails, the system line in a conversation and the money metrics run in one
task per transition, queued on commit, idempotent through a single stamp on the transition
(the only update the append-only rule allows). The request returns as soon as the state is
committed. Step-up code emails and invitations are tasks too.

## Idempotency at the edge

A required `Idempotency-Key` header on every mutation (quote, create, accept, pay,
delivered, confirm, cancel, dispute, evidence, payout account). The scope folds in the
endpoint and the caller; the same key with the same body returns the stored answer; the
same key with a different body is 409; a repeat while the first is running is 409. The key
is a UUID generated once per client attempt, reused on a retry after a dropped connection,
and never derived from another key. The client side has one guard hook that drops a
same-instant duplicate and only settles the attempt that was sent.

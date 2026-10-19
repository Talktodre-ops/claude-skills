---
name: payment-infrastructure
description: Blueprint for building payment infrastructure inside an existing product when a partner holds the money: escrow (hold, confirm, release, dispute, refund), direct split payments, subscription renewals, payout accounts for recipients who may not be on the platform. Distilled from a real Django + Celery + Postgres + Next.js build. Load when designing or building a money path, a ledger, a webhook inbox, a command outbox, a provider adapter, a fake provider for testing, or when reviewing money code for who-gains defects. Covers source of truth, the append-only ledger, the state machine, messaging between the app and the provider, idempotency, the Money screen, the security threat table, and the mistakes that bit. Stack-agnostic in principle; the companion `payment` skill covers a Merchant of Record (Paddle) subscription integration.
---

# Payment infrastructure blueprint

How to build money movement into a product that is not a bank, so that every naira is
accounted for, no user action can put money in the wrong place, and the system is boring
under load. Distilled from Heimly's payments and escrow build (Payscrow for the hold,
Paystack for direct payments and card renewals; Django, Celery, Postgres, Next.js), and
from the review and live runs that found what the first build got wrong.

Read `references/ledger.md`, `references/state-machine-and-messaging.md`,
`references/providers-and-fakes.md` and `references/security-checklist.md` for the
detail. This file is the shape and the rules.

## 1. The seven principles

1. **You do not hold the money.** A licensed partner holds it (a processor, an escrow
   provider whose bank holds the funds, a bank). You instruct and you record. There is
   never a balance a user can fund or withdraw, and the word "wallet" never appears beside
   held money. The user-facing surface is a window onto money the partner holds: paid,
   held, received, each row a transaction with its state and next action, totals that are
   sums of rows and never a balance.
2. **The database is the record.** Every state change, its audit row, its ledger journal
   and any command to the provider are written in one database transaction. The queue is
   only a trigger; sweepers recover anything a lost task leaves behind. No second broker,
   no second service, no second source of truth.
3. **Nothing is funded, released or refunded on your say-so.** A user action sets an
   in-between state (RELEASING) and queues a command. The provider's confirmation moves the
   money state, and never on the webhook alone: the worker fetches the transaction from the
   provider's API and moves on what the API says. A forged or replayed webhook is then noise.
4. **Money is integer minor units with a currency**, in a frozen value type, converted to
   decimals only at the API edge. Participants' amounts plus the provider's fee equal the
   payer's total, and the database checks it.
5. **Append-only.** Journal entries, journal lines, state transitions and raw webhook
   bodies are never updated or deleted, enforced by database triggers so a bug or a staff
   shell cannot rewrite history. Corrections are reversing entries.
6. **Every write is idempotent and every action is guarded.** A client-generated
   idempotency key (a UUID, one per call, never derived) on every mutation; unique
   references towards the provider so a resend is recognised; transitions that are no-ops
   when repeated; events deduplicated on delivery id, event id and body hash.
7. **Whoever pays never decides how the money splits.** Recipients, commissions, account
   names and amounts come from the system's own records (assignments, verified payout
   accounts, the bank's name enquiry), never from the request body.

## 2. The shape

```
Web / Admin ──HTTP──▶ API (one walled-off payments module)
                        │  one DB transaction per action:
                        │  state change + audit + ledger + outbox row
                        ▼
                    Postgres  ◀── the record of everything
                        │
            task queue (trigger only; sweepers recover)
               │                           ▲
     send outbox command             process inbox event
               ▼                           │
      provider(s) ────webhook────▶ /webhooks/<provider>/  (verify, store raw, 200)
               ▲
     reconciliation: status polls + daily compare
```

- **One module owns money.** Models, provider calls, webhooks, ledger, tasks. Other code
  reaches it only through a small API of plain functions (`create_quote`,
  `start_transaction`, `transaction_summary`), enforced by an import contract in CI. It
  tells the rest of the app what happened through events written in the same commit;
  it never reaches into other modules' internals beyond a listed set of entry points.
- **One generic transaction** for rent, sales (in full or instalments), one-off
  payments and service jobs, with a `kind`, a `route` (ESCROW or DIRECT) and links to the
  domain objects. The transaction never names a provider; the adapter does.
- **Quotes are immutable and short-lived.** A quote snapshots the fee tier, the
  provider's own fee answer and the resulting amounts; a transaction is created only from
  an unexpired quote. Fee percentages and thresholds are configuration rows, never code.
- **Beneficiaries are verified bank accounts**, owned by an organisation or an invited
  person, with the account name from the bank's name enquiry, encrypted at rest, last four
  digits only in any API. A change creates a new row and supersedes the old; a participant
  keeps the row it was created with.
- **Side effects run after the commit, in a task**, stamped once, with a catch-up sweeper.
  No network inside a transaction: fetch from the provider first, then lock and write.

## 3. The flow, as the people see it

Payer side: quote (direct or protected, with the breakdown: agreed amount, platform fee,
protection fee, total, who receives what), pay at the provider, "held safely" with the
sentence that names who gets it and when, "Mark as handed over" by the other side starts
the confirmation window, "Confirm and release" with a fresh emailed code, or "Report a
problem" which locks the funds. Recipient side: accept the protected payment (it binds
them to the window and the dispute process), add a payout account once, see "Paid out".
Silence until the window ends releases the money. Disputes: the platform's own people
first, inside the provider's evidence window; an agreed outcome needs two different staff
members; otherwise the provider's arbiter rules.

Every sentence on screen says who pays, who receives, how much, and where the money is
right now. "Held safely" before "escrow". Never "we hold the money".

## 4. Build order

1. Contract first: API shapes, flags, the fake provider, the house rules, in one file
   every builder reads; the backend owns it and changes it there before changing code.
2. Models, value types, constraints and triggers; the ledger; the transitions service.
3. Inbox, outbox, sweepers; the provider protocol with a fake that behaves like the real
   one and signs real webhooks to your own endpoint; the real adapter written from the
   vendor document and marked where it is an assumption.
4. Beneficiaries with encryption, name enquiry and invites; quotes, fee tiers, policies.
5. Transaction endpoints and actions with object-level permissions and idempotency;
   step-up codes for release and payout changes.
6. Disputes and the admin surface (two-person outcomes, retries, reconciliation).
7. Integration with the domain (rent books, offers, conversations) through events.
8. Reconciliation, metrics and alarms; no alarms, no launch.
9. Screens, with real screenshots at desktop and phone, first mocked then on the real
   stack end to end.
10. A read-only review of the money paths by someone who did not build them, briefed
    with the threat table, before any merge.

## 5. Non-negotiables

- No float. No balance. No hold on a processor whose terms forbid escrow.
- No state set by a webhook alone; no FUNDED, RELEASED or REFUNDED from a user action.
- No network inside a transaction; no side effects on the request path.
- No amount, recipient or account name taken from the caller.
- No provider fee computed locally when the provider will quote it.
- No endpoint without object-level access checks; uuids are not a security control.
- No kill switch whose ON means off: it ships ON, OFF is the emergency action, and it
  never blocks webhooks, reads or releases already due.
- No merge of money code without the review in step 10 and the live run in step 9.

## 6. What bit us (one line each; the lessons folder has the detail)

- A payer could set the agent's commission; the fix is the assignment's terms, never the
  request.
- An agent could invite their own email as the owner's payout account and the bank name
  was matched against the typed name; the fix is owner-only recipients and a match
  against the owner's recorded name.
- The processor's split was tucked into `metadata`; processors ignore metadata.
- A payment landing after a local cancel was marked processed and dropped; it goes to
  suspense with an alarm.
- A confirm read the state on an unlocked copy and could release past a dispute; pass the
  expected state into the transition.
- A provider fetch inside the row lock stalled every write; fetch first, then lock.
- Side effects on the request made each write as slow as the slowest email; move them to
  a stamped task after commit.
- A kill flag with inverted meaning read as "stop" wherever flags default on.
- A self-call needs an internal URL, a public URL and the internal host allowed.
- An idempotency key derived from another is not a UUID.
- A model field named `property` shadowed the builtin and broke every import.
- An upload endpoint scoped to one persona cannot be borrowed for another; reuse the
  service, not the view.

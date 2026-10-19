# The ledger: source of truth for every minor unit

## Why a ledger and not a status column

A status column says where a transaction is. A ledger says where every unit of money is,
at every moment, and lets you prove it: the payer's money left, the provider holds it, the
fee went to the provider, the owner is owed, the platform earned. When the provider's
report and yours disagree, the ledger is what you reconcile against. Balances are sums of
lines with an index, never stored.

## Money

- A frozen value type: integer minor units (kobo, cents) plus a currency code. Adding two
  currencies raises. No floats anywhere; decimals only at the API edge, where amounts are
  strings with two decimals (`"6500000.00"`).
- Database columns are big integers in minor units with a `currency` column and CHECK
  constraints: non-negative, and for a transaction, recipients' amounts plus the provider
  fee equal the payer total.

## Accounts

Per transaction: `payer`, `held_at_provider`, `provider_fees`, `owner_payable`,
`agent_payable`, `platform_revenue`, `refunds`. One global `suspense` for money that
arrived in a form you did not expect (a different amount, a payment after a local cancel).
Unique `(transaction, account kind)`.

## Journals

A journal entry per transition, lines that sum to zero. Postings for an escrow transaction:

| Transition | Lines (minor units) |
|---|---|
| FUNDED | payer −total; held_at_provider +(total − provider fee); provider_fees +fee |
| RELEASED | held_at_provider −(total − fee); owner_payable +owner; agent_payable +agent; platform_revenue +platform |
| REFUNDED | held_at_provider −refund; refunds +refund (the provider's fee is not refunded) |
| PARTIALLY_REFUNDED | the refund lines plus the release lines for the remainder; the refund comes off the owner's share first, then the agent's, then the platform's |
| Direct RELEASED | payer −total; owner_payable, agent_payable, platform_revenue, provider_fees by their amounts |

Rules:
- A DEFERRABLE INITIALLY DEFERRED constraint trigger checks at commit that every
  journal's lines sum to zero. The posting service checks it too; the trigger is for the
  day the service has a bug.
- Triggers reject UPDATE and DELETE on journal entries, journal lines, state transitions
  and the raw body of stored webhooks. Append-only is a database rule, not a convention.
  The one allowed change is the single stamp of "side effects done" on a transition.
- Corrections are reversing journals, never edits.
- Suspense postings use a short fixed kind with the reference in the memo; a kind built
  from a long reference truncates to the same string and collides on the unique index.
- A unique index of (transaction, kind) stops a repeated posting; a repeat posts nothing.
- Settlement confirmations per recipient stamp the participant's `settled_at`; the
  reconciliation job compares those with the provider.

## Reconciliation

Daily, for every transaction touched that day: fetch the provider's view, compare state,
amounts and settlements, write a run with each mismatch, alarm on any. For a direct
payment, a released transaction whose provider status shows no split is a mismatch. Stuck
transactions (no event for thirty minutes in a non-final state) get a status fetch every
fifteen minutes.

## What the Money screen reads

The list and detail are a read model over transactions, participants, transitions and
journal lines: `state_label`, a plain `state_line` per role ("Your ₦6,500,000 is held
safely. It goes to Okafor Properties when you confirm you have moved in."), `next_action`
per role, the breakdown, the timeline from transitions, totals as sums. Payment state is
never cached long on the client; a push only nudges a refetch and the API answer is the
truth. Prefetch participants, disputes, photos and the timeline so a list is a handful of
queries, not seventy.

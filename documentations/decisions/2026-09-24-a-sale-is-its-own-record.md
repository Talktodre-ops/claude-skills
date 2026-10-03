# A sale is its own record, with a plan, six steps and the rent pipeline

Date: 2026-09-24. Status: accepted. Source: Dre, approving the Home design
review ("I want the entire work done, from sales to rental"), with the stage
model supplied by the Home Rent and Buy design. Supersedes
[[2026-09-19-sale-agreements-keep-their-model-for-now]].

## Decision

`rent_ops.Sale` holds a sale: property and unit, the seller organisation, the
buyer (a user, or a name, email and phone), the offer and the agreement it came
from, the price, a status and the buyer's lawyer. Its status is `OFFERED`,
`ACTIVE`, `COMPLETE`, `CANCELLED`, `DECLINED` or `LAPSED`.

It is created when the seller sends the sale offer, so the buyer sees real
figures before confirming, and it moves with the offer: accept to ACTIVE,
reject to DECLINED, expiry to LAPSED.

Six steps, each done as a fact Heimly witnessed or a claim somebody made by
name: agreed, checks, agreement signed, deposit in, paying the rest, handed
over. COMPLETE needs both the last payment and the handover.

Money is a finite plan of instalments (a deposit, then numbered payments) that
sums to the price. `Payment`, `PaymentAllocation` and `Receipt` serve rent and
sales alike: a payment belongs to a tenancy or a sale, an allocation settles a
period or an instalment. Sale receipts are `SR-` numbered per organisation.

`Lease` stays the agreement document for a sale, the way it is for a let. One
predicate replaces the string comparisons on `"Sale Agreement"`.

## Why

The trigger the superseded record named has happened: sales now need
completion steps, a buyer record and staged payments, and the design gave the
stage model the modelling debt note said to wait for.

The sale lives in `rent_ops`, not `property` as the older proposal had it,
because it shares the report, confirm, allocate and receipt flow, the scoping
helpers, the flag and the document rail. A second pipeline would drift from the
first within a round.

Creating the sale at offer time rather than at acceptance keeps one list for
the seller (offers out and sales in progress are the same rows) and lets the
buyer's confirm screen read the plan from the record it will become.

## Rejected

- Generating instalments from a cycle, the way rent periods are. A plan is a
  negotiated list with an end; a cycle recurs forever.
- A separate `SalePayment` model. Two pipelines, two sets of bugs.
- Reminders and late fees on instalments. A late instalment is a conversation
  between the buyer and the seller, not a nudge from an app.

## Revisit when

Escrow arrives and Heimly starts holding sale money, or a seller needs a plan
shape a list of dated amounts cannot express.

# Past homes show only what Heimly knows

Date: 2026-09-24. Status: accepted. Source: Dre: "if we need some backfill, we
should do it but we should make sure that we render the information
accurately."

## Decision

Rental agreements that ended before Rent Ops, with no tenancy, become ended
tenancies carrying only what the agreement says: the place, the dates, the rent
and the service charge. Heimly never tracked their money, so they have no
schedule and never show money owed anywhere, owner side included. They read
"Rent was N300,000 a year. No payments recorded on Heimly." An existing
tenancy for the same person and place is enriched rather than duplicated.

Legacy sale agreements become sales with no plan, saying so, and the seller can
add one.

Both run as a dry run command first and a reversible, idempotent data migration
after review.

## Why

A backfilled past home with a schedule would show a year of unpaid rent that
was almost certainly paid. The only honest statement about money Heimly never
saw is that it never saw it.

## Revisit when

Owners start importing historical payments, at which point a past tenancy can
carry a real ledger.

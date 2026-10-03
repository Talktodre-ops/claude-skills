# Home quotes what is owed now, cycle by cycle, on a monthly schedule

Date: 2026-09-24. Status: accepted. Source: the Home review, where a yearly
tenant paying N8,500,000 was told N708,333.33 was due.

## Decision

The schedule stays monthly whatever the cycle. What people are told changes.
One function computes, for a tenancy:

- a cycle is the run of monthly periods from one cycle start to the next, and
  it falls due in full on its cycle start's due date;
- **owed now** is everything outstanding in cycles already due;
- **next due** is the first cycle not yet due, less anything received on it;
- **paid through** is the end of the last fully covered period.

The tenant's Home and the owner's tenancy record both read it, so the two sides
quote one number. Reminders use the same figures. The rent roll's month lens is
unchanged. For monthly, weekly and daily cycles the figures equal the old ones.

## Why

The monthly schedule is right for the ledger: it keeps part payments, credit
carried forward and a tenancy ending mid cycle truthful at once. It is wrong as
a headline, because a yearly rent is paid once, up front. Telling a tenant a
monthly fraction, with kobo, is telling them something no landlord asked for.

## Rejected

Moving every period's due date to its cycle start. It would make the obligation
right everywhere at once, but it rewrites due dates under settled periods and
changes the month view the owner's rent roll is built on. Fixing the quote fixes
what people read without touching what the ledger means.

## Revisit when

An owner asks for the rent roll itself to show cycle obligations rather than
monthly accruals.

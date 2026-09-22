# One noun for a let: the tenancy, with the lease demoted to its agreement

Date: 2026-09-19. Status: accepted. Source: Dre, locking in the Rent Ops
consolidation proposal.

## Decision

A let is one record: `rent_ops.Tenancy`. It holds who is in which unit, from
when, at what rent, on what cycle, with what schedule, arrears, receipts and
reminders.

The other two models do not merge into it wholesale:

- **`tenant.RentedProperty` retires into it.** It holds nothing a tenancy does
  not: property, tenant, start date, end date, active flag. Every row becomes
  a tenancy and the model goes.
- **`tenant.Lease` is demoted to the agreement**, not the occupancy. It keeps
  the terms as signed, the signers, the documents, the review state and its
  own lifecycle, and it points at the let it created. It does not keep a
  parallel idea of the rent.

**Sale agreements leave.** `Lease` carries both lettings and sales today, with
the agreement type stored as a string and an `is_sale_property` branch
deciding what to say to people. A sale has no rent, no cycle and no arrears.
It becomes its own record against the property, and it never appears on a rent
roll.

So: three models in, one let plus one agreement plus a sale record out.

## Why the lease is not simply folded in

A lease exists before anybody occupies anything, as an offer awaiting a
signature, and it goes on existing after the occupancy ends, as the thing that
proves what was agreed. It has its own states (pending, active, expired,
terminated, rejected) that are about a document, not about a person living
somewhere. Folding it into the let would give one row two lifecycles, and the
first renewal would need two rows anyway.

The rule that keeps them honest: **the let owns the money, the agreement owns
the terms as signed.** Where they disagree today (rent amount, dates, cycle),
the let is the source of truth and the agreement is the historical record of
what was promised.

## What this fixes, which is the point

Lease acceptance already creates an occupancy record. It creates the wrong
one. `LeaseService._create_rental_record`, called from the accept path, writes
a `RentedProperty`: property, tenant, dates, active. The money system cannot
see it, so the rent roll stays empty, the tenant's My rent stays empty, and a
landlord who has just finished the paperwork is asked to type the tenant, the
rent, the cycle and the dates into Add tenancy by hand.

The seam is one function. It becomes the place a let is born.

## How it is built, in order

1. **The join.** `_create_rental_record` creates or updates a `Tenancy` from
   the lease, with its schedule, first due date and reminders set, and a real
   `Tenancy.lease` foreign key rather than the `source_ref` string the
   backfill left. The application approval path gets the same treatment.
   Behind the `rent_ops` flag, so nothing changes for anyone until it is on.
2. **The occupancy check.** `tenant/managers/maintenance.py` decides whether a
   tenant may log a maintenance request by asking `RentedProperty`. It asks
   the tenancy instead.
3. **The backfill.** Every `RentedProperty` without a matching tenancy becomes
   one, the way migration 0003 did for leases. Verified before anything is
   dropped.
4. **The retirement.** `RentedProperty` model and admin go, table last.
5. **The split.** Sale agreements move out of `Lease` into their own record
   against the property.
6. **The screens follow**, as set out in
   `.agents/rent-ops-journey-and-consolidation.md`: the landlord and agent
   sidebar from thirteen items to eight with Rentals as the merge, and the
   tenant's three pages to one Home.

Steps one and two are worth shipping alone. Step five should not start until
the sale flows have a place to go.

## Consequences

A landlord who signs a lease through Heimly gets a rent schedule without
typing anything, and the tenant sees their rent the same minute. That is the
moment the product either feels joined up or does not.

Two records will briefly hold the same rent figure, between step one and the
point where the agreement stops carrying its own copy. The let wins any
disagreement, and the UI reads the let.

Anything still reading `RentedProperty` breaks at step four, which is why step
two is separate and comes first.

## Supersedes

Nothing directly. It settles the open question left by the Rent Ops round,
where the D2 decision unified documents but occupancy was left with three
models.

## Amendment: the noun is Tenancy, not let

Added 2026-09-19, later the same day, during the Portfolio and documents
round. Source: Dre.

The name changes. Everything else in this record stands.

"Let" was the customer's word for the relationship and `rent_ops.Tenancy` was
the schema's, and this record picked the customer's. In practice the product
now says one and the code says the other, which is exactly the split this
round exists to close. The word of record is **tenancy**, in the interface as
well as in the model.

So: the Portfolio tab is Tenancies, the action is Add a tenancy, the drawer
ends a tenancy, and every empty state, toast, confirmation, aria label and
notification body says tenancy. The model was always `Tenancy` and does not
move.

Two things deliberately do not change. URL parameter **values** stay as they
are, so `?view=lets` still resolves and links already sent in notifications
keep working: renaming what a link carries breaks things that were sent
before the rename, and the word a person reads is what mattered here. And the
filename of this record stays as it is, because the journal's wiki links
point at it.

The substance, one record for one relationship with the agreement demoted
beside it and sales leaving, is untouched. Only the name is superseded.

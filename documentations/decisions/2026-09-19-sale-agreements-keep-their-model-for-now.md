# Sale agreements keep their model for now, and leave the rent roll by guard

Date: 2026-09-19. Status: accepted. Source: the Rent Ops one-let round,
stopping at step five as `.agents/rent-ops-one-let-loop.md` allows.

## Decision

`tenant.Lease` keeps carrying sale agreements. The model is not split in this
round. What ships instead is the outcome the split was wanted for:

- A sale never becomes a let. `rent_ops.services.lease_join.let_for_lease`
  refuses an agreement whose `document_type` is "Sale Agreement" or whose
  property `purpose` is `SALE`, so a sale cannot reach a rent roll however it
  was recorded. Both signals are read, because either one alone has been wrong
  in the data before.
- A sale leaves the rent surface. Lease and Sales is off the landlord and
  agent sidebar once `rent_ops` is on, and sales are reached from Properties,
  which is where a deal on an asset belongs.

## Why the split did not happen

[[2026-09-19-one-noun-for-a-let]] made the split step five and said plainly
that it "should not start until the sale flows have a place to go", and the
loop brief said to stop and report rather than half-split a model that carries
signed documents. Both conditions bit:

- The place sales now have is a screen, not a model. Moving the letting half
  into Rentals was the work of this round; giving sales their own record needs
  its own surface, not a borrowed one.
- The blast radius is not the model. It is `LeaseDocument`, `LeaseSigner`,
  `Offer.renewal_of_lease`, the lease views and serialisers, the leasing
  screens on two personas, and a data migration of rows that are somebody's
  signed agreement. A half-applied split there loses paperwork.
- The round already carried the join, the retirement of `RentedProperty`, the
  notification routing and the screen collapse. Adding a signed-document
  migration on top would have been the thing that made it unreviewable.

## Consequences

`Lease.document_type` stays the discriminator, which means the string is still
load-bearing and a row with a blank `document_type` on a `SALE` property is
still caught only by the property. The guard reads both, so nothing reaches a
rent roll, but the modelling smell is unchanged.

The next round can do the split on its own, against a Sales screen that now
exists, with the rent surfaces already off `Lease`.

## Revisit when

Sales grow anything a letting does not have (completion milestones, a buyer
record, staged payments), or the next time somebody has to add an
`is_sale_property` branch to a function that should not know about sales.

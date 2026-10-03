# A payment report carries evidence, and both sides can open it

Date: 2026-09-24. Status: accepted. Source: Dre, on setting up for escrow:
"user can use outside payment but upload receipt on Heimly as record, the
receipt get seen by both property owner and every one involved and the record
get created."

## Decision

- A tenant or buyer cannot send a payment report without a transfer reference
  or a proof file. A proof file alone is enough; a note is optional.
- The proof is visible to the person who reported it, the owning
  organisation's full access roles and the agents assigned to the property,
  and to nobody else. Owners get a proof viewer on every payment that has one.
- Every payment records how the money moved relative to Heimly. Today that is
  always directly to the owner; the field exists so escrow can add its own
  value without touching old rows.
- Accepting a rental offer and telling Heimly about the move in payment is one
  step. The owner confirms it like any other report.

This does not start escrow ([[2026-08-28-escrow-start-deferred]] stands). It
shapes the records escrow will extend.

## Why

A report with nothing in it asks the owner to trust a sentence. A reference or
a photo is what they check against their account, and requiring one of the two
turns most confirmations into a single glance. Requiring both would turn away a
cash payment, which has neither a transfer reference nor always a receipt; for
cash the reference field names who took the money.

## Revisit when

Escrow lands and Heimly holds the money, at which point evidence for escrow
payments comes from the payment provider rather than from the payer.

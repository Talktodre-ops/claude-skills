---
date: 2026-11-01
status: accepted
tags: [listings, fees, sale]
---

# Sale listings carry fees, but never a caution deposit

## Context

Dre opened a sale listing and found service charge, agency, legal and the other fees "gone" from the Details step. They had always been rent-only: the FE field rule showed fees only when the purpose was RENT, and the BE serializer refused fees on anything else.

## Decision

A sale keeps service charge, agency, legal and other fees; a percentage fee is a share of the price, and a one-off fee is paid on purchase. A caution deposit is refused on a sale (400, "A caution deposit is for a listing to let. Remove it from a sale.") and is dropped when a listing turns into a sale, in the serializer and in a wizard effect. The move-in breakdown becomes "What it takes to buy" and "Total to buy", with the price as its first line and yearly charges starting at nothing.

## Why

Buyers in Nigeria pay agency and legal fees on top of the price, and estates bill a service charge after purchase; hiding them made a sale look cheaper than it is. A caution deposit only makes sense when something is handed back at move-out, which a sale never has.

## Rejected

- Keeping fees rent-only and telling sellers to put them in the description: the buyer then meets the charge at inspection, which the fees card exists to prevent.
- Allowing a caution deposit on a sale with a warning: there is no event that refunds it.

## Revisit when

A sale flow gains a refundable hold (for example an escrowed deposit), or estates ask for a separate one-off "development levy" line.

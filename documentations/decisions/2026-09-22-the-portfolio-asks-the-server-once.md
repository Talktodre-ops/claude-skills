# The Portfolio asks the server once, and counts money over a window

Date: 2026-09-22. Status: accepted. Source: Dre, on a screen that fetched on
every keystroke.

## Decision

Only the **window** and the **sort** reach the server, because only they change
which rows exist or what order they are in. Searching, status, property type and
agent narrow rows the screen already holds.

The window is a range of months rather than a single month. Expected, received
and outstanding sum across it, and a range of one month is the old behaviour
exactly.

## Why

Every filter was a request. Typing a name cost one per character, switching a
filter back cost another, and leaving for the Documents tab and returning cost
a third. Measured after the change on a real portfolio: **one request on load,
then none** for ten characters typed, a status narrowed and widened, a property
type chosen, and a trip away and back.

For this to be honest rather than merely fast, the client has to narrow exactly
the way the server did. The row carries `search_text`, built server side from
the same fields the server matched on, so a phone number or an address still
finds its tenancy. Totals and status counts are computed from the narrowed rows
by the same function that produces them, so a row, a chip and a total cannot
describe different sets.

## The window, and why the money had to move with it

`derive_status` and the serializers were written against one `RentPeriod`. A
window has several. Rather than teach every caller about ranges, the row carries
a `_WindowMoney` that answers the same three questions a period does, and the
period stays as the representative: what the drawer opens on, and what "next
due" reads from, which over a window is the earliest month still owing.

The window is capped at 24 months. Rows are held in memory so the set can agree
with its own totals, and an unbounded span would load a portfolio's whole
history to answer one screen.

## Consequences

The list paints ten rows and reveals ten more as it scrolls, from memory, so
that costs a render rather than a request. There is a button behind the
observer for anyone not using a pointing device.

The roll is cached for five minutes and no longer refetches on focus or on
mount. Recording a payment invalidates the key, which is what should make it
refresh.

Client narrowing is bounded by what one request returns. Beyond that page the
server has to narrow again, and the export always does, because it runs there.

## The bug this round nearly hid

`toParams` never mapped `from`, `to` or `property_type` into the request. The
cache key changed, a request went out, and identical rows came back: a request
that did nothing, which looks like working software. Anything added to a query
object has to be added to the serialiser that turns it into parameters, and a
filter that fetches without filtering is the symptom.

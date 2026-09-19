# Documents are organisation level, uploaded once, delivered many times

Date: 2026-09-19. Status: accepted. Source: Dre, after the let convergence.

## Decision

One file store. `rent_ops.Document` is the document, wherever it came from.
`property.PropertyDocument` migrates into it and retires.
`tenant.LeaseDocument` is demoted rather than merged: the signing ceremony,
its signers and its review state stay where they are, and its file becomes a
`Document`. Same shape as the let and its agreement, for the same reason.

**A document belongs to one organisation and never leaves it.** The picker
lists only the active organisation's documents, resolved from the
`X-Organization-ID` header and never guessed. Wanting the same file in another
organisation means uploading it there. A cross-organisation read is a 404.

**Upload once, deliver many times.** A document is never copied to be shared.
Delivery is its own record: which document, to whom, when, by whom, opened,
revoked. The tenant sees it on their Home; an external tenant gets an email
carrying a signed expiring link, and the delivery is still recorded.

**A per-let document can never be sent to many.** Agreements, receipts and
identification belong to one person. Only organisation-level documents,
notices, policies and templates, can go to several recipients. The rule lives
in the model, not in the screen.

**An agreement is a history, not a card.** Every agreement ever raised for a
let is kept, including the one raised when an application was accepted, which
files itself automatically. Sending another appends and never overwrites, with
a supersedes link.

## Why the rail matters more than it looks

A bulk send that can reach a per-let document turns one wrong click into
another tenant's signed agreement, receipt or identity document landing in a
stranger's dashboard. That is a breach under the NDPA and the kind of thing a
landlord never forgives. Enforcing it in the model means no future screen can
get it wrong.

## Why the lease document is demoted rather than merged

Signed agreements carry legal weight and their signing flow works. Merging
would mean rewriting a ceremony nobody asked us to touch in order to gain
nothing a foreign key does not already give. The file is the part that needs
to be in one place, so that is the part that moves.

## Consequences

Reuse should reduce storage rather than grow it, so a delivery must not count
against a plan's storage limit a second time.

Documents with no property become normal. Every query, filter and permission
check has to cope with a null property rather than assuming one.

The Portfolio surface (Lets, Sales, Documents) is where this becomes visible,
and it is the reason the deferred sale model split can no longer wait: a Sales
tab reading `Lease` rows by `document_type == "Sale Agreement"` is the wrong
foundation for a screen.

## Supersedes

It completes decision D2, which unified documents in principle in 2026-09-15
but left `PropertyDocument` unmigrated and said nothing about delivery,
organisation-level documents or bulk sending.

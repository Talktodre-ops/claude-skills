---
date: 2026-09-08
status: accepted
tags: [blog, cms, contentful, admin-portal, phase6, d1]
---

# Blog CMS ported in house, retiring D1

**Context.** D1 read the SOW's blog section ("Blog CRUD APIs. Draft support.
Publish/Unpublish functionality. Rich text support. Featured image support.
Category and tag support. SEO metadata fields. Publish scheduling.") and
deviated: keep Contentful, buy Content Admins seats there, and reduce Phase 6
to visibility controls on the Heimly side. The record itself said the deviation
should be confirmed with the client rather than assumed, because someone may be
expecting an editor.

Two things settled it. The SOW text is specific enough that "visibility
controls" is not a defensible reading of it, and Dre already owns a working
blog CMS in the personal site: a `blog_posts` table with slug, excerpt, HTML
content, featured image, tags, category, status, published_at, read_time,
views, meta title and description and a featured flag, plus list, detail,
create, update and delete routes and an image upload path. Porting that shape
into Django is a smaller job than negotiating a scope reduction, and it removes
a vendor from the critical path of a contracted deliverable.

**Decision.** Build the CMS in house as a `blog` app and retire D1. Post,
Category and Tag models with soft delete and the DRAFT, SCHEDULED, PUBLISHED,
ARCHIVED status set; `content_html` sanitised with nh3 against a single
allow list on every save; `content_json` kept alongside it so the editor can
round trip its own document without re-parsing HTML; scheduling through a
`publish_scheduled_posts` Celery task with a beat row created in a migration;
public read endpoints under `/api/v1/blog/` and authoring under
`/api/v1/heimly-admin/blog/` behind the existing `manage_blog` capability, with
an audit row on every mutation. Images go to R2 through the same presigned PUT
flow the property media uploads use. A management command imports the live
Contentful `blogPost` entries once, converting the rich text document to HTML
through a mapper and copying hero images into R2, so the cutover carries the
existing posts rather than starting empty.

**Why.** Sanitising on write rather than on render is the part that makes an
in-house editor safe to own: the stored HTML is already the trusted output, so
every consumer (the marketing site, an RSS feed, a future native app) gets the
same guarantee without repeating the work, and a bug in one renderer cannot
reintroduce a script tag. Keeping the allow list in one module and testing it
means the security boundary is a single reviewable file.

The port also collapses three systems into one. Today a blog post's identity
lives in Contentful, its analytics nowhere, and its permissions in a Contentful
seat that has no relationship to the Heimly admin role matrix. After the port,
Content Admin means one thing, the audit trail covers publishing the way it
covers moderation, and Phase 8's content analytics have a first-party row to
attach to. Contentful stays reachable as the source for the one-time import and
then stops being load bearing.

**Rejected.** Keeping D1 as written (leaves a contracted deliverable unbuilt
and a vendor seat as the permission model). A Contentful management-API proxy,
where Heimly's admin UI writes into Contentful (all of the editor work, none of
the ownership, and it makes every publish a network call to a third party).
Storing markdown instead of HTML (the source blog is already HTML, and it moves
sanitisation to render time where it has to be repeated per consumer).
Sanitising on read (same problem, plus it costs on every request).

**Revisit when.** Editorial volume grows past what a single-author CMS handles
well, meaning real workflow states, per-locale content or scheduled embargoes
across timezones. At that point the question is a dedicated CMS again, not a
larger version of this one.

---
date: 2026-09-09
status: accepted
tags: [campaigns, email, brevo, consent, ndpr, admin-portal, phase7]
---

# Campaigns send through Brevo, to opted-in users, with our own delivery rows

**Context.** Phase 7 of the admin portal is the SOW's Platform Messaging and
Marketing: in-app notifications and email campaigns to all users or selected
groups, with message history, background bulk sends, templates and delivery
statistics. Nothing exists today. Email leaves the system through Django's
SMTP backend to the Brevo relay, synchronously, with no record of the send,
so even "sent" is not observable. No column records marketing consent; the
consent work that shipped is the cookie banner on the web app.

Three questions were open: the provider, the lawful basis for sending, and
how a campaign is monitored.

**Decision.**

Brevo stays the provider. The SMTP relay credentials already in env are the
send path; on the first day of the build the agent confirms against Brevo's
transactional webhook documentation that webhooks fire for relay-sent mail and
echo the `X-Mailin-custom` header, and sends campaigns through the relay with a
per-delivery id in that header. If that does not hold, a `BREVO_API_KEY` goes
into env and sends go through the HTTP API using the returned message id. The
provider sits behind one small sender interface either way.

Consent is a `marketing_opt_in` on the user with `opted_at` and `source`.
A data migration opts every existing user in with source `migrated`. New
users see a toggle at sign-up, shown and on by default. Every campaign email
carries an opt-out link that flips the flag without a sign-in (a signed token
with a 90 day expiry) and a `List-Unsubscribe` header. Campaigns send only to
opted-in users. Transactional mail is untouched.

Monitoring is ours: a `CampaignDelivery` row per recipient, updated by a
webhook Brevo posts to, so the funnel (sent, delivered, opened, clicked,
bounced, unsubscribed) is counted over our rows and survives the provider's
retention. Hard bounces and spam complaints feed an `EmailSuppression` table
consulted before every send.

**Why.** Brevo is already the relay for transactional mail and its cheapest
paid tier covers a monthly send to every account for a single digit dollar
figure (secondary trackers checked 2026-09-09; the vendor page renders prices
in script and was not readable from this network). One provider, one send
path. Owning the delivery rows means the statistics do not depend on a
dashboard we do not control, and the suppression list stops the sender
reputation from paying for bad addresses twice.

On consent, the practical reading of NDPR is that the basis has to exist and
be recorded, and the person has to be able to leave in one click. The backfill
records the basis for existing users, the toggle records it for new ones, and
the link is the exit. Said once for the record: a toggle that starts unchecked
reads better under NDPR than one that starts on; Dre chose on by default and
the code follows that.

**Rejected.** Zoho ZeptoMail, cheaper per email but transactional only, with
terms that forbid bulk promotional sends. Zoho Campaigns, priced per stored
contact, which would move the audience and the statistics out of our database
and make the portal's campaign page a wrapper on someone else's. Sending
through the relay without delivery rows, which leaves "sent" unobservable.
Legitimate interest without a recorded opt-in, which has no record to point at.

**Revisit when.** Monthly volume reaches tens of thousands of emails, at which
point per-email pricing is worth comparing again, or when SMS or push are
wanted, which need a provider Brevo's relay does not cover.

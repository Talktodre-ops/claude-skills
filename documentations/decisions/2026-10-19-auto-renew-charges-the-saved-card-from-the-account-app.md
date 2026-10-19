---
date: 2026-10-19
status: accepted
tags: [payments, subscriptions, paystack, auto-renew]
---

# Auto-renew charges the saved card from the account app, not from the payments ledger

Date: 2026-10-19. Status: accepted. Source: Dre: "also add to it, the auto renew for user who subscribed... everything about this payment and escrow will be in the payments-be or fe branch".

## Context

Paid subscriptions had an `auto_renew` flag, a `SavedCard` with Paystack's authorization code, and nothing that ever charged it; gift and voucher lifts turned the flag off "until escrow". Dre wanted auto-renew in the same build, on the same branches.

## Decision

- Renewal lives in `account` (the existing subscription service and Paystack charge authorization), with no coupling to the payments ledger in this round. The spec's note that subscriptions and boosts move onto the payments core later still stands.
- A subscription renews when `auto_renew` is on, it is ACTIVE, not cancelled at period end, on a paid plan, has a prior successful card payment, and `next_billing_date` has passed. The amount is the current plan's price for the last card payment's cycle and card; a renewal is skipped with a log line when the plan differs from the last card payment's plan, so a gifted or admin-changed plan is never charged at the wrong price.
- Reference `hmly_sub_ren_<uuid>`, so the existing Paystack webhook routing carries it unchanged. One open renewal per subscription at a time.
- Failure: attempts count up, retries at +2 and +5 days, PAST_DUE after the third, then the existing expiry sweep moves it to FREE after 7 days grace. A pending charge is marked so the sweep waits 48 hours for the webhook. A successful card payment resets attempts; renewal payments keep the user's `auto_renew` choice.
- Reminders 7 and 1 day before; emails on renewal and on the third failure, on the email design system, test addresses only.
- Turning auto-renew on needs a reusable card (`NO_CARD`); deleting the last card turns it off. The web switch renders off and disabled when no card is saved even if the row says on. Gift and voucher lifts keep auto-renew off. `payments_live` OFF pauses the task.

## Why

The subscription path is live revenue and already correct; rebuilding it on the new ledger in the same release would risk it for no user-visible gain. Charging the current plan's price, not the last payment's, keeps a plan change from producing a wrong charge. Treating "on with no card" as off in the UI is the only honest reading of a row whose default was `True` before any card existed.

## Rejected

- Applying Heimly credit automatically on renewal: credit is spent by an explicit Apply; mixing it into an unattended charge hides what was paid.
- An email on every failed attempt: the spec says the third; flagged for Dre as a product choice.

## Revisit when

Subscriptions and boosts move onto the payments core, or a second card processor appears. Related: [[2026-10-05-escrow-runs-on-payscrow-inside-one-walled-off-app]], [[2026-10-19-the-payments-kill-switch-ships-on]].

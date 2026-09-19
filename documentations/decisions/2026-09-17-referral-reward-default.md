# Referral reward: four options built, one default at launch

Date: 2026-09-17. Status: accepted. Source: Dre, closing plan decision D5.

## Decision

The referral reward is configuration, not code. Four reward types are built
and switchable from the admin Growth section's Programme tab, so the
executives choose inside the product instead of gating the build:

- plan months on a named plan
- boost credits for marketplace sponsorship
- priority verification (a queue flag, no value transferred)
- wallet credit in NGN that only ever nets off a Heimly invoice

Cash paid out is excluded. The programme launches with a default so nothing
waits on a meeting: one month of Pro per qualified referral, capped at twelve
rewards per person per year, qualifying on the referred person's first
published listing.

## Why

A verified account is too cheap to fake, a first paid plan is too slow to feel
like a reward, and a published listing is the behaviour the marketplace wants
anyway. Plan months cost nothing to fulfil and reuse the subscription
extension service that already exists. Paying cash out would turn the
programme into a payout system with the fraud surface that implies.

## How it is built

- A programme row carries the active reward type, its parameters, the
  milestone rule and the qualifying event; a migration seeds the default.
- A programme change is dated and never rewrites earlier referrals; each
  referral stores the rule that governed it.
- Wallet credit is the only option that adds a model beyond referrals (a
  small credit ledger) and is built last, behind the same `growth` flag.
- Brief of record: .agents/growth-loop.md.

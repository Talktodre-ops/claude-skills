---
date: 2026-10-19
status: accepted
tags: [payments, product, escrow, licensing]
---

# No funded wallet: the Money page shows money the partners hold

Date: 2026-10-19. Status: accepted. Source: Dre: "the funded wallet is just showcase... the money is displayed somewhere... payscrow and paystack and our licensed partner would be the one to hold the money while we just display it to users as confirmation."

## Context

Starting the payments build, Dre asked whether users need "a wallet kind of thing where users can fund, see their money and all that", or what we would build from a product point of view.

## Decision

- Heimly never holds money and never shows a spendable balance. There is no Fund button and no Withdraw button anywhere.
- The Money page (`/dashboard/money`) is a window onto money that Payscrow, Paystack and the licensed bank hold: Paid, Held and Received tabs, each row one transaction with its state, counterparty, amount, fee breakdown, countdown and next action. Totals at the top are sums of rows and are labelled "Held for you", "Paid out to you" and "Paid by you", never "Balance".
- Every state the page shows traces to a provider confirmation in the ledger.
- The voucher "wallet credit" is called "Heimly credit" everywhere in copy, so the word wallet never sits beside escrow money. Model and field names stay.
- A collections balance for landlords with many tenants, if it ever comes, is a virtual account per organisation at a licensed partner where the bank holds the money and Heimly displays it.

## Why

A balance users can fund and withdraw is stored value, and only mobile money operators, banks and microfinance banks may hold customer funds in Nigeria. A wallet also drags in KYC tiers with daily caps, anti-money-laundering reporting, a float to reconcile daily and partner-bank failure risk, for a product that moves money a few times a year per user. Rent is paid once or twice a year; a buyer pays once; everybody already has a bank app with instant transfers. What people mean by "see my money" is where each payment is and what happens next, which is a ledger view, not a balance.

## Rejected

- A funded wallet on a licensed partner's pooled account: possible, but a licence conversation and a custody liability for no user gain at this stage.
- Showing the sum of held money as a "balance": reads as custody and invites a withdraw request we cannot honour.

## Revisit when

Rent Ops landlords with many tenants ask for a collections account, or the marketplace moves to many small daily jobs where per-payment funding becomes the friction. Related: [[2026-10-05-escrow-runs-on-payscrow-inside-one-walled-off-app]], [[2026-10-19-owner-accepts-before-the-payer-can-fund-escrow]].

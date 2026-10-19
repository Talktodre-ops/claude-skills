---
date: 2026-10-05
status: accepted
tags: [payments, escrow, architecture, payscrow, paystack]
---

# Escrow runs on Payscrow, inside one walled-off Django app

Date: 2026-10-05. Status: accepted. Supersedes [[2026-08-28-escrow-start-deferred]]. Source: Dre, after the business finished its meetings and feasibility study with Payscrow and signed the commercial agreement.

## Context

Heimly cannot legally hold customer money: in Nigeria only mobile money operators, banks and microfinance banks may hold funds, and Paystack's terms name escrow as an ineligible business. The SoW wants a provider-agnostic transaction model for rent, sales, one-off payments and later service jobs, with escrow optional below a threshold and required above it. Dre asked whether the money path needed Lambda, Kafka or RabbitMQ, or a separate service in Rust.

## Decision

- Escrow runs on Payscrow's MarketPlace API. Payscrow's bank holds the money; Heimly instructs and records. Direct (non-escrow) payments run on Paystack split payments and settle straight to the recipients.
- The payer pays the escrow fee. The provider fee is never computed by Heimly: every quote asks Payscrow's charges API and stores the answer, so a negotiated rate change needs no code.
- Release happens when the payer confirms, inside a confirmation window that starts at delivery (keys handed over, move-in date), not at funding. Silence until the window ends releases the money. Disputes are handled by Heimly first and by Payscrow's arbiter if we cannot settle; any outcome Heimly pushes needs two staff approvals.
- Payments is ONE Django app in the existing API, walled off by an import-linter contract, in Python, with its own Celery queue in the existing worker container. The database is the record: a webhook inbox, a command outbox, an append-only double-entry ledger and an audit of every state change. Celery is only the trigger; sweepers recover anything a lost task leaves behind. No Lambda, no Kafka, no RabbitMQ, no second container.
- Nothing is marked funded, released or refunded unless the provider confirmed it; a webhook alone never moves money state, the worker fetches the transaction from the provider first.

## Why

The provider choice was a business decision made outside engineering; the engineering question was only how to integrate safely. A queue or a second service adds operational surface without changing the facts that matter: money state must be durable, ordered and replayable, and Postgres already gives that with locks and constraints. Keeping payments in the API keeps one deploy, one set of credentials and one place to audit, while the import contract keeps other apps from reaching into money tables. Provider confirmation before any money state is what makes a forged or replayed webhook harmless.

## Rejected

- Building the hold on Paystack with delayed payouts: their terms forbid escrow, and a stored "balance" would make Heimly the custodian.
- A separate payments service (Rust or Python) with its own broker: more to operate, nothing more to guarantee at our volume.
- Heimly computing the provider fee from a configured percentage: the agreement lowers the rate at volume milestones, so a constant would drift from the charge.

## Revisit when

The Payscrow sandbox spike answers its open questions differently (whether the broker can apply the escrow code without the payer, what the event payloads carry), or transaction volume makes the single-queue worker a bottleneck. Related: [[2026-10-19-no-funded-wallet]], [[2026-10-19-escrow-built-on-a-fake-provider-until-keys-arrive]].

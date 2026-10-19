# Providers behind one interface, and a fake that behaves like the real one

## The protocol

```python
class PaymentProvider(Protocol):
    def quote(self, amount, payer_pays_fee) -> ProviderQuote: ...
    def create(self, txn, participants) -> ProviderCreateResult: ...   # payment url
    def release(self, txn) -> ProviderResult: ...
    def cancel(self, txn) -> ProviderResult: ...
    def raise_dispute(self, txn, dispute) -> ProviderResult: ...
    def resolve_dispute(self, txn, outcome) -> ProviderResult: ...
    def fetch_status(self, txn) -> ProviderStatus: ...
    def verify_webhook(self, raw_body, headers) -> bool: ...
    def parse_event(self, raw_body, headers) -> NormalisedEvent: ...
```

One implementation per provider; a registry picks by a setting. The transaction model
never names a provider. Adapters have a 15 second timeout, no retries of their own (retries
belong to the outbox), and log every call with the transaction reference. Fees the provider
will quote are asked for, stored raw in the quote, and never computed locally.

## Choosing who may hold the money

Before any design: who is licensed to hold customer funds in this market, and what does
each candidate's terms of service say about escrow? A processor whose terms name escrow
as ineligible cannot be the hold even if its API could delay payouts. Research it live,
with sources and dates, and keep the research file. For Heimly: Nigeria's rules allow only
mobile money operators, banks and microfinance banks to hold funds; Paystack names escrow
ineligible; Payscrow's bank holds the funds under an escrow arrangement.

## Direct split payments on a processor

The split (recipients' subaccounts, the platform's charge, who bears the fee) goes in the
initialize request's own top-level fields or a pre-created split object, exactly as the
processor documents. Never inside `metadata`: the processor ignores it, the whole amount
lands in the platform's balance, and your ledger will say the recipients were paid.
Reconciliation flags a released direct payment whose provider status shows no split.
Mark the exact request shape "to confirm in sandbox" until a sandbox run has confirmed it.

## The fake provider

The point of a fake is to exercise the same code the real provider will, so the swap later
is configuration plus corrections from the sandbox spike. So the fake:

- keeps state in its own table and serves a pay page on your own API with Pay, Fail and
  Abandon buttons, reached through a public base URL a browser can open;
- quotes a fee the way the real one does (a percentage plus a flat amount, labelled fake);
- on every state change POSTs a webhook to your own endpoint through an internal base URL,
  signed with the real scheme (HMAC over `{timestamp}.{rawBody}`, the real headers, a
  delivery id and an event id), so the inbox, the dedupe, the verify-by-fetch and the
  sweepers all run for real;
- is driven from a shell or an e2e script by a management command that fires any event
  (`funded`, `settled`, `payment_failed`, `cancelled`, `refunded`, `dispute:<stage>`);
- is selected automatically when no real key is set, refuses to load outside DEBUG unless
  an explicit setting allows it, and its public dev secret is refused once the real
  provider is selected;
- comes with a seed command that creates fee tiers, policies, verified payout accounts for
  the test personas and one transaction per state, so screens and screenshots have data.

Two base URLs: the internal one (compose service name) for service-to-service calls, with
its host added to the allowed hosts; the public one for links a person follows.

## The real adapter before keys exist

Write it from the vendor's document, cover it with tests against recorded shapes, and mark
every path and field name that is an assumption as "pending the sandbox spike" in a
comment and in the spec. Keep the spike's questions in the spec (can the broker apply the
release code without the payer; the full event list and payloads; what the amount field
excludes; whether settlement accounts can change after creation; partial refunds outside
a dispute; limits; secret rotation). Answers that change a model or a screen are written
back into the spec before the first dress run.

## Rollout ladder

Sandbox keys on local and pre-prod; production with flags off; allowlisted staff with a
₦100 escrow and a ₦100 direct payment, released and reconciled; allowlisted testers;
wider by flag. Kill switch ships ON (`payments_live`); turning it OFF stops new quotes,
payments and renewals and never blocks webhooks, reads or releases already due.

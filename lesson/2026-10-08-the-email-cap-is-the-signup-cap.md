---
date: 2026-10-08
tags: [email, growth]
---

# The email provider's daily cap is the sign-up cap

## What happened

Brevo's plan allows 300 emails a day. Every sign-up needs a confirmation email, so the 301st person in a day cannot finish signing up, whatever the servers can take. Found while planning for ad bursts.

## Why it bit

Capacity planning looked at our servers; the ceiling was a vendor quota.

## The rule

For every growth push, list each third-party quota on the path (email, SMS, KYC, payments) next to the expected peak, and alarm before the cap.

## How to spot it next time

Sign-ups stalling at confirmation while the API is healthy.

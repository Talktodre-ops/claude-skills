---
date: 2026-10-08
tags: [aws, nat, networking]
---

# fck-nat cannot claim an Elastic IP the NAT gateway still holds

## What happened

The fck-nat instance booted while the old NAT gateway still held the Elastic IP, so its own association failed and nothing retried. The first hand fix put the address on the static route interface, which is wrong: outbound traffic left from a different, temporary IP until the address went on the instance's primary interface.

## Why it bit

Two resources wanted one address during the same apply, and fck-nat only tries at boot. The static ENI carries the route; egress uses the primary ENI.

## The rule

After a NAT swap, check `describe-addresses` shows the EIP on the NAT instance's primary ENI, then check egress from inside the VPC (`curl checkip.amazonaws.com` via the bastion) returns the EIP. A replacement instance claims it by itself once nothing else holds it.

## How to spot it next time

Outbound calls work but partners that allowlist our IP start refusing, or the egress IP differs from the EIP.

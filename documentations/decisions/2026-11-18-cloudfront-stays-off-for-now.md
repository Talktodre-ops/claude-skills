---
date: 2026-11-18
status: deferred
tags: [infra, cdn, cloudfront, caching, cost]
---

# CloudFront stays off for now

## Context

The next step after [[2026-11-18-browsers-never-store-pages]] would be:

- serve `/_next/static` from an S3 archive that keeps every deploy's files for 30 days, behind CloudFront;
- later, at scale, cache public pages at the edge and route old tabs to old servers during a rollout.

The CloudFront distribution is already built in Infra-Heimly (`modules/cloudfront`) and parked behind three switches in `prod.tfvars`: `enable_cloudfront`, `cloudfront_serves_dns`, `alb_requires_cloudfront_header`.

**Priced on 18 November** from production's last 30 days (3.26 M requests, at most 128 GB out, 12 deploys) and AWS's own pages:

| Traffic | Monthly cost |
|---|---|
| Today | About $0 to $1: inside CloudFront's permanent free tier of 1 TB and 10 M requests a month; S3 archive under $0.05 |
| 10× | About $59 pay as you go |
| 100× | About $1,000 on the flat-rate Premium plan |

Figures and sources: `.agents/research/cloudfront-s3-pricing-2026-11.md` in the monorepo.

## Decision

Dre: do not turn CloudFront on yet. The browser fix (FE #273, #274, #275) stands on its own.

## Why

The browser fix removed the failure people saw. The archive closes what remains:
- tabs left open across a deploy;
- the minute of 404s while ECS swaps tasks.

That work can wait for a deliberate infra round, with the DNS move done on purpose rather than as part of a bug fix.

## Rejected

- **Turning it on in the same round as the fix.** It mixes a DNS move with a frontend fix, and doubles what has to be watched.

## Revisit when

- tabs held across deploys start failing in numbers;
- the rolling-deploy 404 minute becomes visible to users;
- traffic grows enough for edge caching or Nigerian edge latency to matter.

The plan doc lists the order: pre-prod nginx archive, then switches 1 to 3, then the S3 origin with a 30-day lifecycle that re-uploads every file on each deploy.

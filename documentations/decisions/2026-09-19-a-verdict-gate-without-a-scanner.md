# A verdict gate now, a scanner when Dre says so

Date: 2026-09-19. Status: accepted for the gate, open for the scanner.
Source: Dre, during the document convergence round.

## The fact that started it

There is no malware scanner anywhere in Heimly and there never has been.
`python-clamd` is commented out in `requirements.txt`, there is no clamav
service in `docker-compose.yaml`, and nothing answers on port 3310 from the
api container. `base/utils/file_validation.scan_for_viruses` has therefore
always taken its "clamd unavailable, allow" branch, in every environment,
since the day it was written. The property document upload path and the lease
document upload path both call it and both have always been told the file is
clean.

That is worse than having no scan at all, because the code reads as though
something looked.

## Decision

Build the gate, not the scanner.

A document is born with no verdict. Until it has one it is not downloadable,
not deliverable and not offered by the picker, including to the person who
uploaded it. Delivery re-checks the verdict at the moment of sending rather
than trusting the one recorded at upload. The verdict comes from a provider
behind one interface, `base/utils/malware_scan.py`, chosen by the
`DOCUMENT_SCAN_PROVIDER` setting, and the default provider says plainly that
nothing looked.

Two states that must never be conflated:

- **Scanning disabled**, which is today. The document is cleared **by
  policy**, and the row says `CLEARED_BY_POLICY` with a sentence saying no
  scanner is configured. That is an honest audit trail rather than a fake
  clean verdict.
- **Scanning enabled and the scanner unreachable, errored, timed out, or
  facing an archive it cannot read.** Not cleared. The document sits
  quarantined and somebody is told why. Never "broken, therefore allow".

`CLEAN` is reserved for a verdict a scanner actually gave. An incident has to
be able to tell the three apart, and a boolean cannot.

## Why the gate is the expensive half

The state machine is what is expensive to retrofit: every read path, every
delivery path, every picker query and every screen has to learn that a
document might not be openable yet. The scanner is one class implementing one
method. Building the gate now means turning scanning on later is a setting
and a rescan pass over the library, not a redesign and not a data migration.
That is proved by a test: with the provider swapped for one that returns
infected, an already uploaded document becomes undeliverable and
undownloadable.

## What turning it on would take

Researched live on 2026-09-19 and cached at
`.agents/research/malware-scanning-2026-09.md` with per-fact dates and
sources. The short version.

**Recommended when the time comes: ClamAV as its own ECS Fargate service**,
reached over TCP from the api task, rather than Amazon GuardDuty Malware
Protection for S3 or a third-party API. The deciding fact is architectural.
Heimly's storage is not S3 everywhere: production uses AWS S3 when `USE_S3`
is true, and development and pre-prod use Cloudflare R2 with a separate
documents bucket. GuardDuty is S3 only and cannot see R2 at all, and R2 has
no native scanning of its own as of 2026-09-19, which is a verified negative
rather than an omission. Picking GuardDuty would leave the control exercised
only in production, which is how a security control ends up untested.

Cost, and it supports the choice rather than driving it. eu-west-1 Fargate
on-demand Linux x86, from the AWS Price List API, rate effective 2026-07-01:
$0.04048 per vCPU-hour and $0.004445 per GB-hour. At 1 vCPU and 4 GB running
continuously that is about $42.53 a month, flat, at 2,000 uploads a month or
at 20,000. GuardDuty Malware Protection for S3 in eu-west-1, rate effective
2026-09-01: $0.1005 per GB scanned above a 1 GB free tier and $0.000241 per
object above 1,000 free objects, which is about $0.44 a month at Heimly's
current volume and about $7.49 at ten times it. The two cross over at roughly
108,000 uploads a month. GuardDuty is cheaper and loses anyway.

Cloudmersive and VirusTotal were considered and ruled out on residency: both
send every uploaded byte, tenant and landlord identity documents included, to
a third party outside our AWS account, which is an NDPA problem rather than
an engineering preference.

**What the infrastructure needs**, written down rather than built, because
Dre decides when:

- Its own always-on ECS service, not a sidecar on the api task, because
  clamd holds the signature database in memory and a cold start is useless.
- Roughly 3 to 4 GiB of memory for the signature database, and headroom above
  that if ClamAV's database grows again.
- Outbound internet egress for freshclam to fetch signature updates.
- Service discovery so the api task can reach clamd over TCP, and a security
  group that admits that one path and nothing else.
- `AlertEncryptedArchive=yes` and `AlertEncryptedDoc=yes` in clamd.conf.
  ClamAV defaults both to `no`, which means an encrypted archive raises
  nothing at all, and Heimly must treat any `Heuristics.Encrypted.*` hit the
  same as a detection.
- `StreamMaxLength` checked against the largest file the product accepts. Its
  default is 25 MB, which is also Heimly's vault ceiling.
- Then `DOCUMENT_SCAN_PROVIDER=base.utils.malware_scan.ClamdProvider`,
  `CLAMAV_HOST` and `CLAMAV_PORT`, and a pass of the rescan command over the
  library.

No Terraform was written for any of this.

## What would trigger the decision

- The first infected or fraudulent file reaching a recipient through Heimly.
- Documents beginning to flow between organisations rather than only within
  one, which widens the blast radius of a bad file.
- Dev and pre-prod moving onto real S3, which removes the argument against
  GuardDuty and makes the cheap managed option the obvious one.
- Volume past roughly 108,000 uploads a month, where the flat ClamAV fee wins
  on price as well.
- A customer or a partner asking what scans their uploads, which today has
  the honest answer: nothing does, and the product says so on the record.

## What is not deferred

Everything that is code rather than infrastructure shipped in this round: the
content type derived from the magic bytes with the client's claim ignored,
`.html` and `.svg` refused outright, the executable and script denylist
reused rather than rewritten, the vault wired into that validator for the
first time, attachment disposition and nosniff on every download, downloads
served from the storage host rather than the app origin, size caps,
unguessable storage keys with the user's filename kept out of the path, rate
limits on upload and send, revocable deliveries, a report button that
quarantines at once, and the audit trail.

## Supersedes

Nothing. It records a gap `file_validation.py` has always had and decides
what to do about it.

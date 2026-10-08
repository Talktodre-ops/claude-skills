# States and edge cases

A checklist of what every screen prompt should name. Items come from the STATES blocks and edge sections of our prompts. Mark each as "applies" or "not applicable" before sending; do not leave the designer to guess.

## Universal states (every screen and widget)

- **Loading:** content-shaped skeleton matching the final layout, one skeleton style across the product, never a lone spinner on a blank page (admin-design-prompt.md, requests-and-tasks-prompt.md).
- **Empty, first run:** "nothing exists yet", with guidance and the next step. Inviting, not apologetic (01-properties-with-applications.md, 02-tenant-home.md).
- **Empty, no results:** "no results for these filters", with a clear-filters action. A separate design from first run (admin-design-prompt.md, growth-and-rentops-design-prompt.md).
- **Empty, partial:** one thing exists but not the next ("properties but no applications yet. Say something more useful than none", 01).
- **Error:** inline, recoverable, a retry and a support reference id. States what went wrong and what to do next (admin, growth briefs).
- **Partial failure:** a failing widget degrades alone without taking the page down (admin brief).
- **Success:** specific confirmation naming what happened ("User blocked, sessions revoked"), optimistic where safe (admin brief).
- **Permission denied:** a full page and an inline variant (admin brief). Also the case where a role may see the screen but not an action: the action is absent, with an explanatory tag (requests-and-tasks-prompt.md).
- **Offline or slow connection:** a banner with a stale-data indicator; a pending action that is waiting to confirm (admin brief, deals-in-messaging-prompt.md).
- **Long-running job:** progress, and a summary on completion with counts and a download of failures (admin brief, growth brief import).
- **Pending:** a claim waiting for someone else, visible on both sides (02, growth brief, 03).
- **Conflict:** "already handled by another admin" or "already confirmed by your colleague", showing who acted first (admin and growth briefs).

## Data-shaped states

- No photo, no image, no cover (01: "some have no photo at all, design for that").
- Optional fields absent. Many units versus single unit.
- Two status fields that disagree: define which wins (01).
- Sparse data in charts: "not enough data yet", explained (admin brief, design-guidelines.md).
- Very small and very large sets: 3 rows and 3,000, or 10 and 100,000, same design (growth and admin briefs).
- Deleting the last item on a page does not strand an empty page (admin, growth briefs).
- Media still processing after upload (requests-and-tasks-prompt.md: photos may arrive seconds later).
- Long text, long names (inferred).

## Journey states

- Wrong or expired code; too many attempts ("try again in a few minutes"); account already exists (offer sign in, keep context); no connection; third-party sign-in cancelled; expired invitation; sign-up paused (signup-journey-prompt.md).
- Same flow from a different entry point; same flow for a signed-in person versus a visitor (signup, landing briefs).
- A second device finishing a step the first started ("Confirmed on another device", signup-journey-prompt.md).
- Questions that were skipped, part answered, finished, dismissed (signup-journey-revision-prompt.md).

## Lifecycle states

Draw each status of each lifecycle the screen touches, including the terminal and the reversed ones. Examples from our briefs:

- Request: pending, acknowledged, in progress, resolved, confirmed, rejected (with reason), reopened (with count and reason) (requests-and-tasks-prompt.md).
- Task: open, pending, in progress, completed, cancelled, archived, overdue.
- Application: waiting, approved, lease drafted, lease active, rejected, expired, withdrawn (01).
- Money record: reported (pending), confirmed (with receipt), rejected (with reason and a way to correct and resubmit) (02).
- Transaction: created, awaiting payment, funded, awaiting release, released, refunded, failed, cancelled (payments-and-escrow-prompt.md).
- Sale: nothing for sale, listed with no offers, several competing offers, accepted and on schedule, behind, completed, fallen through (and whether the buyer walked or the offer went stale) (03).
- Past and ended: a past home reachable and clearly ended (02).

## Role states

- A role that has nothing yet (agent with no assignments).
- A role with an action waiting (pending assignment invite that cannot be missed) (01).
- An observer who can read but not act (deals-in-messaging-prompt.md).
- A role whose access ends while records stay (agent loses assignment; records stay) (growth brief).
- External or not-yet-onboarded people: an owner not on the platform, an external tenant who later joins; history must not be lost (payments brief, growth brief).

## Money states

- Partial payment, overpayment, payment against the wrong period then moved, duplicate payment caught, receipt voided and reissued with the void kept in the record, rent change from a given period, a period ended mid-cycle (growth brief B2, B3).
- Payment failed, pending at the partner, partner unavailable, refund requested, refund answered (payments brief).
- Beneficiary not yet verified (payments brief).
- Example values for fees and thresholds clearly marked as examples when undecided (payments, deals briefs).

## Content and file edge cases

- A 25 MB upload on mobile data; storage limits surfaced before the upload fails; an expired share link; a document deleted while someone holds a link (growth brief B6).
- Import: unknown property, bad date, missing rent shown on the row; re-uploading the same file creates no duplicates; failed rows downloadable (growth brief B5).
- Share text over a platform's length limit (growth-screens-spec.md).

## Behaviour rules to state explicitly

- Reasons mandatory on destructive and moderation actions (admin brief).
- The last owner or last super admin cannot be demoted: control disabled with an explanation (admin brief).
- A reward is never granted before its qualifying event; a void reverses only what has not been consumed; a rule change never rewrites earlier records (growth brief).
- Reminders sent once per window, never twice, and the design makes that legible (growth brief B4).
- A combination already closed (active lease exists) looks closed, not available (01).

## Responsive coverage

For every prompt, state which screens must be drawn on a phone explicitly. The admin brief lists them by name (moderation queue and detail, user detail and block flow, analytics, campaigns progress); the growth brief does the same. Anything not listed risks being desktop only.

# Rent Ops landed on pre-prod behind its flag, and the wave branches are gone

Date: 2026-09-19. Status: accepted. Source: Dre.

## Decision

Every open pull request in both repositories was merged into pre-prod and the
merged branches deleted. That is the twelve Rent Ops waves, the country copy
sweep, the MQTT teardown fix, and the analytics KYC split.

Rent Ops is on pre-prod but not on for anyone: the `rent_ops` flag stays off
globally, with Dre's two accounts and four organisations on the allowlist.

## How it is built

- Backend waves one to six and frontend waves one to six merged in order,
  each retargeted to pre-prod before the first merge.
- `rent_ops/tests` is still not in `ci.yml`, so nothing gates these merges.
  That needs one line from someone allowed to touch CI.
- Remaining branches are the ones with genuinely unmerged work:
  `admin-iam-w6-be` with its `-export` and `-retention` companions, other
  people's `feat/*` and milestone branches, and a stray branch named `origin`
  in both repositories.

## Consequences

Two mechanics are worth remembering because they cost time:

- **Retarget a stack before merging any of it.** Merging with
  `--delete-branch` closed the pull request stacked on the deleted base rather
  than retargeting it, and GitHub would not reopen it once its base branch was
  gone. It had to be recreated.
- **A pull request stacked on a branch that never had one drags that branch's
  history with it.** The analytics change was stacked on `admin-iam-w6-be`,
  which carried about a dozen unmerged commits. Its reviewed commit was
  cherry-picked onto a branch cut from pre-prod instead, and the original
  closed with the reason.

Pre-prod now carries admin auth suites that fail locally, nineteen in the
older admin auth files and eleven in the two-factor file. They predate this
merge: the older ones assert the one-step sign-in response that two-factor
replaced. Nothing caught it because CI does not run on pre-prod pull requests.

## Supersedes

Nothing. The pre-prod branching decision of 2026-09-09 stands; this records the
first round to land through it end to end.

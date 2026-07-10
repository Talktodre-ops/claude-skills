---
name: loop
description: How to run a long, multi-phase build autonomously with a self-continuing loop, one phase per fresh context window, verifying before every commit. Load whenever the user starts a /loop (or asks for an autonomous multi-phase build) so the rhythm does not have to be restated: orient from git, make the smallest correct change per sub-plan, verify it for real, commit and push one sub-plan at a time, then checkpoint to the next phase with a scheduled wake-up that carries the state forward. Pairs with a project-guide skill (for the repo's own build and test commands) and a house-rules skill (voice, commit conventions, safety).
---

# The loop workflow

A repeatable way to build a large, multi-phase batch on autopilot without losing
correctness or context. The idea: split the work into ordered phases, do exactly
one phase per context window, prove each sub-plan works before committing it, and
hand off to the next phase through a scheduled wake-up that carries the state
forward. The loop's own memory is unreliable across a long run, so git and the
handed-off prompt, not recall, are the source of truth for where things stand.

Pair this with two companion skills: a **project guide** that supplies the repo's
exact run, test, typecheck, and migration commands, and a **house-rules** skill for
voice, commit conventions, and safety. This skill is the process; those supply the
specifics.

## When to use

- The user runs a self-continuing loop over a large spec and wants it built end to
  end without babysitting.
- Any task too large for one context window that splits into ordered phases, each
  independently shippable and verifiable.

Not for a single small change: just do that directly. The loop's overhead only pays
off when the work genuinely spans many phases.

## The shape of a loop prompt

A good loop spec (the thing that fires each iteration) carries everything a cold
context needs to resume, because the next iteration will not remember this one:

- **PROGRESS**: which phases are DONE, with their commit SHAs, and where to resume.
- **LOCKED DECISIONS**: choices already settled with the user, so they are never
  reopened.
- **The phases**: each a small, ordered, independently verifiable sub-plan.
- **Repo facts that bite**: the current migration head, how to run the tests, known
  slow spots, the commit convention, anything that wasted time once.
- **HYGIENE**: branch rules, one commit per sub-plan, and what counts as done.

If the user's spec is missing these, infer them (read the code, the git log, the
status doc) and fill them in before starting.

## One phase per context window

Do not try to run the whole batch in a single context. Each phase gets a fresh
window so a long batch never runs out of room mid-change, and so a mistake in one
phase cannot corrupt the next. At the end of a phase you checkpoint (below) and the
next firing starts clean.

### Each fresh context, first

1. Load the companion skills (the project guide, the house rules, plus any the spec
   names).
2. Confirm the working branch (never the default branch; work on a feature branch).
   Confirm the services or toolchain are up and healthy.
3. **Derive progress from git, not memory**: read the commit log on the branch and
   compare it against the spec's phase list to see which phases are already
   committed, then resume at the first sub-plan not yet committed. This is why one
   commit per sub-plan matters: the git log is the ground truth for where you are.

### Per sub-plan

1. Read the code you are about to change. Make the **smallest correct change** that
   satisfies the sub-plan, matching the surrounding style.
2. **Verify for real before committing.** Exercise the actual behavior (a test, a
   live probe), run the typecheck and linter, run any UI or integration checks the
   change touches, and re-run the project's standing regression gate. Restart
   whatever could be serving stale code first.
3. If a check fails, fix the root cause. **Never commit red**, and never weaken a
   test to make it pass.
4. Commit exactly this sub-plan, then push.
5. Update the task list so progress is visible.

### End of phase: checkpoint

When a phase is committed and pushed, hand off to the next phase with a fresh window
instead of pressing on:

- Post a short status of what shipped this phase.
- Schedule the next iteration with a prompt that is the **full loop spec with
  PROGRESS updated**: mark this phase DONE with its commit SHA, note anything the
  next phase needs (a new migration head, moved files), and point to the next phase.
  Handing the whole spec forward is what lets a cold context resume cleanly.

Keep going phase by phase until every phase is committed and pushed.

### End of loop

When all phases are done, verified, committed, and pushed:

- Restart the stack so the user runs against fresh code.
- Post a **final summary**: what shipped per phase, the test results, and the exact
  human follow-ups (see below).
- Stop the loop rather than scheduling another iteration.

## Commits

- One commit per sub-plan, subject prefixed by area (the repo's convention).
- In the user's name only. **No AI attribution**: no `Co-Authored-By`, no "generated
  with" trailer. Follow the house-rules skill for voice and formatting.
- For multi-line commit messages, write the message to a file and
  `git commit -F <file>`. Do not rely on the shell's here-string syntax being
  portable; it differs between shells and silently corrupts messages.
- Never commit to the default branch. Opening PRs is the user's call unless they ask.

## Testing must be real

The bar is "safe to ship after review", not "looks done". Exercise the actual
endpoint or function, seed throwaway data and clean it up, keep the regression gate
green, and keep the typecheck and linter at zero new errors. If something cannot be
verified in this environment (a live interview, real third-party credentials, a
scheduled job firing in production, perceptual quality), say so and mark it
**needs-human-check** in the final summary rather than claiming it works.

## Picking the wake-up delay

The scheduled wake-up between phases exists only to get a fresh window, not to wait
on an event, so a short delay is fine. If instead you are polling external state (a
CI run, a deploy), match the delay to how fast that state actually changes. To end
the loop, stop instead of scheduling again.

## Checklist

- [ ] On a feature branch; progress derived from the git log.
- [ ] Smallest correct change per sub-plan; surrounding style matched.
- [ ] Verified for real (behavior, types, lint, integration, regression gate) before commit.
- [ ] One commit per sub-plan, correct prefix, user's name, no AI trailer, pushed.
- [ ] Checkpoint with the full spec and updated PROGRESS, or stop when done.
- [ ] Final summary names every needs-human-check item.

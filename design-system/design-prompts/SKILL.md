---
name: design-prompts
description: Write high-quality design prompts (briefs) for Claude Design or any AI design tool, for any product. Use when asked to brief a designer or design tool on a new screen, flow, page or revision, when turning a product requirement into a design brief, when writing a revision prompt for an earlier design, or when reviewing a returned design against its brief. Covers gathering context, the section order that worked, the states every prompt must cover, mobile and accessibility rules, and an element-by-element review. Product-specific facts (brand, vocabulary, market) live in one file so the rest carries to other products.
---

# Writing design prompts

This skill distils about twenty design prompts written for Claude Design (new briefs, one revision, specs and guidelines). The rules below are the ones that repeat across them. Where a rule is inferred rather than stated, the knowledge file says so.

## Core idea

A design tool returns what the prompt makes possible. A prompt that lists data, people, states and constraints gets a design that can be built. A prompt that lists adjectives gets a mood board. Every prompt in our set therefore does three things: it says what the product really does today, it says who is looking and what changes for each of them, and it says exactly what to hand back.

## Workflow

1. **Gather context before writing.**
   - Read what exists: the current screens, the data model (field names and enums), the permissions per role, and any earlier prompt on the same area.
   - Separate what is live from what is planned. Planned features are named as such and not designed as available (landing-page-prompt.md, sale part of 03-sales.md).
   - Collect the real data shapes: statuses, flags, optional fields, counts. Prompts that listed them (01-properties-with-applications.md, 02-tenant-home.md) got designs that carried them.
   - Write down what is broken today and why. The merged-page brief lists current inconsistencies so the designer ends them (requests-and-tasks-prompt.md).
   - Know the brand tokens and put them in the prompt verbatim (see `knowledge/heimly-specifics.md` for an example set).
2. **Structure the prompt** using the template below and `knowledge/prompt-structure.md`.
3. **Cover the states.** Use `knowledge/states-and-edge-cases.md` as a checklist. Name each state in the prompt. Unlisted states do not get designed.
4. **Check the prompt against the do and don't list** in `knowledge/dos-and-donts.md` before sending.
5. **Send, then review the returned design element by element** with `knowledge/review-checklist.md`. Do not accept "close enough". Silent omissions are the most common failure.
6. **Revise with a revision prompt**, not a rewrite. A revision names the file to leave untouched, lists what to keep exactly, then lists numbered changes (signup-journey-revision-prompt.md).

## Prompt template

Copy this order. Cut sections that do not apply; do not reorder without a reason.

```
# Design prompt: <screen or flow name>

## What you are designing
Two or three paragraphs. The product in one line, the problem today,
what is being merged, replaced or added. State the judging question
("can the person tell within five seconds what needs them?").

## Rules of this journey / page   (optional, 3 to 5 numbered rules)
The principles that settle arguments.

## Who is looking, and what changes
Per role: what they own, what they see, what they cannot do.
A table when arrival points or roles map to destinations.

## Be honest about what exists
What is live, what is planned, what is thin or missing in the backend.
Name features that must not be shown as available.

## The data
Every field the screen can show, with enums spelled out, optional
fields flagged, and which fields are only available on the detail view.

## The flow / the shape
Numbered steps, lifecycle tables (status, meaning, who moves it on),
the rules the design must respect, and how records link to each other.

## What to design
Numbered list of deliverable pieces: the main view, the row, the
detail, dialogs, the dashboard card, the other roles' views.

## States
Loading, empty (first run), empty (no results), partial, error,
pending, conflict, permission denied, offline, done, plus the
domain-specific ones.

## Brand and rules
Tokens, type, currency and date formats, widths, theme, touch
target, accessibility floor, copy rules.

## What I want back
Widths, clickable or static, control bar options, the exact paths
to show, and a short note of decisions (and, if wanted, push-backs).
```

## Knowledge files

- `knowledge/prompt-structure.md`: section order, what each section contains, how to word constraints, length and tone of a prompt.
- `knowledge/design-rules.md`: reusable layout, type, colour, component, data display, form, navigation, motion and writing rules.
- `knowledge/dos-and-donts.md`: one-line rules with the reason and the source prompt.
- `knowledge/states-and-edge-cases.md`: the state checklist and the edge cases prompts call out.
- `knowledge/review-checklist.md`: how to check a returned design against the prompt.
- `knowledge/heimly-specifics.md`: brand, colours, tone, market context and vocabulary for Heimly. Read this only when the product is Heimly.

## Using it for another product

Swap `heimly-specifics.md` for a file of the same shape: tokens, type, currency and date format, widths, tone, market context, vocabulary, features that are not live. Everything else applies unchanged.

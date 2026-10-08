# Prompt structure

How our design prompts are built. Source files are named in brackets. "Inferred" means the pattern shows across prompts but no prompt states it as a rule.

## Two families of prompt

1. **Screen briefs** (01-properties-with-applications.md, 02-tenant-home.md, 03-sales.md): brand block, then the shape of the screen, then data, then states, then copy rules, then what to hand back. Long on data, short on layout.
2. **Journey and page briefs** (signup-journey-prompt.md, landing-page-prompt.md, deals-in-messaging-prompt.md, payments-and-escrow-prompt.md, requests-and-tasks-prompt.md): "What you are designing", numbered rules, who arrives from where, screen by screen, states, rules, deliverables. Long on flow and constraints.

Large programme briefs (admin-design-prompt.md, growth-and-rentops-design-prompt.md) are a third shape: brand, then numbered parts and sections, then a shared STATES block, EDGE BEHAVIORS, RESPONSIVE and DELIVER. Use it when one prompt covers many screens.

## Section order that converged

1. **Title and what you are designing.** The product in one line, the situation today, what changes. Say plainly that something is a merge, a replacement, an addition or "not a redesign of X" (deals-in-messaging-prompt.md: "This is not a messaging redesign").
2. **A judging question.** One sentence the designer can use to settle any trade-off, repeated in the briefs that mattered most: "does the person get back to what they came to do, in as few taps as possible, on a phone?" (signup-journey-prompt.md); "can the person tell within five seconds what needs them today?" (requests-and-tasks-prompt.md); "does each person always know who pays, who receives, how much, and where the money is?" (payments-and-escrow-prompt.md).
3. **Numbered rules of the journey or page** (three to five). Examples: never lose the intent; work it out before asking; only ask what changes what we show (signup-journey-prompt.md). Every visitor finds themselves fast; show the product, not adjectives; one primary action per section; real data only (landing-page-prompt.md).
4. **Who is looking.** Roles, with what each owns, sees and cannot do. A table of "arrives from, we can tell they are, they should end up" when entry points matter.
5. **What exists today, honestly.** What is live, what is thin, what is missing. 03-sales.md spends a full section on this because "if you assume the product already works, you will design the wrong thing". landing-page-prompt.md lists "not live yet, so do not present as available".
6. **The data.** Field lists, enums, optional fields, flags, counts. See "Data blocks" below.
7. **The flow.** Numbered steps, lifecycle tables, rules the design must respect, how records link.
8. **What to design.** A numbered list of the pieces, each with its contents.
9. **States.** Named list, never "and the usual".
10. **Brand and rules.** Tokens, type, formats, widths, theme, touch targets, accessibility, copy rules. In screen briefs this comes near the top; in journey briefs it comes near the end. Either is fine; keep it in one block (inferred).
11. **What I want back.** Widths, interactivity, control bar, exact paths to show, and a short decisions note.

## What the context section must give

- The product and who uses it, in two sentences.
- The current pain, concretely ("the same leaking tap shows up on two pages, with two status vocabularies", requests-and-tasks-prompt.md).
- Where the screen sits in the product (which sidebar section, which tab, which other brief it hands off to). Companion briefs are named and the boundary stated (deals-in-messaging-prompt.md and payments-and-escrow-prompt.md point at each other).
- What is explicitly out of scope and why ("Applications stay a separate destination... do not design applications into this page", 02-tenant-home.md).
- Room to leave for later work: "leave the structure able to carry a second kind of row" (01-properties-with-applications.md). Leave space, not a disabled button (02-tenant-home.md, 03-sales.md).

## Data blocks

- List fields by their real names or real labels, with enums spelled out (`PENDING`, `APPROVED`, ...).
- Mark what is only available on open (detail) versus list. "Design the list so it does not need these" (requests-and-tasks-prompt.md).
- Say which fields are different questions people confuse: balance, arrears and month balance (02-tenant-home.md).
- Say what data does not exist: "no comments, no chat thread, no full activity log" (requests-and-tasks-prompt.md); "design the timeline from those timestamps and nothing more".
- State derived rules: availability wins over publish status when they disagree (01-properties-with-applications.md).

## Wording constraints

- Use "must", "never", "exact" for hard rules; use "decide whether" and "propose" where the designer should think (01-properties-with-applications.md asks whether a chart earns its space or four numbers say it better).
- Give the reason with the rule ("a queue that is not visible is a queue that rots", 01-properties-with-applications.md). Reasons let the designer apply the rule to cases the prompt did not list.
- Ask for opinions where you want them: "Write two or three options" for headlines, "propose the name" for a merged page. And say when you do not want them: the revision prompt ends "Do not add a 'Where I would push back' section" (signup-journey-revision-prompt.md).
- Give decision points as options on a control bar rather than choosing for the business: marketing consent default on or off, wording A or B (signup-journey-revision-prompt.md).
- Use tables for lifecycles, arrival points and role matrices; use bullets for data; use prose for reasons.

## The "what I want back" block

Every prompt ends with deliverables, and they are specific:

- Widths (see `design-rules.md`), and both of them, first-class.
- Clickable or static. Journey briefs ask for clickable, with a **control bar** to switch entry point, role, state and options.
- The exact paths to show end to end ("a renter who tapped Apply, a landlord from the pricing page, an agent from the home page, an invited team member").
- A short note of decisions: screen and tap count per path, section order and why, page weight, names chosen, colour mapping.
- Optionally, push-backs ("anything in this brief you would push back on", used in most journey briefs; dropped in the signup revision).

## Revision prompts

From signup-journey-revision-prompt.md:

- Say it is a revision, which file it revises, and the new file name. Leave the original untouched so both can be compared.
- Say who reviewed the original and what they asked for.
- A **Keep exactly as it is** list, before any change. This protects approved work.
- **Numbered changes**, each with a rule and a table or a before and after where useful.
- Tell the designer to **remove, not shrink** when the problem is too much on screen.
- Offer wording options on a control bar when stakeholders disagree.
- Restate the unchanged rules so the prompt stands alone.
- A measurable test for the change ("on a 390 by 844 phone, judge by what is visible without scrolling").

## Length

Our briefs run from about 6 KB to 14 KB. Long is acceptable because every section is something the designer would otherwise have to guess. Shorter is only right when a guideline file already holds the shared rules (inferred: the deals and payments briefs repeat the token block; a skill or a reference file could hold it once).

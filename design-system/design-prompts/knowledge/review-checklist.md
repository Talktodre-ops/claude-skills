# Reviewing a returned design against the prompt

How we check a design element by element. The method comes from the mobile round (mobile-implementation.md) and from the revision prompt, which exists because a first design drifted from what was wanted. The checklist as a whole is partly inferred: our files describe the checks for built screens and the points a revision fixed.

## Principle

Nothing is dropped in silence. Every element the prompt asked for is either present, or named as a deliberate omission with its reason (admin-mobile-guidelines.md: "Anything the spec leaves out is named in the report as a deliberate omission with its reason").

## Steps

1. **Build a list from the prompt before looking.** One line per requested element: each screen, each width, each state, each path, each control-bar option, each data field the prompt listed, each rule. Tick them off while reviewing. A prompt written with numbered "what to design" items makes this list for you.
2. **Open the design at the reference widths** named in the prompt. For built screens we used 360 by 740, 393 by 852 (the reference), 430 by 932, 820 by 1180 and 1524 by 918 on a real browser with device emulation (mobile-implementation.md). For a design file, use the two widths the prompt asked for and a narrower phone.
3. **Go element by element, not screen by screen.** For each screen compare to the prompt for: data shown, hierarchy, the one primary action, copy, states, roles. Take a screenshot per state, not just the default.
4. **Check the paths end to end.** Click through each path the prompt named. Count screens and taps and compare with the design's own note (signup briefs asked for the counts).
5. **Check every control-bar option** produces the state it names, including role switches and wording options.
6. **Run the hard checks** below.
7. **Write findings as fixes.** "Every deviation went back with the fix spelled out" (mobile-implementation.md). Do not write "improve spacing"; write "stack the buttons full width, primary on top".
8. **Re-verify after the change**, and diff what should not have moved (mobile-implementation.md diffed the unchanged desktop pixel by pixel, byte equal or live-data differences only).

## Hard checks

Layout
- No sideways page scroll at any width (scrollWidth equals innerWidth).
- No interactive element under 44 by 44 px on touch. Native checkboxes and radios are an accepted exception when their label row is 44 px; list them rather than hide them.
- No text under 11 px on phone.
- Fixed bars and sheets pad for safe areas; the cookie bar does not cover the form.

Content
- Every data field the prompt listed is shown, or its omission is explained.
- Money is exact, labelled, and uses the stated format.
- Copy: no em dashes, no country name where forbidden, no codes or internal names, errors say what happened and what to do, plain nouns for each role.
- No invented numbers, quotes, logos or features. Planned features are marked or absent.

Colour and type
- Only the prompt's tokens. The accent appears once per screen or section for the primary action.
- Semantic colours are used for meaning only and are distinct from the accent.
- Each status has one pill design and one colour on every surface.
- Contrast passes AA: spot check muted text on tinted fills.

States
- Each state in the prompt is drawn: loading, both empties, error, pending, conflict, permission denied, offline, plus domain states.
- Skeletons match the final layout.
- Rejections and voids show a reason.

Behaviour
- The right action is offered to the right role; others see who the item is waiting on.
- Moves of money or commitments confirm with amount and recipient.
- Destructive actions require typed confirmation and a reason.
- Filters and tabs appear in the URL where the prompt asked.
- Intent and typed input survive every step in a journey.

## Patterns to send back (from our review rounds)

- Nested frames, a card inside a card (mobile-implementation.md).
- Stacked controls that should share a row, such as Filters under the search field.
- A sentence that is only true on one rendering of the screen.
- Shadows on list cards.
- A full-width button for a menu trigger.
- Multiple status colours for one meaning (requests-and-tasks-prompt.md).
- A first screen with too much on it: remove, do not shrink (signup-journey-revision-prompt.md).
- Labels the audience does not use for themselves (signup-journey-revision-prompt.md).
- Questions that block the fastest path.
- A disabled placeholder where space was asked for.

## What does not go back

Only blockers and false statements about money, availability or privacy need a rework round. Cosmetic differences become notes for the owner. (This echoes a standing preference on our team to land work rather than over-engineer; it is not stated in the prompts themselves.)

## Output of the review

A short list: what matches, what is missing, what deviates with the fix, what is a deliberate omission and why, and open questions for the owner. Keep the design file of record and the review notes together so a later revision prompt can cite them.

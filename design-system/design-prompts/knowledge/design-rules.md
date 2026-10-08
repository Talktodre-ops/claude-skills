# Design rules (reusable)

Rules that recur across the prompts and guidelines. Colour and type values are examples from Heimly; swap in your own tokens. Source in brackets. "Inferred" marks a pattern seen but not stated.

## Principles

- **Say the thing.** A screen answers one question and puts the next one tap away. Lead with the number, name or state the person came for (design-guidelines.md).
- **Real data or no data.** Nothing invented. If a figure cannot be computed honestly, say so in a sentence and never draw a line through a handful of points (design-guidelines.md; landing-page-prompt.md: "leave a clearly labelled slot that says where the number comes from").
- **Read on a phone, compose on a desktop.** Small screens show what a decision needs; big screens carry the full tools (design-guidelines.md, admin-mobile-guidelines.md).
- **Never make the person decode.** No raw errors, no codes, no internal names. Controls say what happens (design-guidelines.md).
- **Consistency beats novelty.** One pill for status, one card for a row, one sheet for anything transient, one way to filter. A pattern used once is a decision, twice a rule, three times a component (design-guidelines.md).
- **Judge by the person's task.** Every journey brief ends its framing with one question about the person getting their job done in few taps (signup, landing, requests briefs).

## Layout and widths

- Design phone and desktop as first-class. Reference widths in our briefs: 393 and 1524 (screen briefs), 390 and 1440 (journey briefs), 1180 minimum (admin desktop), tablet in between. Pick one pair per project and hold it (see the inconsistency note in the report to Dre).
- Phone first when most users are on phones (landing-page-prompt.md: 90 percent of visitors).
- Three modes: phone under 768, tablet 768 to 1279, desktop 1280 and up. Author mobile first (admin-mobile-guidelines.md).
- No page scrolls sideways. Deliberate swipe rows show a peek of the next card (landing-page-prompt.md).
- Two columns only above 1024 (design-guidelines.md).
- Respect safe areas on fixed bars and bottom sheets (admin-mobile-guidelines.md).
- Running text tops out near 65 characters (design-guidelines.md).

## Spacing, radius, elevation

- 8 px grid with 4 px half steps. Cards 16 inside, 12 apart. Gutters 16 on phone, 24 on tablet (design-guidelines.md).
- Cards and inputs 12 radius, sheets and modals 16, pills fully round.
- Shadows only for things that float: menus, modals, drawers. A list of shadows reads as a pile. Never a card inside a card (design-guidelines.md, mobile-implementation.md).

## Type

- Three roles: display face for titles and big numbers, body face for UI, a tabular or mono face for figures, codes, references, money and dates (admin-design-prompt.md, landing-page-prompt.md, requests-and-tasks-prompt.md).
- Tabular numerals wherever digits align (design-guidelines.md; 01-properties-with-applications.md uses a secondary face for table figures).
- Scale from design-guidelines.md: titles 26 (17 compact on phone), card titles 15, body 13, notes 12, mono facts 12, never under 11 on phone, never under 10.5 anywhere. Inputs use 16 on phone so iOS does not zoom.
- Sentence case. Uppercase only for small mono section labels and table headers.

## Colour

- One accent, spent on the single primary action per screen (per section on long pages) and on active navigation. Everything else is quiet (every prompt).
- Semantic colour (success, warning, danger, info) is separate from the accent and used only for meaning, never decoration. Semantic colours must be distinct from each other and from the accent (growth-and-rentops-design-prompt.md; growth-screens-spec.md: "None of them borrow the orange").
- Neutrals chosen slightly warm so they sit with a warm accent (01-properties-with-applications.md).
- Colour is never the only signal: pills carry a word as well as a dot (design-guidelines.md).
- One colour per meaning, used identically on every surface. Write the mapping down for each lifecycle (requests-and-tasks-prompt.md, which found "In progress" in three colours).
- Theme: screen briefs ask for light and dark, both complete, "not an inversion" (01 to 03). The admin and growth briefs say light only. State which, per project.

## Components

- **Status pill:** one component, a dot plus a tone plus a plain word (design-guidelines.md).
- **Buttons:** one primary per screen; secondary outlined; tertiary text. Loading keeps the width (design-guidelines.md).
- **Lists and tables:** desktop table becomes a card list on phone. A card is an identity line, a status pill, and at most two facts; the rest opens in a sheet. One query, one row type, two renderings (admin-mobile-guidelines.md).
- **Rows with linked records are one row.** A request and its linked task are one piece of work, shown once (requests-and-tasks-prompt.md).
- **Filters:** a search field with a Filters button beside it and a count badge; sheet with segmented controls; Apply and Clear pinned; active filters as removable chips (design-guidelines.md).
- **Filters live in the address bar** so a filtered view can be shared (01-properties-with-applications.md, 03-sales.md). Tabs live in the URL too.
- **Sheets, drawers, dialogs:** transient things are sheets. Bottom sheets for forms and menus, full sheets for records on phone, side drawers on desktop. Confirmations are centred dialogs with stacked buttons, primary on top (design-guidelines.md).
- **Toasts:** one line, above any tab bar, an action when there is one (design-guidelines.md). Make them specific: "Payment recorded, receipt HR-000231 issued" (growth-and-rentops-design-prompt.md).
- **Charts:** 160 to 200 tall on phone, three axis labels, legend as dots under the title, an explicit sparse state (design-guidelines.md; admin-design-prompt.md).
- **Editors:** grouped toolbar that scrolls on phone, a details sheet for metadata, a publish bar that never wraps (admin-mobile-guidelines.md).
- **Deal or step cards inside a thread:** compact, one clear action each, updating in place, text never pushed out of view (deals-in-messaging-prompt.md).

## Data display

- Money is exact and labelled: who pays, who receives, the amount, fees, status. Never rounded (02-tenant-home.md, 03-sales.md, deals and payments briefs).
- Show a total as its parts when people confuse them: balance, arrears and this month's amount side by side (02-tenant-home.md).
- Make large numbers readable at a glance, not a wall of digits (03-sales.md).
- Quote a recurring price in the period people think in, with the other as subtext (01 and 02: yearly rent with the monthly figure beneath).
- Dates: absolute where precision matters, relative ("due in 3 days") where it helps (growth-and-rentops-design-prompt.md, design-guidelines.md).
- Summary strips use honest numbers (new, overdue, in progress, done this month) rather than a chart that recounts whatever tab is open (requests-and-tasks-prompt.md).
- A progression of flags is shown as one readable path, not separate flags the user assembles: waiting, approved, lease drafted, lease active (01-properties-with-applications.md).
- Claims versus facts look different: a confirmed payment is a fact, a ticked box is a claim (03-sales.md). Reported but unconfirmed money is visibly pending on both sides (02-tenant-home.md, growth-and-rentops-design-prompt.md).
- Comparison, not queue, when several offers compete: design for side-by-side and make the recommended one obvious, with why (03-sales.md).
- Tables work at 3 rows and 3,000, or 10 and 100,000, with the same design (growth and admin briefs).

## Forms

- Labels above fields, one field per row, 44 px inputs, help text under, errors under in the danger colour with a sentence on how to fix it (design-guidelines.md).
- Sticky submit row in a sheet (design-guidelines.md).
- Correct keyboards, autofill for name, email, password, one-time code; keyboard never hides the active field (signup-journey-prompt.md).
- Accept real names (apostrophes, hyphens) and real formats generously (signup-journey-prompt.md; design-research.md).
- Ask only what changes what you show next. Every onboarding question must visibly change the next screen (signup-journey-prompt.md).
- Do not ask what you can work out. Pre-select, show "Joining as X, Change" (signup-journey-prompt.md, revision).
- A confirm password field and a terms checkbox were both dropped in favour of a show/hide eye and one line of text (signup-journey-prompt.md).
- Destructive actions use a typed confirmation and a mandatory reason, never a bare "Are you sure?" (admin and growth briefs).
- Every action that moves money or commits someone confirms with the amount and the recipient named (deals and payments briefs).
- A report form for a claimed payment should feel like two taps and a photo, not paperwork (02-tenant-home.md).

## Navigation

- Phone: bottom tab bar with the four most used destinations plus More; large title that collapses on scroll; search opens a full-screen sheet (admin-mobile-guidelines.md). Note design-research.md advises avoiding a More tab; the guidelines chose to keep it.
- Put queues where they are visible: a count badge on the parent nav item, because "a queue that is not visible is a queue that rots" (01-properties-with-applications.md). No badge at zero.
- Back never loses typed input (design-guidelines.md). The person always knows where they are.
- After a handoff to another part of the product, say where the thing now lives and offer a way to go there (01-properties-with-applications.md).
- A cross-account or cross-scope affordance shows names and counts only, never records (01-properties-with-applications.md).

## Motion

- Purposeful and brief: sheets slide, dialogs rise, lists do not animate rows. 150 to 250 ms, ease out. Honour reduced motion by dropping movement and keeping the fade (design-guidelines.md).
- No autoplay video or heavy animation on pages for slow connections (landing-page-prompt.md).

## Accessibility

- WCAG 2.2 AA floor: 4.5:1 text, 3:1 large text and controls; 44 px touch targets; 24 px minimum everywhere; visible focus; labels on every field; icon buttons labelled; sheets are dialogs with titles; keyboard navigable lists; reduced motion respected (design-guidelines.md).
- Alt text on every product image, headings in order, real text rather than text in images (landing-page-prompt.md).

## Writing and tone

- Plain words from the user's side of the screen: they have a home, not an "occupancy record" (02-tenant-home.md).
- The right noun for the relationship: buyer and seller, not tenant and landlord, on sale screens (03-sales.md).
- Errors say what went wrong and what to do next, like a sentence a support person could say aloud (design-guidelines.md).
- Buttons say what happens, then the result: "Publish", then "Published" (design-guidelines.md).
- No em dashes in labels or body copy (01 to 03, growth brief).
- No exclamation marks, no jargon, no internal identifiers in prose (design-guidelines.md).
- Serious moments (arrears, rejection, voided rewards) are serious without being punitive or accusing (02-tenant-home.md, growth-and-rentops-design-prompt.md).
- Good states are allowed to feel good: "Paid up, nothing due. Make this feel good" (02-tenant-home.md).
- Empty states point at what the person can do, never apologise (01 and 02).

## Privacy and trust in the UI

- Show a preview of exactly what a recipient will see, so nobody has to trust a promise (growth-screens-spec.md, location rule).
- Never show another person's private details beyond what they agreed to share (growth-and-rentops-design-prompt.md).
- Explain money custody in plain words: "held safely" before "escrow balance" (payments-and-escrow-prompt.md).

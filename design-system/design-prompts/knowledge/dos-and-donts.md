# Dos and don'ts

One line each, with the reason and the source. Items marked "(revision)" were corrections made after the first design came back, so they record what went wrong.

## Writing the prompt

**Do**
- Do state what is live and what is not. Why: the designer will otherwise assume it all works (03-sales.md, landing-page-prompt.md).
- Do list real field names and enums. Why: designs then carry every state the data can be in (01, 02).
- Do give the reason with each hard rule. Why: the designer can then apply it to cases you did not list (01).
- Do name the roles and what each cannot do. Why: an agent who cannot assign needs the button absent, not disabled (requests-and-tasks-prompt.md).
- Do list the states by name. Why: states left unnamed are not designed (all briefs).
- Do list the exact end-to-end paths you want shown. Why: it forces the whole journey, not a hero screen (signup, landing briefs).
- Do ask for a decisions note with screen and tap counts. Why: makes trade-offs reviewable (signup-journey-prompt.md).
- Do put planned features in a separate, removable "coming soon" option. Why: the page must not promise what is not live (landing-page-prompt.md).
- Do state the boundary with companion briefs. Why: stops the designer folding two jobs into one screen (deals and payments briefs, 02-tenant-home.md).
- Do leave decisions the business owns as a control-bar option. Why: both can be judged on one screen (signup revision: marketing default, wording A or B).
- Do say that example values are examples. Why: fee percentages and thresholds were undecided (payments-and-escrow-prompt.md).

**Don't**
- Don't describe a mood. Describe data, people, states. Why: adjectives do not make a buildable design (inferred from all briefs).
- Don't say "and the usual states". Why: see above.
- Don't let the prompt assume a backend feature exists. Why: "if you assume the product already works, you will design the wrong thing" (03-sales.md).
- Don't ask for a feature that cannot be real, such as card payment when the product only records money. Why: leave space instead of a disabled button (02, 03).
- Don't paste long reference material when a short rule will do (inferred).

## Revising

**Do**
- Do tell the tool to save as a new file and leave the original untouched. Why: the two are compared side by side (signup-journey-revision-prompt.md).
- Do list what to keep exactly before listing changes. Why: stakeholders approved most of it (revision).
- Do remove rather than shrink when a screen shows too much. Why: shrinking keeps the clutter (revision).
- Do give a measurable test, such as what is visible without scrolling on a named phone size. Why: "calmer" is not checkable (revision).
- Do use words the audience uses ("I am: Tenant or buyer, Landlord, Agent, Company"). Why: "Find tenants and buyers for others, then Just me or A brokerage firm" was not how people describe themselves (revision).
- Do move non-essential questions out of the critical path and into a dismissible card after landing. Why: sign-up must be the fastest path (revision).
- Do restate the unchanged rules in the revision prompt. Why: it must stand alone in the same project (revision).

**Don't**
- Don't ask for "Where I would push back" again once the review is done. Why: the revision explicitly removed it (revision).
- Don't put descriptions inside option cards on a small screen. Why: short labels only, compact chips or a 2 by 2 grid (revision).
- Don't add a terms checkbox or a field that can be filled automatically (referral code from a link). Why: friction costs sign-ups (revision, signup-journey-prompt.md).

## Layout and components

**Do**
- Do one primary action per screen or section in the accent. Why: it is the only loud colour (all briefs).
- Do show a count badge on the parent nav for a queue. Why: hidden queues rot (01).
- Do turn tables into card lists on phones. Why: squished rows are unusable (admin briefs, mobile-implementation.md).
- Do keep a request and its linked task as one row. Why: two rows for one piece of work confuses (requests-and-tasks-prompt.md).
- Do show one status pill design with one colour per meaning everywhere. Why: the same status appeared in three colours (requests-and-tasks-prompt.md).
- Do show a progression as one readable path. Why: four separate flags have to be assembled in the head (01).
- Do put filters and tabs in the URL. Why: filtered views can be shared (01, 03).
- Do use a bottom sheet for any dialog with a form on a phone (admin-mobile-guidelines.md).
- Do name where a record now lives after a handoff. Why: people approved an application then could not find what happened (01).
- Do design the comparison view when several offers compete. Why: sellers compare, they do not queue (03).

**Don't**
- Don't nest a card in a card or give a list of cards shadows. Why: sent back in review as a mistake and a pile (mobile-implementation.md).
- Don't put row actions as tiny inline icons on touch. Why: under 44 px; use the sheet or an overflow menu (admin-mobile-guidelines.md).
- Don't stack controls that should share a row, such as the Filters button under the search field. Why: sent back in review (mobile-implementation.md).
- Don't let a subtitle be true on only one rendering ("Select a row" over a card list). Why: fixed to "Tap a card" under the desktop width (mobile-implementation.md).
- Don't use a donut that recounts the open tab. Why: on Archived it charted archived items and misled (requests-and-tasks-prompt.md).
- Don't keep controls that do nothing ("Mark as Spam") or duplicate ones (Confirm shown inline and in a menu). Why: requests-and-tasks-prompt.md.
- Don't use a disabled button as a placeholder for a future feature. Why: leave empty space (02, 03).
- Don't draw a chart through a handful of points. Why: design the sparse state (design-guidelines.md, admin brief).
- Don't merge cross-account lists where the product is scoped to one account. Why: show names and counts only (01, 03).

## States and behaviour

**Do**
- Do give every list loading, empty and error (design-guidelines.md).
- Do separate "nothing exists yet" from "no results for these filters" (admin and growth briefs).
- Do use content-shaped skeletons, never a lone spinner (admin brief).
- Do let a failing widget degrade alone (admin brief).
- Do show a pending claim as pending on both sides, without implying it is settled and without making the person feel doubted (02).
- Do show a reason with every rejection or void, in words that do not accuse (02, growth brief).
- Do use typed confirmation and a mandatory reason on destructive or moderation actions (admin brief).
- Do show who acted first on a conflict (admin brief).
- Do disable with an explanation, not silently (last Super Admin cannot be demoted, admin brief).
- Do protect typed input and intent through every step (signup-journey-prompt.md).

**Don't**
- Don't show raw server strings or codes. Why: nobody can act on them (design-guidelines.md).
- Don't use "Are you sure?" alone (admin brief).
- Don't strand an empty page after deleting the last row on a page (admin and growth briefs).
- Don't imply a rented property is still available because it is still published. Availability wins (01).
- Don't treat a buyer as a tenant in copy. Why: wrong and slightly alarming (03).

## Brand, copy and compliance

**Do**
- Do use the exact tokens and the real logo. Why: "do not invent a palette"; never a drawn substitute (admin, growth briefs).
- Do state the currency and date format and where they apply (all briefs).
- Do write errors as what went wrong plus what to do next (all briefs).
- Do show the sharer what the recipient will see (growth-screens-spec.md).
- Do hide private data by rule and show that it is hidden (growth brief: street address never leaves the platform).

**Don't**
- Don't use em dashes in copy (01 to 03, growth brief).
- Don't name a country in copy where the product must not read as tied to one (01 to 03, growth brief). Note the journey briefs do name the market; see heimly-specifics.md.
- Don't invent numbers, testimonials, logos or features (signup, landing, requests briefs).
- Don't use stock photos or adjectives as proof. Show a real screen (landing-page-prompt.md).
- Don't round money (02, 03).
- Don't put text inside images on pages that must be indexable (landing-page-prompt.md).

## Mobile and accessibility

**Do**
- Do design the phone for one thumb: primary action reachable, 44 px targets (all journey briefs).
- Do keep the cookie bar slim and at the bottom, never over the form (signup briefs).
- Do check on a slow connection: light assets, lazy images, no autoplay video (landing-page-prompt.md).
- Do make the 44 px and 11 px floors a script check, not a review comment (mobile-implementation.md).
- Do diff the unchanged desktop to prove nothing moved when you only add mobile (mobile-implementation.md).

**Don't**
- Don't scroll the page sideways (admin-mobile-spec.md).
- Don't let the keyboard hide the field being typed in (signup briefs).
- Don't rely on colour alone (design-guidelines.md).
- Don't animate list rows (design-guidelines.md).

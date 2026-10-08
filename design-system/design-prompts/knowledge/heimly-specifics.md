# Heimly specifics

Everything in the prompts that only applies to Heimly. Other products replace this file. Sources in brackets.

## What Heimly is

A property platform for Nigeria. Renters and buyers find verified homes, talk to the owner or agent, apply and move in. Landlords, agents, brokers and developers list properties, get verified, and run tenants, rent and teams from one dashboard (landing-page-prompt.md, signup-journey-prompt.md). Heimly records rent and sale money paid elsewhere; it does not yet move money (payments-and-escrow-prompt.md, 02-tenant-home.md).

## Brand tokens

From design-guidelines.md and the brief token blocks. Hex values are exact, do not invent a palette.

| Role | Name | Value |
|---|---|---|
| Ink, headings, primary surface | Navy | `#14213c` |
| Single accent, one primary action | Orange | `#f48741` (hover `#e9762f`) |
| Secondary emphasis and links | Deep blue | `#113384` |
| Body text in early briefs | Near black | `#101010` |
| App ground | Warm off white | `#f1f0ea` |
| Surfaces | White | `#ffffff` |
| Muted panels | | `#fafaf7` |
| Chips | | `#f4f3ee` |
| Muted text | | `#4e5872` |
| Faint text | | `#8c93a5` |
| Success | | `#0e7c66` on `#e4f1ec` |
| Warning | | `#8a5e12` on `#fbf1dc` |
| Danger | | `#b32338` (growth spec fill `#fbeeef`) |

Growth state pills (growth-screens-spec.md): invited grey `#4e5872` on `#f1f0ea`; signed up blue `#113384` on `#e7eaf6`; qualified green; rewarded dark green `#0a5f4e` on `#d6ede5`; voided red; flagged purple `#5b3fa8` on `#efeafb`. None borrow the orange.

Type: Cabinet Grotesk for titles and big numbers; Uncut Sans for body; IBM Plex Mono for codes, references, money, dates and table headers. The early screen briefs (01 to 03) instead say Cabinet Grotesk for headings and body and Uncut Sans for figures; the later guidelines are the current rule. The real Heimly logo is used, never a drawn one (growth brief).

Accent use: one primary action per screen, or per section on the landing page; active navigation.

Themes: screen briefs 01 to 03 ask for light and dark, both complete. Admin and growth briefs say light only.

## Market and format

- Currency is the Naira: `₦450,000` in the screen briefs and journey briefs, `N25,000,000` in the admin and growth briefs (a text fallback). Prefer the symbol.
- Thousands separators always. Sale prices are large: make them readable (`₦85,000,000`, 03-sales.md).
- Rent is quoted per year with the monthly figure as subtext: `₦450,000/yr` above `₦37,500/mo` (01, 02).
- Time zone: West Africa Time on the admin, with relative time where it helps.
- Most rent is paid outside any platform: bank transfer, cash, sometimes cheque. Heimly does not block this; it wants the record to live in the product (02, 03, growth brief).
- Many users are on phones, often standing up, often on slow or patchy mobile data. 90 percent of landing page visitors are on a phone (landing-page-prompt.md). Staff on the admin are sometimes on Nigerian mobile data (admin brief).
- Local language: "flat", "self contain", places such as Lekki, Yaba, Gwarinpa, GRA Port Harcourt, Ibadan North West (landing-page-prompt.md, 01).
- People describe themselves as "I'm an agent", "I'm a landlord", "I have an estate firm" (signup-journey-revision-prompt.md).
- Identity checks: NIN, BVN, and CAC for companies; a verified badge on listings and profiles (landing-page-prompt.md). Trust badges: gold, silver, bronze (01).
- Gold badge verification requests appear in admin moderation (admin-design-prompt.md).

## Country naming: an inconsistency

The screen briefs (01 to 03) and the growth brief say never name a country in copy; the product "must not read as tied to one country". The journey briefs (signup, landing, deals, payments, requests) and the admin brief open with "a property platform for Nigeria" and the landing page asks for copy written for Nigeria. Read the first rule as applying to copy inside the product, and the second as describing the market to the designer (inferred). Dre should confirm.

## Tone

Plain, short, specific, sentence case. Written from the user's side. No exclamation marks, no jargon, no internal identifiers (design-guidelines.md). Atlassian-style microcopy in the app, more serious near money, KYC and leases (design-research.md synthesis). No em dashes in any label or body copy (01 to 03, growth brief). Support contact is a mailto link to the company support address (landing-page-prompt.md footer).

## Product vocabulary

- **Properties** destination with tabs **Listings** and **Applications**; a count badge of pending applications on the Applications tab and the sidebar entry (01).
- **Portfolio**: where a tenancy lives after a lease is created; tabs **Tenancies** and **Sales** (01, 03).
- **Home**: the tenant's single screen (02). Buyers need their own screen, not called a tenancy (03).
- **Rent roll**: one row per tenancy; replaces the old Payments page (growth brief B1). **Rent Ops** records money, does not move it.
- **Requests and tasks**: merged maintenance requests and team tasks. "Assigned property" tag for properties an agent manages for a landlord (requests-and-tasks-prompt.md).
- **Find agents**: the public directory of agent and company profiles with reviews.
- **Deal strip, deal cards, escrow**: deals in messaging and payments briefs.
- **Refer and earn**, **Growth** section in admin with tabs Programme, Referrals, Review.
- **Get started** list and the **getting-to-know-you** card (signup revision).
- **90 day Pro trial**, no card (signup, landing briefs). Plan names and prices come from the pricing page, never from a brief.
- **Import your book**: portfolio import from a spreadsheet.
- Roles: tenant or buyer, landlord, agent, company (agency or developer), team roles Owner, Admin, Member, External user. Admin roles: Super, Platform, Content, Support.
- An agent only ever sees one landlord's properties at a time, because the product is scoped to one active organisation; no merged cross-landlord list. Show names and counts only for other organisations (01, 03).
- Shared listing content shows area and city, never the street address or owner details (growth brief, growth-screens-spec.md).

## Product facts for a landing or marketing brief

Take the live list from landing-page-prompt.md ("What Heimly actually does today") and refresh it against the product before use. Features marked not live there: AI text search, the AI assistant, deals and escrow in messaging.

## Reference widths

Screen briefs: 393 phone, 1524 desktop. Journey briefs: 390 phone, 1440 desktop. Admin desktop minimum 1180. Tablet in between. These differ; see the inconsistency list in the report.

## Where things live

Prompts and specs are under `.agents/design/` and `.agents/design-prompts/` in the monorepo; guidelines are `design-guidelines.md`, `admin-mobile-guidelines.md`, `design-research.md`. The design showcase and exports are described in the repo notes, not here.

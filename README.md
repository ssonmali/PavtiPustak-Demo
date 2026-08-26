# पावती पुस्तक · Pavti Pustak — live demo

A working demo of Pavti Pustak, the vargani (contribution) receipt book a Ganesh
Mandal's volunteers use on their phones. Same app, same code — with the database
taken out, so it can be handed to anyone with a link.

**Sign in with:**

| | |
|---|---|
| Email | `volunteer@demo.pavtipustak.app` |
| Password | `ganpati` |

The credentials are printed on the login screen, and one button fills them in
and signs you in. Any email address works; only the password is checked.

A guided tour opens the first time you land on the dashboard, and the compass
button at the bottom of the screen brings it back.

## What you can try

- **Write a receipt** — type two letters of a donor's name and the app offers
  everyone who has given before, with their phone number
- **Send it** — the WhatsApp button opens a bilingual thank-you with a receipt
  image attached
- **Record a pledge** — money promised but not yet given, with the date it is
  expected. It never counts as collected, and the bell reminds you on the day
- **Take a part-payment** — a contribution paid in instalments
- **Spend some money** — the expense ledger, by category, and what is left
- **Look at the activity log** — every change, by whom, field by field
- **Print the report** — a ruled ledger for any date range, or export to Excel
- **Go offline** — turn off your network, enter a receipt, come back
- **Open it in two tabs** — they stay in sync, and each warns you when the other
  has the same receipt open
- **Switch to English** — the whole app is bilingual, Marathi by default

Nothing you do is visible to anyone else, and signing out puts the demo back the
way you found it.

## Is any of this real?

No. Every donor, phone number, contribution and bill is invented. The ledger is
generated fresh relative to the day you visit, so the pledges are due *today*
and the chart ends *yesterday* — but it is fiction throughout.

## How a full-stack app runs with no back end

The production app is Next.js on Supabase — Postgres, Auth, Realtime and
row-level security. Taking the database out changes **three files**:
`src/lib/supabase/` (server and browser clients) and `src/proxy.ts`. Every
page, dialog, Server Action, validation rule and query is the production code,
untouched.

In their place, `src/lib/demo/` answers the same query language from a seeded
ledger:

| | |
|---|---|
| `seed.ts` | the invented ledger, generated relative to today |
| `query.ts` | the slice of PostgREST the app uses — filters, ordering, ranges, counts |
| `views.ts` | the seven SQL views, transcribed into TypeScript |
| `journal.ts` | your changes, as a replayable list of operations |
| `db.ts` | seed + journal → the database this request sees |
| `server-client.ts` | the Supabase server client's shape, over the above |
| `browser-client.ts` | Realtime and editing presence, over BroadcastChannel |

Your session lives in a cookie — not the whole ledger, just the handful of
changes you have made, replayed onto the seed on every request. That is what
makes the demo survive a reload and a new tab, keep one visitor's edits away
from another's, and need no database anywhere.

The SQL the views are transcribed from is still in [`supabase/`](supabase/), so
the real data model is there to read.

## The animation

Seven more files carry motion, because a demo is watched as much as it is used.
`src/components/motion/` holds the vocabulary — four springs, a count-up, an
entrance, a page transition, a press — and the screens compose it:

- the balance and every stat tile **count to their figure**, and travel to the
  new one when you change the period filter
- the nav marker is a **shared element**: it slides from the tab you left to the
  tab you tapped, rather than disappearing and reappearing
- the chart's bars **grow from the axis**, one after the next along the month
- marking a pledge received **flies the row out** and closes the gap behind it,
  while the total counts down to match
- pages **swap** rather than cut, lists arrive **staggered**, and cards answer a
  press

Two things it does not do. It respects `prefers-reduced-motion` — the whole
system drops to a plain crossfade when the operating system asks, which is the
one setting a deliberately loud interface must not ignore. And the desktop
receipts *table* is left alone: a layout animation on a `<tr>` fights the
table's own column sizing, so only the phone's card list animates.

Every figure is also rendered at its real value on the server. A counter seeded
at zero would put `₹0` in the HTML, and a receipt book that reads zero until
JavaScript arrives is worse than one that never animated.

`npm run verify` covers the demo layer too: the view transcriptions and the
query engine have their own tests, because a view that drifts from its SQL does
not crash — it quietly shows the wrong money.

## Running it

```bash
npm install
npm run dev
```

No environment variables, no database, no setup. Deploying is the same: push it
at Vercel and it works.

| Command | |
|---|---|
| `npm run dev` | Dev server |
| `npm run verify` | Lint + typecheck + tests |
| `npm run build` | Production build |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Motion
(Framer Motion) · installable PWA

Built by [Sanket Sonmali](https://github.com/ssonmali).

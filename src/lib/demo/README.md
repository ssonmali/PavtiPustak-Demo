# The demo back end

There is no database in this build. This directory is what stands in for one.

## The rule it is built to

**No file outside this directory knows the demo exists**, apart from the three
that had to change: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`
and `src/proxy.ts`. Every page, Server Action and dialog is the production code.

That constraint is the whole design. A demo that is a rewrite proves nothing
about the app; a demo that is the app with a different storage layer under it
proves the storage layer was the only thing missing.

## How a request works

1. `server-client.ts` reads two cookies: who you are, and the journal — the list
   of changes you have made.
2. `db.ts` builds the ledger for this request: `buildSeed(today)` plus every
   journalled operation replayed on top.
3. The app queries it exactly as it queries PostgREST. `query.ts` answers.
4. A Server Action's write appends an operation to the journal, applies it to
   the request's own copy so the action can read it back, and writes the cookie.

## Why a journal and not a table

A cookie is 4KB. A mandal's ledger is not, but *your changes to it* are — an
evening of clicking is a few hundred bytes of `{kind: "insert", ...}`. Because
the seed is a pure function of the date, replaying that list is enough to
reconstruct your session anywhere: another tab, another serverless instance,
tomorrow's cold start. No shared state, so no visitor can ever see another's
edits, and there is nothing to reset between them.

When the journal does overflow, `encodeJournal` drops the oldest operation
rather than the session.

## What is deliberately fake

- **Auth** — any email, one password. There are no accounts to have.
- **Realtime** — `browser-client.ts` watches the journal cookie and posts
  presence over `BroadcastChannel`, so two tabs behave like two phones.
- **The audit trigger** — the activity feed is derived, in `buildActivity`,
  from the seed's timestamps and the journal. Production writes audit rows from
  a Postgres trigger.
- **RLS** — nothing to enforce; each visitor already has their own ledger.

## What is not fake

The views. `views.ts` is a transcription of the SQL in `supabase/`, function by
function, and each carries the migration file it came from. A pledge not
counting as collected, a part-payment counting once, a bill with no due date not
reading as overdue — those are the app's actual rules, and
`src/lib/__tests__/demo-views.test.ts` pins them.

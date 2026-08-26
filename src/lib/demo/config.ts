/**
 * Demo build configuration.
 *
 * This fork of Pavti Pustak has no backend. Every page, dialog and server
 * action is the production code, unchanged — only `@/lib/supabase/*` is
 * swapped for an in-repo fake that answers the same query language from seeded
 * data. See `src/lib/demo/README.md`.
 */

/** The account the demo hands out. Any password of six characters is taken. */
export const DEMO_EMAIL = "volunteer@demo.pavtipustak.app";
export const DEMO_PASSWORD = "ganpati";

/** A second volunteer, so attribution and the activity log have two voices. */
export const DEMO_PEER_EMAIL = "treasurer@demo.pavtipustak.app";

/** Cookie holding the signed-in demo email. */
export const SESSION_COOKIE = "pp-demo-session";
/** Cookie holding the replayable log of everything the visitor has changed. */
export const JOURNAL_COOKIE = "pp-demo-journal";

/**
 * Cookies are capped at 4KB, so the journal keeps only the most recent ops and
 * drops the oldest — a visitor who edits for an hour loses their earliest
 * change rather than the whole session.
 */
export const JOURNAL_MAX_BYTES = 3200;

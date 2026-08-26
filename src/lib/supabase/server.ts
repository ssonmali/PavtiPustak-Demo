import { createDemoServerClient } from "@/lib/demo/server-client";

/**
 * DEMO BUILD — there is no Supabase project behind this.
 *
 * The production file returned a cookie-backed Supabase client here. This one
 * returns the in-repo fake from `@/lib/demo`, which answers the same subset of
 * PostgREST that the app actually uses, over a seeded ledger plus whatever the
 * visitor has changed. Every caller — Server Components, Server Actions, Route
 * Handlers — is unchanged, and still awaits a fresh client per request.
 */
export async function createClient() {
  return createDemoServerClient();
}

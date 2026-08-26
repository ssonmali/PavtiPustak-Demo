"use client";

import { createDemoBrowserClient } from "@/lib/demo/browser-client";

/**
 * DEMO BUILD — see the note in `server.ts`.
 *
 * In the app the browser client is used only for Realtime: table changes and
 * editing presence. The demo answers both over BroadcastChannel, so two tabs
 * behave like two volunteers' phones.
 */
export function createClient() {
  return createDemoBrowserClient();
}

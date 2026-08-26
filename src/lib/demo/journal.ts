import { JOURNAL_MAX_BYTES } from "./config";
import type { LedgerTable } from "./db";

/**
 * One change a demo visitor made.
 *
 * The journal is the whole persistence story: the seeded ledger is a pure
 * function of the date, so everything that makes a session *yours* is this
 * list. It is small enough to live in a cookie, which means the demo survives a
 * reload, a new tab and a serverless instance changing underneath it — without
 * a database, and without one visitor ever seeing another's edits.
 */
export type Op =
  | {
      kind: "insert";
      table: LedgerTable;
      id: string;
      at: string;
      email: string;
      values: Record<string, unknown>;
    }
  | {
      kind: "update";
      table: LedgerTable;
      id: string;
      at: string;
      email: string;
      values: Record<string, unknown>;
    }
  | { kind: "delete"; table: LedgerTable; id: string; at: string; email: string }
  | {
      kind: "upsert";
      table: "volunteer_names";
      email: string;
      display_name: string;
      at: string;
    }
  | { kind: "delete"; table: "volunteer_names"; email: string; at: string };

export function encodeJournal(ops: Op[]): string {
  let kept = ops;
  let encoded = encodeURIComponent(JSON.stringify(kept));

  // Oldest first out. A visitor who has been clicking for an hour loses their
  // earliest edit rather than being logged out of their own session.
  while (encoded.length > JOURNAL_MAX_BYTES && kept.length > 1) {
    kept = kept.slice(1);
    encoded = encodeURIComponent(JSON.stringify(kept));
  }
  return encoded;
}

export function decodeJournal(raw: string | undefined): Op[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    return Array.isArray(parsed) ? (parsed as Op[]) : [];
  } catch {
    // A cookie from an older build of the demo. Starting clean is better than
    // a page that cannot render.
    return [];
  }
}

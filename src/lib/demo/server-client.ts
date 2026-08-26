import "server-only";

import { cookies } from "next/headers";
import {
  DEMO_EMAIL,
  DEMO_PASSWORD,
  DEMO_PEER_EMAIL,
  JOURNAL_COOKIE,
  SESSION_COOKIE,
} from "./config";
import { applyOp, buildDb, type DemoDb, type LedgerTable } from "./db";
import { decodeJournal, encodeJournal, type Op } from "./journal";
import { DemoMutation, DemoQuery, source, type Row } from "./query";
import { PEER_ID, USER_ID } from "./seed";

/** The shape `auth.getUser()` hands back, narrowed to what the app reads. */
export type DemoUser = { id: string; email: string };

function userFor(email: string | null): DemoUser | null {
  if (!email) return null;
  return { id: email === DEMO_PEER_EMAIL ? PEER_ID : USER_ID, email };
}

const SESSION_MAX_AGE = 60 * 60 * 12;

/**
 * A stand-in for the Supabase server client, backed by the seeded ledger and
 * the visitor's own cookie journal.
 *
 * Built per request, exactly like the client it replaces: the journal has to be
 * read fresh, and a client cached across requests would hand one visitor's
 * receipts to the next.
 */
export async function createDemoServerClient() {
  const cookieStore = await cookies();
  const ops = decodeJournal(cookieStore.get(JOURNAL_COOKIE)?.value);
  const email = cookieStore.get(SESSION_COOKIE)?.value ?? null;
  const db: DemoDb = buildDb(ops);

  /**
   * Server Components may not write cookies. They also never mutate, so this
   * only ever silently does nothing on a read — the same reason the real
   * client's `setAll` swallows the throw.
   */
  const persist = () => {
    try {
      cookieStore.set(JOURNAL_COOKIE, encodeJournal(ops), {
        path: "/",
        sameSite: "lax",
        maxAge: SESSION_MAX_AGE,
      });
    } catch {
      // Read-only cookie store. The change still applies to this render.
    }
  };

  /** Journal it, put it in the cookie, and make this request see it. */
  const record = (op: Op) => {
    ops.push(op);
    persist();
    applyOp(db, op);
  };

  const now = () => new Date().toISOString();

  function rowsOf(table: LedgerTable): Row[] {
    return db[table] as unknown as Row[];
  }

  function requireEmail() {
    if (!email) throw new Error("Unauthorized");
    return email;
  }

  return {
    from(name: string) {
      return {
        select(columns = "*", options?: { count?: "exact" }) {
          return new DemoQuery(() => source(db, name)).select(columns, options);
        },

        insert(values: Row | Row[]) {
          return new DemoMutation(() => {
            const who = requireEmail();
            const list = Array.isArray(values) ? values : [values];
            const written: Row[] = [];

            for (const value of list) {
              if (name === "volunteer_names") {
                const op: Op = {
                  kind: "upsert",
                  table: "volunteer_names",
                  email: String(value.email),
                  display_name: String(value.display_name),
                  at: now(),
                };
                record(op);
                written.push({ ...value });
                continue;
              }

              const op: Op = {
                kind: "insert",
                table: name as LedgerTable,
                id: crypto.randomUUID(),
                at: now(),
                email: who,
                values: strip(value),
              };
              record(op);
              written.push(
                rowsOf(op.table).find((row) => row.id === op.id) ?? { ...value },
              );
            }
            return written;
          });
        },

        upsert(values: Row, _options?: { onConflict?: string }) {
          void _options;
          return new DemoMutation(() => {
            const op: Op = {
              kind: "upsert",
              table: "volunteer_names",
              email: String(values.email),
              display_name: String(values.display_name),
              at: now(),
            };
            record(op);
            return [{ ...values }];
          });
        },

        update(values: Row) {
          return new DemoMutation((match) => {
            // Names are written by upsert, never by update. Answering with no
            // rows is what Postgres would do, and is what the caller checks.
            if (name === "volunteer_names") return [];

            const who = requireEmail();
            const targets = rowsOf(name as LedgerTable).filter(match);
            const written: Row[] = [];

            for (const target of targets) {
              const op: Op = {
                kind: "update",
                table: name as LedgerTable,
                id: String(target.id),
                at: now(),
                email: who,
                values: strip(values),
              };
              record(op);
              const after = rowsOf(op.table).find((row) => row.id === op.id);
              if (after) written.push(after);
            }
            return written;
          });
        },

        delete() {
          return new DemoMutation((match) => {
            const who = requireEmail();

            if (name === "volunteer_names") {
              const targets = db.volunteer_names.filter((row) =>
                match(row as unknown as Row),
              );
              for (const target of targets) {
                const op: Op = {
                  kind: "delete",
                  table: "volunteer_names",
                  email: target.email,
                  at: now(),
                };
                record(op);
              }
              return targets as unknown as Row[];
            }

            const targets = rowsOf(name as LedgerTable).filter(match);
            for (const target of targets) {
              const op: Op = {
                kind: "delete",
                table: name as LedgerTable,
                id: String(target.id),
                at: now(),
                email: who,
              };
              record(op);
            }
            return targets.map((row) => ({ ...row }));
          });
        },
      };
    },

    /** The keep-alive's round-trip. There is nothing to keep alive here. */
    async rpc(_name: string) {
      void _name;
      return { data: "demo", error: null };
    },

    auth: {
      async getUser() {
        return { data: { user: userFor(email) }, error: null };
      },

      async getSession() {
        const user = userFor(email);
        return {
          data: { session: user ? { access_token: "demo", user } : null },
          error: null,
        };
      },

      async signInWithPassword({
        email: submitted,
        password,
      }: {
        email: string;
        password: string;
      }) {
        // Any address gets in, so a visitor who types their own email is not
        // stopped by a typo in a demo. The password is checked, because the
        // login screen is part of what is being shown.
        const clean = submitted.trim().toLowerCase();
        if (password !== DEMO_PASSWORD) {
          return { data: { user: null }, error: { message: "Invalid login" } };
        }

        cookieStore.set(SESSION_COOKIE, clean || DEMO_EMAIL, {
          path: "/",
          sameSite: "lax",
          maxAge: SESSION_MAX_AGE,
        });
        return { data: { user: userFor(clean || DEMO_EMAIL) }, error: null };
      },

      async signOut() {
        // The journal goes with the session: signing out is how a visitor puts
        // the demo back the way they found it for the next person on the phone.
        cookieStore.delete(SESSION_COOKIE);
        cookieStore.delete(JOURNAL_COOKIE);
        return { error: null };
      },
    },
  };
}

/** Columns the form never sends and the database would assign itself. */
function strip(values: Row): Row {
  const out: Row = { ...values };
  delete out.id;
  delete out.created_at;
  delete out.updated_at;
  delete out.user_id;
  delete out.created_by_email;
  delete out.receipt_number;
  delete out.donation_number;
  return out;
}

import { todayInIst } from "@/lib/receipt-utils";
import type {
  ActivityEntry,
  Donation,
  Expense,
  Receipt,
  VolunteerName,
} from "@/lib/types";
import { DEMO_PEER_EMAIL } from "./config";
import { buildSeed, PEER_ID, USER_ID } from "./seed";
import type { Op } from "./journal";

/** The three ledgers a demo visitor can write to. */
export type LedgerTable = "receipts" | "expenses" | "donations";

export type DemoDb = {
  receipts: Receipt[];
  expenses: Expense[];
  donations: Donation[];
  volunteer_names: VolunteerName[];
  /** Receipt, expense and donation history in one feed — `activity_log`. */
  activity: ActivityEntry[];
};

type Row = Record<string, unknown>;

const DATE_COLUMN = {
  receipts: "collection_date",
  expenses: "spent_on",
  donations: "donation_date",
} as const;

/**
 * The seed is rebuilt once per calendar day rather than per request: it is
 * pure, and a dashboard render asks for it a dozen times over.
 */
let cachedDay = "";
let cachedSeed: ReturnType<typeof buildSeed> | null = null;

function seedForToday() {
  const today = todayInIst();
  if (cachedSeed && cachedDay === today) return cachedSeed;
  cachedDay = today;
  cachedSeed = buildSeed(today);
  return cachedSeed;
}

/** Deep-enough copy: rows are flat, so this is all the isolation needed. */
const clone = <T,>(rows: T[]): T[] => rows.map((row) => ({ ...row }));

/**
 * Materialises the database a request sees: the seeded ledger with the
 * visitor's own changes replayed on top.
 *
 * Replaying rather than storing the whole table is what lets a demo session
 * live in a 4KB cookie — a visitor's evening of edits is a few hundred bytes of
 * operations, not a hundred receipts.
 */
export function buildDb(ops: Op[]): DemoDb {
  const seed = seedForToday();
  const db: DemoDb = {
    receipts: clone(seed.receipts),
    expenses: clone(seed.expenses),
    donations: clone(seed.donations),
    volunteer_names: clone(seed.volunteer_names),
    activity: [],
  };

  for (const op of ops) applyOp(db, op);
  db.activity = buildActivity(db, ops);
  return db;
}

/** Next value of the per-table sequence Postgres would hand out. */
function nextNumber(rows: Row[], column: string) {
  return rows.reduce((max, row) => Math.max(max, Number(row[column]) || 0), 0) + 1;
}

/**
 * Applies one op to a materialised database, in place.
 *
 * Exported because a Server Action that writes and then reads back within the
 * same request needs the row to be there — replaying the whole journal from the
 * seed to learn one row would be the wrong shape of expensive.
 */
export function applyOp(db: DemoDb, op: Op) {
  if (op.table === "volunteer_names") {
    const rest = db.volunteer_names.filter((n) => n.email !== op.email);
    if (op.kind === "delete") {
      db.volunteer_names = rest;
      return;
    }
    db.volunteer_names = [
      ...rest,
      { email: op.email, display_name: op.display_name, updated_at: op.at },
    ];
    return;
  }

  const rows = db[op.table] as unknown as Row[];

  if (op.kind === "insert") {
    const numberColumn =
      op.table === "receipts"
        ? "receipt_number"
        : op.table === "donations"
          ? "donation_number"
          : null;

    const row: Row = {
      ...op.values,
      id: op.id,
      created_at: op.at,
      updated_at: op.at,
      // The demo visitor is always the signed-in volunteer; `created_by_email`
      // is set by a trigger in production, so it is set here too rather than
      // coming off the form.
      user_id: USER_ID,
      created_by_email: op.email,
    };
    if (numberColumn) row[numberColumn] = nextNumber(rows, numberColumn);
    if (op.table === "expenses" && row.note === undefined) row.note = null;
    rows.push(row);
    return;
  }

  const index = rows.findIndex((row) => row.id === op.id);
  if (index === -1) return;

  if (op.kind === "delete") {
    rows.splice(index, 1);
    return;
  }

  // `updated_at` is bumped by a trigger in production. The dialogs rely on it:
  // it is the value the optimistic-locking check compares against.
  rows[index] = { ...rows[index], ...op.values, updated_at: op.at };
}

/**
 * Derives the activity feed instead of storing it.
 *
 * Production has an audit table written by a trigger; here the same information
 * already exists twice over — every seeded row knows when it was created, and
 * every visitor change is in the journal — so a second copy would only be
 * something to keep in sync.
 */
function buildActivity(db: DemoDb, ops: Op[]): ActivityEntry[] {
  const entries: ActivityEntry[] = [];
  let sequence = 0;

  const push = (
    entity: ActivityEntry["entity"],
    action: ActivityEntry["action"],
    at: string,
    email: string | null,
    before: Row | null,
    after: Row | null,
  ) => {
    sequence += 1;
    const row = after ?? before;
    entries.push({
      entity,
      entry_key: `${entity}:${sequence}`,
      id: sequence,
      row_id: (row?.id as string) ?? null,
      receipt_number:
        entity === "receipt" ? ((row?.receipt_number as number) ?? null) : null,
      action,
      actor_id: email === DEMO_PEER_EMAIL ? PEER_ID : USER_ID,
      actor_email: email,
      changed_at: at,
      before,
      after,
    });
  };

  const seed = seedForToday();
  const seeded: [ActivityEntry["entity"], Row[]][] = [
    ["receipt", seed.receipts as unknown as Row[]],
    ["expense", seed.expenses as unknown as Row[]],
    ["donation", seed.donations as unknown as Row[]],
  ];

  for (const [entity, rows] of seeded) {
    for (const row of rows) {
      push(
        entity,
        "created",
        row.created_at as string,
        (row.created_by_email as string) ?? null,
        null,
        row,
      );
    }
  }

  // Replay a second time, tracking the row as each op saw it, so an update
  // entry carries a real before/after pair and the field-level diff works.
  const shadow = buildShadow(ops);
  for (const step of shadow) {
    push(step.entity, step.action, step.at, step.email, step.before, step.after);
  }

  // Newest first, exactly as the query in activity/page.tsx asks for.
  return entries.sort((a, b) => b.changed_at.localeCompare(a.changed_at));
}

type Step = {
  entity: ActivityEntry["entity"];
  action: ActivityEntry["action"];
  at: string;
  email: string | null;
  before: Row | null;
  after: Row | null;
};

function buildShadow(ops: Op[]): Step[] {
  const seed = seedForToday();
  const tables: Record<LedgerTable, Row[]> = {
    receipts: clone(seed.receipts) as unknown as Row[],
    expenses: clone(seed.expenses) as unknown as Row[],
    donations: clone(seed.donations) as unknown as Row[],
  };
  const entityOf = {
    receipts: "receipt",
    expenses: "expense",
    donations: "donation",
  } as const;

  const steps: Step[] = [];
  const db = { ...tables, volunteer_names: [], activity: [] } as unknown as DemoDb;

  for (const op of ops) {
    if (op.table === "volunteer_names") continue;
    const rows = tables[op.table];
    const before = rows.find((row) => row.id === op.id) ?? null;
    const snapshot = before ? { ...before } : null;

    applyOp(db, op);

    const after = tables[op.table].find((row) => row.id === op.id) ?? null;
    steps.push({
      entity: entityOf[op.table],
      action: op.kind === "insert" ? "created" : op.kind === "delete" ? "deleted" : "updated",
      at: op.at,
      email: op.email,
      before: op.kind === "insert" ? null : snapshot,
      after: op.kind === "delete" ? null : after ? { ...after } : null,
    });
  }

  return steps;
}

export { DATE_COLUMN };

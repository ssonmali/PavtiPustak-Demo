/* eslint-disable @typescript-eslint/no-explicit-any */
//
// `any` is deliberate and confined to this file. The point of the demo layer is
// that not one line of the app changes, which means answering PostgREST's
// query language with PostgREST's own loose result typing. Reproducing
// supabase-js's generated-type machinery would be a great deal of type-level
// code to arrive back at exactly the types the call sites already cast to.

import type { DemoDb, LedgerTable } from "./db";
import { resolveView } from "./views";

type Row = Record<string, any>;
type Result = { data: any; error: { message: string } | null; count: number | null };

const TABLES = ["receipts", "expenses", "donations", "volunteer_names"] as const;
type TableName = (typeof TABLES)[number];

const isTable = (name: string): name is TableName =>
  (TABLES as readonly string[]).includes(name);

/** Rows behind a name, whether it is a table or one of the views. */
function source(db: DemoDb, name: string): Row[] {
  if (isTable(name)) return db[name] as unknown as Row[];
  return resolveView(db, name);
}

type Filter = { column: string; op: string; value: any };

function matches(row: Row, filter: Filter): boolean {
  const actual = row[filter.column];
  const { value } = filter;

  switch (filter.op) {
    case "eq":
      // Postgres compares a date column to a date, not a string; every column
      // this app filters on is text, a number or a date, all of which loose
      // equality gets right — and `updated_at` must match exactly, which it does.
      return actual === value;
    case "neq":
      return actual !== value;
    case "gt":
      return actual != null && actual > value;
    case "gte":
      return actual != null && actual >= value;
    case "lt":
      return actual != null && actual < value;
    case "lte":
      // Null is not "less than or equal" to anything — a receipt with no due
      // date is not overdue, it is simply not a pledge with a date yet.
      return actual != null && actual <= value;
    case "is":
      return actual === value;
    case "ilike": {
      const pattern = String(value)
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/%/g, ".*")
        .replace(/_/g, ".");
      return new RegExp(`^${pattern}$`, "i").test(String(actual ?? ""));
    }
    default:
      return true;
  }
}

/** `"id"`, `"*"`, or `"amount, collection_date"` — as PostgREST accepts them. */
function project(rows: Row[], columns: string): Row[] {
  const clean = columns.trim();
  if (!clean || clean === "*") return rows.map((row) => ({ ...row }));

  const wanted = clean.split(",").map((c) => c.trim()).filter(Boolean);
  return rows.map((row) => {
    const out: Row = {};
    for (const column of wanted) out[column] = row[column];
    return out;
  });
}

function compare(a: any, b: any) {
  if (a === b) return 0;
  // Nulls last on an ascending sort, which is Postgres's default.
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

/**
 * A PostgREST-shaped read.
 *
 * Thenable rather than a promise, so the app's `await query` and
 * `Promise.all([query, ...])` work unchanged, and so `.eq()` can keep being
 * chained onto a query that has already had `.select()` called on it.
 */
export class DemoQuery implements PromiseLike<Result> {
  private filters: Filter[] = [];
  private orders: { column: string; ascending: boolean }[] = [];
  private columns = "*";
  private wantCount = false;
  private limitTo: number | null = null;
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;
  private single: "maybe" | "one" | null = null;

  constructor(private rows: () => Row[]) {}

  select(columns = "*", options?: { count?: "exact" | "planned" | "estimated" }) {
    this.columns = columns;
    if (options?.count) this.wantCount = true;
    return this;
  }

  eq(column: string, value: any) {
    return this.filter(column, "eq", value);
  }
  neq(column: string, value: any) {
    return this.filter(column, "neq", value);
  }
  gt(column: string, value: any) {
    return this.filter(column, "gt", value);
  }
  gte(column: string, value: any) {
    return this.filter(column, "gte", value);
  }
  lt(column: string, value: any) {
    return this.filter(column, "lt", value);
  }
  lte(column: string, value: any) {
    return this.filter(column, "lte", value);
  }
  is(column: string, value: any) {
    return this.filter(column, "is", value);
  }
  ilike(column: string, value: any) {
    return this.filter(column, "ilike", value);
  }

  private filter(column: string, op: string, value: any) {
    this.filters.push({ column, op, value });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: options?.ascending ?? true });
    return this;
  }

  limit(n: number) {
    this.limitTo = n;
    return this;
  }

  range(from: number, to: number) {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }

  maybeSingle() {
    this.single = "maybe";
    return this;
  }

  /** The rows this query selects, ordered but not yet paged. */
  matched(): Row[] {
    const rows = this.rows().filter((row) =>
      this.filters.every((filter) => matches(row, filter)),
    );

    if (this.orders.length) {
      rows.sort((a, b) => {
        for (const { column, ascending } of this.orders) {
          const result = compare(a[column], b[column]);
          if (result !== 0) return ascending ? result : -result;
        }
        return 0;
      });
    }
    return rows;
  }

  private run(): Result {
    const matched = this.matched();
    const count = this.wantCount ? matched.length : null;

    let page = matched;
    if (this.rangeFrom != null && this.rangeTo != null) {
      page = page.slice(this.rangeFrom, this.rangeTo + 1);
    }
    if (this.limitTo != null) page = page.slice(0, this.limitTo);

    const data = project(page, this.columns);
    if (this.single) return { data: data[0] ?? null, error: null, count };
    return { data, error: null, count };
  }

  then<A = Result, B = never>(
    onFulfilled?: ((value: Result) => A | PromiseLike<A>) | null,
    onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve(this.run()).then(onFulfilled, onRejected);
  }
}

/**
 * A write, which becomes a read the moment `.select()` is called on it.
 *
 * `update(...).eq(...).select("id")` returning zero rows is how the app detects
 * a save that lost a race, so the filters have to be applied to the write and
 * the returned rows have to be the ones actually written — not the ones that
 * matched before it.
 */
export class DemoMutation implements PromiseLike<Result> {
  private filters: Filter[] = [];
  private columns: string | null = null;
  private single: "maybe" | "one" | null = null;

  constructor(private commit: (match: (row: Row) => boolean) => Row[]) {}

  eq(column: string, value: any) {
    this.filters.push({ column, op: "eq", value });
    return this;
  }

  select(columns = "*") {
    this.columns = columns;
    return this;
  }

  maybeSingle() {
    this.single = "maybe";
    return this;
  }

  private run(): Result {
    let written: Row[];
    try {
      written = this.commit((row) =>
        this.filters.every((filter) => matches(row, filter)),
      );
    } catch (error) {
      return {
        data: null,
        error: { message: error instanceof Error ? error.message : "Demo write failed" },
        count: null,
      };
    }

    const data = project(written, this.columns ?? "*");
    if (this.single) return { data: data[0] ?? null, error: null, count: null };
    return { data, error: null, count: null };
  }

  then<A = Result, B = never>(
    onFulfilled?: ((value: Result) => A | PromiseLike<A>) | null,
    onRejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve(this.run()).then(onFulfilled, onRejected);
  }
}

export type { Row, Result, TableName, LedgerTable };
export { isTable, source };

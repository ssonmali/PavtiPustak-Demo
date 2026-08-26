import { describe, expect, it } from "vitest";
import { buildDb } from "@/lib/demo/db";
import { encodeJournal, decodeJournal, type Op } from "@/lib/demo/journal";
import { DemoQuery } from "@/lib/demo/query";

/**
 * The fake PostgREST.
 *
 * Every one of these is a query shape the app actually issues; if one of them
 * answers wrongly the app does not crash, it quietly shows a different ledger.
 */

const rows = [
  { id: "a", donor_name: "Sanjay Kulkarni", amount: 500, date: "2026-09-03", status: "Paid" },
  { id: "b", donor_name: "Meena Deshpande", amount: 1500, date: "2026-09-01", status: "Unpaid" },
  { id: "c", donor_name: "Rahul Jadhav", amount: 900, date: "2026-09-05", status: "Paid" },
  { id: "d", donor_name: "sanjay kadam", amount: 100, date: "2026-09-02", status: "Unpaid" },
];

const query = () => new DemoQuery(() => rows.map((row) => ({ ...row })));

describe("DemoQuery", () => {
  it("is awaited like the client it stands in for", async () => {
    const { data, error } = await query().select("*");
    expect(error).toBeNull();
    expect(data).toHaveLength(4);
  });

  it("projects only the columns asked for", async () => {
    const { data } = await query().select("id, amount");
    expect(Object.keys(data[0])).toEqual(["id", "amount"]);
  });

  it("filters and orders together", async () => {
    const { data } = await query()
      .select("*")
      .eq("status", "Paid")
      .order("amount", { ascending: false });

    expect(data.map((row: { id: string }) => row.id)).toEqual(["c", "a"]);
  });

  it("breaks ties with the second order key", async () => {
    const { data } = await query()
      .select("*")
      .order("status", { ascending: true })
      .order("amount", { ascending: false });

    expect(data.map((row: { id: string }) => row.id)).toEqual(["c", "a", "b", "d"]);
  });

  it("counts the matches, not the page", async () => {
    const { data, count } = await query()
      .select("*", { count: "exact" })
      .order("date", { ascending: true })
      .range(0, 1);

    expect(count).toBe(4);
    expect(data).toHaveLength(2);
  });

  it("matches ilike case-insensitively, anywhere in the value", async () => {
    const { data } = await query().select("*").ilike("donor_name", "%sanjay%");
    expect(data.map((row: { id: string }) => row.id).sort()).toEqual(["a", "d"]);
  });

  it("does not treat a null as less than a date", async () => {
    const nullable = new DemoQuery(() => [
      { id: "x", due_on: "2026-09-01" },
      { id: "y", due_on: null },
    ]);

    const { data } = await nullable.select("*").lte("due_on", "2026-09-30");
    // A receipt with no due date is not overdue; it is not a dated pledge.
    expect(data.map((row: { id: string }) => row.id)).toEqual(["x"]);
  });

  it("returns a row or null for maybeSingle, never an array", async () => {
    const hit = await query().select("*").eq("id", "b").maybeSingle();
    const miss = await query().select("*").eq("id", "zzz").maybeSingle();

    expect(hit.data).toMatchObject({ donor_name: "Meena Deshpande" });
    expect(miss.data).toBeNull();
  });
});

describe("the journal", () => {
  const email = "volunteer@demo.test";

  it("replays an insert into the ledger, numbering it as Postgres would", () => {
    const seeded = buildDb([]);
    const highest = Math.max(...seeded.receipts.map((r) => r.receipt_number));

    const db = buildDb([
      {
        kind: "insert",
        table: "receipts",
        id: "new-1",
        at: "2026-09-09T10:00:00Z",
        email,
        values: {
          donor_name: "Nandini Apte",
          amount: 1501,
          phone_number: "9812345678",
          payment_method: "Cash",
          collection_date: "2026-09-09",
          payment_status: "Paid",
        },
      },
    ]);

    const added = db.receipts.find((r) => r.id === "new-1");
    expect(added?.receipt_number).toBe(highest + 1);
    expect(added?.created_by_email).toBe(email);
  });

  it("bumps updated_at on an update, which is what the locking check reads", () => {
    const before = buildDb([]).receipts[0];
    const op: Op = {
      kind: "update",
      table: "receipts",
      id: before.id,
      at: "2026-09-09T11:00:00Z",
      email,
      values: { amount: 777 },
    };

    const after = buildDb([op]).receipts.find((r) => r.id === before.id);
    expect(after?.amount).toBe(777);
    expect(after?.updated_at).toBe("2026-09-09T11:00:00Z");
  });

  it("removes a deleted row and logs the deletion", () => {
    const target = buildDb([]).receipts[0];
    const db = buildDb([
      { kind: "delete", table: "receipts", id: target.id, at: "2026-09-09T12:00:00Z", email },
    ]);

    expect(db.receipts.find((r) => r.id === target.id)).toBeUndefined();
    expect(
      db.activity.some((e) => e.action === "deleted" && e.row_id === target.id),
    ).toBe(true);
  });

  it("survives a round trip through the cookie", () => {
    const ops: Op[] = [
      { kind: "delete", table: "receipts", id: "x", at: "2026-09-09T12:00:00Z", email },
    ];
    expect(decodeJournal(encodeJournal(ops))).toEqual(ops);
  });

  it("drops the oldest change rather than the whole session when it overflows", () => {
    const ops: Op[] = Array.from({ length: 400 }, (_, i) => ({
      kind: "insert" as const,
      table: "receipts" as const,
      id: `row-${i}`,
      at: "2026-09-09T12:00:00Z",
      email,
      values: { donor_name: "Someone With A Fairly Long Name", amount: 1000 },
    }));

    const kept = decodeJournal(encodeJournal(ops));
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.length).toBeLessThan(ops.length);
    // The newest edit is the one a visitor just made and is looking at.
    expect(kept.at(-1)).toEqual(ops.at(-1));
  });

  it("starts clean rather than throwing on a cookie it cannot read", () => {
    expect(decodeJournal("not-json")).toEqual([]);
    expect(decodeJournal(undefined)).toEqual([]);
  });
});

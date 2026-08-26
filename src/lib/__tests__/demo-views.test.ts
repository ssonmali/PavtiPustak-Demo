import { describe, expect, it } from "vitest";
import type { DemoDb } from "@/lib/demo/db";
import {
  donorDirectory,
  expenseDailyTotals,
  payableTotals,
  pledgeTotals,
  receiptDailyTotals,
  volunteerTotals,
} from "@/lib/demo/views";
import { todayInIst } from "@/lib/receipt-utils";
import type { Expense, Receipt } from "@/lib/types";

/**
 * The demo's views are a transcription of the SQL in `supabase/`, and a
 * transcription that drifts does not fail loudly — it shows the wrong money.
 * These pin the parts of each definition that were easy to get wrong: a pledge
 * counting as collected, a part-payment counting twice, a null due date reading
 * as overdue.
 */

function receipt(partial: Partial<Receipt>): Receipt {
  return {
    id: crypto.randomUUID(),
    receipt_number: 1,
    donor_name: "Sanjay Kulkarni",
    donor_name_mr: null,
    amount: 1000,
    paid_amount: null,
    phone_number: "9800000000",
    payment_method: "Cash",
    collection_date: "2026-09-01",
    created_at: "2026-09-01T12:00:00Z",
    updated_at: "2026-09-01T12:00:00Z",
    user_id: "u",
    created_by_email: "one@mandal.org",
    payment_status: "Paid",
    due_on: null,
    ...partial,
  };
}

function expense(partial: Partial<Expense>): Expense {
  return {
    id: crypto.randomUUID(),
    description: "Mandap",
    amount: 1000,
    category: "Mandap",
    payment_method: "Cash",
    spent_on: "2026-09-01",
    note: null,
    created_at: "2026-09-01T12:00:00Z",
    updated_at: "2026-09-01T12:00:00Z",
    user_id: "u",
    created_by_email: "one@mandal.org",
    payment_status: "Paid",
    due_on: null,
    paid_amount: null,
    ...partial,
  };
}

const db = (partial: Partial<DemoDb>): DemoDb => ({
  receipts: [],
  expenses: [],
  donations: [],
  volunteer_names: [],
  activity: [],
  ...partial,
});

describe("receiptDailyTotals", () => {
  it("splits a day between cash and UPI", () => {
    const [row] = receiptDailyTotals(
      db({
        receipts: [
          receipt({ amount: 500, payment_method: "Cash" }),
          receipt({ amount: 300, payment_method: "UPI" }),
        ],
      }),
    );

    expect(row).toMatchObject({ total: 800, cash: 500, upi: 300, receipt_count: 2 });
  });

  it("credits a pledge nothing until the money arrives", () => {
    const [row] = receiptDailyTotals(
      db({
        receipts: [
          receipt({ amount: 5000, payment_status: "Unpaid", due_on: "2026-09-05" }),
        ],
      }),
    );

    // The promise is on the ledger; not a rupee of it is collected.
    expect(row).toMatchObject({ total: 0, receipt_count: 0, donor_count: 0 });
  });

  it("credits only the instalment actually received", () => {
    const [row] = receiptDailyTotals(
      db({
        receipts: [
          receipt({
            amount: 5000,
            paid_amount: 2000,
            payment_status: "Unpaid",
            due_on: "2026-09-05",
          }),
        ],
      }),
    );

    expect(row).toMatchObject({ total: 2000, receipt_count: 1 });
  });

  it("counts a donor once however many receipts they have", () => {
    const [row] = receiptDailyTotals(
      db({
        receipts: [
          receipt({ donor_name: "Meena Deshpande" }),
          receipt({ donor_name: "  meena deshpande " }),
        ],
      }),
    );

    expect(row.receipt_count).toBe(2);
    expect(row.donor_count).toBe(1);
  });
});

describe("volunteerTotals", () => {
  it("credits each volunteer only what they collected", () => {
    const rows = volunteerTotals(
      db({
        receipts: [
          receipt({ created_by_email: "one@mandal.org", amount: 500 }),
          receipt({ created_by_email: "two@mandal.org", amount: 300 }),
          receipt({ created_by_email: "one@mandal.org", amount: 200 }),
        ],
      }),
    );

    expect(rows.find((r) => r.volunteer === "one@mandal.org")).toMatchObject({
      total: 700,
      receipt_count: 2,
    });
  });

  it("leaves out a volunteer whose only row is an untouched pledge", () => {
    const rows = volunteerTotals(
      db({
        receipts: [
          receipt({
            created_by_email: "three@mandal.org",
            payment_status: "Unpaid",
            due_on: "2026-09-09",
          }),
        ],
      }),
    );

    expect(rows).toEqual([]);
  });
});

describe("donorDirectory", () => {
  it("offers the contact details from the newest receipt", () => {
    const [donor] = donorDirectory(
      db({
        receipts: [
          receipt({
            receipt_number: 1,
            collection_date: "2026-09-01",
            phone_number: "9800000001",
            amount: 100,
          }),
          receipt({
            receipt_number: 2,
            collection_date: "2026-09-04",
            phone_number: "9800000002",
            donor_name_mr: "संजय कुलकर्णी",
            amount: 400,
          }),
        ],
      }),
    );

    expect(donor.phone_number).toBe("9800000002");
    expect(donor.donor_name_mr).toBe("संजय कुलकर्णी");
    expect(donor.lifetime_total).toBe(500);
    expect(donor.receipt_count).toBe(2);
    expect(donor.last_collection).toBe("2026-09-04");
  });

  it("still finds a donor who has only ever part-paid", () => {
    const rows = donorDirectory(
      db({
        receipts: [
          receipt({
            amount: 5000,
            paid_amount: 100,
            payment_status: "Unpaid",
            due_on: "2026-09-09",
          }),
        ],
      }),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].lifetime_total).toBe(100);
  });
});

describe("pledgeTotals", () => {
  const today = todayInIst();

  it("expects the outstanding half of a part-paid pledge, not the whole", () => {
    const totals = pledgeTotals(
      db({
        receipts: [
          receipt({
            amount: 5000,
            paid_amount: 2000,
            payment_status: "Unpaid",
            due_on: today,
          }),
        ],
      }),
    );

    expect(totals).toMatchObject({
      expected: 3000,
      pledge_count: 1,
      due_now: 3000,
      due_today: 1,
      overdue: 0,
    });
  });

  it("drops a pledge the moment the last instalment lands", () => {
    const totals = pledgeTotals(
      db({
        receipts: [receipt({ amount: 5000, paid_amount: 5000, payment_status: "Unpaid" })],
      }),
    );

    // Nothing outstanding, so nothing to chase — a row owing ₹0 must never
    // appear in the reminder list.
    expect(totals.pledge_count).toBe(0);
    expect(totals.expected).toBe(0);
  });
});

describe("expenseDailyTotals and payableTotals", () => {
  it("counts a bill as recorded but not as spent", () => {
    const ledger = db({
      expenses: [
        expense({ amount: 1000 }),
        expense({ amount: 4000, payment_status: "Unpaid", due_on: "2026-09-09" }),
      ],
    });

    const [row] = expenseDailyTotals(ledger);
    expect(row).toMatchObject({
      total: 1000,
      expense_count: 2,
      unpaid: 4000,
      unpaid_count: 1,
    });

    expect(payableTotals(ledger)).toMatchObject({ owed: 4000, bill_count: 1 });
  });

  it("does not read a bill with no due date as overdue", () => {
    const totals = payableTotals(
      db({ expenses: [expense({ amount: 900, payment_status: "Unpaid", due_on: null })] }),
    );

    expect(totals.owed).toBe(900);
    expect(totals.overdue).toBe(0);
    expect(totals.due_now).toBe(0);
  });
});

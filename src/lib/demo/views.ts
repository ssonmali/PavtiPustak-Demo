import { outstanding, received, todayInIst } from "@/lib/receipt-utils";
import type {
  DailyTotal,
  Donor,
  ExpenseDailyTotal,
  PayableTotals,
  PledgeTotals,
  VolunteerTotal,
} from "@/lib/types";
import type { DemoDb } from "./db";

/**
 * The seven views the app reads, computed in TypeScript.
 *
 * Each one is a transcription of the SQL in `supabase/` — the file and view
 * name are named above each function so the two can be diffed by eye when a
 * migration changes. Getting these wrong would not throw; it would quietly
 * show the wrong money, which is the one thing a receipt book must not do.
 */

const key = (name: string) => name.trim().toLowerCase();

/** supabase/14-partial-payments.sql — receipt_daily_totals */
export function receiptDailyTotals(db: DemoDb): DailyTotal[] {
  const byDate = new Map<string, DailyTotal & { donors: Set<string> }>();

  for (const r of db.receipts) {
    const row = byDate.get(r.collection_date) ?? {
      collection_date: r.collection_date,
      total: 0,
      cash: 0,
      upi: 0,
      receipt_count: 0,
      donor_count: 0,
      donors: new Set<string>(),
    };

    // Credit follows the money received, not the promise: a pledge adds a row
    // to the ledger but nothing to the day's collection until it is paid.
    const money = received(r);
    row.total += money;
    if (r.payment_method === "Cash") row.cash += money;
    else row.upi += money;
    if (money > 0) {
      row.receipt_count += 1;
      row.donors.add(key(r.donor_name));
    }

    byDate.set(r.collection_date, row);
  }

  return [...byDate.values()].map(({ donors, ...row }) => ({
    ...row,
    donor_count: donors.size,
  }));
}

/** supabase/14-partial-payments.sql — volunteer_totals */
export function volunteerTotals(db: DemoDb): VolunteerTotal[] {
  const byVolunteer = new Map<string, VolunteerTotal>();

  for (const r of db.receipts) {
    const money = received(r);
    if (money <= 0) continue;

    const volunteer = r.created_by_email ?? "unknown";
    const row = byVolunteer.get(volunteer) ?? {
      volunteer,
      total: 0,
      receipt_count: 0,
      first_collection: r.collection_date,
      last_collection: r.collection_date,
    };

    row.total += money;
    row.receipt_count += 1;
    if (r.collection_date < row.first_collection) {
      row.first_collection = r.collection_date;
    }
    if (r.collection_date > row.last_collection) {
      row.last_collection = r.collection_date;
    }
    byVolunteer.set(volunteer, row);
  }

  return [...byVolunteer.values()];
}

/** supabase/14-partial-payments.sql — donor_directory */
export function donorDirectory(db: DemoDb): Donor[] {
  const byDonor = new Map<string, Donor & { sortDate: string; sortNumber: number }>();

  for (const r of db.receipts) {
    const money = received(r);
    if (money <= 0) continue;

    const k = key(r.donor_name);
    const existing = byDonor.get(k);

    if (!existing) {
      byDonor.set(k, {
        donor_name: r.donor_name.trim(),
        phone_number: r.phone_number,
        donor_name_mr: r.donor_name_mr,
        lifetime_total: money,
        receipt_count: 1,
        last_collection: r.collection_date,
        sortDate: r.collection_date,
        sortNumber: r.receipt_number,
      });
      continue;
    }

    existing.lifetime_total += money;
    existing.receipt_count += 1;
    if (r.collection_date > existing.last_collection) {
      existing.last_collection = r.collection_date;
    }

    // `distinct on ... order by collection_date desc, receipt_number desc`:
    // the contact details and corrected spelling come from the newest receipt,
    // so a donor who changed their number is offered the current one.
    const newer =
      r.collection_date > existing.sortDate ||
      (r.collection_date === existing.sortDate &&
        r.receipt_number > existing.sortNumber);
    if (newer) {
      existing.donor_name = r.donor_name.trim();
      existing.phone_number = r.phone_number;
      existing.donor_name_mr = r.donor_name_mr;
      existing.sortDate = r.collection_date;
      existing.sortNumber = r.receipt_number;
    }
  }

  return [...byDonor.values()].map(({ sortDate, sortNumber, ...donor }) => {
    void sortDate;
    void sortNumber;
    return donor;
  });
}

/** supabase/14-partial-payments.sql — pledge_totals */
export function pledgeTotals(db: DemoDb): PledgeTotals {
  const today = todayInIst();
  const totals: PledgeTotals = {
    expected: 0,
    pledge_count: 0,
    due_now: 0,
    due_today: 0,
    overdue: 0,
  };

  for (const r of db.receipts) {
    // Guarded on the remainder, not on payment_status, so a fully-settled row
    // can never appear in the reminder list owing ₹0.
    const owed = outstanding(r);
    if (owed <= 0) continue;

    totals.expected += owed;
    totals.pledge_count += 1;
    if (r.due_on && r.due_on <= today) totals.due_now += owed;
    if (r.due_on === today) totals.due_today += 1;
    if (r.due_on && r.due_on < today) totals.overdue += 1;
  }

  return totals;
}

/** supabase/15-expense-payments.sql — expense_daily_totals */
export function expenseDailyTotals(db: DemoDb): ExpenseDailyTotal[] {
  const byDate = new Map<string, ExpenseDailyTotal>();

  for (const e of db.expenses) {
    const row = byDate.get(e.spent_on) ?? {
      spent_on: e.spent_on,
      total: 0,
      expense_count: 0,
      unpaid: 0,
      unpaid_count: 0,
    };

    const owed = outstanding(e);
    row.total += received(e);
    // count(*), not a filter: a bill is an expense recorded whether or not it
    // has been settled.
    row.expense_count += 1;
    row.unpaid += owed;
    if (owed > 0) row.unpaid_count += 1;

    byDate.set(e.spent_on, row);
  }

  return [...byDate.values()];
}

/** supabase/15-expense-payments.sql — payable_totals */
export function payableTotals(db: DemoDb): PayableTotals {
  const today = todayInIst();
  const totals: PayableTotals = {
    owed: 0,
    bill_count: 0,
    due_now: 0,
    due_today: 0,
    overdue: 0,
  };

  for (const e of db.expenses) {
    const owed = outstanding(e);
    if (owed <= 0) continue;

    totals.owed += owed;
    totals.bill_count += 1;
    if (e.due_on && e.due_on <= today) totals.due_now += owed;
    if (e.due_on === today) totals.due_today += 1;
    if (e.due_on && e.due_on < today) totals.overdue += 1;
  }

  return totals;
}

/** Every view, resolved by the name the app queries it under. */
export function resolveView(db: DemoDb, name: string): Record<string, unknown>[] {
  switch (name) {
    case "receipt_daily_totals":
      return receiptDailyTotals(db) as unknown as Record<string, unknown>[];
    case "volunteer_totals":
      return volunteerTotals(db) as unknown as Record<string, unknown>[];
    case "donor_directory":
      return donorDirectory(db) as unknown as Record<string, unknown>[];
    case "expense_daily_totals":
      return expenseDailyTotals(db) as unknown as Record<string, unknown>[];
    case "pledge_totals":
      return [pledgeTotals(db)] as unknown as Record<string, unknown>[];
    case "payable_totals":
      return [payableTotals(db)] as unknown as Record<string, unknown>[];
    case "activity_log":
      return db.activity as unknown as Record<string, unknown>[];
    default:
      return [];
  }
}

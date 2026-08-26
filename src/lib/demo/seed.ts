import { todayInIst } from "@/lib/receipt-utils";
import type {
  Donation,
  Expense,
  ExpenseCategory,
  PaymentMethod,
  Receipt,
  VolunteerName,
} from "@/lib/types";
import { DEMO_EMAIL, DEMO_PEER_EMAIL } from "./config";

/**
 * The ledger the demo opens on.
 *
 * Everything here is invented — the donors, the phone numbers, the bills. It is
 * generated rather than checked in as JSON so the dates stay relative to the
 * day you visit: the pledge reminders are due *today*, the collection chart
 * ends *yesterday*, and the demo never looks abandoned.
 *
 * Deterministic on purpose. The same visit produces the same ledger, so a
 * screenshot in the README still matches, and a lost session restores to
 * exactly what it was rather than to a different mandal.
 */

/** mulberry32 — small, seeded, and identical on server and client. */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DONORS: [string, string][] = [
  ["Sanjay Kulkarni", "संजय कुलकर्णी"],
  ["Meena Deshpande", "मीना देशपांडे"],
  ["Rahul Jadhav", "राहुल जाधव"],
  ["Pramod Shinde", "प्रमोद शिंदे"],
  ["Vaishali Patil", "वैशाली पाटील"],
  ["Anil Gaikwad", "अनिल गायकवाड"],
  ["Sunita Bhosale", "सुनीता भोसले"],
  ["Mahesh Kadam", "महेश कदम"],
  ["Nilesh More", "निलेश मोरे"],
  ["Archana Sawant", "अर्चना सावंत"],
  ["Dattatray Pawar", "दत्तात्रय पवार"],
  ["Shubhangi Joshi", "शुभांगी जोशी"],
  ["Ganesh Mane", "गणेश माने"],
  ["Kavita Chavan", "कविता चव्हाण"],
  ["Prashant Salunkhe", "प्रशांत साळुंखे"],
  ["Rohini Dhumal", "रोहिणी धुमाळ"],
  ["Vikas Thorat", "विकास थोरात"],
  ["Manisha Nikam", "मनीषा निकम"],
  ["Sachin Bhandari", "सचिन भंडारी"],
  ["Jyoti Kamble", "ज्योती कांबळे"],
  ["Umesh Waghmare", "उमेश वाघमारे"],
  ["Snehal Ghorpade", "स्नेहल घोरपडे"],
  ["Ravindra Jagtap", "रवींद्र जगताप"],
  ["Pooja Rane", "पूजा राणे"],
  ["Balasaheb Shelke", "बाळासाहेब शेळके"],
  ["Trupti Lokhande", "तृप्ती लोखंडे"],
  ["Nitin Ingale", "नितीन इंगळे"],
  ["Asmita Bagul", "अस्मिता बागुल"],
  ["Sandeep Khedkar", "संदीप खेडकर"],
  ["Rupali Tambe", "रुपाली तांबे"],
  ["Yogesh Phadtare", "योगेश फडतरे"],
  ["Deepali Sonawane", "दीपाली सोनवणे"],
  ["Kiran Barve", "किरण बर्वे"],
  ["Harshada Vetal", "हर्षदा वेताळ"],
  ["Amol Dabhade", "अमोल दाभाडे"],
  ["Swati Kharat", "स्वाती खरात"],
];

const DONATION_ITEMS: [string, number | null][] = [
  ["Silver kalash for the puja", 8500],
  ["25 kg sugar for the prasad", 1100],
  ["Two ceiling fans for the mandap", 4600],
  ["Marigold garlands, five days", null],
  ["Steel serving vessels, set of 6", 3200],
  ["Sound system hire, one evening", null],
  ["Ganpati idol decoration cloth", 2400],
  ["100 folding chairs, five days", null],
  ["Modak flour, 40 kg", 1800],
  ["LED string lights, 20 sets", 2600],
  ["Drinking water drum with tap", 900],
  ["Printing of the aarti booklets", 1500],
  ["Coconuts and puja supplies", null],
  ["Generator diesel for visarjan day", 3500],
];

const EXPENSES: [string, ExpenseCategory, number][] = [
  ["Mandap poles and canvas", "Mandap", 14000],
  ["Idol advance to the karkhana", "Idol", 10000],
  ["Sound system for ten days", "Sound", 9500],
  ["LED lighting and wiring", "Decoration", 12400],
  ["Flowers for the first day", "Decoration", 3200],
  ["Prasad — modak, day one", "Prasad", 4800],
  ["Mahaprasad ingredients", "Food", 12500],
  ["Electricity meter deposit", "Electricity", 6000],
  ["Tempo hire for the idol", "Other", 3500],
  ["Aarti booklets, 300 copies", "Other", 1500],
  ["Prasad — pedhe, day three", "Prasad", 2600],
  ["Rangoli colours and stencils", "Decoration", 850],
  ["Cook and helpers, mahaprasad", "Food", 9000],
  ["Extra speakers for visarjan", "Sound", 4500],
  ["Backdrop cloth and thermocol", "Decoration", 5400],
  ["Tea and snacks for volunteers", "Food", 2200],
  ["Idol balance payment", "Idol", 12000],
  ["Mandap flooring mats", "Mandap", 4200],
  ["Generator hire, visarjan day", "Electricity", 6000],
  ["Prasad — coconut burfi", "Prasad", 3100],
  ["Photographer for the ten days", "Other", 5000],
  ["Dhol-tasha pathak, visarjan", "Other", 9000],
];

/** Stable ids: readable in the URL bar, and the same on every render. */
const id = (prefix: string, n: number) =>
  `${prefix}-${String(n).padStart(4, "0")}-demo`;

function shiftDate(isoToday: string, days: number) {
  const d = new Date(`${isoToday}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** A timestamp inside the working evening of `isoDate`, in IST. */
function stamp(isoDate: string, hour: number, minute: number) {
  // IST is UTC+5:30 and never shifts, so the offset can be subtracted flat.
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCMinutes(d.getUTCMinutes() + hour * 60 + minute - 330);
  return d.toISOString();
}

const phone = (r: () => number) =>
  `9${String(Math.floor(r() * 900000000) + 100000000)}`;

export type SeedTables = {
  receipts: Receipt[];
  donations: Donation[];
  expenses: Expense[];
  volunteer_names: VolunteerName[];
};

/**
 * Builds the opening ledger for a given "today".
 *
 * Takes the date rather than reading the clock so the caller can memoise it per
 * day, and so the tests can pin it.
 */
export function buildSeed(today = todayInIst()): SeedTables {
  const r = rng(20250826);

  // Ganesh Chaturthi runs ten days; the demo sits on day eight of the
  // collection, which is when a ledger is at its most interesting.
  const START = -11;

  const receipts: Receipt[] = [];
  let receiptNumber = 0;

  for (let day = START; day <= -1; day++) {
    const date = shiftDate(today, day);
    // Busier at the start of the round and on the weekend push.
    const count = 8 + Math.floor(r() * 6);

    for (let i = 0; i < count; i++) {
      const [name, mr] = DONORS[Math.floor(r() * DONORS.length)];
      receiptNumber += 1;
      const byPeer = r() < 0.42;
      const method: PaymentMethod = r() < 0.55 ? "UPI" : "Cash";
      // Round figures, the way contributions are actually given.
      const amount = [101, 251, 501, 501, 1001, 1001, 1100, 2100, 2500, 5100][
        Math.floor(r() * 10)
      ];

      receipts.push({
        id: id("rcpt", receiptNumber),
        receipt_number: receiptNumber,
        donor_name: name,
        // Most rows carry the Marathi spelling; a few are left for the app to
        // transliterate, which is what the live ledger looks like.
        donor_name_mr: r() < 0.75 ? mr : null,
        amount,
        paid_amount: null,
        phone_number: phone(r),
        payment_method: method,
        collection_date: date,
        created_at: stamp(date, 18 + Math.floor(r() * 4), Math.floor(r() * 60)),
        updated_at: stamp(date, 18 + Math.floor(r() * 4), Math.floor(r() * 60)),
        user_id: byPeer ? PEER_ID : USER_ID,
        created_by_email: byPeer ? DEMO_PEER_EMAIL : DEMO_EMAIL,
        payment_status: "Paid",
        due_on: null,
      });
    }
  }

  // Pledges. Deliberately spread across overdue / due today / still to come,
  // so the reminder panel, the bell and the "due now" badge all have something
  // to show the moment the demo opens.
  const pledges: [number, number, number | null][] = [
    // [days until due, amount, paid so far]
    [-3, 5100, null],
    [-1, 2100, 1000],
    [0, 1001, null],
    [0, 2500, null],
    [0, 501, null],
    [2, 11000, 5000],
    [4, 1001, null],
    [6, 2100, null],
  ];

  for (const [offset, amount, paid] of pledges) {
    const [name, mr] = DONORS[Math.floor(r() * DONORS.length)];
    receiptNumber += 1;
    const created = shiftDate(today, Math.min(-1, offset - 4));

    receipts.push({
      id: id("rcpt", receiptNumber),
      receipt_number: receiptNumber,
      donor_name: name,
      donor_name_mr: mr,
      amount,
      paid_amount: paid,
      phone_number: phone(r),
      payment_method: "Cash",
      collection_date: created,
      created_at: stamp(created, 19, Math.floor(r() * 60)),
      updated_at: stamp(created, 19, Math.floor(r() * 60)),
      user_id: r() < 0.5 ? PEER_ID : USER_ID,
      created_by_email: r() < 0.5 ? DEMO_PEER_EMAIL : DEMO_EMAIL,
      payment_status: "Unpaid",
      due_on: shiftDate(today, offset),
    });
  }

  const donations: Donation[] = DONATION_ITEMS.map(([item, value], i) => {
    const [name, mr] = DONORS[(i * 5 + 3) % DONORS.length];
    void mr;
    // Spread across the collection window rather than clustered on today —
    // a donation box fills up over the ten days, it does not arrive at once.
    const date = shiftDate(today, START + ((i * 5) % 11));
    return {
      id: id("dntn", i + 1),
      donation_number: i + 1,
      donor_name: name,
      phone_number: i % 4 === 0 ? null : phone(r),
      item,
      value,
      donation_date: date > today ? today : date,
      created_at: stamp(date > today ? today : date, 20, i),
      updated_at: stamp(date > today ? today : date, 20, i),
      user_id: i % 3 === 0 ? PEER_ID : USER_ID,
      created_by_email: i % 3 === 0 ? DEMO_PEER_EMAIL : DEMO_EMAIL,
    };
  });

  const expenses: Expense[] = EXPENSES.map(([description, category, amount], i) => {
    const date = shiftDate(today, START - 3 + Math.floor(i * 0.7));
    const spent = date > today ? today : date;
    // The last two are bills the mandal has committed to but not settled —
    // the expense side of a pledge, which the overview reports separately.
    const unpaid = i >= EXPENSES.length - 2;

    return {
      id: id("expn", i + 1),
      description,
      amount,
      category,
      payment_method: i % 3 === 0 ? "Cash" : "UPI",
      spent_on: spent,
      note: i % 5 === 0 ? "Receipt kept with the treasurer" : null,
      created_at: stamp(spent, 12 + (i % 8), (i * 7) % 60),
      updated_at: stamp(spent, 12 + (i % 8), (i * 7) % 60),
      user_id: i % 2 === 0 ? PEER_ID : USER_ID,
      created_by_email: i % 2 === 0 ? DEMO_PEER_EMAIL : DEMO_EMAIL,
      payment_status: unpaid ? "Unpaid" : "Paid",
      due_on: unpaid ? shiftDate(today, i === EXPENSES.length - 1 ? 0 : 3) : null,
      paid_amount: i === EXPENSES.length - 1 ? 6000 : null,
    };
  });

  const volunteer_names: VolunteerName[] = [
    {
      email: DEMO_EMAIL,
      display_name: "Aditya",
      updated_at: stamp(shiftDate(today, START), 9, 0),
    },
    {
      email: DEMO_PEER_EMAIL,
      display_name: "Sunil Kaka",
      updated_at: stamp(shiftDate(today, START), 9, 5),
    },
  ];

  return { receipts, donations, expenses, volunteer_names };
}

/** Stable user ids, referenced by seeded rows and by the fake auth. */
export const USER_ID = "11111111-1111-4111-8111-111111111111";
export const PEER_ID = "22222222-2222-4222-8222-222222222222";

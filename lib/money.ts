import { Bill } from "./types";

// Indian digit grouping with "=paise" suffix, e.g. 135000 -> "1,35,000=00"
export function fmtInr(n: number): string {
  if (!isFinite(n)) return "0=00";
  const negative = n < 0;
  const abs = Math.abs(n);
  const rupees = Math.floor(abs + 1e-9);
  const paise = Math.round((abs - rupees) * 100);
  let s = rupees.toString();
  if (s.length > 3) {
    const last3 = s.slice(-3);
    let rest = s.slice(0, -3);
    const parts: string[] = [];
    while (rest.length > 2) {
      parts.unshift(rest.slice(-2));
      rest = rest.slice(0, -2);
    }
    if (rest) parts.unshift(rest);
    s = parts.join(",") + "," + last3;
  }
  return (negative ? "-" : "") + s + "=" + paise.toString().padStart(2, "0");
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  let out = "";
  if (h) out = ONES[h] + " Hundred";
  if (rest) out += (out ? " " : "") + twoDigits(rest);
  return out;
}

// Indian numbering system: crore / lakh / thousand / hundred
export function numberToWordsIndian(n: number): string {
  const rupees = Math.floor(Math.abs(n) + 1e-9);
  const paise = Math.round((Math.abs(n) - rupees) * 100);
  if (rupees === 0 && paise === 0) return "Zero Only";

  let x = rupees;
  const crore = Math.floor(x / 10000000); x %= 10000000;
  const lakh = Math.floor(x / 100000); x %= 100000;
  const thousand = Math.floor(x / 1000); x %= 1000;

  const parts: string[] = [];
  if (crore) parts.push(twoDigits(crore) + " Crore");
  if (lakh) parts.push(twoDigits(lakh) + " Lakh");
  if (thousand) parts.push(twoDigits(thousand) + " Thousand");
  if (x) parts.push(threeDigits(x));

  let out = parts.join(" ");
  if (paise) out += (out ? " and " : "") + twoDigits(paise) + " Paise";
  return out + " Only";
}

// "2026-04-30" -> "30/04/2026"
export function fmtDateSlash(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// "2026-04-30" -> "30.04.2026"
export function fmtDateDot(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

// Indian financial year prefix for a given ISO date, e.g. "2026-27"
export function fyPrefix(iso: string): string {
  const d = iso ? new Date(iso + "T00:00:00") : new Date();
  const y = d.getFullYear();
  const startYear = d.getMonth() >= 3 ? y : y - 1; // April(3) onward is new FY
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

// Round to 2 decimal places avoiding float artifacts
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Months count -> word/numeric label used inside the Display Period line
export function monthsLabel(months: number): string {
  const WORDS: Record<number, string> = {
    1: "one", 2: "two", 3: "three", 4: "four", 5: "five",
    6: "six", 7: "seven", 8: "eight", 9: "nine", 10: "ten",
  };
  if (Number.isInteger(months) && WORDS[months]) {
    return `${WORDS[months]} month${months === 1 ? "" : "s"}`;
  }
  return `${months} months`;
}

// Builds "01.04.2026 to 30.04.2026 (one month)" from period bounds + months count
export function buildPeriodLabel(fromIso: string, toIso: string, months: number): string {
  if (!fromIso || !toIso) return "";
  return `${fmtDateDot(fromIso)} to ${fmtDateDot(toIso)} (${monthsLabel(months)})`;
}

// Billing convention: 1 month = 30 days, inclusive of both the from and to date
// (e.g. 01.08.2026 to 20.08.2026 = 20 days = 0.67 months), so a partial-month
// display run is prorated instead of always billed as a full month.
//
// A period that runs from the 1st of a month through the last day of a month
// (spanning whole calendar months, e.g. 01.08 to 31.08, or 01.08 to 30.09) is
// billed as a clean integer month count instead of the 30-day approximation —
// a 31-day calendar month shouldn't read as "1.03 months" on the invoice.
export function monthsFromPeriod(fromIso: string, toIso: string): number {
  if (!fromIso || !toIso) return 1;
  const from = new Date(fromIso + "T00:00:00");
  const to = new Date(toIso + "T00:00:00");
  const days = Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  if (days <= 0) return 1;

  const lastDayOfToMonth = new Date(to.getFullYear(), to.getMonth() + 1, 0).getDate();
  const isFullCalendarSpan = from.getDate() === 1 && to.getDate() === lastDayOfToMonth;
  if (isFullCalendarSpan) {
    return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1;
  }

  return round2(days / 30);
}

export interface TaxRow {
  label: string;
  amount: number;
}

export interface BillTotals {
  net: number;
  taxRows: TaxRow[];
  taxTotal: number;
  grandTotal: number;
}

// Shared by the invoice preview and the form's running-total strip
export function calcBillTotals(bill: Bill): BillTotals {
  const net = round2(bill.items.reduce((sum, item) => sum + (item.amount || 0), 0));

  const taxRows: TaxRow[] = [];
  if (bill.taxMode === "igst") {
    taxRows.push({ label: "IGST @18%", amount: round2(net * 0.18) });
  } else {
    const half = round2(net * 0.09);
    taxRows.push({ label: "CGST @9%", amount: half });
    taxRows.push({ label: "SGST @9%", amount: half });
  }
  const taxTotal = round2(taxRows.reduce((sum, r) => sum + r.amount, 0));
  const grandTotal = round2(net + taxTotal);

  return { net, taxRows, taxTotal, grandTotal };
}

export interface DisplayTemplate {
  id: string;
  display: string; // e.g. "Tathastu" / "Pride Purple"
  location: string; // e.g. "Deccan Gymkhana, Facing Sambhaji Bridge, Pune."
  size: string; // e.g. "28' x 13' illuminated"
  sacCode: string; // default "998366"
  rate: number; // per month
  rateUnit: string; // default "Per Month"
}

export interface Client {
  id: string;
  name: string; // "Tathastu" -> rendered as "M/s. Tathastu"
  address: string; // multi-line
  stateName: string; // "Maharashtra"
  stateCode: string; // "27"
  gstin: string;
  displays: DisplayTemplate[];
}

export interface BillItem {
  id: string;
  display: string;
  location: string;
  size: string;
  periodFrom: string; // yyyy-mm-dd
  periodTo: string; // yyyy-mm-dd
  periodLabel: string; // auto-built, editable override
  sacCode: string;
  rate: number;
  rateUnit: string; // "Per Month"
  months: number; // multiplier, default 1
  amount: number; // auto = rate * months, manually overridable
}

export type TaxMode = "cgst_sgst" | "igst";

export interface Bill {
  date: string; // yyyy-mm-dd
  invoiceNo: string; // free text, e.g. "2026-27/03"
  buyerName: string;
  buyerAddress: string;
  buyerStateName: string;
  buyerStateCode: string;
  buyerGstin: string;
  poNumber: string; // optional client purchase-order number, shown below GSTIN when present
  items: BillItem[];
  taxMode: TaxMode;
}

export const SELLER = {
  name: "MIDAS PUBLICITY",
  tagline: "Outdoor Advertising",
  addressLine1: "687 Budhwar Peth, Kamala Chambers, Office No.302, Bajirao Road,",
  addressLine2: "Near ABC Chowk, Pune-411002",
  contact: "Mob.: 9403187051 | Email: midaspublicity@gmail.com",
  gstin: "27AGIPC6356K1Z5",
  pan: "AGIPC6356K",
  udyam: "UDYAM-MH-26-0635701",
  bank: {
    acName: "MIDAS PUBLICITY",
    bank: "State Bank of India",
    branch: "Pune City branch",
    acNo: "11153673038",
    ifsc: "SBIN0000455",
  },
} as const;

export function makeId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function newBillItem(): BillItem {
  return {
    id: makeId(),
    display: "",
    location: "",
    size: "",
    periodFrom: "",
    periodTo: "",
    periodLabel: "",
    sacCode: "998366",
    rate: 0,
    rateUnit: "Per Month",
    months: 1,
    amount: 0,
  };
}

export function newDisplayTemplate(): DisplayTemplate {
  return {
    id: makeId(),
    display: "",
    location: "",
    size: "",
    sacCode: "998366",
    rate: 0,
    rateUnit: "Per Month",
  };
}

export function newClient(): Client {
  return {
    id: makeId(),
    name: "",
    address: "",
    stateName: "Maharashtra",
    stateCode: "27",
    gstin: "",
    displays: [],
  };
}

// Fixed id (not makeId()) because this seeds useState(emptyBill()) directly,
// which runs during SSR and again on client hydration — a random id there
// would differ between passes and break hydration.
export function emptyBill(): Bill {
  return {
    date: "",
    invoiceNo: "",
    buyerName: "",
    buyerAddress: "",
    buyerStateName: "Maharashtra",
    buyerStateCode: "27",
    buyerGstin: "",
    poNumber: "",
    items: [{ ...newBillItem(), id: "initial" }],
    taxMode: "cgst_sgst",
  };
}

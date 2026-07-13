"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";
import InvoicePreview from "@/components/InvoicePreview";
import ItemEditor from "@/components/ItemEditor";
import ClientManager from "@/components/ClientManager";
import { Bill, Client, TaxMode, emptyBill, newBillItem } from "@/lib/types";
import { calcBillTotals, fmtInr, fyPrefix } from "@/lib/money";
import {
  loadClients,
  saveClients,
  loadDraft,
  saveDraft,
  loadLastSerial,
  saveLastSerial,
  loadTheme,
  saveTheme,
  Theme,
} from "@/lib/store";

const A4_WIDTH_PX = 793.7; // 210mm at 96dpi

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function suggestInvoiceNo(dateIso: string, lastSerial: number): string {
  return `${fyPrefix(dateIso)}/${String(lastSerial + 1).padStart(2, "0")}`;
}

export default function Home() {
  const [ready, setReady] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [lastSerial, setLastSerial] = useState(0);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [bill, setBill] = useState<Bill>(emptyBill());
  const [scale, setScale] = useState(1);
  const [theme, setTheme] = useState<Theme>("light");

  const previewScrollRef = useRef<HTMLDivElement>(null);

  // initial load from localStorage (client-only)
  useEffect(() => {
    const storedClients = loadClients();
    const storedSerial = loadLastSerial();
    setClients(storedClients);
    setLastSerial(storedSerial);

    const draft = loadDraft();
    if (draft) {
      // merge over emptyBill() so fields added after a draft was saved (e.g.
      // poNumber) get a safe default instead of undefined
      setBill({ ...emptyBill(), ...draft });
    } else {
      const initial = emptyBill();
      initial.date = todayIso();
      initial.invoiceNo = suggestInvoiceNo(initial.date, storedSerial);
      setBill(initial);
    }

    const storedTheme = loadTheme();
    const resolvedTheme =
      storedTheme ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTheme(resolvedTheme);
    if (storedTheme) document.documentElement.setAttribute("data-theme", storedTheme);

    setReady(true);
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    saveTheme(next);
  }

  // persist draft on every change, after initial load completes
  useEffect(() => {
    if (!ready) return;
    saveDraft(bill);
  }, [bill, ready]);

  // recompute horizontal scale to fit the available preview width
  useEffect(() => {
    function recomputeScale() {
      const container = previewScrollRef.current;
      if (!container) return;
      const availableWidth = container.clientWidth;
      setScale(Math.min(1, availableWidth / A4_WIDTH_PX));
    }
    recomputeScale();
    const ro = new ResizeObserver(recomputeScale);
    if (previewScrollRef.current) ro.observe(previewScrollRef.current);
    window.addEventListener("resize", recomputeScale);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recomputeScale);
    };
  }, [ready]);

  function updateClients(next: Client[]) {
    setClients(next);
    saveClients(next);
  }

  function handleSelectClient(id: string) {
    setSelectedClientId(id);
    if (!id) {
      setBill({
        ...bill,
        buyerName: "",
        buyerAddress: "",
        buyerStateName: "Maharashtra",
        buyerStateCode: "27",
        buyerGstin: "",
      });
      return;
    }
    const client = clients.find((c) => c.id === id);
    if (!client) return;
    const items =
      client.displays.length > 0
        ? client.displays.map((tpl) => ({
            ...newBillItem(),
            display: tpl.display,
            location: tpl.location,
            size: tpl.size,
            sacCode: tpl.sacCode,
            rate: tpl.rate,
            rateUnit: tpl.rateUnit,
            amount: tpl.rate,
          }))
        : [newBillItem()];
    setBill({
      ...bill,
      buyerName: client.name,
      buyerAddress: client.address,
      buyerStateName: client.stateName,
      buyerStateCode: client.stateCode,
      buyerGstin: client.gstin,
      items,
    });
  }

  function patchBill(fields: Partial<Bill>) {
    setBill({ ...bill, ...fields });
  }

  function addItem() {
    setBill({ ...bill, items: [...bill.items, newBillItem()] });
  }

  function updateItem(id: string, updated: Bill["items"][number]) {
    setBill({ ...bill, items: bill.items.map((it) => (it.id === id ? updated : it)) });
  }

  function removeItem(id: string) {
    if (bill.items.length <= 1) return;
    setBill({ ...bill, items: bill.items.filter((it) => it.id !== id) });
  }

  function refreshInvoiceSuggestion() {
    patchBill({ invoiceNo: suggestInvoiceNo(bill.date, lastSerial) });
  }

  function handleDownload() {
    const prefix = `${fyPrefix(bill.date)}/`;
    if (bill.invoiceNo.startsWith(prefix)) {
      const serialPart = bill.invoiceNo.slice(prefix.length);
      const n = parseInt(serialPart, 10);
      if (!isNaN(n) && n > lastSerial) {
        setLastSerial(n);
        saveLastSerial(n);
      }
    }
    window.print();
  }

  const currentTemplates = clients.find((c) => c.id === selectedClientId)?.displays ?? [];
  const { grandTotal } = calcBillTotals(bill);

  return (
    <div className={styles.page}>
      <div className={`${styles.topbar} app-chrome`}>
        <div>
          <div className={styles.topbarTitle}>Midas Publicity</div>
          <div className={styles.topbarSubtitle}>Generate tax invoices, preview live, download as A4 PDF</div>
        </div>
        <button type="button" className="btn btnGhost" onClick={toggleTheme}>
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
      </div>

      <div className={styles.layout}>
        <div className={`${styles.formPanel} app-chrome`}>
          <ClientManager clients={clients} onSave={updateClients} />

          <div className={styles.section}>
            <p className="eyebrow">Bill to</p>
            <div className="field">
              <label htmlFor="f-client">Client</label>
              <select
                id="f-client"
                name="client"
                value={selectedClientId}
                onChange={(e) => handleSelectClient(e.target.value)}
              >
                <option value="">Custom (one-off bill)</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="f-buyerName">Buyer name</label>
              <input
                id="f-buyerName"
                name="buyerName"
                type="text"
                value={bill.buyerName}
                onChange={(e) => patchBill({ buyerName: e.target.value })}
                placeholder="e.g. Tathastu"
              />
            </div>
            <div className="field">
              <label htmlFor="f-buyerAddress">Buyer address</label>
              <textarea
                id="f-buyerAddress"
                name="buyerAddress"
                rows={2}
                value={bill.buyerAddress}
                onChange={(e) => patchBill({ buyerAddress: e.target.value })}
                placeholder="Kumthekar road, Pune"
              />
            </div>
            <div className="fieldRow">
              <div className="field">
                <label htmlFor="f-buyerStateName">State name</label>
                <input
                  id="f-buyerStateName"
                  name="buyerStateName"
                  type="text"
                  value={bill.buyerStateName}
                  onChange={(e) => patchBill({ buyerStateName: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="f-buyerStateCode">State code</label>
                <input
                  id="f-buyerStateCode"
                  name="buyerStateCode"
                  type="text"
                  value={bill.buyerStateCode}
                  onChange={(e) => patchBill({ buyerStateCode: e.target.value })}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="f-buyerGstin">GSTIN</label>
              <input
                id="f-buyerGstin"
                name="buyerGstin"
                type="text"
                value={bill.buyerGstin}
                onChange={(e) => patchBill({ buyerGstin: e.target.value })}
                placeholder="27AAEFT4379B1Z5"
              />
            </div>
            <div className="field">
              <label htmlFor="f-poNumber">PO Number (optional)</label>
              <input
                id="f-poNumber"
                name="poNumber"
                type="text"
                value={bill.poNumber}
                onChange={(e) => patchBill({ poNumber: e.target.value })}
                placeholder="e.g. PO-4471"
              />
            </div>
          </div>

          <hr className="hairline" />

          <div className={styles.section}>
            <p className="eyebrow">Invoice</p>
            <div className="fieldRow">
              <div className="field">
                <label htmlFor="f-date">Date</label>
                <input
                  id="f-date"
                  name="date"
                  type="date"
                  value={bill.date}
                  onChange={(e) => patchBill({ date: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="f-invoiceNo">Invoice No.</label>
                <input
                  id="f-invoiceNo"
                  name="invoiceNo"
                  type="text"
                  value={bill.invoiceNo}
                  onChange={(e) => patchBill({ invoiceNo: e.target.value })}
                />
              </div>
            </div>
            <button type="button" className="btn btnGhost btnBlock" onClick={refreshInvoiceSuggestion}>
              Suggest next invoice number
            </button>
          </div>

          <hr className="hairline" />

          <div className={styles.section}>
            <div className={styles.sectionHead}>
              <p className="eyebrow">Line items</p>
            </div>
            <div className={styles.itemsStack}>
              {bill.items.map((item, idx) => (
                <ItemEditor
                  key={item.id}
                  item={item}
                  index={idx}
                  templates={currentTemplates}
                  onChange={(updated) => updateItem(item.id, updated)}
                  onRemove={() => removeItem(item.id)}
                  canRemove={bill.items.length > 1}
                />
              ))}
            </div>
            <button type="button" className="btn btnGhost btnBlock" onClick={addItem}>
              + Add item
            </button>
          </div>

          <hr className="hairline" />

          <div className={styles.section}>
            <p className="eyebrow">Tax</p>
            <div className={styles.radioRow}>
              <label className={styles.radioOption}>
                <input
                  id="f-taxCgstSgst"
                  type="radio"
                  name="taxMode"
                  checked={bill.taxMode === "cgst_sgst"}
                  onChange={() => patchBill({ taxMode: "cgst_sgst" as TaxMode })}
                />
                CGST 9% + SGST 9% (within Maharashtra)
              </label>
              <label className={styles.radioOption}>
                <input
                  id="f-taxIgst"
                  type="radio"
                  name="taxMode"
                  checked={bill.taxMode === "igst"}
                  onChange={() => patchBill({ taxMode: "igst" as TaxMode })}
                />
                IGST 18% (outside Maharashtra)
              </label>
            </div>
          </div>

          <button type="button" className="btn btnPrimary btnBlock" onClick={handleDownload}>
            Download PDF
          </button>
        </div>

        <div className={styles.previewPanel}>
          <div className={`${styles.summaryStrip} app-chrome`}>
            <p className={styles.summaryLabel}>Live preview</p>
            <p className={styles.summaryTotal}>
              <span>Grand total</span>
              {fmtInr(grandTotal)}
            </p>
          </div>
          <div className={styles.previewScroll} ref={previewScrollRef}>
            <div
              className={`${styles.sheetWrap} sheet-wrap`}
              style={{ transform: `scale(${scale})`, width: A4_WIDTH_PX }}
            >
              <InvoicePreview bill={bill} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

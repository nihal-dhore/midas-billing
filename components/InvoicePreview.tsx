import { Bill, SELLER } from "@/lib/types";
import { calcBillTotals, fmtDateSlash, fmtInr, numberToWordsIndian, TaxRow } from "@/lib/money";
import styles from "./InvoicePreview.module.css";

interface Props {
  bill: Bill;
}

// Fixed (not flex/percentage-based) filler heights for the last item row,
// tuned so the item table's blank space reaches near the page bottom for a
// short bill without pushing the totals/footer/signature onto a second
// page. Static heights are used instead of a flex-grow/height:100% fill
// because Safari's print engine (used by the iPad "Download PDF" -> Print
// -> Save as PDF flow) does not reliably size flex/percentage-height
// content in paged media — it renders blank/collapsed boxes there even
// though Chromium's print pipeline handles it fine.
//
// Kept well under the headless-safe ceiling (~82mm tested 1-page-safe on
// Letter with Chromium/Firefox/WebKit) because iOS's own print pipeline
// adds its own header/footer band (URL + date + page number) that eats
// extra vertical space no headless engine reproduces — that's what pushed
// the original 80mm value to a second page on a real iPad even though it
// tested fine here. If a real device still overflows to page 2, shrink
// these further; there's no way to verify Safari's print chrome headlessly.
function fillerHeightMm(itemCount: number): number | null {
  if (itemCount === 1) return 78;
  if (itemCount === 2) return 50;
  return null;
}

export default function InvoicePreview({ bill }: Props) {
  const { net, taxRows, grandTotal } = calcBillTotals(bill);
  const rightRows: TaxRow[] = [{ label: "Net Amount Before Tax", amount: net }, ...taxRows];

  const dense = bill.items.length > 3 ? styles.dense : "";
  const fillerMm = fillerHeightMm(bill.items.length);

  return (
    <div className={`${styles.sheet} ${dense} invoice-sheet`}>
      <div className={styles.header}>
        <p className={styles.companyName}>{SELLER.name}</p>
        <p className={styles.tagline}>{SELLER.tagline}</p>
        <p className={styles.addressLine}>{SELLER.addressLine1}</p>
        <p className={styles.addressLine}>{SELLER.addressLine2}</p>
        <p className={styles.addressLine}>{SELLER.contact}</p>
      </div>
      <hr className={styles.headerRule} />
      <p className={styles.titleBar}>TAX INVOICE</p>

      <div className={styles.buyerMetaRow}>
        <div className={styles.buyerBlock}>
          <p>To:</p>
          <p className={styles.buyerName}>M/s. {bill.buyerName}</p>
          {bill.buyerAddress.split("\n").filter(Boolean).map((line, i) => (
            <p key={i}>{line}</p>
          ))}
          <p>
            {bill.buyerStateName} Code : {bill.buyerStateCode}
          </p>
          <p className={styles.buyerGstin}>GSTIN :- {bill.buyerGstin}</p>
          {bill.poNumber?.trim() && <p className={styles.buyerPo}>PO No : {bill.poNumber}</p>}
        </div>
        <div className={styles.metaBlock}>
          <p>Date : {fmtDateSlash(bill.date)}</p>
          <p>INVOICE No:{bill.invoiceNo}</p>
        </div>
      </div>

      {/* Item rows and totals rows live in one bordered table (matching the
          real bills) so a short item list leaves blank space INSIDE the
          table border rather than a floating gap outside it. Only the
          description cell of the last item gets an explicit fixed height
          (see fillerHeightMm) — the table row layout stretches the whole
          row to match, so its border becomes the single line separating
          items from totals, instead of a second seam. */}
      <table className={styles.table}>
        <colgroup>
          <col style={{ width: "6%" }} />
          <col style={{ width: "52%" }} />
          <col style={{ width: "11%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "17%" }} />
        </colgroup>
        <thead>
          <tr className={styles.theadRow}>
            <th>Sr. No.</th>
            <th>Description</th>
            <th>SAC Code</th>
            <th>Rate</th>
            <th>Taxable Amount</th>
          </tr>
        </thead>
        <tbody>
          {bill.items.map((item, idx) => {
            const isLast = idx === bill.items.length - 1;
            return (
              <tr key={item.id}>
                <td className={styles.srCell}>{idx + 1})</td>
                <td
                  className={styles.descCell}
                  style={isLast && fillerMm ? { height: `${fillerMm}mm` } : undefined}
                >
                  <p className={styles.bold}>Sale of other advertising space or time</p>
                  <p className={styles.bold}>DISPLAY CHARGES</p>
                  <p className={styles.bold}>DISPLAY : {item.display}</p>
                  <p>
                    <span className={styles.bold}>Location</span> : {item.location}
                  </p>
                  <p>
                    <span className={styles.bold}>Size</span> : {item.size}
                  </p>
                  <p>
                    <span className={styles.bold}>Display Period</span> : {item.periodLabel}
                  </p>
                </td>
                <td className={styles.centerCell}>{item.sacCode}</td>
                <td className={styles.centerCell}>
                  {fmtInr(item.rate)}
                  <br />
                  {item.rateUnit}
                </td>
                <td className={styles.rightCell}>{fmtInr(item.amount)}</td>
              </tr>
            );
          })}

          {rightRows.map((row, i) => (
            <tr key={row.label} className={styles.totalsRow}>
              {i === 0 && (
                <td className={styles.totalsLeftCell} colSpan={2} rowSpan={rightRows.length}>
                  <p>GSTIN : {SELLER.gstin}</p>
                  <p>PAN No : {SELLER.pan}</p>
                  <p>UDYAM R.No : {SELLER.udyam}</p>
                </td>
              )}
              <td className={`${styles.totalsLabelCell} ${i > 0 ? styles.taxBg : ""}`} colSpan={2}>
                {row.label}
              </td>
              <td className={`${styles.totalsValueCell} ${i > 0 ? styles.taxBg : ""}`}>
                {fmtInr(row.amount)}
              </td>
            </tr>
          ))}

          <tr className={styles.grandRow}>
            <td colSpan={2}>Rs : {numberToWordsIndian(grandTotal)}.</td>
            <td colSpan={2}>GRAND TOTAL :</td>
            <td>{fmtInr(grandTotal)}</td>
          </tr>
        </tbody>
      </table>

      <div className={styles.footerRow}>
        <div className={styles.footerLeft}>
          <p>
            <span className={styles.bold}>Note:</span> Please indicate our Bill No.on the TDS
            certificate if Income Tax is deducted from our payment. Please deduct TDS on the
            Basic Amount and Not on GST as per CBDT Circular 01/2014 dtd. 13/01/2014
          </p>
          <hr className={styles.footerRule} />
          <p className={styles.bold}>E &amp; O.E.</p>
          <ul className={styles.bulletList}>
            <li>
              cheque should be drawn in favour of <span className={styles.bold}>&quot;MIDAS PUBLICITY&quot;</span>
            </li>
            <li>Any complaint about this bill must be received within 3 days from the receipt of this bill.</li>
            <li>Amount shall be deemed to be overdue at the end of 30 days from the date of this bill.</li>
            <li>Interest at 12% will be charged on over due bills.</li>
          </ul>
        </div>
        <div className={styles.footerRight}>
          <p className={styles.bankTitle}>BANK DETAILS</p>
          <div className={styles.bankBox}>
            <p>A/c Name : {SELLER.bank.acName}</p>
            <p>Bank : {SELLER.bank.bank}</p>
            <p>Branch: {SELLER.bank.branch}</p>
            <p>
              A/c No : <span className={styles.bold}>{SELLER.bank.acNo}</span>
            </p>
            <p>
              IFS Code : <span className={styles.bold}>{SELLER.bank.ifsc}</span>
            </p>
          </div>
        </div>
      </div>

      <p className={styles.signature}>For {SELLER.name}</p>
    </div>
  );
}

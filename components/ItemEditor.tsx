import { BillItem, DisplayTemplate } from "@/lib/types";
import { buildPeriodLabel, monthsFromPeriod, round2 } from "@/lib/money";
import styles from "./ItemEditor.module.css";

interface Props {
  item: BillItem;
  index: number;
  templates: DisplayTemplate[];
  onChange: (item: BillItem) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export default function ItemEditor({ item, index, templates, onChange, onRemove, canRemove }: Props) {
  const fid = (name: string) => `item-${item.id}-${name}`;

  function patch(fields: Partial<BillItem>) {
    onChange({ ...item, ...fields });
  }

  // Recomputes months (30-day convention) and amount from the period bounds,
  // so a partial-month display run gets prorated instead of billed as a full
  // month. Used by the period-from/period-to date pickers.
  function patchAndRebuildPeriod(fields: Partial<BillItem>) {
    const next = { ...item, ...fields };
    next.months = monthsFromPeriod(next.periodFrom, next.periodTo);
    next.amount = round2(next.rate * next.months);
    next.periodLabel = buildPeriodLabel(next.periodFrom, next.periodTo, next.months);
    onChange(next);
  }

  function applyTemplate(templateId: string) {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    patch({
      display: tpl.display,
      location: tpl.location,
      size: tpl.size,
      sacCode: tpl.sacCode,
      rate: tpl.rate,
      rateUnit: tpl.rateUnit,
      amount: round2(tpl.rate * item.months),
    });
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <span className={styles.cardTitle}>Item {index + 1}</span>
        {canRemove && (
          <button type="button" className="btn btnDangerText" onClick={onRemove}>
            Remove
          </button>
        )}
      </div>

      {templates.length > 0 && (
        <div className="field">
          <select defaultValue="" onChange={(e) => e.target.value && applyTemplate(e.target.value)}>
            <option value="">Fill from saved display…</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.display} — {t.size}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="fieldRow">
        <div className="field">
          <label htmlFor={fid("display")}>Display name</label>
          <input
            id={fid("display")}
            name="display"
            type="text"
            value={item.display}
            onChange={(e) => patch({ display: e.target.value })}
            placeholder="e.g. Pride Purple"
          />
        </div>
        <div className="field">
          <label htmlFor={fid("size")}>Size</label>
          <input
            id={fid("size")}
            name="size"
            type="text"
            value={item.size}
            onChange={(e) => patch({ size: e.target.value })}
            placeholder="e.g. 60' x 20' illuminated"
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor={fid("location")}>Location</label>
        <input
          id={fid("location")}
          name="location"
          type="text"
          value={item.location}
          onChange={(e) => patch({ location: e.target.value })}
          placeholder="e.g. Deccan Gymkhana, Facing Sambhaji Bridge, Pune."
        />
      </div>

      <div className="fieldRow3">
        <div className="field">
          <label htmlFor={fid("periodFrom")}>Period from</label>
          <input
            id={fid("periodFrom")}
            name="periodFrom"
            type="date"
            value={item.periodFrom}
            onChange={(e) => {
              const periodFrom = e.target.value;
              const periodTo = item.periodTo && item.periodTo < periodFrom ? periodFrom : item.periodTo;
              patchAndRebuildPeriod({ periodFrom, periodTo });
            }}
          />
        </div>
        <div className="field">
          <label htmlFor={fid("periodTo")}>Period to</label>
          <input
            id={fid("periodTo")}
            name="periodTo"
            type="date"
            min={item.periodFrom || undefined}
            value={item.periodTo}
            onChange={(e) => patchAndRebuildPeriod({ periodTo: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor={fid("sacCode")}>SAC</label>
          <input
            id={fid("sacCode")}
            name="sacCode"
            type="text"
            value={item.sacCode}
            onChange={(e) => patch({ sacCode: e.target.value })}
          />
        </div>
      </div>

      <div className="field">
        <label htmlFor={fid("periodLabel")}>Display period label (auto, editable)</label>
        <input
          id={fid("periodLabel")}
          name="periodLabel"
          type="text"
          value={item.periodLabel}
          onChange={(e) => patch({ periodLabel: e.target.value })}
        />
      </div>

      <div className="fieldRow3">
        <div className="field">
          <label htmlFor={fid("rate")}>Rate</label>
          <input
            id={fid("rate")}
            name="rate"
            type="number"
            step="0.01"
            min="0"
            value={item.rate}
            onChange={(e) => {
              const rate = parseFloat(e.target.value) || 0;
              patch({ rate, amount: round2(rate * item.months) });
            }}
          />
        </div>
        <div className="field">
          <label htmlFor={fid("rateUnit")}>Rate unit</label>
          <input
            id={fid("rateUnit")}
            name="rateUnit"
            type="text"
            value={item.rateUnit}
            onChange={(e) => patch({ rateUnit: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor={fid("amount")}>Amount (overridable)</label>
          <input
            id={fid("amount")}
            name="amount"
            type="number"
            step="0.01"
            min="0"
            value={item.amount}
            onChange={(e) => patch({ amount: parseFloat(e.target.value) || 0 })}
          />
        </div>
      </div>
    </div>
  );
}

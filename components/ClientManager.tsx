"use client";

import { useState } from "react";
import { Client, DisplayTemplate, newClient, newDisplayTemplate } from "@/lib/types";
import styles from "./ClientManager.module.css";

interface Props {
  clients: Client[];
  onSave: (clients: Client[]) => void;
}

export default function ClientManager({ clients, onSave }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [isNew, setIsNew] = useState(false);

  function startAdd() {
    setIsNew(true);
    setEditing(newClient());
  }

  function startEdit(client: Client) {
    setIsNew(false);
    setEditing({ ...client, displays: client.displays.map((d) => ({ ...d })) });
  }

  function cancelEdit() {
    setEditing(null);
  }

  function commitEdit() {
    if (!editing || !editing.name.trim()) return;
    const next = isNew
      ? [...clients, editing]
      : clients.map((c) => (c.id === editing.id ? editing : c));
    onSave(next);
    setEditing(null);
  }

  function deleteClient(id: string) {
    if (!window.confirm("Delete this saved client? This cannot be undone.")) return;
    onSave(clients.filter((c) => c.id !== id));
  }

  function patchEditing(fields: Partial<Client>) {
    if (!editing) return;
    setEditing({ ...editing, ...fields });
  }

  function addTemplate() {
    if (!editing) return;
    setEditing({ ...editing, displays: [...editing.displays, newDisplayTemplate()] });
  }

  function patchTemplate(id: string, fields: Partial<DisplayTemplate>) {
    if (!editing) return;
    setEditing({
      ...editing,
      displays: editing.displays.map((d) => (d.id === id ? { ...d, ...fields } : d)),
    });
  }

  function removeTemplate(id: string) {
    if (!editing) return;
    setEditing({ ...editing, displays: editing.displays.filter((d) => d.id !== id) });
  }

  return (
    <div className={styles.panel}>
      <button type="button" className={styles.toggleBtn} onClick={() => setExpanded(!expanded)}>
        <span>Clients</span>
        <span className={styles.toggleCount}>{clients.length}</span>
      </button>

      {expanded && (
        <div className={styles.body}>
          {!editing && (
            <>
              {clients.length === 0 && (
                <p className={styles.emptyNote}>No saved clients yet. Add one to reuse across bills.</p>
              )}
              <div className={styles.clientList}>
                {clients.map((c) => (
                  <div className={styles.clientRow} key={c.id}>
                    <div>
                      <strong>{c.name}</strong>
                      <div className={styles.clientRowMeta}>
                        {c.gstin || "no GSTIN"} · {c.displays.length} saved display
                        {c.displays.length === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div className={styles.clientActions}>
                      <button type="button" className="btn btnAccentText" onClick={() => startEdit(c)}>
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btnDangerText"
                        onClick={() => deleteClient(c.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className="btn btnGhost btnBlock" onClick={startAdd}>
                + Add new client
              </button>
            </>
          )}

          {editing && (
            <div className={styles.editForm}>
              <p className={styles.formTitle}>{isNew ? "New client" : "Edit client"}</p>

              <div className="fieldRow">
                <div className="field">
                  <label htmlFor="cm-name">Client name</label>
                  <input
                    id="cm-name"
                    name="name"
                    type="text"
                    value={editing.name}
                    onChange={(e) => patchEditing({ name: e.target.value })}
                    placeholder="e.g. Tathastu"
                  />
                </div>
                <div className="field">
                  <label htmlFor="cm-gstin">GSTIN</label>
                  <input
                    id="cm-gstin"
                    name="gstin"
                    type="text"
                    value={editing.gstin}
                    onChange={(e) => patchEditing({ gstin: e.target.value })}
                    placeholder="27AAEFT4379B1Z5"
                  />
                </div>
              </div>

              <div className="field">
                <label htmlFor="cm-address">Address</label>
                <textarea
                  id="cm-address"
                  name="address"
                  rows={2}
                  value={editing.address}
                  onChange={(e) => patchEditing({ address: e.target.value })}
                  placeholder="Kumthekar road, Pune"
                />
              </div>

              <div className="fieldRow">
                <div className="field">
                  <label htmlFor="cm-stateName">State name</label>
                  <input
                    id="cm-stateName"
                    name="stateName"
                    type="text"
                    value={editing.stateName}
                    onChange={(e) => patchEditing({ stateName: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="cm-stateCode">State code</label>
                  <input
                    id="cm-stateCode"
                    name="stateCode"
                    type="text"
                    value={editing.stateCode}
                    onChange={(e) => patchEditing({ stateCode: e.target.value })}
                  />
                </div>
              </div>

              <hr className="hairline" />

              <div className={styles.templateBlock}>
                <p className="eyebrow">Saved displays (prefill bill items)</p>
                {editing.displays.map((tpl) => (
                  <div className={styles.templateCard} key={tpl.id}>
                    <div className={styles.templateCardHead}>
                      <span className={styles.templateCardTitle}>Display template</span>
                      <button
                        type="button"
                        className="btn btnDangerText"
                        onClick={() => removeTemplate(tpl.id)}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="fieldRow">
                      <div className="field">
                        <label htmlFor={`tpl-${tpl.id}-display`}>Display name</label>
                        <input
                          id={`tpl-${tpl.id}-display`}
                          name="display"
                          type="text"
                          value={tpl.display}
                          onChange={(e) => patchTemplate(tpl.id, { display: e.target.value })}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={`tpl-${tpl.id}-size`}>Size</label>
                        <input
                          id={`tpl-${tpl.id}-size`}
                          name="size"
                          type="text"
                          value={tpl.size}
                          onChange={(e) => patchTemplate(tpl.id, { size: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="field">
                      <label htmlFor={`tpl-${tpl.id}-location`}>Location</label>
                      <input
                        id={`tpl-${tpl.id}-location`}
                        name="location"
                        type="text"
                        value={tpl.location}
                        onChange={(e) => patchTemplate(tpl.id, { location: e.target.value })}
                      />
                    </div>
                    <div className="fieldRow3">
                      <div className="field">
                        <label htmlFor={`tpl-${tpl.id}-sacCode`}>SAC</label>
                        <input
                          id={`tpl-${tpl.id}-sacCode`}
                          name="sacCode"
                          type="text"
                          value={tpl.sacCode}
                          onChange={(e) => patchTemplate(tpl.id, { sacCode: e.target.value })}
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={`tpl-${tpl.id}-rate`}>Rate</label>
                        <input
                          id={`tpl-${tpl.id}-rate`}
                          name="rate"
                          type="number"
                          min="0"
                          step="0.01"
                          value={tpl.rate}
                          onChange={(e) =>
                            patchTemplate(tpl.id, { rate: parseFloat(e.target.value) || 0 })
                          }
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={`tpl-${tpl.id}-rateUnit`}>Rate unit</label>
                        <input
                          id={`tpl-${tpl.id}-rateUnit`}
                          name="rateUnit"
                          type="text"
                          value={tpl.rateUnit}
                          onChange={(e) => patchTemplate(tpl.id, { rateUnit: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <button type="button" className="btn btnGhost btnBlock" onClick={addTemplate}>
                  + Add saved display
                </button>
              </div>

              <div className={styles.formActions}>
                <button type="button" className="btn btnPrimary" onClick={commitEdit}>
                  Save client
                </button>
                <button type="button" className="btn btnGhost" onClick={cancelEdit}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { PointerEvent as ReactPointerEvent, useLayoutEffect, useRef, useState } from "react";
import { SitePhoto, fileToSitePhoto } from "@/lib/photos";
import styles from "./PhotoEditor.module.css";

interface Props {
  photos: SitePhoto[];
  onChange: (photos: SitePhoto[]) => void;
  saveError: string;
}

// Live state of a grip drag. Kept in a ref (not React state) because it
// changes on every pointer move and is applied straight to element styles.
interface DragState {
  id: string;
  pointerId: number;
  startY: number; // pointer clientY at grab
  lastY: number; // latest pointer clientY
  startOffsetTop: number; // card's layout position at grab
  scrollEl: HTMLElement | null; // container that scrolls while dragging (null = window)
  startScroll: number;
  swapPending: boolean; // a reorder was requested and hasn't rendered yet
}

const SETTLE_MS = 200;
const SETTLE_EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function scrollParent(from: HTMLElement): HTMLElement | null {
  let el = from.parentElement;
  while (el && !(el.scrollHeight > el.clientHeight && /(auto|scroll)/.test(getComputedStyle(el).overflowY))) {
    el = el.parentElement;
  }
  return el;
}

function scrollTopOf(el: HTMLElement | null): number {
  return el ? el.scrollTop : window.scrollY;
}

export default function PhotoEditor({ photos, onChange, saveError }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  // which photo the single-file change picker is for (a ref, not state, so
  // the change handler sees it even if React hasn't re-rendered yet)
  const replaceIdRef = useRef<string | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const dragRef = useRef<DragState | null>(null);
  // card layout positions captured just before a reorder, for the slide animation
  const prevTopsRef = useRef<Map<string, number> | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setAdding(true);
    setAddError("");
    // A new photo starts with the previous photo's text, since consecutive
    // photos are usually of the same site; both stay editable.
    const last = photos[photos.length - 1];
    let location = last?.location ?? "";
    let size = last?.size ?? "";
    const added: SitePhoto[] = [];
    let failed = 0;
    for (const file of Array.from(files)) {
      try {
        const photo = await fileToSitePhoto(file, location, size);
        added.push(photo);
        location = photo.location;
        size = photo.size;
      } catch {
        failed += 1;
      }
    }
    onChange([...photos, ...added]);
    if (failed) setAddError(`${failed} photo${failed === 1 ? "" : "s"} couldn't be read and ${failed === 1 ? "was" : "were"} skipped.`);
    setAdding(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function startReplace(id: string) {
    replaceIdRef.current = id;
    replaceInputRef.current?.click();
  }

  // Swaps only the picture: the photo keeps its place and its Location/Size
  async function handleReplace(files: FileList | null) {
    const id = replaceIdRef.current;
    const file = files?.[0];
    if (replaceInputRef.current) replaceInputRef.current.value = "";
    if (!id || !file) return;
    setReplacingId(id);
    setAddError("");
    try {
      const { dataUrl } = await fileToSitePhoto(file, "", "");
      onChange(photos.map((p) => (p.id === id ? { ...p, dataUrl } : p)));
    } catch {
      setAddError("That photo couldn't be read. The old photo was kept.");
    }
    setReplacingId(null);
    replaceIdRef.current = null;
  }

  function patch(id: string, fields: Partial<SitePhoto>) {
    onChange(photos.map((p) => (p.id === id ? { ...p, ...fields } : p)));
  }

  // ---- Drag to reorder (6-dot grip) ----------------------------------------
  // The grabbed card follows the pointer with a transform. When its centre
  // passes a neighbour's centre the list is reordered, and the neighbours
  // slide into their new places (FLIP: measure before, invert, animate to 0).
  // Pointer events cover mouse and iPad touch; capture keeps moves coming to
  // the grip while the finger is over other cards.

  // Where the grabbed card should be drawn: under the pointer, corrected for
  // scrolling and for layout moves caused by reorders.
  function applyDragTransform() {
    const d = dragRef.current;
    if (!d) return;
    const el = cardRefs.current.get(d.id);
    if (!el) return;
    const scrolled = scrollTopOf(d.scrollEl) - d.startScroll;
    const layoutShift = el.offsetTop - d.startOffsetTop;
    el.style.transform = `translateY(${d.lastY - d.startY + scrolled - layoutShift}px)`;
  }

  function onGripDown(e: ReactPointerEvent<HTMLButtonElement>, id: string) {
    const el = cardRefs.current.get(id);
    if (!el || dragRef.current) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // capture is a nicety; dragging still works within the grip's events
    }
    const scrollEl = scrollParent(el);
    dragRef.current = {
      id,
      pointerId: e.pointerId,
      startY: e.clientY,
      lastY: e.clientY,
      startOffsetTop: el.offsetTop,
      scrollEl,
      startScroll: scrollTopOf(scrollEl),
      swapPending: false,
    };
    el.style.transition = "none";
    setDraggingId(id);
  }

  function onGripMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    d.lastY = e.clientY;
    autoScroll(d.scrollEl, e.clientY);
    applyDragTransform();
    if (d.swapPending) return;

    const idx = photos.findIndex((p) => p.id === d.id);
    const el = cardRefs.current.get(d.id);
    if (idx < 0 || !el) return;
    const visualTop = el.offsetTop + (d.lastY - d.startY) + (scrollTopOf(d.scrollEl) - d.startScroll) - (el.offsetTop - d.startOffsetTop);
    const centre = visualTop + el.offsetHeight / 2;
    const centreOf = (i: number) => {
      const n = cardRefs.current.get(photos[i].id);
      return n ? n.offsetTop + n.offsetHeight / 2 : null;
    };
    const prev = idx > 0 ? centreOf(idx - 1) : null;
    const next = idx < photos.length - 1 ? centreOf(idx + 1) : null;
    let target = -1;
    if (prev !== null && centre < prev) target = idx - 1;
    else if (next !== null && centre > next) target = idx + 1;
    if (target < 0) return;

    const tops = new Map<string, number>();
    cardRefs.current.forEach((node, nodeId) => tops.set(nodeId, node.offsetTop));
    prevTopsRef.current = tops;
    d.swapPending = true;
    const reordered = [...photos];
    [reordered[idx], reordered[target]] = [reordered[target], reordered[idx]];
    onChange(reordered);
  }

  function onGripUp(e: ReactPointerEvent<HTMLButtonElement>) {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    const el = cardRefs.current.get(d.id);
    if (el) {
      // glide from where it was dropped into its slot
      el.style.transition = prefersReducedMotion() ? "none" : `transform ${SETTLE_MS}ms ${SETTLE_EASE}`;
      el.style.transform = "";
    }
    dragRef.current = null;
    setDraggingId(null);
  }

  // After a reorder renders: slide the other cards from their old spots and
  // keep the grabbed card under the pointer.
  useLayoutEffect(() => {
    const tops = prevTopsRef.current;
    const d = dragRef.current;
    if (!tops) return;
    prevTopsRef.current = null;
    const animate = !prefersReducedMotion();
    cardRefs.current.forEach((el, id) => {
      if (d && id === d.id) return;
      const before = tops.get(id);
      if (before === undefined) return;
      const delta = before - el.offsetTop;
      if (!delta || !animate) return;
      el.style.transition = "none";
      el.style.transform = `translateY(${delta}px)`;
      void el.offsetHeight; // commit the start position before animating
      el.style.transition = `transform ${SETTLE_MS}ms ${SETTLE_EASE}`;
      el.style.transform = "";
    });
    if (d) {
      applyDragTransform();
      d.swapPending = false;
    }
  }, [photos]);

  // Scrolls the form (or the page, when stacked) while dragging near its edge
  function autoScroll(scrollEl: HTMLElement | null, y: number) {
    const top = scrollEl ? scrollEl.getBoundingClientRect().top : 0;
    const bottom = scrollEl ? scrollEl.getBoundingClientRect().bottom : window.innerHeight;
    const edge = 70;
    const delta = y < top + edge ? -14 : y > bottom - edge ? 14 : 0;
    if (!delta) return;
    if (scrollEl) scrollEl.scrollBy(0, delta);
    else window.scrollBy(0, delta);
  }

  function remove(id: string) {
    onChange(photos.filter((p) => p.id !== id));
  }

  function removeAll() {
    if (window.confirm(`Remove all ${photos.length} photos from this bill?`)) onChange([]);
  }

  const pageCount = Math.ceil(photos.length / 2);

  return (
    <div className={styles.wrap}>
      <p className={styles.hint}>
        Printed after the bill, 2 photos per page.
        {photos.length > 0 && ` ${photos.length} photo${photos.length === 1 ? "" : "s"}, ${pageCount} page${pageCount === 1 ? "" : "s"}.`}
      </p>

      {photos.length > 0 && (
        <div className={styles.list}>
          {photos.map((photo, idx) => (
            <div
              key={photo.id}
              ref={(el) => {
                if (el) cardRefs.current.set(photo.id, el);
                else cardRefs.current.delete(photo.id);
              }}
              className={`${styles.card} ${draggingId === photo.id ? styles.dragging : ""}`}
            >
              <div className={styles.cardHead}>
                <div className={styles.cardTitleRow}>
                  <button
                    type="button"
                    className={styles.grip}
                    onPointerDown={(e) => onGripDown(e, photo.id)}
                    onPointerMove={onGripMove}
                    onPointerUp={onGripUp}
                    onPointerCancel={onGripUp}
                    aria-label={`Drag to reorder photo ${idx + 1}`}
                    title="Drag to reorder"
                  >
                    <svg width="12" height="18" viewBox="0 0 12 18" aria-hidden="true">
                      {[3, 9].map((cx) =>
                        [3, 9, 15].map((cy) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.6" fill="currentColor" />)
                      )}
                    </svg>
                  </button>
                  <span className={styles.cardTitle}>Photo {idx + 1}</span>
                </div>
                <button type="button" className="btn btnDangerText" onClick={() => remove(photo.id)}>
                  Remove
                </button>
              </div>
              <div className={styles.cardBody}>
                <button
                  type="button"
                  className={styles.thumbButton}
                  onClick={() => startReplace(photo.id)}
                  disabled={replacingId !== null}
                  aria-label={`Change photo ${idx + 1}`}
                  title="Change photo"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className={styles.thumb} src={photo.dataUrl} alt="" />
                  <span className={styles.editBadge} aria-hidden="true">
                    {replacingId === photo.id ? (
                      <span className={styles.editBadgeText}>…</span>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                    )}
                  </span>
                </button>
                <div className={styles.fields}>
                  <div className="field">
                    <label htmlFor={`photo-${photo.id}-location`}>Location</label>
                    <textarea
                      id={`photo-${photo.id}-location`}
                      name="photoLocation"
                      rows={3}
                      value={photo.location}
                      onChange={(e) => patch(photo.id, { location: e.target.value })}
                      placeholder="e.g. Viman Nagar, Near Phoenix Mall, Nagar Road, Pune."
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`photo-${photo.id}-size`}>Size</label>
                    <input
                      id={`photo-${photo.id}-size`}
                      name="photoSize"
                      type="text"
                      value={photo.size}
                      onChange={(e) => patch(photo.id, { size: e.target.value })}
                      placeholder="e.g. 30'(W) x 20'(H) Illuminated"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <input
        ref={inputRef}
        id="f-photos"
        className={styles.fileInput}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => handleFiles(e.target.files)}
      />
      <input
        ref={replaceInputRef}
        id="f-photo-replace"
        className={styles.fileInput}
        type="file"
        accept="image/*"
        onChange={(e) => handleReplace(e.target.files)}
      />
      <button
        type="button"
        className="btn btnGhost btnBlock"
        onClick={() => inputRef.current?.click()}
        disabled={adding}
      >
        {adding ? "Adding photos…" : "+ Add photos"}
      </button>
      {photos.length > 0 && (
        <button type="button" className="btn btnDangerText btnBlock" onClick={removeAll}>
          Remove all photos
        </button>
      )}
      {addError && <p className={styles.error}>{addError}</p>}
      {saveError && <p className={styles.error}>{saveError}</p>}
    </div>
  );
}

import { makeId } from "./types";

// One site photo printed after the invoice: the image (already downscaled
// to a JPEG data URL) plus the Location / Size lines shown under it.
export interface SitePhoto {
  id: string;
  dataUrl: string;
  location: string;
  size: string;
}

// Long edge after downscaling. A photo prints about 165mm wide, so 1600px is
// ~250dpi: sharp on paper while keeping each photo around 300-500KB, which
// keeps the iPad responsive and the PDF small even with many photos.
const MAX_EDGE_PX = 1600;
const JPEG_QUALITY = 0.85;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't read this image"));
    img.src = src;
  });
}

// Decodes any image the browser can show (including iPhone HEIC on Safari),
// scales it down and re-encodes it as JPEG. Drawing an <img> onto a canvas
// applies the EXIF rotation, so portrait phone photos stay upright.
export async function fileToSitePhoto(file: File, location: string, size: string): Promise<SitePhoto> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(objectUrl);
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return { id: makeId(), dataUrl: canvas.toDataURL("image/jpeg", JPEG_QUALITY), location, size };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// Photos are too big for localStorage (~5MB cap), so the draft's photos live
// in IndexedDB on this device, as one array under a single key.
const DB_NAME = "midas";
const STORE = "photos";
const KEY = "draft";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadPhotos(): Promise<SitePhoto[]> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function savePhotos(photos: SitePhoto[]): Promise<boolean> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(photos, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return true;
  } catch {
    return false;
  }
}

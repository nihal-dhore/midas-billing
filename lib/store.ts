import { Bill } from "./types";

export type Theme = "light" | "dark";

const KEYS = {
  lastSerial: "midas.lastSerial",
  draft: "midas.draft",
  theme: "midas.theme",
} as const;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readJson<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage unavailable (private browsing quota, etc.) - fail silently
  }
}

export function loadLastSerial(): number {
  return readJson<number>(KEYS.lastSerial, 0);
}

export function saveLastSerial(n: number): void {
  writeJson(KEYS.lastSerial, n);
}

export function loadDraft(): Bill | null {
  return readJson<Bill | null>(KEYS.draft, null);
}

export function saveDraft(bill: Bill): void {
  writeJson(KEYS.draft, bill);
}

// null = no explicit preference saved, follow the OS/browser setting
export function loadTheme(): Theme | null {
  return readJson<Theme | null>(KEYS.theme, null);
}

export function saveTheme(theme: Theme): void {
  writeJson(KEYS.theme, theme);
}

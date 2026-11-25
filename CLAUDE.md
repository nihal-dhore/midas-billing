# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

Tax-invoice generator for MIDAS PUBLICITY, an outdoor-advertising (hoarding) business in Pune. One operator picks a saved client (or types a custom buyer), enters display line items, sees a live A4 preview, and downloads the PDF through the browser print dialog. Deployed on Vercel (production: https://midas-billing.vercel.app); `main` on GitHub deploys to production.

Original MVP spec is in `../PLAN.md`. It is partly out of date: it says "no backend, no auth", but clients now live server-side behind a password gate (see below).

## Commands

```bash
npm run dev     # dev server
npm run build   # production build; also the only type check (no lint or test scripts exist)
npm run start   # serve the production build
```

There is no test suite. Print/PDF layout is checked by hand, or with headless browsers via the gstack `/browse` skill.

Required env vars (in `.env.local`, pulled from Vercel): `MIDAS_APP_PASSWORD` (shared login password) and `BLOB_READ_WRITE_TOKEN` (Vercel Blob).

## Architecture

- **Single page app.** `app/page.tsx` is one client component that holds all bill state. It renders the form (`ClientManager`, `ItemEditor`) and the live `InvoicePreview`. The preview is scaled with a CSS transform to fit the column (`A4_WIDTH_PX` plus a ResizeObserver).
- **Layout:** wider than 900px is a collapsible edit sidebar ("Hide editor", remembered in localStorage) beside the preview, each scrolling separately while the page itself is fixed. At 900px and below it switches to a sticky Edit | Preview tab bar showing one screen at a time. Print CSS forces the preview to show and hides the form in every layout.
- **Storage split:**
  - Saved clients (each with reusable `DisplayTemplate`s) are shared across devices. They are stored as a single JSON blob, `midas-clients.json`, in private Vercel Blob storage, read and written through `app/api/clients/route.ts` (GET, and PUT of the full array).
  - The draft bill, the last invoice serial, and the theme are per-device `localStorage` values (`lib/store.ts`). When a draft is loaded it is merged over `emptyBill()`, so new `Bill` fields need a default there.
- **Auth.** `proxy.ts` (Next 16's replacement for `middleware.ts`) gates every route. The cookie `midas_session` holds the sha256 of `MIDAS_APP_PASSWORD` (`lib/auth.ts`). Unauthenticated API calls get a 401; pages redirect to `/login?next=…`. API routes check the session again themselves.
- **Domain logic lives in `lib/`.**
  - `types.ts` holds the data model, the `SELLER` constants (hardcoded seller, GST and bank details; there is no settings UI), and the factory functions. `emptyBill()` uses a fixed item id on purpose, to avoid SSR hydration mismatches.
  - `money.ts` holds Indian-format money (`1,35,000.00`), amount-in-words (crore/lakh), financial-year invoice prefix (`2026-27/NN`, FY starts in April), and GST (CGST 9% + SGST 9%, or IGST 18%) in `calcBillTotals`, which both the preview and the form total use.
  - Billing periods: a span from the 1st of a month to the last day of a month bills as a whole number of months. Any other span is prorated at 30 days per month, counting both end dates, and labelled as days or "N month M days", never as decimal months.
  - An item's `amount` is `rate × months` automatically but can be overridden by hand.
- **Site photos** (`lib/photos.ts`, `components/PhotoEditor.tsx`, `components/PhotoPages.tsx`) print after the invoice, 2 per page, each with Location/Size text. Uploads are downscaled to 1600px JPEG data URLs and the draft's photos are stored in IndexedDB on the device, since they are too big for localStorage. They are not on the server, and they stay until removed in the form.
- **PDF is `window.print()`, with no PDF library.** Print rules are in the `@media print` block of `app/globals.css`: `.app-chrome` is hidden, `@page` is set to A4 with 10mm/11mm margins, and `.invoice-sheet` has a minimum height of 277mm. Bills with more than 3 items switch to the `dense` style.

## Print layout constraints (read before touching InvoicePreview)

The main user is on an iPad (Safari, then "Download PDF", then AirPrint, then Save as PDF). Safari's print engine collapses or blanks flex and percentage-height content in paged media. Because of that, the blank filler space below the item rows that pushes totals and the footer toward the page bottom uses **fixed mm heights** (`fillerHeightMm` in `components/InvoicePreview.tsx`). Do not use flex-grow or `height: 100%` for it.

Those values are tuned by hand. iOS adds its own print header and footer band (URL, date, page number), which no headless engine reproduces, and the iPad may silently print on Letter (279mm) instead of A4. A value that passes headless Chromium, Firefox, and WebKit on Letter (about 82mm was the ceiling for 1 item) can still spill onto a second page on a real iPad (about 80mm did). After changing anything that affects vertical size, check that the bill stays on one page on both Letter and A4, and tell the user it still needs a test on a real iPad.

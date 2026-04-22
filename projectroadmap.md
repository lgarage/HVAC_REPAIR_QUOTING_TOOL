# Dispatcher Tool — Project Map

A single-page web app for **Twin Pillars Heating & Cooling** dispatchers that combines service-call intake, quoting, invoicing, and a shared customer directory. Runs as a static site (just open `index.html`), stores most state in `localStorage`, and syncs invoices to Firebase Firestore when a config is provided.

---

## 1. What this app is for

A dispatcher working the front desk uses this tool to:

1. **Log incoming service calls** — pin the customer location on a live map, schedule the job on a visual tech timeline, and track status.
2. **Build HVAC repair quotes** — enter labor hours, truck charge, and a parts list; the tool auto-calculates retail pricing using a sliding markup scale, shows an on-screen "paper" preview, and prints / saves as PDF.
3. **Produce invoices** — identical workflow to quoting, with the finished invoice synced to Firebase for cloud retrieval.
4. **Maintain one master customer directory** — every customer name / address / location # the dispatcher enters in any of the three tools is deduplicated into a single local directory keyed by customer name.

The goal is zero-friction quoting: the dispatcher types a customer name, everything known about that customer (ID, locations, **residential vs. commercial labor rate**) auto-fills, and a quote/invoice can go out in under a minute.

---

## 2. File layout

| File | Role |
|---|---|
| `index.html` | The entire app. All HTML for the four views, all CSS, and most of the JavaScript (service-call logic, quoting logic, customer directory logic, map/schedule rendering) live here. |
| `invoice.js` | Invoice-specific logic — form parsing, Firebase save/load, invoice list rendering. Loaded with a `?v=N` cache-buster from `index.html`. |
| `firebase-config.js` | **Not committed.** Supplies `firebaseConfig` (also reused as the Google Maps API key source). If this file is missing, cloud features are skipped gracefully and the app still runs locally. |
| `tphc_logo.png`, `USA_logo.png` | Branding assets shown in the UI and on printed documents. |
| `README.md` | One-line project title. |
| `PROJECT_MAP.md` | This file. |

External dependencies loaded from CDN: Leaflet 1.9.4 (map tiles), Firebase 10.8.1 compat SDK, Google Maps JS API.

---

## 3. Navigation — four views

The left sidebar switches between four views, controlled by `switchTab(tabName)` and tracked in the global `currentActiveView` variable (`'service' | 'quoting' | 'invoice'` — the Customer Directory is a modal, not a view).

| View | DOM id | Purpose |
|---|---|---|
| **Service Call Intake** | `#view-service` | Leaflet-based dispatch map, live tech schedule timeline, and a form to log a new service call. |
| **Quoting Tool** | `#mainFormContainer` + `#resultsSection` | Build and save a repair quote. Includes an on-screen PDF preview and a quote-history database table. |
| **Invoicing Tool** | `#invoiceBuilder` + `#invoiceResultsSection` | Build and save an invoice. Syncs to Firebase. |
| **Customer Directory** | modal overlay | Browse / search / edit the deduplicated customer + location records. |

All three form views share a common customer-lookup system (`customerNamesList` datalist, `attachTabAutocomplete`, `checkCustomerAutoNumber`, `checkLocationAutoNumber`, `loadCustomerIntoForm`).

---

## 4. Data storage

### LocalStorage keys

| Key | Shape | Written by |
|---|---|---|
| `tp_customers_db` | `{ [CUSTOMER_NAME]: { id, customerType, locations: { [LOC_ID]: { street, city, state, zip, contact, phone, email } } } }` | `syncCustomerToDirectory()` |
| `twinPillarsQuotesDB` | `Array<Quote>` — see schema below | `saveQuoteToDatabase()` |
| `tp_service_tickets` | service-call records for the dispatch map/schedule | service-call logic |
| `tp_quote_counter`, `tp_service_counter`, `tp_invoice_counter` | monotonic sequence numbers | sequence helpers |
| `tp_has_seeded_data` | flag so demo data only seeds once | one-time bootstrap |

### Quote record schema (`twinPillarsQuotesDB[i]`)

```
{
  id, customerName, customerNum, contactName,
  locationAddress, custCity, custState, custZip, locationNum,
  quoteNum, status, jobWorkflow, requoteNote,
  quoteDate, dueDate,
  customerType,          // "Residential" | "Commercial"  (added Apr 2026)
  laborHours, laborRate, truckCharge, totalLaborAmount,
  parts: [ { qty, desc, num, vendor, lead, cost, markupPercent, retailUnit, retailTotal } ],
  subtotal, tax, grandTotal
}
```

### Firestore (invoice-only)

Invoices saved by `saveAndPrintInvoice()` in `invoice.js` are also written to a Firestore collection with a `timestamp`. `loadFirebaseInvoices()` reads them back to populate the invoice history list. If `firebaseConfig` is absent, the app prints locally and shows a friendly warning.

---

## 5. Pricing & quoting logic

### 5.1 Automatic parts markup — sliding scale

Defined in **two identical functions** kept in sync so quotes and invoices price parts the same way:

- `getMarkupPercentage(cost)` — used by the Quoting Tool.
- `getInvoiceMarkup(cost)` — used by `invoice.js` via the Invoicing Tool.

Both return a **decimal multiplier** that the caller applies as `retail = cost + (cost * markup)` (equivalently a `1 + markup` multiplier).

**Updated Apr 2026** — smoother curve, more high-cost tiers:

| Raw unit cost | Markup | Effective multiplier |
|---|---|---|
| $0.00 – $5.00 | 400% | 5.0× |
| $5.01 – $10.00 | 300% | 4.0× |
| $10.01 – $15.00 | 200% | 3.0× |
| $15.01 – $100.00 | 150% | 2.5× |
| $100.01 – $500.00 | 100% | 2.0× |
| $500.01 – $1 000.00 | 70% | 1.7× |
| $1 000.01 – $1 250.00 | 50% | 1.5× |
| $1 250.01 – $1 500.00 | 45% | 1.45× |
| $1 500.01 – $3 000.00 | 40% | 1.4× |
| $3 000.01 + | 30% | 1.3× |

Boundary rule: each tier uses `<=`, so `$5.50` falls in the `<= 10` bucket. No gaps at decimal boundaries.

### 5.2 Labor rate by customer type

**Added Apr 2026.** Section 3 of both the Quote form and the Invoice form now has a **Residential / Commercial** pill toggle that sets the labor rate in one click.

| Customer Type | Labor rate |
|---|---|
| Residential | **$125.00 / hr** |
| Commercial  | **$175.00 / hr** |

- Implemented via `setQuoteCustomerType(type, opts)` and `setInvoiceCustomerType(type, opts)` in `index.html`, driven by the constant `CUSTOMER_TYPE_RATES = { Residential: 125.00, Commercial: 175.00 }`.
- The choice is persisted on every quote record as `customerType` **and** on the customer directory record (`tp_customers_db[NAME].customerType`).
- Auto-applied when a dispatcher picks a known customer via `checkCustomerAutoNumber()` or `loadCustomerIntoForm()` — the toggle flips and the rate field updates without extra clicks.
- `loadQuoteForEditing` passes `{ preserveRate: true }` when restoring a saved record, so if a dispatcher manually overrode the rate (e.g., $150 discount) the override survives a reload.
- Older quotes without a saved `customerType` are classified on load by comparing the stored `laborRate` against $125.

### 5.3 Tax

Flat **5.5%** sales tax applied to `(parts retail + labor + truck charge)` subtotal in both quote and invoice math.

---

## 6. Customer directory

One unified model for all three tools. Key functions (all in `index.html`):

- `getCustomerDB()` / `saveCustomerDB(db)` — localStorage wrappers, updates the `customerNamesList` datalist on save.
- `syncCustomerToDirectory(data)` — called by any form's save flow. Upserts the customer by name, generates a `CST-XXXX` id if missing, upserts locations by `LOC-XXXX` id, and **persists `customerType`** when supplied.
- `attachTabAutocomplete(...)` — hooks Tab-completion + `change` on the three customer / location fields to auto-fill ids and trigger auto-save.
- `checkCustomerAutoNumber(context)` / `checkLocationAutoNumber(context)` — runs when a name/street field loses focus. Fills the id box, pulls the city/state/zip + contact from the matched location, and flips the customer-type toggle for `context === 'quoting'` or `'invoice'`.
- `loadCustomerIntoForm(...)` — "Select" button in the directory modal; writes every field into whichever view is currently active.

---

## 7. Quote preview &amp; Print / Save-as-PDF flow

The quote builder flows into the PDF preview automatically:

1. **Preview Quote** button (renamed from "Create Quote" in Apr 2026) at the bottom of the form calls `createQuote()`, which:
   - Saves the quote via `saveQuoteToDatabase(false, false)` (bumps the sequence, syncs the customer directory, writes to `twinPillarsQuotesDB`).
   - Calls `updatePreviewHTML()` to populate both the internal view and the customer-facing view.
   - Reveals `#resultsSection`.
   - **Automatically calls `showQuotePreview()`** so the dispatcher lands directly on the rendered PDF view without any extra clicks.
2. `showQuotePreview()` applies the `screen-preview` CSS class to `#customerQuoteView` (rendering it as an 800-px "paper" preview), hides the `#quotePreviewTriggerBtn`, reveals a yellow banner + two action buttons, and scrolls to the top of the preview.
3. The two action buttons:
   - **Confirm — Print / Save as PDF** (`confirmPrintQuote()`) → fires `window.print()`, opening the browser's native print dialog where the user can choose "Save as PDF" as the destination.
   - **Close Preview** (`closeQuotePreview()`) → removes the `screen-preview` class, restores the trigger button, and scrolls back up to the internal view.
4. A standalone **"Print or Save as PDF"** button (`#quotePreviewTriggerBtn`) remains below the preview for re-opening it after a Close, or for older quotes loaded via the DB table's Preview button.

All preview chrome (banner + confirm/close buttons + standalone trigger) carries the `print-btn` class, which the existing `@media print { .print-btn { display: none !important } }` rule hides, so none of it leaks into the printed output.

The CSS that makes this work is the `.document-print-view` / `.document-print-view.screen-preview` pair, plus the `@media print` section that forces only the element with the `screen-preview` class to appear on paper.

---

## 8. Auto-save

- `triggerQuoteAutoSave()` debounces a full `saveQuoteToDatabase(true, true)` call on nearly every input in the quote form.
- `triggerServiceAutoSave()` does the same for service calls.
- A small `#saveIndicator` floater shows "✓ Auto-Saved" or "✓ Quote Updated!" via `showSaveCue(msg)`.

---

## 9. Cache-busting

`invoice.js` is loaded with `?v=N` in the final `<script>` tag of `index.html`. **Bump `N` whenever `invoice.js` — or the quoting-logic block in `index.html` that the invoice consumes (e.g., `getInvoiceMarkup`, `setInvoiceCustomerType`) — changes.** Current version: `?v=10`.

---

## 10. Build history / completed phases

### April 2026

- **Quote action button renamed &amp; preview auto-opens.** The primary quote-builder button at the bottom of the Quoting Tool form is now **"Preview Quote"** (previously "Create Quote"). Clicking it still saves the quote to the database, but now **automatically triggers `showQuotePreview()`** so the rendered PDF view loads immediately — no separate "Print or Save as PDF" click needed to see the preview. The dispatcher lands directly on the paper-style customer view with the Confirm / Close controls already visible. Files modified: `index.html` (button label + `createQuote()` body). See §7.
- **On-screen PDF preview before printing.** The quote "Print as PDF" button was renamed to **"Print or Save as PDF"** and now shows a full on-screen preview with explicit Confirm / Close controls before the browser's print dialog opens. Helpers added: `showQuotePreview()`, `confirmPrintQuote()`, `closeQuotePreview()`. Preview chrome uses the `print-btn` class so it is auto-hidden by the existing `@media print` rules. Files modified: `index.html`. See §7.
- **Residential vs. Commercial customer-type toggle.** New pill toggle in Section 3 of both the Quote and Invoice forms. Sets the labor rate to **$125** (Residential) or **$175** (Commercial) in one click, persists the choice on the quote record **and** on the customer directory, and auto-applies it next time the same customer is selected. Helpers added: `setQuoteCustomerType()`, `setInvoiceCustomerType()`, `_paintTypeToggle()`, constant `CUSTOMER_TYPE_RATES`. Wired into `checkCustomerAutoNumber()` and `loadCustomerIntoForm()` for auto-apply on customer lookup. Files modified: `index.html`, `invoice.js` (reset call in `clearInvoiceForm()`). See §5.2.
- **Markup scale smoothed.** Replaced the 7-tier sliding scale with a 10-tier scale that tapers more gracefully at the high end (new $1 000 – $3 000+ tiers with 70 / 50 / 45 / 40 / 30% markup). Applied consistently across quoting and invoicing via `getMarkupPercentage()` and `getInvoiceMarkup()`. Files modified: `index.html`. See §5.1.

## 11. Cache-bump log

| Date | Asset | Prev → New | Reason |
|---|---|---|---|
| Apr 2026 | `invoice.js` | `?v=8` → `?v=9` | Sliding-scale markup tiers updated (shared with invoice flow). |
| Apr 2026 | `invoice.js` | `?v=9` → `?v=10` | `clearInvoiceForm()` now resets the new Residential/Commercial toggle. |

## 12. Current focus / active blockers

_None. Most recent delivery (Apr 2026) — quote builder now opens the PDF preview automatically via the renamed **Preview Quote** button. No open blockers._

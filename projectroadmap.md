# Dispatcher Tool — Project Map

A single-page web app for **USA Heating & Cooling** dispatchers that combines service-call intake, quoting, invoicing, and a shared customer directory. Runs as a static site (just open `index.html`), stores most state in `localStorage`, and syncs invoices to Firebase Firestore when a config is provided.

> **Brand note (Apr 2026):** the business was previously known as *Twin Pillars Heating & Cooling*. All dispatcher-facing and customer-facing text was renamed to *USA Heating & Cooling* along with the logo and color palette. **Internal `localStorage` data keys (`twinPillarsQuotesDB`, `twinPillarsServiceDB`, `tp_*`) were deliberately left unchanged** so every quote and ticket already saved on a dispatcher's computer remains readable. See §10.

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
| `USA_logo.png` | Default branding asset — shown in the sidebar, in every net-new quote's preview / print output, and anywhere else the app renders a logo. Every brand-new quote uses this exclusively. |
| `tphc_logo.png` | Legacy Twin Pillars Heating &amp; Cooling logo. Loaded **only** by `applyQuoteBrand('TPHC')` when a resubmitted quote has explicitly been saved with `brandMode: "TPHC"` via the Resubmit modal's "Keep Twin Pillars Schema" button. Never referenced on any other code path, and never reachable from the net-new-quote flow. Do **not** delete this file without first removing the legacy-brand code path in `applyQuoteBrand()`, the `.brand-tphc` CSS block, and the "Keep Twin Pillars Schema" button in `#resubmitBrandModal`. |
| `README.md` | One-line project title. |
| `MODEL_DOSSIER.md` | Model/cost discipline: skim enabled Cursor models, T0–T4 archetypes, §6B opener cues, task outcome log, and hook-maintained empirical confidence table (requires `.cursor/hooks.json` + Node). |
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
| `twinPillarsQuotesDB` | `Array<Quote>` — see schema below. Only ever appended to or updated by id; never overwritten wholesale. | `saveQuoteToDatabase()`, `importQuotesBackup()` (additive merge) |
| `tp_service_tickets` | service-call records for the dispatch map/schedule | service-call logic |
| `tp_quote_counter`, `tp_service_counter`, `tp_invoice_counter` | monotonic sequence numbers. `tp_quote_counter` is self-healing: `setNextQuoteNumber()` and `incrementQuoteNumber()` always force the counter past `getHighestExistingQuoteNumber()` so the displayed Quote # is guaranteed to be greater than any quote already saved in `twinPillarsQuotesDB`. | sequence helpers, `importQuotesBackup()` (forward only) |
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
  workScope,             // string — "Work to be completed / scope" free-text; optional; shown above parts in customer PDF + internal view
  parts: [ { qty, desc, num, vendor, lead, cost, markupPercent (% string — suggested from tier but user-editable; stored as applied), retailUnit, retailTotal } ],
  subtotal, tax, grandTotal
}
```

### Firestore (invoice-only)

Invoices saved by `saveAndPrintInvoice()` in `invoice.js` are also written to a Firestore collection with a `timestamp`. `loadFirebaseInvoices()` reads them back to populate the invoice history list. If `firebaseConfig` is absent, the app prints locally and shows a friendly warning.

---

## 5. Pricing & quoting logic

### 5.1 Automatic parts markup — sliding scale

Defined in **two identical functions** kept in sync so quotes and invoices price parts the same way:

- `getMarkupPercentage(cost)` — default tier markup for the Quoting Tool when **`Markup %`** is resolved automatically (blur-suggestion + **`gatherFormData()`** fallback for blank, non-user-edited rows).
- `getInvoiceMarkup(cost)` — used by `invoice.js` via the Invoicing Tool.

Both return a **decimal multiplier** that the caller applies as `retail = cost + (cost * markup)` (equivalently a `1 + markup` multiplier).

**Quoting Tool (May 2026):** Section 4’s parts grid includes an editable **`Markup %`** column. After **`Our Cost $`** loses focus (and the dispatcher has not overridden markup yet), the field is auto-filled from the tier that matches **`abs(cost)`**. Any manual change to **`Markup %`** locks that row; clearing the percentage after editing applies **no markup** (0%). Leaving **`Markup %`** untouched (never manually edited) on a blank field still resolves to the tier on save/preview—even if **`Our Cost`** was typed without triggering blur—as long as **`data-markup-user-edited`** is unset (new rows).

The **Invoicing Tool** (`invoice.js`) still uses **`getInvoiceMarkup(cost)`** per line with no per-line override field unless extended separately.

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
4. A standalone **"Print or Save as PDF"** button (`#quotePreviewTriggerBtn`) remains below the preview for re-opening it after a Close.
5. The purple **Preview** button on each Recent Quotes Database row calls `previewQuote(dbId)` → `loadQuoteForEditing(dbId)` → `showQuotePreview()`, so past quotes also open directly into the PDF preview with one click.

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

- **Quoting Tool — "Work to be Done" section (Section 4, Parts → Section 5).** New `<textarea id="workScopeInput">` (excluded from auto-uppercase) persisted on quote records as `workScope`. Cleared by `startNewQuote()`, restored by `loadQuoteForEditing()`. On Preview/Print: `#printWorkScopeSection` div (with `#printWorkScopeText`) renders above the parts table on the **customer-facing PDF** and internal dispatcher view. Hidden when blank. Files: **`index.html`**.

- **Mandatory model gate (.cursorrules §4).** Before substantive work—editing **`index.html`**, **`invoice.js`**, **`technician/`**, hooks, dossier rules, roadmap for a delivering change, or running repo-changing destructive/install shell—agents must answer first with a **§6B** block (**LOW | HIGH | UNCERTAIN**, archetype **T0–T4**, **`MODEL_DOSSIER.md`** skim §1–§3 + **`grep`** §5 when useful), **recommended Cursor model picker**, **confidence %**, then **stop** until you confirm **`Model switched — proceed`**, **`Override: … — proceed`**, or **`Pre-approved model: … — proceed`**. **Bypass** only if your message already includes one of those lines, or you asked for **purely read-only** Q&A. Files: `.cursorrules`, **`MODEL_DOSSIER.md`** (§6B).

- **Quoting Tool — editable parts markup % + truck/dispatch label (May 2026 delivery).** Section 4 parts grid gains **Markup %** (tier-suggested after **`Our Cost $`** blur, user-editable, clear-after-edit ⇒ 0%). `gatherFormData()` uses `markupTierMultiplierForCost` / explicit field; rebates allowed via **`Our Cost`** without HTML `min=0`; Labor section 3 field label **`TRUCK / DISPATCH CHARGE $`**. Body listeners on `document.body` (`wireQuotePartsDelegates()`). Files: **`index.html`**, **`projectroadmap.md`** (`§4`/`§5.1`/build history).

- **`MODEL_DOSSIER.md` added** — Canonical place for Cursor **enabled-models skim** (user-maintained paste from Settings → Models), **T0–T4** archetype map, cheap→**Strong** escalation guidance (Firestore/invoice/money/schema/security → Opus-/Codex-class), **§6B-style opener** reminders, logging norms (**append §5 row** after substantive outcomes; skim/grep log before picker recommendations). Bootstrap outcome row seeded in §5. Files: `MODEL_DOSSIER.md`, this roadmap (`MODEL_DOSSIER.md` row in §2 File layout).
- **Cursor hooks — empirical composer confidence.** Project hooks `.cursor/hooks.json` run `node .cursor/hooks/confidence-metrics.cjs` on **`stop`** (composer finished with status `completed` increments one assumed-OK tally per Cursor `model` id) and on **`beforeSubmitPrompt`** (if the immediately following user prompt matches a rejection heuristic, increment explicit pushback for that composer model and undo one assumed OK). Persists counters in `.cursor/confidence-metrics.json` and replaces the marked table region in `MODEL_DOSSIER.md` under “Hook-maintained empirical confidence.” Requires Node.js on PATH; edit `FAILURE_HINT_RE` in the script to tune detection. Files: `.cursor/hooks.json`, `.cursor/hooks/confidence-metrics.cjs`, `MODEL_DOSSIER.md`.

- **Resubmit-only legacy brand option (net-new quotes locked to USA).** Clarified the brand-choice scope: the legacy Twin Pillars Heating &amp; Cooling schema is available **exclusively** on the Resubmit flow and is **never** reachable when creating a brand-new quote. The single-schema lock from the previous iteration was reversed here, but the "USA only for new quotes" guarantee was preserved. Concretely:<br>&nbsp;&nbsp;• `startNewQuote()` always writes `#brandModeInput = "USA"` — net-new quotes cannot carry any other value.<br>&nbsp;&nbsp;• `gatherFormData()` normalizes any unknown `#brandModeInput` value back to `"USA"` as a safety net.<br>&nbsp;&nbsp;• The Resubmit brand-choice modal (`#resubmitBrandModal`) is the **only** entry point that can set `#brandModeInput = "TPHC"`, via its "Keep Twin Pillars Schema" button. The modal is opened only by `resubmitQuote(dbId)` (Recent Quotes Database → ↻ Resubmit) and is restored to its original 3-button layout: Cancel / Keep Twin Pillars Schema / Rebrand to USA Heating &amp; Cooling.<br>&nbsp;&nbsp;• `loadQuoteForEditing()` restores `#brandModeInput` from the saved `quote.brandMode` — so a resubmission that was deliberately kept on Twin Pillars continues to render that way every time it's reopened, while every record without a `brandMode` field (older saves, seeded demo data) defaults to `"USA"`.<br>&nbsp;&nbsp;• `applyQuoteBrand(mode)` is once again brand-aware: swaps `#printHeaderLogo`, `#printHeaderCompanyName`, and `#printPayeeName` plus toggles the `.brand-tphc` class on `#customerQuoteView` (scoped CSS override to the legacy blue/gold palette — affects only the quote preview, never the surrounding app chrome).<br>&nbsp;&nbsp;• Helpers restored: `chooseResubmitBrand(mode)` + 2-arg `_finalizeResubmit(dbId, brandMode)`. The transitional single-button `confirmResubmit()` was removed.<br>&nbsp;&nbsp;• Copy in the Resubmit modal body explicitly says "New quotes always use the USA Heating &amp; Cooling schema — the legacy option is available only when resubmitting a job that was originally quoted under Twin Pillars."<br>&nbsp;&nbsp;• The Resubmit button's `title` tooltip restored to mention the brand-choice step.<br>Audit line in `requoteNoteHistory` reflects the chosen brand: `created under the USA Heating & Cooling schema` vs. `kept under the legacy Twin Pillars Heating & Cooling schema`. Save-cue toast echoes it too. Files modified: `index.html` (restored the 3-button modal, the `.brand-tphc` CSS block, the brand-aware renderer, and the 2-arg `_finalizeResubmit`).
- **Single-schema lock: USA Heating &amp; Cooling is the only brand.** _[Superseded by the Resubmit-only legacy brand option above — left here as history for context.]_ Temporarily removed every TPHC code path. That change was walked back: the legacy Twin Pillars schema is once again available, but exclusively on the Resubmit flow.
- **Resubmit brand-choice modal (rebrand or keep legacy).** Originally added a 3-button brand-choice modal (`#resubmitBrandModal`) so the dispatcher could pick USA, keep Twin Pillars, or cancel at resubmit time; each quote carried a `brandMode: "USA" | "TPHC"` field and the preview renderer was brand-aware via a `.brand-tphc` CSS scope and `applyQuoteBrand(mode)`. This is the current behavior for resubmitted quotes.
- **Resubmit-past-quote action in Recent Quotes Database.** Added a new green **↻ Resubmit** button to every row of the Recent Quotes Database table (placed just before Edit and Delete). After the rebrand warning is accepted, it clones the selected historical record into the form as a **brand-new quote** under the USA Heating &amp; Cooling schema: loads all customer / part / labor / customer-type data from the source row, then wipes `currentQuoteId` so the next save creates a new record, calls `setNextQuoteNumber()` to assign a fresh auto-incremented QT number, calls `setDates()` to reset quote date + due date (today / +14 days), resets status to `Pending`, and replaces the requote-note history with a single audit line: `[timestamp] Resubmission of QT-XXXX (originally dated YYYY-MM-DD) — created under USA Heating & Cooling schema.` The original saved quote is **never modified** — it stays in `twinPillarsQuotesDB` exactly as it was. Since every branded string in the preview/print output is rendered from the current HTML templates, the resubmitted quote automatically displays under the USA Heating &amp; Cooling logo, colors, and payee name. A `showSaveCue()` toast confirms: `↻ Resubmission started — QT-old cloned to QT-new. Press Preview Quote to save.` Files modified: `index.html` (new `.resubmit-btn` CSS, new button in `renderQuoteHistory()` row template, new `resubmitQuote(dbId)` helper). See §7.
- **Full text rename: Twin Pillars Heating &amp; Cooling → USA Heating &amp; Cooling.** Completed the rebrand by renaming every user-visible string in `index.html`: the `&lt;title&gt;` tag, sidebar footer, quote-print header company name, "Please make checks payable to…" terms line, the invoice `&lt;h2&gt;` and `&lt;h4&gt;` company headings, and the `alert()` copy shown when a bad import file is dropped into `importQuotesBackup()`. The quote backup export was also updated — downloaded filename changed from `twin-pillars-quotes-backup-YYYY-MM-DD.json` to `usa-heating-cooling-quotes-backup-YYYY-MM-DD.json`, and the JSON payload's `format` marker changed from `"twinPillars.quotes.backup"` to `"usaHeatingCooling.quotes.backup"`. Image `alt` text on both logo references updated to a neutral `Company Logo` / `Company Print Logo`. **Intentionally preserved unchanged** to guarantee no historical data loss: every `localStorage` data key (`twinPillarsQuotesDB`, `twinPillarsServiceDB`, and all `tp_*` sequence / config keys — 27 total read/write sites across `index.html`). Renaming those keys would have orphaned every quote and service ticket already saved on a dispatcher's computer; leaving them as-is means every past quote still loads, previews, and prints — and because the print templates themselves now say "USA Heating &amp; Cooling", those old quotes automatically render under the new schema when re-opened. The import-backup validator is unaffected by the `format` marker change because it only checks `payload.quotes` is a valid array, so backups exported under the old `twinPillars.quotes.backup` marker still import cleanly. Files modified: `index.html`.
- **Visual rebrand — USA Heating &amp; Cooling logo and flag palette.** Replaced every `tphc_logo.png` reference (sidebar logo + quote-print header logo) with `USA_logo.png`, and swapped the entire color palette on every page/view to USA flag colors to match the new logo. Color mapping executed as global `StrReplace` replace-all runs:<br>&nbsp;&nbsp;• `#1e4b85` → `#0A3161` (USA flag navy) — 28 instances (headers, primary buttons, sidebar background, table headers, print title, customer-type toggle, invoice search border, map popups, etc.)<br>&nbsp;&nbsp;• `#2c3e50` → `#071f42` (darker navy for the live tech schedule strip).<br>&nbsp;&nbsp;• `#c89b53` → `#BF0A30` (gold → USA flag red) — 7 instances (sidebar hover/active highlight, sidebar logo border, input focus ring, quote-table header, preview-banner border, add-customer form border, tech-notes textarea).<br>&nbsp;&nbsp;• `rgba(30,75,133, …)` → `rgba(10,49,97, …)` (customer-type toggle shadow tint).<br>&nbsp;&nbsp;• `#fef6e4` / `#5a3b00` → `#fff0f2` / `#5a0a15` (preview banner — warm yellow recolored to soft patriotic pink with navy text).<br>&nbsp;&nbsp;• `#e6eef5` → `#e8eef7` (invoice table header, slightly warmer pale blue to harmonize with the new navy).<br>Image alt text updated from "Twin Pillars Logo" / "Twin Pillars Print Logo" to generic "Company Logo" / "Company Print Logo" so accessibility labels match what is rendered. **Intentionally left alone:** every body-copy "Twin Pillars Heating &amp; Cooling" label (sidebar footer, print header, invoice header, terms, payee line). If a full rename to "USA Heating &amp; Cooling" is desired, that is a separate rebrand pass — see §12 Current focus. Files modified: `index.html`.
- **Recent Quotes Database "Preview" button now auto-opens the PDF preview.** The purple **Preview** button on each row of the Recent Quotes Database table (column 1) used to load the quote back into the form and scroll to the internal numbers view. It now reuses the same flow as the main **Preview Quote** button: after loading the record it calls `showQuotePreview()` so the paper-style customer view renders on screen immediately, with the Confirm / Close controls already visible. Files modified: `index.html` (one-line change inside `previewQuote(dbId)`). See §7.
- **Quote # auto-increment made collision-proof.** Verified the existing flow (`tp_quote_counter` in `localStorage`, read by `setNextQuoteNumber()` on load, bumped by `incrementQuoteNumber()` on new-quote save, preserved per-record on edit, advanced by import) is intact, then added a **self-healing guard**: both `setNextQuoteNumber()` and `incrementQuoteNumber()` now call a new helper `getHighestExistingQuoteNumber()` that scans `twinPillarsQuotesDB` for the largest `QT-NNNN` and forces the counter past it before displaying / bumping. Guarantees the next auto-generated number is **always strictly greater than any quote already saved on this computer** — even if the counter key is ever cleared, reset, or falls behind an imported record. Also wired `setNextQuoteNumber()` into the end of `importQuotesBackup()` so the Quote # input updates immediately after a merge. Files modified: `index.html`. See §4.
- **Quote persistence hardened + Export / Import Backup added.** Three safeguards so a dispatcher never loses historical quotes on their computer: (1) `injectDummyData()` rewritten to be strictly non-destructive — each seed key (`tp_geo_cache`, `tp_customers_db`, `twinPillarsServiceDB`, `twinPillarsQuotesDB`, sequence counters) is now only written when that specific key is missing or empty, so even if `tp_has_seeded_data` is cleared a dispatcher's real records can never be wiped. (2) New **⬇ Export Backup** button above the Recent Quotes Database table calls `exportQuotesBackup()` to download `twin-pillars-quotes-backup-YYYY-MM-DD.json` containing every quote + the customer directory + the quote counter. (3) New **⬆ Import Backup** button calls `importQuotesBackup()`, which merges a backup file **additively** — quotes with an already-present `id` are skipped, customer records are merged only when the name is new, and the quote counter is only advanced (never rolled back). A count indicator `(N saved)` now lives next to the Recent Quotes Database heading. Files modified: `index.html`. See §4 &amp; §10.
- **Preview Quote save-confirmation tightened.** Verified and reinforced that pressing **Preview Quote** saves the quote to the local `twinPillarsQuotesDB` **before** opening the preview. Save-cue copy is now explicit: `✓ Saved to Recent Quotes — QT-NNNN (new)` / `(updated)` so dispatchers have visible proof of the write. Added a small caption under the Preview Quote button: _"Saves automatically to the Recent Quotes Database on this computer before opening the preview."_ The save path is `saveQuoteToDatabase(false, false)` → `localStorage.setItem('twinPillarsQuotesDB', ...)` → `renderQuoteHistory()` (refreshes the database table row so the new quote appears instantly). Files modified: `index.html`. See §7.
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

_Most recent delivery (Apr 2026) — **Resubmit-only legacy brand option**. Net-new quotes always use the USA Heating &amp; Cooling schema (enforced in `startNewQuote()` + normalized in `gatherFormData()`). The Resubmit modal is the sole entry point where a dispatcher can opt to keep the legacy Twin Pillars schema on a cloned quote — useful when a customer specifically needs the historical branding. No open blockers._

**Data-preservation invariant (must not be violated):** the `localStorage` keys `twinPillarsQuotesDB`, `twinPillarsServiceDB`, and all `tp_*` keys are **internal identifiers only** and hold the dispatcher's historical records. They must **never** be renamed in code — doing so would make every existing saved quote and ticket on a dispatcher's computer invisible to the app. Branding renames only apply to user-facing strings, not to storage keys. A future migration that moves these keys would need a read-old-key / write-new-key compatibility shim, coordinated with explicit dispatcher opt-in.

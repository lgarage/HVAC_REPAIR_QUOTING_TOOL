# Storage Audit — USA Heating & Cooling Dispatcher Tool
**Audited:** 2026-05-28  
**Scope:** Quoting tool storage architecture, read-only investigation, no code changes made.

---

## Current Architecture

```
Quote Form (index.html)
        ↓ (focusout / change events → 250ms debounce)
triggerQuoteAutoSave()
        ↓
saveQuoteToDatabase(silent=true, isAutoSave=true)
        ↓
localStorage.setItem("twinPillarsQuotesDB", JSON.stringify(db))
        ↓ (manual Export button)
exportQuotesBackup() → .json file download
        ↓ (manual Import button)
importQuotesBackup() → additive merge back into localStorage
```

---

## Storage Locations

| Mechanism | Used? | Notes |
|---|---|---|
| **localStorage** | YES — primary | All quote, customer, service call, and counter data |
| sessionStorage | NO | Not used anywhere |
| IndexedDB | NO | Not used anywhere |
| Files | READ-ONLY | Manual JSON export/import only — no automatic file writes |
| Firebase Firestore | PARTIAL | Used only in the Invoice tool (`invoice.js`). The Quoting tool does NOT use Firebase at all. |
| Cookies | NO | Not used |

---

## Storage Keys

| Key | Type | Contents |
|---|---|---|
| `twinPillarsQuotesDB` | JSON Array | All saved quotes |
| `tp_customers_db` | JSON Object | Customer directory (keyed by customer name) |
| `twinPillarsServiceDB` | JSON Array | Service call records |
| `tp_quote_counter` | String (integer) | Next quote number to assign (e.g. `"1017"`) |
| `tp_service_counter` | String (integer) | Next service call number to assign |
| `tp_geo_cache` | JSON Object | Geocode cache — address string → `[lat, lng]` |
| `tp_has_seeded_data` | String `"true"` | Guard flag — prevents demo data from being re-injected |

---

## Data Structures

### Quote Record (`twinPillarsQuotesDB` array element)

```json
{
  "id": "DB-ID-1716900000000",
  "customerName": "PLANET FITNESS",
  "customerNum": "CST-8180",
  "contactName": "MIKE",
  "locationAddress": "1640 W MASON ST",
  "custCity": "GREEN BAY",
  "custState": "WI",
  "custZip": "54303",
  "locationNum": "LOC-7503",
  "quoteNum": "QT-1017",
  "status": "Pending",
  "jobWorkflow": "N/A",
  "requoteNote": "",
  "workScope": "",
  "quoteDate": "2026-03-07",
  "dueDate": "2026-03-21",
  "customerType": "Commercial",
  "brandMode": "USA",
  "customerLayout": "consolidated",
  "laborHours": 4,
  "laborRate": 175,
  "truckCharge": 150,
  "totalLaborAmount": 700,
  "showTruckToCustomer": false,
  "showTax": true,
  "showItemizedParts": true,
  "partsSummaryDesc": "All parts and materials...",
  "parts": [
    {
      "qty": 1,
      "desc": "SUPPLY FAN MOTOR",
      "num": "OPTIONAL",
      "vendor": "",
      "lead": "2",
      "cost": 300,
      "markupPercent": "100",
      "retailUnit": 600,
      "retailTotal": 600
    }
  ],
  "partsRetailSubtotal": 600,
  "subtotal": 1450,
  "tax": 79.75,
  "grandTotal": 1529.75
}
```

**Notes:**
- Fields added over time (`showTruckToCustomer`, `showTax`, `showItemizedParts`, `partsSummaryDesc`, `partsRetailSubtotal`, `workScope`, `brandMode`, `customerLayout`) are absent from older records. All have safe defaults applied on load.
- `subtotal`, `tax`, and `grandTotal` are saved snapshots — they are **not** used for rendering. `updatePreviewHTML()` always recomputes these live from the form.

### Customer Record (`tp_customers_db` object)

```json
{
  "PLANET FITNESS": {
    "id": "CST-8180",
    "customerType": "Commercial",
    "locations": {
      "LOC-7503": {
        "street": "1640 W MASON ST",
        "city": "GREEN BAY",
        "state": "WI",
        "zip": "54303",
        "contact": "MIKE",
        "phone": "(920) 555-1234",
        "email": ""
      }
    }
  }
}
```

### Export Backup Payload

```json
{
  "format": "usaHeatingCooling.quotes.backup",
  "version": 1,
  "exportedAt": "2026-05-28T01:00:00.000Z",
  "quoteCounter": "1025",
  "customers": { ... },
  "quotes": [ ... ]
}
```

---

## How Quote IDs Are Generated

Two separate ID systems exist:

### 1. Internal Database ID (`id` field)
- Format: `"DB-ID-" + Date.now()` (e.g. `"DB-ID-1716900123456"`)
- Generated at first save of a new quote in `saveQuoteToDatabase()`
- Uses millisecond timestamp — **collision is possible but extremely unlikely** on a single device
- Demo seed data uses the static value `"DB-ID-1"` which cannot collide with timestamp IDs

### 2. Customer-Facing Quote Number (`quoteNum` field)
- Format: `"QT-NNNN"` (e.g. `"QT-1017"`)
- Counter stored in `tp_quote_counter` localStorage key
- `setNextQuoteNumber()` sets the form field to `"QT-" + counter`
- `incrementQuoteNumber()` writes `counter + 1` back to localStorage after a successful save
- **Self-healing:** both functions scan `twinPillarsQuotesDB` for the highest existing QT number and advance the counter past it if it has fallen behind — prevents collisions after imports or counter resets

---

## How Duplicate Detection Works During Import

Located in `importQuotesBackup()`:

1. Loads current `twinPillarsQuotesDB` into memory
2. Builds a `Set` of all existing `id` values
3. For each incoming quote:
   - If `id` is missing or malformed → **skip** (counted as skipped)
   - If `id` already exists in the Set → **skip** (no overwrite)
   - Otherwise → **append** to the array
4. Quote counter is advanced to whichever is higher: current or imported
5. Customer records are merged non-destructively (existing customer entries are never overwritten)

**Gap:** Duplicate detection is based solely on the `id` field. Two quotes with different `id` values but the same `quoteNum` (e.g. from two different computers both at `"QT-1017"`) can both be imported — resulting in two records with the same customer-facing quote number. The self-healing counter prevents this going forward but cannot fix existing duplicates.

---

## How Export Backup Works

Located in `exportQuotesBackup()`:

1. Reads `twinPillarsQuotesDB`, `tp_quote_counter`, and `tp_customers_db` from localStorage
2. Wraps them in a versioned payload object
3. Serializes to JSON and triggers a browser download as:
   `usa-heating-cooling-quotes-backup-YYYY-MM-DD.json`
4. No data is removed or modified in localStorage

**Gap:** `twinPillarsServiceDB` and `tp_geo_cache` are NOT included in the export payload. If a backup is imported on a new machine, service call history and geocode cache are not transferred.

---

## Risk Assessment

### Risk 1 — Data Loss on Browser Clear
**Severity: HIGH**  
All quote data lives exclusively in browser localStorage. Clearing browser data, switching browsers, reinstalling the OS, or using private/incognito mode wipes all quotes. There is no automatic backup or cloud sync. Manual export is the only safeguard.

### Risk 2 — Quote Number Collision Across Devices
**Severity: MEDIUM**  
Each device maintains its own `tp_quote_counter`. Two users on different computers can independently generate `QT-1020`. The self-healing counter prevents collisions within a single device but cannot prevent two devices from producing the same QT number. If backups are merged, both records coexist with identical `quoteNum` values but different `id` values.

### Risk 3 — Corrupt JSON on Write
**Severity: LOW-MEDIUM**  
Every write is a full replacement of the entire JSON array (`setItem(key, JSON.stringify(db))`). If the browser tab is closed or power is lost mid-write, the stored value could be partially written or empty. There is no transactional write or checksum. Recovery depends on having a recent export backup.

### Risk 4 — localStorage Size Limit
**Severity: LOW (current scale), MEDIUM (long-term)**  
Browser localStorage is typically limited to **5 MB per origin**. A typical quote record with several parts is approximately 1–3 KB serialized. At that rate:
- ~1,700 quotes ≈ 5 MB (approximate upper limit)
- Current typical usage (dozens of quotes) is far below this
- Customer records and geocache add overhead but are small
- **Estimated safe capacity: 800–1,200 quotes before the 5 MB limit becomes a concern**
- Chrome will silently throw a `QuotaExceededError` if the limit is hit — this would cause saves to fail silently unless error handling is added

### Risk 5 — Customer Linking is Name-Based
**Severity: MEDIUM**  
Customers in `tp_customers_db` are keyed by customer name string (e.g. `"PLANET FITNESS"`). Quote records store `customerName` and `customerNum` but do NOT store a foreign key into `tp_customers_db`. If a customer name is changed or a typo is corrected, that customer's quotes become orphaned from their customer record. The `syncCustomerToDirectory()` function upserts on save, so the link is rebuilt on next edit, but historical quotes are not retroactively repaired.

### Risk 6 — No Data Validation on Import
**Severity: LOW**  
The import function checks that records have an `id` field but does not validate any other fields. A malformed or hand-edited backup file could import records with missing required fields. These would render as blank or partially blank quotes in the table.

### Risk 7 — Auto-Save Race Condition
**Severity: LOW**  
`triggerQuoteAutoSave()` uses a 250ms debounce. If the user types rapidly and closes the tab before 250ms has elapsed, the most recent keystrokes are not saved. This is minor in practice but worth noting.

---

## Cloud Migration Readiness

| Factor | Current State | Migration Impact |
|---|---|---|
| Data format | Clean JSON objects with consistent fields | LOW — maps well to Firestore documents |
| IDs | `DB-ID-{timestamp}` strings | LOW — can be used as Firestore document IDs |
| Quote numbers | Sequential integers in `tp_quote_counter` | MEDIUM — counter must be centralized |
| Customer linking | Name-based, not ID-based | MEDIUM — should be normalized before migration |
| Multi-user | None — each browser is isolated | HIGH — conflicts possible when two users save simultaneously |
| Auth | None | HIGH — Firebase Auth must be added before cloud writes |
| Offline support | Full (localStorage) | LOW — localStorage continues to work offline |

---

## Recommended Migration Plan

### Phase 1 — Harden Local Storage (No Architecture Change)
1. Add `try/catch` around all `localStorage.setItem` calls to catch `QuotaExceededError` and alert the user
2. Add export reminder prompt when quote count exceeds a threshold (e.g. 200 quotes)
3. Add `twinPillarsServiceDB` to the export backup payload so service call history is not lost on machine transfers

### Phase 2 — Add Firebase as Secondary Backup (Read-Only Cloud)
1. Add Firebase project and Firestore rules (authenticated users only)
2. After each successful `saveQuoteToDatabase()`, asynchronously mirror the quote to `Firestore/quotes/{id}`
3. Use the existing `id` (`"DB-ID-{timestamp}"`) as the Firestore document ID
4. Cloud writes are fire-and-forget — local save is never blocked waiting for cloud
5. Add a visible sync indicator (e.g. "☁ Synced" / "⚠ Offline")

### Phase 3 — Centralize Quote Counter
1. Move `tp_quote_counter` to a Firestore `metadata/quoteCounter` document using `FieldValue.increment(1)` as a transaction
2. `setNextQuoteNumber()` reads from Firestore; falls back to local counter if offline
3. This eliminates cross-device QT number collisions

### Phase 4 — Optional Full Cloud Primary
1. `loadQuoteForEditing()` and `renderQuoteHistory()` can optionally read from Firestore instead of localStorage when online
2. localStorage remains the offline fallback
3. Manual JSON export remains as tertiary backup

---

## Function Inventory

### Save / Update
| Function | Trigger | Notes |
|---|---|---|
| `saveQuoteToDatabase(silent, isAutoSave)` | Manual save, auto-save | Creates new or updates existing quote; increments quote counter on new |
| `triggerQuoteAutoSave()` | focusout / change on form fields | 250ms debounce; only saves if quote already has an `id` |
| `updateQuoteStatusInline(quoteId, newStatus)` | Status dropdown in Recent Quotes table | Mutates only the `status` and `jobWorkflow` fields |
| `refactorQuoteLayout(dbId)` | "Refactor" button in history table | Mutates only `customerLayout` field |
| `syncCustomerToDirectory(data)` | Called inside `saveQuoteToDatabase` | Upserts customer and location into `tp_customers_db` |

### Load / Read
| Function | Notes |
|---|---|
| `loadQuoteForEditing(dbId)` | Reads one quote from localStorage, populates form |
| `previewQuote(dbId)` | Calls `loadQuoteForEditing` then `updatePreviewHTML` |
| `renderQuoteHistory()` | Reads all quotes, renders the Recent Quotes table |
| `getCustomerDB()` | Returns parsed `tp_customers_db` |

### Delete
| Function | Notes |
|---|---|
| `deleteQuote(dbId)` | Requires confirm dialog; filters quote out of array and re-saves |

### Quote Numbering
| Function | Notes |
|---|---|
| `setNextQuoteNumber()` | Sets form field to next QT number; self-heals counter against saved records |
| `incrementQuoteNumber()` | Advances `tp_quote_counter` by 1 after a new quote is saved |
| `getHighestExistingQuoteNumber()` | Scans all saved quotes for highest QT integer; used by both above |

### Export / Import
| Function | Notes |
|---|---|
| `exportQuotesBackup()` | Serializes quotes + customers + counter to dated JSON file download |
| `importQuotesBackup(event)` | Reads JSON file; additive merge by `id`; advances counter if needed |

### Seeding
| Function | Notes |
|---|---|
| `injectDummyData()` | Runs once on first load; seeds demo quote, customer, and service call data |

---

## Risk Score

| Dimension | Score (1–10) | Rationale |
|---|---|---|
| **Overall Risk** | **6 / 10** | localStorage-only storage with no auto-cloud backup is the primary risk at business scale |
| **Migration Difficulty** | **4 / 10** | Data structures are clean JSON, IDs are already unique strings, and export/import is already working — Firebase integration is straightforward |

---

## Recommended Migration Sequence

1. **Immediately:** Ensure every user has made at least one manual Export Backup before any code changes
2. **Short-term (Phase 1):** Add `QuotaExceededError` handling and export reminder threshold
3. **Medium-term (Phase 2):** Wire Firebase as a silent secondary backup — no UX change for users
4. **Medium-term (Phase 3):** Centralize quote counter in Firestore to eliminate cross-device QT collisions
5. **Long-term (Phase 4):** Optionally promote Firestore to primary read source for multi-device access

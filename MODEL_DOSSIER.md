# Model dossier — Cursor picker & outcome log

**Purpose.** Single place to (1) **skim** which models are enabled in Cursor, (2) **map** tasks to archetypes **T0–T4**, (3) **prefer** the cheapest enabled picker that still meets minimum safety, and (4) **log** substantive task outcomes so later sessions avoid repeating guesses.

Agents should **`grep` §5 Task outcome log** (recent rows + same keyword) **before** recommending an exact picker for a recurring task shape.

Refresh **§1 Enabled models** whenever **Cursor → Settings → Models** changes.

---

## §1 Enabled models (skim from Cursor)

Paste **only toggled-on** model names exactly as shown in Settings → Models. Update this block when availability changes.

```
<!-- Paste below, one name per line. Example placeholders — replace with your machine truth. -->

(Not skimmed yet — open Cursor → Settings → Models and paste enabled pickers above this line.)

```

---

## §2 Archetypes (T0–T4)

| ID | Typical work | Minimum safety cue |
|----|----------------|---------------------|
| **T0** | One-shot typo, trivial one-liner where behavior is obvious | Low |
| **T1** | Mechanical refactor, grep-navigate edits, boilerplate aligned to existing patterns | Low–moderate |
| **T2** | Multi-file JS/HTML coordination with a clear single goal | Moderate |
| **T3** | Cross-cutting behavior, several flows touched, regressions plausible | Moderate–high |
| **T4** | Firestore invoice sync paths, quoting/money math, schema migrations, ambiguous multi-flow specs, security/auth surface | Strong |

Classification tags for opens: **LOW** (T0–T1 dominated), **HIGH** (sensitive/high-regret domains), **UNCERTAIN** (spec or blast radius unclear — treat as HIGH until narrowed).

---

## §3 Switch-to heuristic (cheap → strong)

Use **§1** when filled; otherwise this table is the **default** fallback. **Refresh** whenever Settings → Models changes (names drift).

| If work looks like… | Prefer (typical picker tier) |
|---------------------|------------------------------|
| T0–T1 mechanical | **Composer 2**–class |
| T2 moderate multi-file (e.g. `index.html` + `invoice.js`) | **Sonnet-class** |
| T3 ambiguous blast radius without a pinned spec | **Sonnet-class** minimum; often **Strong** |
| T4 invoice/Firestore/quoting-money/schema/security | **Opus-class** or **Codex-class** (**Strong**) — escalate per project policy |

**Escalate (do not penny-pinch)** when any of these apply: Firestore invoice sync, quoting/money regressions, schema or security-sensitive edits, ambiguous multi-flow changes across apps (Office dispatcher vs Technician field).

---

## Hook-maintained empirical confidence

**Automatic updates.** Cursor project hooks bump scores in `MODEL_DOSSIER.md` after each composer run completes and when you send your **next** user message:

- **`stop`** (status `completed`): adds **one implicit OK** count for that run’s **`model`** string (silent acceptance — you moved on).
- **`beforeSubmitPrompt`**: if that next message reads like rejection of the last result (regex in `.cursor/hooks/confidence-metrics.cjs`), increments **explicit pushback** and **subtracts one** implicit OK for the model that answered last time.

State file: `.cursor/confidence-metrics.json`. Requires **Node** on `PATH`. Configure hooks via `.cursor/hooks.json` (restart Cursor after edits if hooks do not appear).

Tune false positives / misses by editing `FAILURE_HINT_RE` in `.cursor/hooks/confidence-metrics.cjs`.

<!-- HOOK_CONFIDENCE_TABLE_START -->

| _(no hook samples yet)_ | — | — | — |

<!-- HOOK_CONFIDENCE_TABLE_END -->

---


## §6B-style opener (before substantive implementation)

**Project enforcement:** `.cursorrules` §4 — agents **must STOP** after this block and wait for gate confirmation **before** any file edits, roadmap updates for deliveries, or mutating commands. Exceptions: purely read-only Q&A without change requests; or user’s message already contained a gate phrase.

Each implementation-classified turn opens with:

- Task classification **LOW | HIGH | UNCERTAIN**
- **Archetype** T0–T4 (if helpful)
- **Recommended model** (exact picker string from §1 once skimmed — else dossier heuristic)
- **Confidence %** + one-line **reason**

**Model gates** (user confirms one exact line — then agent may execute): **Model switched — proceed** | **Override: … — proceed** | **Pre-approved model: … — proceed**

---

## §4 Logging norms (skim vs append)

**Append** exactly **one row** to **§5** when the turn produced **substantive** artifact worth remembering: behavior change, invoice/Firestore/quote math touch, notable bug fix, or durable doc/policy change.

**Hook-maintained empirical confidence** above is **automatic counter tallies**, not substitutes for qualitative §5 notes.

**Skip** logging when: idle chat only; trivial answer with no artifact; duplicate of an existing §5 row for the same change; or pure meta/policy echo with nothing new to reconcile.

Before recommending a picker for “have we solved this shape before?” issues, **`grep`** §5 (and codebase) rather than improvising confidence from memory.

---

## §5 Task outcome log

_Newest rows at bottom._

| Date (UTC) | Task summary | Classification | Archetype | Recommended model | Conf % | Outcome / notes |
|------------|--------------|----------------|-----------|-------------------|--------|-----------------|
| 2026-05-04 | Initialize MODEL_DOSSIER: §1 skim placeholder, archetypes §2–§3, §6B + logging norms §4, bootstrap §5 | LOW | T1 | Composer 2 | 90 | Repo root dossier authored; roadmap §2 mentions file. User must paste §1 from Settings → Models. |
| 2026-05-04 | Cursor hooks auto-update empirical model confidence (`stop` implicit OK / `beforeSubmitPrompt` regex pushback → rewrite § hook table + `.cursor/confidence-metrics.json`) | LOW | T2 | Sonnet-class | 85 | Ships `.cursor/hooks.json`, `.cursor/hooks/confidence-metrics.cjs`; needs Node on PATH & hook enable in Cursor. |
| 2026-05-04 | Quoting: per-part **Markup %** column (tier blur-suggest; user override; cleared ⇒ 0%); TRUCK/DISPATCH charge label; `gatherFormData` + internal view synced | HIGH | T4 | Sonnet-class | 82 | **`index.html`**, roadmap §5.1; invoice tool still tier-only unless extended. |
| 2026-05-04 | Policy: `.cursorrules` §4 mandates **STOP** after §6B + model picker recommendation until gate phrase confirmed; dossier §6B cross-ref | LOW | T1 | Composer | 94 | Applies to Cursor agents using this workspace; compliance is instructional, not enforced by Cursor OS. |

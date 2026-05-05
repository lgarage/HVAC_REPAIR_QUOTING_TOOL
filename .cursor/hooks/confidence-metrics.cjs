#!/usr/bin/env node
'use strict';

/**
 * Cursor hooks: updates MODEL_DOSSIER.md empirical confidence (marker-delimited).
 * - stop (status completed): implicit_ok[model]++ for this composer model.
 * - beforeSubmitPrompt: if user message reads like pushback, undo one implicit_ok,
 *   increment reported_fail for the pending model, then emit { continue: true }.
 *
 * Regex tuning: edit FAILURE_HINT_RE below.
 */

const fs = require('fs');
const path = require('path');

const STATE_NAME = 'confidence-metrics.json';
const MARK_START = '<!-- HOOK_CONFIDENCE_TABLE_START -->';
const MARK_END = '<!-- HOOK_CONFIDENCE_TABLE_END -->';

/** User message suggests the immediately prior agent result was wrong. */
const FAILURE_HINT_RE =
  /(\bstill\b\s+(wrong|broken|not\s+working|doesn'?t\b|incorrect)|\bdidn'?t\s+work\b|\bdoesn'?t\s+work\b|\bnot\s+working\b|\bthat\s+wasn'?t\b|\bisn'?t\s+working\b|\bthat\s+(is\s+)?wrong\b|\bis\s+wrong\b|\bstill\s+broken\b|\bstill\s+incorrect\b|\bundo\b|\brevert\b(\s+that)?\b|\brollback\b|\bfix\s+didn'?t\b|\byou\s+(broke|broke\s+something)\b|\b(that(\s+solution)?)?\s*doesn'?t\b)/i;

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function ensureState(schema) {
  if (!schema || typeof schema !== 'object') {
    return { version: 1, models: {}, pending: null };
  }
  if (!schema.models || typeof schema.models !== 'object') schema.models = {};
  if ('pending' in schema === false) schema.pending = null;
  schema.version = 1;
  return schema;
}

function bumpModel(models, model) {
  if (!model || typeof model !== 'string') return;
  const m = models[model] || { implicitOk: 0, reportedFail: 0 };
  m.implicitOk = (m.implicitOk || 0) + 1;
  models[model] = m;
}

function recordFailure(models, model) {
  if (!model || typeof model !== 'string') return;
  const m = models[model] || { implicitOk: 0, reportedFail: 0 };
  m.reportedFail = (m.reportedFail || 0) + 1;
  const ok = Math.max(0, (m.implicitOk || 0) - 1);
  m.implicitOk = ok;
  models[model] = m;
}

function pct(ok, fail) {
  const t = ok + fail;
  if (t === 0) return '—';
  return String(Math.round((100 * ok) / t));
}

function renderMarkdownTable(models) {
  const entries = Object.keys(models).sort((a, b) => a.localeCompare(b));
  const lines = [
    '| Cursor `model` id | Implicit OK (*prior run*) | Explicit pushback (*next prompt*) | Roll-up % (OK / (OK + fail)) |',
    '| --- | ---: | ---: | ---: |',
  ];
  if (entries.length === 0) {
    lines.push(
      '| _(no hook samples yet)_ | — | — | — |'
    );
  } else {
    for (const id of entries) {
      const m = models[id];
      const ok = Number(m.implicitOk) || 0;
      const f = Number(m.reportedFail) || 0;
      lines.push(
        '| `' +
          String(id).replace(/`/g, '') +
          '` | ' +
          ok +
          ' | ' +
          f +
          ' | **' +
          pct(ok, f) +
          '%** |'
      );
    }
  }
  lines.push('');
  lines.push(
    `_Updated automatically (UTC): **${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}** — hook: \`.cursor/hooks/confidence-metrics.cjs\`_`
  );
  return lines.join('\n');
}

function replaceMarkers(content, replacement) {
  const i0 = content.indexOf(MARK_START);
  const i1 = content.indexOf(MARK_END);
  if (i0 === -1 || i1 === -1 || i1 <= i0) return null;
  return (
    content.slice(0, i0 + MARK_START.length) +
    '\n\n' +
    replacement +
    '\n\n' +
    content.slice(i1)
  );
}

function findWorkspaceRoot(payload) {
  const roots =
    payload && Array.isArray(payload.workspace_roots)
      ? payload.workspace_roots
      : [];
  for (const r of roots) {
    try {
      const doss = path.join(r, 'MODEL_DOSSIER.md');
      if (fs.statSync(doss).isFile()) return path.resolve(r);
    } catch (_) {
      continue;
    }
  }
  try {
    const scriptDir = path.resolve(__dirname, '..', '..');
    if (fs.statSync(path.join(scriptDir, 'MODEL_DOSSIER.md')).isFile()) {
      return scriptDir;
    }
  } catch (_) {
    /**/
  }
  return null;
}

function statePath(workspaceRoot) {
  const dir = path.join(workspaceRoot, '.cursor');
  return path.join(dir, STATE_NAME);
}

function applyStop(payload) {
  const root = findWorkspaceRoot(payload);
  if (!root) return;
  const dossierPath = path.join(root, 'MODEL_DOSSIER.md');
  const status = payload.status;
  if (status !== 'completed') return;
  const model = typeof payload.model === 'string' ? payload.model : null;
  if (!model) return;

  const dir = path.join(root, '.cursor');
  fs.mkdirSync(dir, { recursive: true });
  const stateFile = path.join(dir, STATE_NAME);
  let state = ensureState();
  try {
    state = ensureState(JSON.parse(fs.readFileSync(stateFile, 'utf8')));
  } catch (_) {
    /**/
  }

  bumpModel(state.models, model);
  state.pending = {
    model,
    generation_id: typeof payload.generation_id === 'string' ? payload.generation_id : null,
  };

  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8');

  updateDossier(dossierPath, state.models);
}

function applyBeforePrompt(payload) {
  try {
    const root = findWorkspaceRoot(payload);
    if (!root) return;
    const prompt = typeof payload.prompt === 'string' ? payload.prompt : '';

    const stateFile = statePath(root);
    let state = ensureState();
    try {
      state = ensureState(JSON.parse(fs.readFileSync(stateFile, 'utf8')));
    } catch (_) {
      /**/
    }

    const pending =
      state.pending && typeof state.pending.model === 'string'
        ? state.pending.model
        : null;
    if (pending && FAILURE_HINT_RE.test(prompt)) {
      recordFailure(state.models, pending);
    }
    state.pending = null;
    fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8');

    const dossierPath = path.join(root, 'MODEL_DOSSIER.md');
    updateDossier(dossierPath, state.models);
  } finally {
    console.log(JSON.stringify({ continue: true }));
  }
}

function updateDossier(dossierPath, models) {
  try {
    const content = fs.readFileSync(dossierPath, 'utf8');
    const table = renderMarkdownTable(models);
    const next = replaceMarkers(content, table);
    if (next !== null && next !== content) {
      fs.writeFileSync(dossierPath, next, 'utf8');
    }
  } catch (_) {
    /**/
  }
}

;(async () => {
  try {
    const rawText = await readStdin();
    let payload = {};
    try {
      payload = JSON.parse(rawText || '{}');
    } catch (_) {
      payload = {};
    }
    const name = payload.hook_event_name || '';

    if (name === 'beforeSubmitPrompt') {
      applyBeforePrompt(payload);
      return;
    }
    if (name === 'stop') {
      applyStop(payload);
      return;
    }

    /** Unknown hook invocation — noop (some runners may omit event name during tests). */
  } catch (e) {
    process.stderr.write(
      `[confidence-metrics] ${e && e.stack ? e.stack : String(e)}\n`
    );
  }
})();

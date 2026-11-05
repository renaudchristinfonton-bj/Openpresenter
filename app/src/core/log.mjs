// Journal structuré (EF-28) : une ligne JSON par évènement, un fichier par jour.

import fs from 'node:fs/promises';
import path from 'node:path';
import { LOG_DIR, todayStamp } from './paths.mjs';
import { projectDir } from './paths.mjs';

export const LEVELS = ['debug', 'info', 'warn', 'error'];

let verbose = process.env.OPENPRESENTER_VERBOSE === '1';
let logDirOverride = null;

export function setVerbose(value) { verbose = Boolean(value); }
export function isVerbose() { return verbose; }
export function setLogDir(dir) { logDirOverride = dir; }

export function logDir() {
  return logDirOverride || path.join(projectDir(), LOG_DIR);
}

export function logFile(date = new Date()) {
  return path.join(logDir(), `session-${todayStamp(date)}.log`);
}

/**
 * Écrit un évènement. `ctx` ne doit jamais contenir de contenu utilisateur
 * ni de chemin absolu (EF-28.4) : le filtrage est fait ici, pas par l'appelant.
 */
export async function log(level, event, msg, ctx) {
  if (!LEVELS.includes(level)) level = 'info';
  if (level === 'debug' && !verbose) return;
  const line = {
    ts: new Date().toISOString(),
    level,
    event,
    msg: String(msg ?? ''),
    ...(ctx ? { ctx: sanitizeCtx(ctx) } : {}),
    pid: process.pid
  };
  try {
    await fs.mkdir(logDir(), { recursive: true });
    await fs.appendFile(logFile(), JSON.stringify(line) + '\n', 'utf8');
  } catch {
    // Un journal indisponible ne doit jamais interrompre la régie.
  }
  if (level === 'error' || level === 'warn') {
    const tag = level.toUpperCase();
    process.stderr.write(`[${tag}] ${event} — ${msg}\n`);
  }
}

export function sanitizeCtx(ctx) {
  const out = {};
  for (const [k, v] of Object.entries(ctx || {})) {
    if (/pass|token|secret/i.test(k)) { out[k] = '****'; continue; }
    if (typeof v === 'string') {
      if (/^([A-Za-z]:[\\/]|[\\/])/.test(v)) {
        out[k] = v.split(/[\\/]/).filter(Boolean).pop() || '.';
      } else {
        out[k] = v.length > 300 ? v.slice(0, 300) + '…' : v;
      }
    } else if (typeof v === 'number' || typeof v === 'boolean' || v === null) {
      out[k] = v;
    } else if (Array.isArray(v) || (v && typeof v === 'object')) {
      out[k] = '(…)';
    }
  }
  return out;
}

/** Lit les N dernières entrées, éventuellement filtrées. */
export async function readLogs({ days = 1, level = null, q = null, limit = 200 } = {}) {
  const dir = logDir();
  let files = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => /^session-\d{4}-\d{2}-\d{2}\.log$/.test(f)).sort();
  } catch {
    return [];
  }
  const keep = files.slice(-Math.max(1, days));
  const entries = [];
  for (const f of keep) {
    let raw = '';
    try { raw = await fs.readFile(path.join(dir, f), 'utf8'); } catch { continue; }
    for (const line of raw.split('\n')) {
      if (!line) continue;
      try {
        const e = JSON.parse(line);
        if (level && e.level !== level) continue;
        if (q) {
          const hay = `${e.event} ${e.msg} ${JSON.stringify(e.ctx || {})}`.toLowerCase();
          if (!hay.includes(String(q).toLowerCase())) continue;
        }
        entries.push(e);
      } catch { /* ligne tronquée : ignorée */ }
    }
  }
  return entries.slice(-limit);
}

/** Purge des fichiers de plus de `days` jours (EF-28.2) ; renvoie le nombre supprimé. */
export async function purgeLogs(days = 30) {
  const dir = logDir();
  const cutoff = Date.now() - days * 86400000;
  let removed = 0;
  let files = [];
  try { files = await fs.readdir(dir); } catch { return 0; }
  for (const f of files) {
    const m = /^session-(\d{4}-\d{2}-\d{2})\.log$/.exec(f);
    if (!m) continue;
    if (new Date(`${m[1]}T00:00:00Z`).getTime() < cutoff) {
      await fs.rm(path.join(dir, f), { force: true });
      removed++;
    }
  }
  return removed;
}

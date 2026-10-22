// Plan de déroulement (EF-23) : étapes, exécution, import et impression.
//
// Le plan appartient à l'événement (`event.plan.cues`). La **position** de lecture
// vit dans `session-state.json` : un rechargement de page retrouve l'étape courante
// (EF-23.13). Une étape `note` ne diffuse rien (EF-23.8).

import { readSessionState, writeSessionState } from './project.mjs';
import { parseReference } from './bible/reference.mjs';

export const CUE_KINDS = ['note', 'bible', 'song', 'media', 'announcement', 'lowerthird', 'timer', 'blank'];

export function normalizeCue(input = {}, index = 0) {
  return {
    id: /^cue_[a-z0-9_]{2,32}$/.test(input.id || '')
      ? input.id
      : `cue_${String(index + 1).padStart(3, '0')}_${Math.random().toString(36).slice(2, 6)}`,
    kind: CUE_KINDS.includes(input.kind) ? input.kind : 'note',
    label: String(input.label || '').slice(0, 160),
    durationSec: Number.isFinite(Number(input.durationSec)) ? Math.max(0, Math.min(4 * 3600, Number(input.durationSec))) : null,
    payload: input.payload && typeof input.payload === 'object' ? input.payload : {},
    notes: String(input.notes || '').slice(0, 400),
    skipped: Boolean(input.skipped)
  };
}

export function normalizeCues(cues) {
  return (Array.isArray(cues) ? cues : []).slice(0, 200).map(normalizeCue);
}

/** Durée estimée d'un plan, en secondes (EF-23.5). */
export function planDuration(cues = []) {
  return cues.reduce((total, cue) => total + (cue.skipped ? 0 : Number(cue.durationSec) || 0), 0);
}

/** Format machine d'une référence biblique : `43-3-16..43-3-18` (EF-23.1). */
export function referenceToRef(parsed) {
  if (!parsed) return null;
  const first = parsed.first || 1;
  const base = `${parsed.bookNum}-${parsed.chapter}-${first}`;
  return parsed.last && parsed.last > first ? `${base}..${parsed.bookNum}-${parsed.chapter}-${parsed.last}` : base;
}

export function refToRange(ref) {
  const match = /^(\d+)-(\d+)-(\d+)(?:\.\.(\d+)-(\d+)-(\d+))?$/.exec(String(ref || ''));
  if (!match) return null;
  return {
    bookNum: Number(match[1]),
    chapter: Number(match[2]),
    first: Number(match[3]),
    last: match[6] ? Number(match[6]) : Number(match[3])
  };
}

function fold(text) {
  return String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/**
 * Analyse un déroulé collé ou importé (§ 14.4.3, EF-23.14).
 * Une ligne = une étape ; reconnaissance automatique, rapport ligne par ligne.
 */
export function parsePlanText(text, { songs = [], bibles = [] } = {}) {
  const cues = [];
  const report = [];
  const songByTitle = new Map(songs.map((song) => [fold(song.title), song]));
  const bible = bibles[0] || null;

  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    // `#…` ou `//…` : repère de conduite explicite.
    if (/^(#|\/\/)/.test(line)) {
      const label = line.replace(/^(#+|\/\/+)\s*/, '').trim();
      const cue = normalizeCue({ kind: 'note', label, payload: { text: label } }, cues.length);
      cues.push(cue);
      report.push({ line, label, kind: 'note', detail: 'note (marqueur)' });
      continue;
    }

    // Une référence biblique reconnue par la machine à états du chapitre 9.
    const parsed = parseReference(line);
    if (parsed) {
      const ref = referenceToRef(parsed);
      const cue = normalizeCue({
        kind: 'bible',
        label: `${parsed.bookName} ${parsed.chapter}${parsed.first
          ? ':' + parsed.first + (parsed.last && parsed.last > parsed.first ? '-' + parsed.last : '')
          : ''}`,
        payload: { bibleId: bible?.id || null, ref }
      }, cues.length);
      cues.push(cue);
      report.push({ line, label: cue.label, kind: 'bible', detail: `verset (${bible?.abbreviation || bible?.name || 'version active'})` });
      continue;
    }

    // Titre de chant : correspondance **exacte**, accents et casse ignorés.
    const song = songByTitle.get(fold(line));
    if (song) {
      const cue = normalizeCue({
        kind: 'song',
        label: song.title,
        payload: { songId: song.id }
      }, cues.length);
      cues.push(cue);
      report.push({ line, label: song.title, kind: 'song', detail: 'chant (correspondance exacte)' });
      continue;
    }

    // Tout le reste : un repère de conduite, jamais une erreur bloquante.
    const cue = normalizeCue({ kind: 'note', label: line, payload: { text: line } }, cues.length);
    cues.push(cue);
    report.push({ line, label: line, kind: 'note', detail: 'note — aucun élément correspondant' });
  }

  return { cues, report };
}

/**
 * Import d'un export JSON Planning Center (§ 14.4.4).
 * Les items deviennent des étapes, les chants sont appariés par titre.
 */
export function parsePlanningCenter(payload, { songs = [] } = {}) {
  const items = payload?.data?.attributes?.items
    || payload?.items
    || payload?.plan?.items
    || (Array.isArray(payload?.data) ? payload.data : null);
  if (!Array.isArray(items)) {
    throw Object.assign(new Error("Ce fichier n'est pas un plan Planning Center."), {
      code: 'VALIDATION',
      message: "TXT: Ce fichier n'est pas un plan Planning Center.\n     Attendu : un export JSON contenant la liste des items du plan."
    });
  }
  const songByTitle = new Map(songs.map((song) => [fold(song.title), song]));
  const cues = [];
  const report = [];
  for (const item of items) {
    const title = String(item?.attributes?.title || item?.title || item?.name || '').trim();
    if (!title) continue;
    const song = songByTitle.get(fold(title));
    const seconds = Number(item?.attributes?.length || item?.length || 0);
    if (song) {
      cues.push(normalizeCue({
        kind: 'song',
        label: song.title,
        durationSec: seconds || null,
        payload: { songId: song.id }
      }, cues.length));
      report.push({ line: title, label: song.title, kind: 'song', detail: 'chant apparié par titre' });
      continue;
    }
    const parsed = parseReference(title);
    if (parsed) {
      cues.push(normalizeCue({
        kind: 'bible',
        label: title,
        durationSec: seconds || null,
        payload: { ref: referenceToRef(parsed) }
      }, cues.length));
      report.push({ line: title, label: title, kind: 'bible', detail: 'verset' });
      continue;
    }
    cues.push(normalizeCue({
      kind: 'note',
      label: title,
      durationSec: seconds || null,
      payload: { text: title }
    }, cues.length));
    report.push({ line: title, label: title, kind: 'note', detail: 'note — aucun élément correspondant' });
  }
  return { cues, report };
}

/** Document lisible / imprimable (§ 14.4.5, EF-23.18). */
export function planToText(event, { org = null, place = null } = {}) {
  const date = new Date(event.startsAt);
  const day = Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fr-FR');
  const time = Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const header = [
    `PLAN DE CULTE — ${event.name}${day !== '—' ? ` du ${day}` : ''}`,
    [org?.name, place?.name, time].filter(Boolean).join(' · '),
    ''
  ];
  const lines = [];
  let width = 0;
  const cues = event.plan?.cues || [];
  const rows = cues.map((cue, index) => {
    const duration = cue.durationSec ? `${Math.round(cue.durationSec / 60)} min` : '';
    const label = `${String(index + 1).padStart(2, ' ')}. ${cue.label}`;
    width = Math.max(width, label.length);
    return { label, duration, skipped: cue.skipped };
  });
  for (const row of rows) {
    lines.push(`${row.label.padEnd(width + 2, ' ')}${row.duration}${row.skipped ? '   (sautée)' : ''}`.trimEnd());
  }
  const total = planDuration(cues);
  const hours = Math.floor(total / 3600);
  const minutes = Math.round((total % 3600) / 60);
  return [...header, ...lines, '', `Durée estimée : ${hours ? `${hours} h ` : ''}${minutes} min`, ''].join('\n');
}

// ---------------------------------------------------------------------------
// Position de lecture (EF-23.13)
// ---------------------------------------------------------------------------

export async function readPlanPosition() {
  const state = (await readSessionState()) || {};
  return state.plan && Number.isInteger(state.plan.index)
    ? state.plan
    : { eventId: null, index: 0, updatedAt: null };
}

export async function savePlanPosition(eventId, index) {
  const previous = (await readSessionState()) || {};
  const plan = { eventId, index, updatedAt: new Date().toISOString() };
  await writeSessionState({ ...previous, plan });
  return plan;
}

/**
 * Index de l'étape affichée, borné au plan courant.
 * `-1` est une valeur légitime : le plan n'a pas encore commencé.
 */
export function clampIndex(cues, index) {
  if (!cues.length) return -1;
  const value = Number.isInteger(Number(index)) ? Number(index) : -1;
  return Math.max(-1, Math.min(cues.length - 1, value));
}

/** Résumé des panneaux En cours / Suivant / Après (EF-23.4). */
export function planView(cues, index) {
  const current = clampIndex(cues, index);
  const findNext = (from) => {
    for (let cursor = from; cursor < cues.length; cursor += 1) {
      if (!cues[cursor].skipped) return cursor;
    }
    return -1;
  };
  const nextIndex = findNext(current + 1);
  const afterIndex = nextIndex >= 0 ? findNext(nextIndex + 1) : -1;
  return {
    index: current,
    started: current >= 0,
    current: current >= 0 ? cues[current] : null,
    next: nextIndex >= 0 ? cues[nextIndex] : null,
    after: afterIndex >= 0 ? cues[afterIndex] : null,
    total: cues.length,
    estimatedSec: planDuration(cues)
  };
}

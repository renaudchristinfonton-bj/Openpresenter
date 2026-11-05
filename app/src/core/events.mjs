// Organisations, lieux et événements (EF-21, EF-22).
//
// Trois niveaux, aucun obligatoire :
//   organisation → lieux (avec leurs écrans) → événements (profil + plan + historique).
// Aucun binaire : le logo d'une organisation est un asset référencé (`logoAssetId`).

import crypto from 'node:crypto';
import { list, put, get, remove } from './library.mjs';
import { readProject, patchSettings } from './project.mjs';

export const ORG_KINDS = ['church', 'association', 'school', 'company', 'other'];
export const RECURRENCE_FREQS = ['daily', 'weekly', 'monthly'];
export const CUE_KINDS = ['note', 'bible', 'song', 'media', 'announcement', 'lowerthird', 'timer', 'blank'];

const COLORS = ['#f5b942', '#38bdf8', '#e879f9', '#34d399', '#f97316', '#a78bfa'];

function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(5).toString('hex')}`;
}

function isoOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// ---------------------------------------------------------------------------
// Organisations et lieux (EF-21)
// ---------------------------------------------------------------------------

/** Complète et borne une organisation reçue du client (EF-21.4 → EF-21.7). */
export function normalizeOrg(input = {}) {
  const places = (Array.isArray(input.places) ? input.places : []).slice(0, 24).map((place) => ({
    id: /^plc_[a-z0-9_]{2,32}$/.test(place?.id || '') ? place.id : newId('plc'),
    name: String(place?.name || 'Lieu').slice(0, 80),
    capacity: Number.isFinite(Number(place?.capacity)) ? Math.max(0, Math.min(1_000_000, Number(place.capacity))) : null,
    screens: (Array.isArray(place?.screens) ? place.screens : []).slice(0, 12)
      .map((screen) => String(screen).slice(0, 60)).filter(Boolean),
    notes: String(place?.notes || '').slice(0, 400)
  }));
  return {
    id: /^org_[a-z0-9_]{2,40}$/.test(input.id || '') ? input.id : newId('org'),
    rev: Number.isInteger(input.rev) ? input.rev : 1,
    name: String(input.name || 'Organisation').trim().slice(0, 120) || 'Organisation',
    kind: ORG_KINDS.includes(input.kind) ? input.kind : 'other',
    contact: {
      email: String(input.contact?.email || '').slice(0, 120),
      phone: String(input.contact?.phone || '').slice(0, 40),
      address: String(input.contact?.address || '').slice(0, 200)
    },
    logoAssetId: input.logoAssetId ? String(input.logoAssetId).slice(0, 40) : null,
    places
  };
}

export function placeById(org, placeId) {
  return (org?.places || []).find((place) => place.id === placeId) || null;
}

/**
 * Supprime une organisation. **Aucun événement n'est supprimé** : ils deviennent
 * simplement « sans organisation » (EF-21.3).
 */
export async function removeOrg(id) {
  const org = await get('orgs', id);
  if (!org) throw Object.assign(new Error("Cette organisation n'existe plus."), { code: 'NOT_FOUND' });
  const placeIds = new Set((org.places || []).map((place) => place.id));
  let detached = 0;
  for (const event of await list('events')) {
    const patch = {};
    if (event.orgId === id) patch.orgId = null;
    if (placeIds.has(event.placeId)) patch.placeId = null;
    if (Object.keys(patch).length) {
      await put('events', event.id, { ...event, ...patch, rev: (event.rev || 1) + 1 });
      detached += 1;
    }
  }
  await remove('orgs', id);
  return { id, removed: true, detachedEvents: detached };
}

// ---------------------------------------------------------------------------
// Événements (EF-22)
// ---------------------------------------------------------------------------

export function eventStatus(event, now = new Date()) {
  const start = event.startsAt ? new Date(event.startsAt) : null;
  const end = event.endsAt ? new Date(event.endsAt) : null;
  if (!start || Number.isNaN(start.getTime())) return 'unscheduled';
  if (end && !Number.isNaN(end.getTime()) && now >= start && now <= end) return 'live';
  if (now >= start && (!end || now <= end || sameDay(now, start))) return 'today';
  return now < start ? 'upcoming' : 'past';
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Complète et borne un événement (EF-22.1 → EF-22.10). */
export function normalizeEvent(input = {}, { now = new Date() } = {}) {
  const startsAt = isoOrNull(input.startsAt) || now.toISOString();
  const endsAt = isoOrNull(input.endsAt) || new Date(new Date(startsAt).getTime() + 90 * 60_000).toISOString();
  const recurrence = input.recurrence && RECURRENCE_FREQS.includes(input.recurrence.freq)
    ? {
      freq: input.recurrence.freq,
      byDay: (input.recurrence.byDay || []).map((day) => String(day).toUpperCase()).filter((day) => /^(MO|TU|WE|TH|FR|SA|SU)$/.test(day)),
      until: isoOrNull(input.recurrence.until)
    }
    : null;

  const plan = input.plan && typeof input.plan === 'object'
    ? { id: String(input.plan.id || newId('plan')).slice(0, 40), cues: normalizeCues(input.plan.cues) }
    : { id: newId('plan'), cues: [] };

  return {
    id: /^evt_[a-z0-9_]{2,44}$/.test(input.id || '') ? input.id : newEventId(startsAt),
    rev: Number.isInteger(input.rev) ? input.rev : 1,
    name: String(input.name || 'Événement').trim().slice(0, 120) || 'Événement',
    startsAt,
    endsAt,
    orgId: input.orgId ? String(input.orgId).slice(0, 40) : null,
    placeId: input.placeId ? String(input.placeId).slice(0, 40) : null,
    profileId: input.profileId ? String(input.profileId).slice(0, 40) : null,
    color: /^#[0-9a-f]{6}$/i.test(input.color || '') ? input.color : COLORS[0],
    description: String(input.description || '').slice(0, 600),
    recurrence,
    templateSourceId: input.templateSourceId ? String(input.templateSourceId).slice(0, 40) : null,
    plan,
    history: (Array.isArray(input.history) ? input.history : []).slice(-500).map(normalizeHistoryEntry)
  };
}

/** Identifiant lisible et stable : `evt_20261026_culte_ab12`. */
export function newEventId(startsAt, name = '') {
  const date = new Date(startsAt);
  const stamp = Number.isNaN(date.getTime())
    ? new Date().toISOString().slice(0, 10).replace(/-/g, '')
    : `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const slug = String(name).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 16);
  return `evt_${stamp}${slug ? '_' + slug : ''}_${crypto.randomBytes(2).toString('hex')}`;
}

function normalizeCues(cues) {
  return (Array.isArray(cues) ? cues : []).slice(0, 200).map((cue, index) => ({
    id: /^cue_[a-z0-9_]{2,32}$/.test(cue?.id || '') ? cue.id : `cue_${(index + 1).toString().padStart(3, '0')}_${crypto.randomBytes(2).toString('hex')}`,
    kind: CUE_KINDS.includes(cue?.kind) ? cue.kind : 'note',
    label: String(cue?.label || '').slice(0, 160),
    durationSec: Number.isFinite(Number(cue?.durationSec)) ? Math.max(0, Math.min(4 * 3600, Number(cue.durationSec))) : null,
    payload: cue?.payload && typeof cue.payload === 'object' ? cue.payload : {},
    notes: String(cue?.notes || '').slice(0, 400),
    skipped: Boolean(cue?.skipped)
  }));
}

function normalizeHistoryEntry(entry) {
  return {
    at: isoOrNull(entry?.at) || new Date().toISOString(),
    cueId: entry?.cueId ? String(entry.cueId).slice(0, 40) : null,
    label: String(entry?.label || '').slice(0, 160),
    kind: CUE_KINDS.includes(entry?.kind) ? entry.kind : 'note',
    outputs: Array.isArray(entry?.outputs) ? entry.outputs.map((id) => String(id).slice(0, 40)) : []
  };
}

/** Durée estimée d'un plan (EF-23.5), en secondes. */
export function planDuration(cues = []) {
  return cues.reduce((total, cue) => total + (cue.skipped ? 0 : Number(cue.durationSec) || 0), 0);
}

/**
 * Matérialise les prochaines occurrences d'un événement récurrent (EF-22.2, EF-22.3).
 * Aucune génération infinie : `count` occurrences au maximum, et jamais au-delà de `until`.
 */
export function nextOccurrences(event, { count = 8, from = event.startsAt } = {}) {
  const recurrence = event.recurrence;
  if (!recurrence) return [];
  const start = new Date(event.startsAt);
  const cursor = new Date(from && new Date(from) > start ? from : start);
  const until = recurrence.until ? new Date(recurrence.until) : null;
  const out = [];
  // Récurrence hebdomadaire avec jours choisis : on avance **jour par jour** puis on
  // filtre, sinon une date de départ hors des jours choisis ne produirait jamais rien.
  const byDayMode = recurrence.freq === 'weekly' && recurrence.byDay.length > 0;
  const step = byDayMode ? 86_400_000
    : recurrence.freq === 'daily' ? 86_400_000
      : recurrence.freq === 'weekly' ? 7 * 86_400_000 : 0;
  let probe = new Date(start);
  for (let guard = 0; guard < 800 && out.length < count; guard += 1) {
    if (recurrence.freq === 'monthly') {
      probe = new Date(probe.getFullYear(), probe.getMonth() + 1, probe.getDate(), start.getHours(), start.getMinutes());
    } else {
      probe = new Date(probe.getTime() + step);
    }
    if (until && probe > until) break;
    if (probe <= start) continue;
    if (byDayMode && !recurrence.byDay.includes(['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][probe.getDay()])) {
      continue;
    }
    if (probe < cursor) continue;
    out.push(probe.toISOString());
  }
  return out;
}

/** Crée les occurrences demandées, sans doublon (EF-22.3). */
export async function materializeOccurrences(id, { count = 4 } = {}) {
  const event = await get('events', id);
  if (!event) throw Object.assign(new Error("Cet événement n'existe plus."), { code: 'NOT_FOUND' });
  if (!event.recurrence) {
    throw Object.assign(new Error("Cet événement n'est pas récurrent."), { code: 'VALIDATION', path: 'recurrence' });
  }
  const existing = await list('events');
  const known = new Set(existing.map((entry) => entry.startsAt));
  const created = [];
  for (const startsAt of nextOccurrences(event, { count })) {
    if (known.has(startsAt)) continue;
    const copy = normalizeEvent({
      ...event,
      id: newEventId(startsAt, event.name),
      rev: 1,
      startsAt,
      endsAt: new Date(new Date(startsAt).getTime() + (new Date(event.endsAt) - new Date(event.startsAt))).toISOString(),
      recurrence: null,
      templateSourceId: event.id,
      history: []
    });
    copy.id = newEventId(startsAt, event.name);
    await put('events', copy.id, copy);
    created.push(copy);
  }
  return { event: id, created };
}

/** Duplique un événement : plan et couleur suivent, l'historique non (EF-22.4). */
export async function duplicateEvent(id, { startsAt } = {}) {
  const source = await get('events', id);
  if (!source) throw Object.assign(new Error("Cet événement n'existe plus."), { code: 'NOT_FOUND' });
  const start = startsAt || new Date(new Date(source.startsAt).getTime() + 7 * 86_400_000).toISOString();
  const copy = normalizeEvent({
    ...structuredClone(source),
    id: null,
    rev: 1,
    startsAt: start,
    endsAt: new Date(new Date(start).getTime() + (new Date(source.endsAt) - new Date(source.startsAt))).toISOString(),
    recurrence: null,
    templateSourceId: source.id,
    history: []
  });
  copy.id = newEventId(start, source.name);
  copy.name = /\(copie\)$/.test(source.name) ? source.name : `${source.name} (copie)`.slice(0, 120);
  await put('events', copy.id, copy);
  return copy;
}

/** Enregistre une diffusion dans l'historique (append-only, EF-22.6). */
export async function appendHistory(id, entry) {
  const event = await get('events', id);
  if (!event) throw Object.assign(new Error("Cet événement n'existe plus."), { code: 'NOT_FOUND' });
  const history = [...(event.history || []), normalizeHistoryEntry({ ...entry, at: new Date().toISOString() })].slice(-500);
  const saved = await put('events', id, { ...event, history, rev: (event.rev || 1) + 1 });
  return { event: saved, entry: history[history.length - 1] };
}

/** Historique au format CSV (EF-22.7). */
export function historyCsv(event) {
  const lines = ['date,heure,etape,type,sorties'];
  for (const entry of event.history || []) {
    const date = new Date(entry.at);
    const day = Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('fr-FR');
    const time = Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const safe = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    lines.push([day, time, safe(entry.label), entry.kind, safe((entry.outputs || []).join(' '))].join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

/** Charge un événement et applique son profil (EF-20.18, EF-22.5). */
export async function openEvent(id) {
  const event = await get('events', id);
  if (!event) throw Object.assign(new Error("Cet événement n'existe plus."), { code: 'NOT_FOUND' });
  const project = await readProject();
  const active = project?.settings?.activeProfileId || null;
  await patchSettings({ activeEventId: id });
  return {
    event,
    status: eventStatus(event),
    needsProfile: Boolean(event.profileId && event.profileId !== active),
    activeProfileId: active,
    message: event.profileId && event.profileId !== active
      ? `Cet événement utilise le profil « ${event.profileId} » : l'appliquer ?`
      : null
  };
}

/** Vue « aujourd'hui / à venir / passés » de l'accueil (EF-22.5). */
export async function eventOverview(now = new Date()) {
  const events = (await list('events')).map((event) => ({
    ...event,
    status: eventStatus(event, now),
    durationSec: planDuration(event.plan?.cues || []),
    cues: event.plan?.cues?.length || 0
  }));
  events.sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
  return {
    today: events.filter((event) => event.status === 'today' || event.status === 'live'),
    upcoming: events.filter((event) => event.status === 'upcoming').slice(0, 10),
    past: events.filter((event) => event.status === 'past').slice(-20).reverse(),
    total: events.length
  };
}

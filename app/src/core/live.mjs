// État de diffusion (ch. 07) : ce qui est à l'antenne, sortie par sortie.
// La vérité reste le disque (`session-state.json`), la mémoire n'est qu'un cache.

import { readSessionState, writeSessionState } from './project.mjs';
import { readOutputs } from './library.mjs';

export const CHANNEL_PREFIX = 'op_out_';
export const STUDIO_CHANNEL = 'op_studio';

/** Ce qui est affiché en ce moment, par sortie. */
const state = new Map(); // outputId → { kind, payload, shownAt, seq }
let seq = 0;
let saveTimer = null;

export function channelFor(outputId) {
  return `${CHANNEL_PREFIX}${outputId}`;
}

export function getState(outputId) {
  return state.get(outputId) || null;
}

export function snapshot() {
  const out = {};
  for (const [id, value] of state) out[id] = value;
  return out;
}

/**
 * Diffuse un contenu vers des sorties.
 * @param {object} relay
 * @param {object} params
 * @param {string[]} params.targets identifiants de sorties
 * @param {string} params.kind bible | songs | media | announcements | lowerthird | timer | plan
 * @param {object} params.payload
 */
export async function show(relay, { targets, kind, payload, origin = 'studio' }) {
  const outputs = await readOutputs();
  const byId = new Map((outputs.outputs || []).map((o) => [o.id, o]));
  const delivered = [];
  const refused = [];

  for (const id of targets || []) {
    const output = byId.get(id);
    if (!output) { refused.push({ id, reason: 'unknown' }); continue; }
    if (output.enabled === false) { refused.push({ id, reason: 'disabled' }); continue; }
    // Le filtre `receives` bloque même une URL directe (EF-08, A-09).
    if (kind && output.receives && output.receives[kind] === false) {
      refused.push({ id, reason: 'filtered', kind });
      continue;
    }
    const message = {
      t: 'show',
      kind,
      payload,
      outputId: id,
      sceneId: output.scenesByKind?.[kind] || null,
      seq: ++seq,
      ts: Date.now(),
      origin
    };
    state.set(id, message);
    relay?.publish(channelFor(id), message);
    delivered.push(id);
  }

  relay?.broadcast(STUDIO_CHANNEL, {
    t: 'live:state', targets: delivered, kind, ts: Date.now()
  });
  scheduleSave();
  return { delivered, refused, seq };
}

/**
 * Coupe ce qui est à l'antenne.
 * @param {object} params
 * @param {string[]} [params.targets] sorties concernées (toutes par défaut)
 * @param {string} [params.kind] ne coupe que ce type de contenu : un habillage
 *   ou un minuteur qui s'arrête ne doit jamais éteindre le verset affiché (EF-19, EF-18).
 */
export async function clear(relay, { targets, kind } = {}) {
  const ids = targets?.length ? targets : [...state.keys()];
  const cleared = [];
  const kept = [];
  for (const id of ids) {
    const current = state.get(id);
    if (kind && current && current.kind !== kind) {
      kept.push(id);
      continue;
    }
    state.delete(id);
    relay?.publish(channelFor(id), { t: 'clear', seq: ++seq, ts: Date.now() });
    cleared.push(id);
  }
  relay?.broadcast(STUDIO_CHANNEL, { t: 'live:cleared', targets: cleared, kind: kind || null, ts: Date.now() });
  scheduleSave();
  return { cleared, kept };
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(async () => {
    saveTimer = null;
    const previous = (await readSessionState()) || {};
    await writeSessionState({
      ...previous,
      live: snapshot(),
      liveSavedAt: new Date().toISOString()
    }).catch(() => {});
  }, 800);
  saveTimer.unref?.();
}

/** Recharge l'état après un redémarrage (la régie retrouve ce qui était à l'antenne). */
export async function restore() {
  const saved = await readSessionState();
  const live = saved?.live || {};
  for (const [id, message] of Object.entries(live)) state.set(id, message);
  return Object.keys(live).length;
}

export function reset() {
  state.clear();
  seq = 0;
}

// Routage des **calques** : habillage (EF-19) et minuteur (EF-18).
//
// Une sortie ne porte qu'un seul contenu à l'antenne : si le minuteur partait
// sur « Plein écran — Salle », il éteindrait le verset en cours. Le calque doit
// donc trouver une sortie qui lui est **dédiée** (transparente, qui ne reçoit ni
// la Bible ni les chants). À défaut, on la crée — c'est ce que fait un régisseur
// à la main, en une fois pour toutes.
//
// Module pur, partagé : serveur, studio et tests (ENF-42).

export const OVERLAY_KINDS = ['lowerthird', 'timer'];

/** Les types de contenu qui « tiennent » une sortie et ne doivent pas être masqués. */
export const PRIMARY_KINDS = ['bible', 'songs', 'media', 'announcements', 'plan'];

export const OVERLAY_OUTPUTS = {
  lowerthird: {
    id: 'out_lower',
    name: 'Habillage',
    notes: 'Bandeau nom + fonction, à superposer dans OBS ou vMix.',
    creates: { lowerthird: true, timer: true }
  },
  timer: {
    id: 'out_timer',
    name: 'Minuteur',
    notes: 'Compte à rebours de l’événement, en surimpression.',
    creates: { timer: true, lowerthird: false }
  }
};

export function acceptsKind(output, kind) {
  return Boolean(output) && output.enabled !== false && output.receives?.[kind] !== false;
}

/** Une sortie ne recevant que des calques : elle peut les accueillir sans rien éteindre. */
export function isOverlayOnly(output) {
  if (!output || output.enabled === false) return false;
  const receives = output.receives || {};
  const primary = PRIMARY_KINDS.some((kind) => receives[kind] === true);
  const overlay = OVERLAY_KINDS.some((kind) => receives[kind] === true);
  return overlay && !primary;
}

/**
 * Où envoyer un calque.
 * @param {object[]} outputs toutes les sorties du projet
 * @param {string[]} checkedIds sorties cochées par le régisseur
 * @param {string} kind `lowerthird` | `timer`
 * @param {{onAir?: Record<string, string>}} [options] `onAir` : type actuellement
 *   affiché par sortie. Un calque ne doit jamais écraser un contenu principal.
 * @returns {{ids: string[], moved: boolean, label: string|null, dedicated: boolean, needsCreation: boolean, reason?: string}}
 *  `dedicated` : un porteur dédié existe, le contenu principal est intact.
 *  `moved`     : on a dû choisir une sortie que le régisseur n'avait pas cochée.
 *  `needsCreation` : aucun porteur possible → il faut créer la sortie dédiée.
 */
export function pickOverlayTargets(outputs = [], checkedIds = [], kind = 'lowerthird', { onAir = {} } = {}) {
  const list = Array.isArray(outputs) ? outputs : [];
  // Une sortie occupée par un contenu principal (verset, chant, média, annonce)
  // n'est pas un porteur : y poser un calque l'éteindrait en plein direct.
  const free = (output) => !PRIMARY_KINDS.includes(onAir?.[output.id]);

  const dedicated = list.filter((o) => isOverlayOnly(o) && acceptsKind(o, kind));
  if (dedicated.length) {
    return { ids: dedicated.map((o) => o.id), moved: false, label: dedicated[0].name, dedicated: true, needsCreation: false };
  }
  const checked = list.filter((o) => checkedIds.includes(o.id) && acceptsKind(o, kind) && free(o));
  if (checked.length) {
    return { ids: checked.map((o) => o.id), moved: false, label: checked[0].name, dedicated: false, needsCreation: false };
  }
  const any = list.filter((o) => acceptsKind(o, kind) && free(o));
  if (any.length) {
    return { ids: [any[0].id], moved: true, label: any[0].name, dedicated: false, needsCreation: false };
  }
  const occupied = list.some((o) => acceptsKind(o, kind));
  return {
    ids: [], moved: false, label: null, dedicated: false, needsCreation: true,
    reason: occupied ? 'occupied' : 'missing'
  };
}

/**
 * Description de la sortie dédiée à créer (validée par `normalizeOutput`).
 * @param {string} kind
 * @param {string[]} [existingIds] ids déjà pris
 */
export function makeOverlayOutput(kind, existingIds = []) {
  const base = OVERLAY_OUTPUTS[kind] || OVERLAY_OUTPUTS.lowerthird;
  let id = base.id;
  const taken = new Set(existingIds);
  if (taken.has(id)) {
    id = `${id}_${Math.random().toString(36).slice(2, 6)}`;
  }
  const receives = {};
  for (const key of [...PRIMARY_KINDS, ...OVERLAY_KINDS]) {
    receives[key] = Boolean(base.creates[key]);
  }
  return {
    id,
    name: base.name,
    preset: 'lowerthird',
    width: 1920,
    height: 1080,
    fit: 'contain',
    transparent: true,
    enabled: true,
    // Jamais « par défaut » : un contenu normal ne doit pas partir sur le calque.
    targetByDefault: false,
    receives,
    scenesByKind: {},
    notes: base.notes
  };
}

/** Libellé court, pour le bandeau d'état du module. */
export function overlayRouteLabel(route) {
  if (!route) return '';
  if (route.dedicated) return `sur « ${route.label} »`;
  if (route.label) return `sur « ${route.label} »`;
  return 'aucun porteur';
}

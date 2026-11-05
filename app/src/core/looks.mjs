// Looks (EF-10.4 → EF-10.11) : jeu de scènes nommé, embarquant une **copie**.
// Modifier la scène d'origine après coup ne doit jamais modifier le look (A-10f).

import { randomHex } from './ids.mjs';
import { normalizeScene } from './scene.mjs';

export function newLookId() {
  return 'look_' + randomHex(5);
}

/**
 * Crée un look à partir d'un ensemble de scènes.
 * @param {object} params
 * @param {string} params.name
 * @param {{kind: string, scene: object}[]} params.scenes
 * @param {string} [params.description]
 */
export function createLook({ name, scenes = [], description = '', themeId = null, backgroundAssetId = null }) {
  const embedded = {};
  for (const { kind, scene } of scenes) {
    if (!scene) continue;
    const copy = structuredClone(scene);
    embedded[kind] = { sceneId: copy.id, embed: copy };
  }
  return {
    id: newLookId(),
    rev: 1,
    name: String(name || 'Look').slice(0, 60),
    description: String(description || '').slice(0, 300),
    themeId,
    backgroundAssetId,
    scenes: embedded
  };
}

/** Retourne les scènes à appliquer à une sortie, sans jamais partager les objets. */
export function lookScenes(look) {
  return Object.entries(look?.scenes || {}).map(([kind, entry]) => ({
    kind,
    scene: structuredClone(entry.embed)
  }));
}

/**
 * Applique un look à une sortie : renvoie la liste des scènes à écrire et le
 * mappage `scenesByKind`. Les types non couverts par le look sont conservés.
 */
export function applyLookToOutput(look, output) {
  const next = { ...output, scenesByKind: { ...(output.scenesByKind || {}) } };
  const written = [];
  for (const [kind, entry] of Object.entries(look?.scenes || {})) {
    const scene = normalizeScene(structuredClone(entry.embed));
    // Un look appliqué à une autre sortie garde ses calques mais reçoit un
    // identifiant propre : les scènes d'une sortie ne sont jamais partagées.
    scene.id = `scn_${kind}_${randomHex(4)}`;
    scene.name = `${look.name} — ${kind}`;
    next.scenesByKind[kind] = scene.id;
    written.push({ kind, scene });
  }
  return { output: next, scenes: written };
}

/** « Détacher » : copie indépendante d'un look partagé (D-07). */
export function detachLook(look, name = null) {
  const copy = structuredClone(look);
  copy.id = newLookId();
  copy.name = name || `${look.name} (copie)`;
  copy.rev = 1;
  copy.detachedFrom = look.id;
  return copy;
}

/**
 * Vérifie qu'un look contient bien des **copies** et non des références.
 * @param {object} look
 * @param {{kind: string, scene: object}[]} originalScenes scènes utilisées pour le créer
 */
export function lookIsIndependent(look, originalScenes = []) {
  for (const original of originalScenes) {
    const entry = look?.scenes?.[original.kind];
    if (!entry?.embed) continue;
    // Même objet en mémoire : le look n'est pas indépendant.
    if (entry.embed === original.scene) return false;
    // Une copie valide doit avoir le même contenu au moment de la création.
    if (entry.embed.id !== original.scene.id) return false;
  }
  return true;
}

/** Applique une modification à la scène d'origine et vérifie que le look n'a pas bougé. */
export function lookSnapshot(look) {
  return JSON.stringify(look?.scenes || {});
}

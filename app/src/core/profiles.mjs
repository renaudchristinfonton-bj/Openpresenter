// Profils : gabarits complets et réutilisables (EF-20, décision D-07).
//
// Un profil ne contient aucun binaire : il référence des sorties, des looks, des
// scènes et une Bible. Changer de profil **ne supprime rien** : les éléments du
// précédent restent sur disque et peuvent être réappliqués.
//
// Trois profils sont livrés et créés à la première ouverture du projet (EF-20.13).

import fs from 'node:fs/promises';
import path from 'node:path';
import { projectDir } from './paths.mjs';
import { readJson, writeJson, exists } from './json-store.mjs';
import { list, get, put, remove, readOutputs, writeOutputs, fileFor } from './library.mjs';
import { readProject, patchSettings } from './project.mjs';
import { sceneFromPreset, normalizeScene } from './scene.mjs';
import { DEFAULT_SETTINGS } from './split.mjs';

export const PROFILE_KINDS = ['church', 'conference', 'stream', 'school', 'custom'];
export const PROFILE_ICONS = ['church', 'mic', 'video', 'graduation', 'star'];

const KINDS = ['bible', 'songs', 'media', 'announcements', 'lowerthird', 'timer', 'plan'];

/** Sortie complète telle qu'un profil la décrit (§ 13.2). */
function output(ref, overrides = {}) {
  return {
    ref,
    name: ref,
    preset: 'full',
    width: 1920,
    height: 1080,
    fit: 'contain',
    transparent: false,
    receives: Object.fromEntries(KINDS.map((kind) => [kind, true])),
    ...overrides
  };
}

const CHURCH = {
  id: 'prof_eglise',
  rev: 1,
  name: 'Église',
  kind: 'church',
  description: 'Projecteur de salle + bandeau pour le stream.',
  color: '#f5b942',
  icon: 'church',
  outputs: [
    output('out_full', { name: 'Plein écran — Salle' }),
    output('out_bottom', {
      name: 'Bas centré — Stream',
      preset: 'bottom',
      transparent: true,
      receives: { bible: true, songs: true, media: false, announcements: true, lowerthird: true, timer: true, plan: true }
    })
  ],
  looks: ['look_sobre', 'look_festif'],
  defaultLook: 'look_sobre',
  bibles: { primary: null, secondary: null, showTwoVersions: false },
  stage: { enabled: true, timerLabel: 'Prédication', defaultMinutes: 35, warnMinutes: 5, criticalMinutes: 1, showChords: true, messageHistorySize: 5 },
  planTemplate: 'plan_culte_type',
  keyboardProfile: 'standard',
  splitDefaults: { bible: { maxWordsPerScreen: 25, splitBy: 'words' }, songs: { maxWordsPerScreen: 30, splitBy: 'words' } }
};

const CONFERENCE = {
  id: 'prof_conference',
  rev: 1,
  name: 'Conférence',
  kind: 'conference',
  description: 'Salle, retour scène et bandeau stream pour une journée de sessions.',
  color: '#38bdf8',
  icon: 'mic',
  outputs: [
    output('out_full', { name: 'Plein écran — Salle' }),
    output('out_stage', {
      name: 'Retour scène',
      width: 1280,
      height: 720,
      receives: { bible: true, songs: true, media: true, announcements: false, lowerthird: false, timer: true, plan: true }
    }),
    output('out_bottom', {
      name: 'Bas centré — Stream',
      preset: 'bottom',
      transparent: true,
      receives: { bible: true, songs: true, media: false, announcements: true, lowerthird: true, timer: false, plan: true }
    })
  ],
  looks: ['look_moderne', 'look_minimal', 'look_cinema'],
  defaultLook: 'look_moderne',
  bibles: { primary: null, secondary: null, showTwoVersions: false },
  stage: { enabled: true, timerLabel: 'Session', defaultMinutes: 45, warnMinutes: 5, criticalMinutes: 1, showChords: false, messageHistorySize: 5 },
  planTemplate: 'plan_conference_sessions',
  keyboardProfile: 'standard',
  splitDefaults: { bible: { maxWordsPerScreen: 22, splitBy: 'words' }, songs: { maxWordsPerScreen: 30, splitBy: 'words' } }
};

const STREAM = {
  id: 'prof_stream',
  rev: 1,
  name: 'Stream live',
  kind: 'stream',
  description: 'Bandeau étroit, habillage et médias plein écran pour un direct.',
  color: '#e879f9',
  icon: 'video',
  outputs: [
    output('out_stream', {
      name: 'Bandeau stream',
      preset: 'bottom',
      transparent: true,
      receives: { bible: true, songs: true, media: false, announcements: true, lowerthird: true, timer: true, plan: true }
    }),
    output('out_lower', {
      name: 'Habillage',
      preset: 'lowerthird',
      transparent: true,
      receives: { bible: false, songs: false, media: false, announcements: false, lowerthird: true, timer: true, plan: false }
    }),
    output('out_media', {
      name: 'Médias plein écran',
      receives: { bible: false, songs: false, media: true, announcements: false, lowerthird: false, timer: false, plan: false }
    })
  ],
  looks: ['look_cinema', 'look_neon'],
  defaultLook: 'look_cinema',
  bibles: { primary: null, secondary: null, showTwoVersions: false },
  stage: { enabled: false, timerLabel: 'Direct', defaultMinutes: 0, warnMinutes: 5, criticalMinutes: 1, showChords: false, messageHistorySize: 3 },
  planTemplate: 'plan_direct',
  keyboardProfile: 'standard',
  splitDefaults: { bible: { maxWordsPerScreen: 18, splitBy: 'words' }, songs: { maxWordsPerScreen: 24, splitBy: 'words' } }
};

/** Les trois profils du § 13.3, prêts à l'emploi. */
export function builtinProfiles() {
  return [structuredClone(CHURCH), structuredClone(CONFERENCE), structuredClone(STREAM)];
}

// ---------------------------------------------------------------------------
// Looks livrés : une copie de scène par look, teintée différemment
// ---------------------------------------------------------------------------

const LOOK_STYLES = {
  look_sobre: { name: 'Sobre', accent: '#f5b942', background: '#0b1020' },
  look_festif: { name: 'Festif', accent: '#f97316', background: '#1a0f06' },
  look_moderne: { name: 'Moderne', accent: '#38bdf8', background: '#071018' },
  look_minimal: { name: 'Minimal', accent: '#e2e8f0', background: '#0a0a0c' },
  look_cinema: { name: 'Cinéma', accent: '#e879f9', background: '#0b0614' },
  look_neon: { name: 'Néon', accent: '#22d3ee', background: '#050b12' }
};

/** Construit les looks livrés (scènes embarquées, aucune référence externe). */
export function builtinLooks() {
  return Object.entries(LOOK_STYLES).map(([id, style]) => {
    const bibleFull = sceneFromPreset({ id: `${id}_bible_full`, name: `${style.name} — Bible`, kind: 'bible', preset: 'full' });
    const songsFull = sceneFromPreset({ id: `${id}_songs_full`, name: `${style.name} — Chants`, kind: 'songs', preset: 'full' });
    const bibleBottom = sceneFromPreset({ id: `${id}_bible_bottom`, name: `${style.name} — Bible (bandeau)`, kind: 'bible', preset: 'bottom' });
    for (const scene of [bibleFull, songsFull, bibleBottom]) {
      scene.accentColor = style.accent;
      if (!scene.transparent) scene.bgColor = style.background;
    }
    return {
      id,
      rev: 1,
      name: style.name,
      description: `Look livré · ${style.name}`,
      scenes: {
        bible: { sceneId: bibleFull.id, embed: bibleFull },
        songs: { sceneId: songsFull.id, embed: songsFull },
        'bible:bottom': { sceneId: bibleBottom.id, embed: bibleBottom }
      }
    };
  });
}

/**
 * Profils disponibles : les trois profils livrés (EF-20.13) **plus** ceux enregistrés
 * dans `project/library/profiles`. Les profils livrés ne sont pas écrits sur disque à
 * la création du projet : un projet neuf reste vide, et un profil livré est matérialisé
 * dès qu'il est modifié, dupliqué ou exporté.
 */
export async function allProfiles() {
  const stored = await list('profiles');
  const byId = new Map(builtinProfiles().map((profile) => [profile.id, profile]));
  for (const profile of stored) byId.set(profile.id, profile);
  return [...byId.values()];
}

/** Looks disponibles : livrés puis enregistrés (un look du projet gagne sur un livré). */
export async function allLooks() {
  const stored = await list('looks');
  const byId = new Map(builtinLooks().map((look) => [look.id, look]));
  for (const look of stored) byId.set(look.id, look);
  return [...byId.values()];
}

// ---------------------------------------------------------------------------
// Lecture, validation, capture
// ---------------------------------------------------------------------------

export async function listProfiles() {
  const profiles = await allProfiles();
  const project = await readProject();
  const active = project?.settings?.activeProfileId || null;
  return profiles.map((profile) => toSummary(profile, active));
}

export function toSummary(profile, activeId) {
  return {
    id: profile.id,
    rev: profile.rev || 1,
    name: profile.name,
    kind: profile.kind,
    description: profile.description || '',
    color: profile.color || '#f5b942',
    icon: profile.icon || 'star',
    outputs: (profile.outputs || []).length,
    looks: (profile.looks || []).length,
    looksList: profile.looks || [],
    defaultLook: profile.defaultLook || null,
    active: profile.id === activeId
  };
}

/** Valide un profil reçu du client et complète les valeurs manquantes (EF-20.12). */
export function normalizeProfile(input = {}) {
  const profile = {
    id: /^prof_[a-z0-9_]{2,40}$/.test(input.id || '') ? input.id : `prof_${Math.random().toString(36).slice(2, 10)}`,
    rev: Number.isInteger(input.rev) ? input.rev : 1,
    name: String(input.name || 'Profil').slice(0, 80),
    kind: PROFILE_KINDS.includes(input.kind) ? input.kind : 'custom',
    description: String(input.description || '').slice(0, 240),
    color: /^#[0-9a-f]{6}$/i.test(input.color || '') ? input.color : '#f5b942',
    icon: PROFILE_ICONS.includes(input.icon) ? input.icon : 'star',
    outputs: (Array.isArray(input.outputs) ? input.outputs : []).slice(0, 12).map((entry) => ({
      ref: String(entry?.ref || '').slice(0, 48),
      name: String(entry?.name || entry?.ref || 'Sortie').slice(0, 80),
      preset: entry?.preset || 'full',
      width: Number(entry?.width) || 1920,
      height: Number(entry?.height) || 1080,
      fit: entry?.fit || 'contain',
      transparent: Boolean(entry?.transparent),
      receives: { ...Object.fromEntries(KINDS.map((kind) => [kind, true])), ...(entry?.receives || {}) },
      ...(entry?.scenesByKind ? { scenesByKind: entry.scenesByKind } : {})
    })),
    looks: (Array.isArray(input.looks) ? input.looks : []).slice(0, 24).map((id) => String(id).slice(0, 48)),
    defaultLook: input.defaultLook ? String(input.defaultLook).slice(0, 48) : null,
    bibles: {
      primary: input.bibles?.primary || null,
      secondary: input.bibles?.secondary || null,
      showTwoVersions: Boolean(input.bibles?.showTwoVersions)
    },
    stage: {
      enabled: input.stage?.enabled !== false,
      timerLabel: String(input.stage?.timerLabel || 'Prédication').slice(0, 40),
      defaultMinutes: Number(input.stage?.defaultMinutes) || 0,
      warnMinutes: Number(input.stage?.warnMinutes) || 5,
      criticalMinutes: Number(input.stage?.criticalMinutes) || 1,
      showChords: Boolean(input.stage?.showChords),
      messageHistorySize: Number(input.stage?.messageHistorySize) || 5
    },
    planTemplate: input.planTemplate ? String(input.planTemplate).slice(0, 48) : null,
    keyboardProfile: input.keyboardProfile === 'presentation' ? 'presentation' : 'standard',
    splitDefaults: {
      bible: { ...DEFAULT_SETTINGS, ...(input.splitDefaults?.bible || {}) },
      songs: { ...DEFAULT_SETTINGS, ...(input.splitDefaults?.songs || {}) }
    }
  };
  return profile;
}

export async function getProfile(id) {
  const stored = await get('profiles', id);
  if (stored) return stored;
  return builtinProfiles().find((profile) => profile.id === id) || null;
}

export async function getLook(id) {
  const stored = await get('looks', id);
  if (stored) return stored;
  return builtinLooks().find((look) => look.id === id) || null;
}

/** Enregistre un profil (création ou mise à jour, révision vérifiée). */
export async function saveProfile(input) {
  const profile = normalizeProfile(input);
  const saved = await put('profiles', profile.id, profile);
  return saved;
}

/** « Enregistrer la configuration actuelle comme profil » (EF-20.4). */
export async function captureProfile({ name, kind = 'custom', color, icon } = {}) {
  const [outputs, project, looks] = await Promise.all([readOutputs(), readProject(), list('looks')]);
  return normalizeProfile({
    name: name || 'Configuration actuelle',
    kind,
    color,
    icon,
    outputs: (outputs.outputs || []).map((entry) => ({
      ref: entry.id,
      name: entry.name,
      preset: entry.preset,
      width: entry.width,
      height: entry.height,
      fit: entry.fit,
      transparent: entry.transparent,
      receives: entry.receives,
      ...(entry.scenesByKind ? { scenesByKind: entry.scenesByKind } : {})
    })),
    looks: looks.map((look) => look.id),
    defaultLook: looks[0]?.id || null,
    bibles: {
      primary: project?.settings?.defaultBibleId || null,
      secondary: null,
      showTwoVersions: Boolean(project?.settings?.showTwoVersions)
    },
    stage: project?.settings?.stage || undefined,
    splitDefaults: project?.settings?.splitDefaults || undefined
  });
}

/** Duplique un profil : « X (copie) » (EF-20.5). */
export async function duplicateProfile(id) {
  const source = await getProfile(id);
  if (!source) throw Object.assign(new Error("Ce profil n'existe plus."), { code: 'NOT_FOUND' });
  const copy = {
    ...structuredClone(source),
    id: `prof_${Math.random().toString(36).slice(2, 10)}`,
    rev: 1,
    name: `${source.name} (copie)`.slice(0, 80)
  };
  await put('profiles', copy.id, copy);
  return copy;
}

/**
 * Applique un profil (§ 13.5.1).
 * @param {string} id
 * @param {{force?: boolean, onAir?: boolean}} [options]
 */
export async function applyProfile(id, { force = false, onAir = false } = {}) {
  const profile = await getProfile(id);
  if (!profile) throw Object.assign(new Error("Ce profil n'existe pas."), { code: 'NOT_FOUND' });

  if (onAir && !force) {
    const err = Object.assign(new Error(
      'TXT: Appliquer le profil « ' + profile.name + ' » ?\n\n'
      + "     Cette action va couper ce qui est à l'antenne\n"
      + '     puis remplacer la configuration des sorties.\n\n'
      + '     Vos scènes et looks actuels sont conservés :\n'
      + '     ils pourront être réappliqués à tout moment.\n\n'
      + '     [A] Appliquer      [Annuler]'
    ), { code: 'LIVE_CONFIRM', requiresConfirmation: true });
    throw err;
  }

  const before = await readOutputs();
  const projectBefore = await readProject();
  const warnings = [];
  const missing = { looks: [], scenes: [], bibles: [], outputs: [] };

  // 1. Les looks cités doivent exister (EF-20.11) : les absents sont ignorés.
  const knownLooks = new Set((await allLooks()).map((look) => look.id));
  const looks = (profile.looks || []).filter((lookId) => {
    if (knownLooks.has(lookId)) return true;
    missing.looks.push(lookId);
    return false;
  });

  const scenes = new Map((await list('scenes')).map((scene) => [scene.id, scene]));

  try {
    // 3. Créer ou mettre à jour les sorties listées.
    const next = { rev: before.rev || 1, outputs: structuredClone(before.outputs || []) };
    const created = [];
    const updated = [];
    const mentioned = new Set();

    for (const spec of profile.outputs || []) {
      mentioned.add(spec.ref);
      const existing = next.outputs.find((entry) => entry.id === spec.ref);
      const base = {
        id: spec.ref,
        name: spec.name,
        preset: spec.preset,
        width: spec.width,
        height: spec.height,
        fit: spec.fit,
        transparent: spec.transparent,
        receives: spec.receives,
        enabled: true,
        targetByDefault: true,
        scenesByKind: {}
      };
      if (existing) {
        Object.assign(existing, {
          ...base,
          scenesByKind: existing.scenesByKind || {},
          notes: existing.notes
        });
        updated.push(spec.ref);
      } else {
        next.outputs.push(base);
        created.push(spec.ref);
      }
      const target = next.outputs.find((entry) => entry.id === spec.ref);
      // 4. Scènes par type : une référence absente est retirée du profil appliqué.
      for (const [kind, sceneId] of Object.entries(spec.scenesByKind || {})) {
        if (scenes.has(sceneId)) target.scenesByKind[kind] = sceneId;
        else {
          missing.scenes.push(sceneId);
          if (target.scenesByKind[kind]) delete target.scenesByKind[kind];
        }
      }
    }

    // Les sorties non mentionnées ne sont pas supprimées : elles sont désactivées.
    const disabled = [];
    for (const outputEntry of next.outputs) {
      if (mentioned.has(outputEntry.id)) continue;
      if (outputEntry.enabled === false) continue;
      outputEntry.enabled = false;
      outputEntry.notes = `Désactivée par le profil « ${profile.name} ».`;
      disabled.push(outputEntry.id);
    }

    // Look par défaut : ses scènes embarquées sont **copiées** dans le projet (EF-20.15).
    const appliedLook = profile.defaultLook && looks.includes(profile.defaultLook)
      ? await getLook(profile.defaultLook)
      : null;
    const copiedScenes = [];
    if (appliedLook) {
      for (const [key, entry] of Object.entries(appliedLook.scenes || {})) {
        const [kind, variant] = key.split(':');
        if (!entry?.embed) continue;
        const copy = await copySceneIntoProject(
          entry.embed,
          `${appliedLook.name} — ${kind}${variant === 'bottom' ? ' (bandeau)' : ''}`,
          kind
        );
        copiedScenes.push(copy.id);
        // La variante « bandeau » va aux sorties en bandeau, la variante pleine
        // largeur aux autres : une sortie ne reçoit jamais la scène de l'autre format.
        const candidates = next.outputs.filter((outputEntry) => mentioned.has(outputEntry.id)
          && outputEntry.receives?.[kind]);
        const exact = candidates.filter((outputEntry) =>
          (variant === 'bottom' ? outputEntry.preset === 'bottom' : outputEntry.preset !== 'bottom'));
        // Repli : un type sans variante adaptée (ex. chant sur un bandeau) reçoit la
        // scène du look plutôt que de garder une scène d'un autre profil.
        const targets = exact.length
          ? exact
          : (variant === 'bottom' ? [] : candidates.filter((outputEntry) => !outputEntry.scenesByKind?.[kind]));
        for (const outputEntry of targets) {
          outputEntry.scenesByKind = { ...(outputEntry.scenesByKind || {}), [kind]: copy.id };
        }
      }
    }

    // 2 + 5 + 7. Écriture atomique : la configuration précédente est restaurée en cas d'échec.
    next.outputs = next.outputs.slice(0, 32);
    await writeOutputs(next);

    const patch = { activeProfileId: profile.id };
    if (profile.bibles?.primary) {
      const bible = await get('bibles', profile.bibles.primary);
      if (bible) patch.defaultBibleId = bible.id;
      else missing.bibles.push(profile.bibles.primary);
    }
    patch.stage = profile.stage;
    patch.splitDefaults = profile.splitDefaults;
    await patchSettings(patch);

    return {
      applied: true,
      profile: toSummary(profile, profile.id),
      outputs: { created, updated, disabled, total: next.outputs.length },
      looks: { applied: appliedLook?.name || null, available: looks },
      scenes: { copied: copiedScenes },
      missing,
      warnings,
      previous: { activeProfileId: projectBefore?.settings?.activeProfileId || null }
    };
  } catch (err) {
    // Restauration : aucune modification partielle ne reste sur disque.
    await writeOutputs({ rev: (before.rev || 1) + 1, outputs: before.outputs || [] }).catch(() => {});
    if (projectBefore) await patchSettings({ activeProfileId: projectBefore.settings?.activeProfileId || null }).catch(() => {});
    throw err;
  }
}

/** Copie une scène embarquée dans `project/scenes`, avec un identifiant neuf. */
async function copySceneIntoProject(embed, name, kind) {
  const scene = normalizeScene({
    ...structuredClone(embed),
    id: `scn_${kind}_${Math.random().toString(36).slice(2, 8)}`,
    rev: 1,
    name: name.slice(0, 60),
    kind
  });
  await put('scenes', scene.id, scene);
  return scene;
}

/** Supprime un profil. Refuse si c'est le profil actif (il faut en appliquer un autre). */
export async function removeProfile(id) {
  const project = await readProject();
  if (project?.settings?.activeProfileId === id) {
    throw Object.assign(new Error('Ce profil est actif : appliquez-en un autre avant de le supprimer.'), {
      code: 'CONFLICT'
    });
  }
  const file = fileFor('profiles', id);
  if (!(await exists(file))) {
    throw Object.assign(new Error("Ce profil n'existe plus."), { code: 'NOT_FOUND' });
  }
  await remove('profiles', id);
  return { id, removed: true };
}

/** Export JSON d'un profil, sans binaire (EF-20.6). */
export async function exportProfile(id) {
  const profile = await getProfile(id);
  if (!profile) throw Object.assign(new Error("Ce profil n'existe pas."), { code: 'NOT_FOUND' });
  const looks = await Promise.all((profile.looks || []).map(async (lookId) => {
    const look = await getLook(lookId);
    return look ? { ...look } : null;
  }));
  return {
    format: 'openpresenter.profile',
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    profile,
    looks: looks.filter(Boolean)
  };
}

/**
 * Import d'un profil (EF-20.8).
 * @param {object} bundle résultat de `exportProfile`
 * @param {{mode?: 'merge'|'copy'}} [options] `merge` met à jour un profil de même identifiant,
 *   `copy` crée toujours un nouveau profil à côté.
 */
export async function importProfile(bundle, { mode = 'copy' } = {}) {
  if (!bundle || bundle.format !== 'openpresenter.profile' || !bundle.profile) {
    throw Object.assign(new Error("Ce fichier n'est pas un profil OpenPresenter."), {
      code: 'VALIDATION',
      message: "TXT: Ce fichier n'est pas un profil OpenPresenter.\n     Attendu : un fichier .opprofile.json exporté depuis l'application."
    });
  }
  const incoming = normalizeProfile(bundle.profile);
  const existing = await getProfile(incoming.id);
  let profile = incoming;
  if (existing && mode === 'copy') {
    profile = { ...incoming, id: `prof_${Math.random().toString(36).slice(2, 10)}`, rev: 1, name: `${incoming.name} (copie)`.slice(0, 80) };
  } else if (existing && mode === 'merge') {
    profile = { ...incoming, id: existing.id, rev: (existing.rev || 1) + 1 };
  } else {
    profile = { ...incoming, rev: 1 };
  }

  // Les looks embarqués sont réutilisés s'ils existent, sinon recréés (aucun binaire).
  const importedLooks = [];
  for (const look of bundle.looks || []) {
    if (!look?.id || !/^look_[a-z0-9_]{2,40}$/.test(look.id)) continue;
    const known = await get('looks', look.id);
    if (!known) {
      await put('looks', look.id, { ...normalizeLook(look), rev: 1 });
      importedLooks.push(look.id);
    }
  }

  await put('profiles', profile.id, profile);
  return { profile, created: !existing || mode === 'copy', looks: importedLooks, merged: Boolean(existing && mode === 'merge') };
}

function normalizeLook(look) {
  return {
    id: look.id,
    name: String(look.name || 'Look').slice(0, 60),
    description: String(look.description || '').slice(0, 160),
    scenes: look.scenes && typeof look.scenes === 'object' ? look.scenes : {}
  };
}

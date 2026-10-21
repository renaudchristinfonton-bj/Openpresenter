// Modèle de scène (ch. 08) : presets, valeurs par défaut, bornes, validation.
// Les bornes géométriques sont celles d'EF-09.3 / EF-09.4 : un calque ne peut
// jamais disparaître entièrement du canevas.

import { newLayerId as makeLayerId, randomHex } from './ids.mjs';

export { newLayerId } from './ids.mjs';

export const KINDS = ['bible', 'songs', 'media', 'announcements', 'lowerthird', 'timer', 'plan'];
export const PRESETS = ['full', 'screen80', 'bottom', 'bottom-right', 'lowerthird', 'custom'];
export const TRANSITIONS = ['none', 'fade', 'zoom', 'slide-up', 'slide-down', 'slide-left', 'slide-right', 'wipe', 'blur'];
export const LAYER_TYPES = ['background', 'overlay', 'text', 'image', 'group'];

export const SPLIT_DEFAULTS = {
  splitMode: 'auto',
  splitBy: 'words',
  maxWordsPerScreen: 25,
  maxCharsPerScreen: 165,
  maxLinesPerScreen: 3,
  minWordsPerPart: 3,
  balanceParts: true
};

export function newSceneId(kind, preset) {
  return `scn_${kind}_${String(preset).replace(/-/g, '_')}_${randomHex(3)}`;
}

/** Applique les bornes de géométrie (EF-09.3 / EF-09.4). */
export function clampLayer(layer) {
  const out = { ...layer };
  out.w = clamp(number(out.w, 100), 2, 300);
  out.h = out.h === null || out.h === undefined ? null : clamp(number(out.h, 100), 2, 300);
  const halfW = out.w / 2;
  out.x = clamp(number(out.x, 50), -halfW + 1, 100 + halfW - 1);
  const halfH = (out.h ?? 0) / 2;
  out.y = clamp(number(out.y, 50), -halfH + 1, 100 + halfH - 1);
  out.opacity = clamp(number(out.opacity, 1), 0, 1);
  out.rotate = clamp(number(out.rotate, 0), -180, 180);
  return out;
}

function number(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// ---------------------------------------------------------------------------
// Calques par défaut
// ---------------------------------------------------------------------------

export function textLayer(overrides = {}) {
  return clampLayer({
    ...overrides,
    id: overrides.id || makeLayerId(),
    type: 'text',
    name: 'Texte',
    visible: true,
    locked: false,
    opacity: 1,
    x: 50, y: 50, w: 80, h: 30,
    rotate: 0,
    zIndex: null,
    blendMode: 'normal',
    bind: 'custom',
    customText: '',
    style: {
      fontFamily: 'Inter',
      fontSize: 40,
      weight: 600,
      color: '#ffffff',
      align: 'center',
      verticalAlign: 'center',
      alignLast: 'auto',
      textCase: 'none',
      letterSpacing: 0,
      wordSpacing: 0,
      lineHeight: 1.25,
      paragraphSpacing: 0,
      italic: false,
      bold: false,
      underline: false,
      strike: false,
      stroke: { enabled: false, color: '#000000', width: 2 },
      shadow: 4,
      padding: 0,
      bg: null,
      radius: 12
    },
    autoFit: { enabled: true, min: 16, max: 120, scaleDown: true, scaleUp: false },
    ...overrides
  });
}

export function backgroundLayer(overrides = {}) {
  return clampLayer({
    ...overrides,
    id: overrides.id || makeLayerId(),
    type: 'background',
    name: 'Fond',
    visible: true,
    locked: false,
    opacity: 1,
    x: 50, y: 50, w: 100, h: 100,
    rotate: 0,
    zIndex: null,
    blendMode: 'normal',
    forceVisible: false,
    source: {
      kind: 'color',
      color: '#05060a',
      fit: 'cover',
      position: 'center center',
      offsetX: 0,
      offsetY: 0,
      scale: 100,
      blur: 0,
      brightness: 100,
      contrast: 100,
      saturate: 100,
      grayscale: 0,
      tint: '#000000',
      tintOpacity: 0,
      loop: true,
      muted: true,
      playbackRate: 1,
      color1: '#0a0d16',
      color2: '#05060a',
      gradientType: 'linear',
      gradientAngle: 135,
      repeat: false
    },
    ...overrides
  });
}

export function overlayLayer(overrides = {}) {
  return clampLayer({
    ...overrides,
    id: overrides.id || makeLayerId(),
    type: 'overlay',
    name: 'Panneau',
    visible: true,
    locked: false,
    opacity: 1,
    x: 50, y: 84, w: 82, h: 24,
    rotate: 0,
    zIndex: null,
    blendMode: 'normal',
    shape: 'rounded',
    bg: 'rgba(8,10,16,.85)',
    radius: 18,
    border: { width: 0, color: '#f5b942', sides: [], style: 'solid' },
    cornerRadiusPerCorner: null,
    ...overrides
  });
}

export function imageLayer(overrides = {}) {
  return clampLayer({
    ...overrides,
    id: overrides.id || makeLayerId(),
    type: 'image',
    name: 'Image',
    visible: true,
    locked: false,
    opacity: 1,
    x: 12, y: 12, w: 14, h: 18,
    rotate: 0,
    zIndex: null,
    blendMode: 'normal',
    bind: null,
    assetId: null,
    fit: 'contain',
    radius: 0,
    radiusPerCorner: null,
    crop: { top: 0, right: 0, bottom: 0, left: 0 },
    flipH: false,
    flipV: false,
    ...overrides
  });
}

// ---------------------------------------------------------------------------
// Presets de scène
// ---------------------------------------------------------------------------

/**
 * Construit une scène complète à partir d'un preset de disposition.
 * Le preset ne fait qu'**initialiser** les calques (EF-07.3) : ils sont ensuite
 * indépendants.
 */
export function sceneFromPreset({ id, name, kind = 'bible', preset = 'full', transparent }) {
  const isTransparent = transparent ?? (preset === 'bottom' || preset === 'bottom-right' || preset === 'lowerthird');
  const base = {
    id: id || newSceneId(kind, preset),
    rev: 1,
    name: name || `Scène ${kind} — ${preset}`,
    kind,
    preset,
    transparent: isTransparent,
    bgColor: isTransparent ? 'rgba(0,0,0,0)' : '#05060a',
    accentColor: '#f5b942',
    textColor: '#ffffff',
    shapeRadius: 18,
    ...SPLIT_DEFAULTS,
    transitionIn: 'fade',
    transitionOut: 'fade',
    transitionDurationMs: 250,
    showPartsHint: true,
    safeArea: 0,
    layers: []
  };

  const layers = [];

  if (!isTransparent) {
    layers.push(backgroundLayer({
      name: 'Fond',
      source: {
        ...backgroundLayer().source,
        kind: 'gradient',
        color1: '#0b1020',
        color2: '#04060c',
        gradientAngle: 145,
        tint: '#000000',
        tintOpacity: 0
      }
    }));
  }

  if (preset === 'full' || preset === 'screen80') {
    layers.push(textLayer({
      name: 'Verset',
      bind: 'verse',
      x: 50, y: 52, w: 78, h: 46,
      style: {
        ...textLayer().style,
        fontSize: preset === 'full' ? 84 : 76,
        lineHeight: 1.22,
        align: 'center',
        verticalAlign: 'center'
      },
      autoFit: { enabled: true, min: 24, max: 120, scaleDown: true, scaleUp: false }
    }));
    layers.push(textLayer({
      name: 'Référence',
      bind: 'ref',
      x: 50, y: 88, w: 60, h: 7,
      style: {
        ...textLayer().style,
        fontSize: 34,
        color: '#f5b942',
        textCase: 'uppercase',
        letterSpacing: 2,
        verticalAlign: 'center'
      },
      autoFit: { enabled: true, min: 18, max: 48, scaleDown: true, scaleUp: false }
    }));
  } else {
    // Bandeau : panneau semi-transparent + texte par-dessus.
    layers.push(overlayLayer({
      name: 'Bandeau',
      x: preset === 'bottom-right' ? 68 : 50,
      y: 84,
      w: preset === 'bottom-right' ? 58 : 84,
      h: preset === 'lowerthird' ? 20 : 26,
      bg: 'rgba(6,8,14,.84)',
      radius: 18,
      border: { width: 6, color: '#f5b942', sides: ['left'], style: 'solid' }
    }));
    layers.push(textLayer({
      name: 'Verset',
      bind: 'verse',
      x: preset === 'bottom-right' ? 68 : 50,
      y: preset === 'lowerthird' ? 85 : 83,
      w: preset === 'bottom-right' ? 52 : 78,
      h: 15,
      style: {
        ...textLayer().style,
        fontSize: 44,
        lineHeight: 1.28,
        align: 'center',
        verticalAlign: 'center'
      },
      autoFit: { enabled: true, min: 20, max: 72, scaleDown: true, scaleUp: false }
    }));
    layers.push(textLayer({
      name: 'Référence',
      bind: 'ref',
      x: preset === 'bottom-right' ? 68 : 50,
      y: 93,
      w: preset === 'bottom-right' ? 52 : 78,
      h: 5,
      style: {
        ...textLayer().style,
        fontSize: 24,
        color: '#f5b942',
        align: 'right',
        textCase: 'uppercase',
        letterSpacing: 2,
        verticalAlign: 'center'
      },
      autoFit: { enabled: true, min: 14, max: 34, scaleDown: true, scaleUp: false }
    }));
    layers.push(textLayer({
      name: 'Version',
      bind: 'badge',
      x: 88, y: 93, w: 12, h: 5,
      style: {
        ...textLayer().style,
        fontSize: 20,
        color: '#8b93a5',
        align: 'right',
        verticalAlign: 'center'
      },
      autoFit: { enabled: false, min: 12, max: 24, scaleDown: true, scaleUp: false }
    }));
  }

  return { ...base, layers };
}

/** Scènes créées avec un projet : une par sortie et par type courant. */
export function defaultScenes() {
  return [
    { outputId: 'out_full', kind: 'bible', scene: sceneFromPreset({ id: 'scn_bible_full', name: 'Plein écran — Bible', kind: 'bible', preset: 'full' }) },
    { outputId: 'out_bottom', kind: 'bible', scene: sceneFromPreset({ id: 'scn_bible_bottom', name: 'Bas centré — Bible', kind: 'bible', preset: 'bottom' }) },
    { outputId: 'out_full', kind: 'songs', scene: sceneFromPreset({ id: 'scn_songs_full', name: 'Plein écran — Chants', kind: 'songs', preset: 'full' }) },
    { outputId: 'out_bottom', kind: 'songs', scene: sceneFromPreset({ id: 'scn_songs_bottom', name: 'Bas centré — Chants', kind: 'songs', preset: 'bottom' }) }
  ];
}

// ---------------------------------------------------------------------------
// Normalisation et validation
// ---------------------------------------------------------------------------

/** Complète et borne une scène reçue du client. */
export function normalizeScene(input) {
  const scene = { ...input };
  scene.kind = KINDS.includes(scene.kind) ? scene.kind : 'bible';
  scene.preset = PRESETS.includes(scene.preset) ? scene.preset : 'full';
  scene.transparent = Boolean(scene.transparent);
  scene.transitionIn = TRANSITIONS.includes(scene.transitionIn) ? scene.transitionIn : 'fade';
  scene.transitionOut = TRANSITIONS.includes(scene.transitionOut) ? scene.transitionOut : 'fade';
  scene.transitionDurationMs = clamp(number(scene.transitionDurationMs, 250), 80, 2000);
  scene.safeArea = [0, 5, 10].includes(Number(scene.safeArea)) ? Number(scene.safeArea) : 0;
  scene.showPartsHint = scene.showPartsHint !== false;
  for (const key of Object.keys(SPLIT_DEFAULTS)) {
    if (scene[key] === undefined) scene[key] = SPLIT_DEFAULTS[key];
  }
  // Un calque de type inconnu est **conservé** : c'est `validateScene()` qui le
  // signale. L'effacer ici masquerait une scène corrompue.
  const givenLayers = Array.isArray(input.layers) ? input.layers : null;
  scene.layers = (givenLayers || [])
    .filter((layer) => layer && typeof layer === 'object')
    .map((layer) => {
      const normalized = clampLayer({
        ...layer,
        id: /^lyr_[a-z0-9_]{2,40}$/.test(layer.id || '') ? layer.id : makeLayerId(),
        visible: layer.visible !== false,
        locked: Boolean(layer.locked)
      });
      if (normalized.type === 'text') {
        normalized.bind = normalized.bind || 'custom';
        normalized.style = { ...textLayer().style, ...(layer.style || {}) };
        normalized.autoFit = { ...textLayer().autoFit, ...(layer.autoFit || {}) };
      }
      if (normalized.type === 'group') {
        normalized.children = (layer.children || []).slice(0, 50);
      }
      return normalized;
    });
  // Scène neuve (aucune liste de calques fournie) : on part du preset.
  if (givenLayers === null) {
    scene.layers = sceneFromPreset({ id: scene.id, name: scene.name, kind: scene.kind, preset: scene.preset }).layers;
  }
  return scene;
}

/**
 * Validation structurelle minimale, en miroir de `scene.schema.json` (annexe 24.7).
 * @returns {{ok: boolean, errors: {path: string, message: string}[]}}
 */
export function validateScene(scene) {
  const errors = [];
  const push = (path, message) => errors.push({ path, message });

  if (!scene || typeof scene !== 'object') return { ok: false, errors: [{ path: '', message: 'scène absente' }] };
  if (!/^scn_[a-z0-9_]{3,40}$/.test(scene.id || '')) push('/id', 'identifiant de scène invalide');
  if (!scene.name || String(scene.name).length > 80) push('/name', 'nom manquant ou trop long');
  if (!KINDS.includes(scene.kind)) push('/kind', 'type de contenu inconnu');
  if (!Array.isArray(scene.layers) || !scene.layers.length) push('/layers', 'au moins un calque est requis');

  for (const [i, layer] of (scene.layers || []).entries()) {
    const at = `/layers/${i}`;
    if (!/^lyr_[a-z0-9_]{2,40}$/.test(layer.id || '')) push(`${at}/id`, 'identifiant de calque invalide');
    if (!LAYER_TYPES.includes(layer.type)) push(`${at}/type`, 'type de calque inconnu');
    if (layer.opacity < 0 || layer.opacity > 1) push(`${at}/opacity`, 'opacité hors bornes');
    if (layer.w < 2 || layer.w > 300) push(`${at}/w`, 'largeur hors bornes');
    if (layer.h !== null && (layer.h < 2 || layer.h > 300)) push(`${at}/h`, 'hauteur hors bornes');
    if (layer.type === 'text') {
      if (!layer.bind) push(`${at}/bind`, 'liaison manquante');
      if (!layer.style?.fontSize) push(`${at}/style/fontSize`, 'taille de police manquante');
      if (!['left', 'center', 'right', 'justify'].includes(layer.style?.align)) push(`${at}/style/align`, 'alignement inconnu');
      if (!['top', 'center', 'bottom'].includes(layer.style?.verticalAlign)) push(`${at}/style/verticalAlign`, 'alignement vertical inconnu');
    }
  }
  return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Opérations sur les calques (utilisées par l'éditeur)
// ---------------------------------------------------------------------------

export function addLayer(scene, layer) {
  return { ...scene, layers: [...scene.layers, clampLayer(layer)] };
}

export function removeLayer(scene, layerId) {
  return { ...scene, layers: scene.layers.filter((l) => l.id !== layerId) };
}

export function duplicateLayer(scene, layerId) {
  const source = scene.layers.find((l) => l.id === layerId);
  if (!source) return scene;
  const copy = clampLayer({
    ...structuredClone(source),
    id: makeLayerId(),
    name: `${source.name} (copie)`,
    x: source.x + 2,
    y: source.y + 2
  });
  return { ...scene, layers: [...scene.layers, copy] };
}

/** Déplace un calque d'un niveau ([ ou ]). */
export function moveLayer(scene, layerId, delta) {
  const index = scene.layers.findIndex((l) => l.id === layerId);
  if (index < 0) return scene;
  const target = clamp(index + delta, 0, scene.layers.length - 1);
  if (target === index) return scene;
  const layers = [...scene.layers];
  const [item] = layers.splice(index, 1);
  layers.splice(target, 0, item);
  return { ...scene, layers };
}

/** Envoie au fond ou au premier plan (Ctrl + [ / ]). */
export function sendToEdge(scene, layerId, edge) {
  const layer = scene.layers.find((l) => l.id === layerId);
  if (!layer) return scene;
  const others = scene.layers.filter((l) => l.id !== layerId);
  return {
    ...scene,
    layers: edge === 'back' ? [layer, ...others] : [...others, layer]
  };
}

export function updateLayer(scene, layerId, patch) {
  return {
    ...scene,
    layers: scene.layers.map((l) => (l.id === layerId ? clampLayer({ ...l, ...patch }) : l))
  };
}

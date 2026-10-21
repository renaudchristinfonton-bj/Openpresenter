// Contraste WCAG (A-10e) : vérifie qu'un texte reste lisible sur son fond.

/** Convertit `#rgb`, `#rrggbb`, `rgb()`, `rgba()` en {r,g,b,a} (0-255, a 0-1). */
export function parseColor(input) {
  if (!input || typeof input !== 'string') return null;
  const value = input.trim().toLowerCase();
  if (value === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  let m = /^#([0-9a-f]{3,8})$/i.exec(value);
  if (m) {
    let hex = m[1];
    if (hex.length === 3 || hex.length === 4) hex = [...hex].map((c) => c + c).join('');
    if (hex.length !== 6 && hex.length !== 8) return null;
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1
    };
  }
  m = /^rgba?\(([^)]+)\)$/.exec(value);
  if (m) {
    const parts = m[1].split(/[,/\s]+/).filter(Boolean).map(Number);
    if (parts.length < 3 || parts.some((n) => !Number.isFinite(n))) return null;
    return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
  }
  return null;
}

/**
 * Composition « source over » d'une couleur semi-transparente sur un fond opaque.
 * Accepte des chaînes (`'#000'`, `'rgba(0,0,0,.45)'`) comme des couleurs déjà
 * analysées, pour rester simple à appeler depuis l'éditeur.
 * @param {string|object} fg
 * @param {string|object} bg
 * @param {number} [alpha] force l'opacité du premier plan
 * @returns {{r:number,g:number,b:number,a:number}|null}
 */
export function composite(fg, bg, alpha) {
  const front = typeof fg === 'string' ? parseColor(fg) : fg;
  const back = typeof bg === 'string' ? parseColor(bg) : bg;
  if (!front || !back) return null;
  const a = alpha ?? front.a ?? 1;
  const mix = (x, y) => Math.round(x * a + y * (1 - a));
  return { r: mix(front.r, back.r), g: mix(front.g, back.g), b: mix(front.b, back.b), a: 1 };
}

function luminance({ r, g, b }) {
  const channel = (value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Rapport de contraste entre deux couleurs (1 → 21). Le fond doit être opaque. */
export function contrastRatio(colorA, colorB) {
  const a = typeof colorA === 'string' ? parseColor(colorA) : colorA;
  const b = typeof colorB === 'string' ? parseColor(colorB) : colorB;
  if (!a || !b) return null;
  const bgA = a.a < 1 ? composite(a, { r: 0, g: 0, b: 0 }) : a;
  const bgB = b.a < 1 ? composite(b, { r: 0, g: 0, b: 0 }) : b;
  const la = luminance(bgA);
  const lb = luminance(bgB);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Couleur de fond dominante d'un calque `background` (teinte comprise). */
export function backgroundBaseColor(source, fallback = '#000000') {
  if (!source) return fallback;
  if (source.kind === 'color') return source.color || fallback;
  if (source.kind === 'gradient') {
    // On retient la couleur la plus sombre : hypothèse pessimiste pour le contraste.
    const a = parseColor(source.color1 || fallback);
    const b = parseColor(source.color2 || fallback);
    if (!a) return source.color2 || fallback;
    if (!b) return source.color1 || fallback;
    return luminance(a) <= luminance(b) ? source.color1 : source.color2;
  }
  // Image ou vidéo : on ne peut pas mesurer, on retient la teinte si elle existe.
  if (source.tint) {
    const tint = parseColor(source.tint);
    if (tint && (source.tintOpacity ?? 0) > 0) {
      const base = composite({ ...tint, a: source.tintOpacity ?? 0 }, { r: 0, g: 0, b: 0 });
      return `rgb(${Math.round(base.r)}, ${Math.round(base.g)}, ${Math.round(base.b)})`;
    }
  }
  return fallback;
}

/**
 * Vérifie la lisibilité d'une scène : chaque calque texte doit atteindre le seuil
 * sur le fond réellement placé derrière lui.
 * @returns {{ok: boolean, results: {layerId: string, ratio: number, status: string}[]}}
 */
export function checkSceneContrast(scene, { min = 4.5 } = {}) {
  const layers = scene?.layers || [];
  const backdrop = layers.find((l) => l.type === 'background');
  const base = backgroundBaseColor(backdrop?.source, scene?.bgColor || '#000000');
  const results = [];
  for (const layer of layers) {
    if (layer.type !== 'text' || layer.style?.color === undefined) continue;
    // Les calques masqués ne sont pas mesurés.
    if (layer.visible === false) continue;
    const ratio = contrastRatio(layer.style.color, base);
    results.push({
      layerId: layer.id,
      name: layer.name,
      ratio: ratio === null ? null : Math.round(ratio * 100) / 100,
      status: ratio === null ? 'unknown' : ratio >= min ? 'ok' : 'low'
    });
  }
  return { ok: results.every((r) => r.status !== 'low'), base, min, results };
}

// Auto-ajustement du texte dans son calque (EF-09.29 → EF-09.33).
//
// Le calcul est **pur** : la mesure de largeur est injectée. Dans le navigateur
// (éditeur comme sortie) c'est `canvas.measureText` ; dans les tests, une fonction
// linéaire déterministe. Les deux vues appellent donc exactement le même algorithme.

export const MIN_FACTOR = 0.35; // EF-09.30 : en dessous, on découpe au lieu de réduire

/**
 * Estime le nombre de lignes d'un texte pour une taille de police donnée.
 * @param {string} text
 * @param {object} params
 * @param {number} params.fontSize
 * @param {number} params.boxWidth largeur utile en px
 * @param {(text: string, fontSize: number) => number} params.measureText
 */
export function countLines(text, { fontSize, boxWidth, measureText }) {
  if (!text) return 0;
  const paragraphs = String(text).split('\n');
  let lines = 0;
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) { lines += 1; continue; }
    let current = '';
    let used = 1;
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (measureText(candidate, fontSize) <= boxWidth || !current) {
        current = candidate;
      } else {
        used += 1;
        current = word;
      }
    }
    lines += used;
  }
  return lines;
}

/**
 * Cherche la plus grande taille de police qui tient dans la boîte.
 * @returns {{fontSize: number, factor: number, lines: number, fits: boolean, clamped: boolean}}
 */
export function computeAutoFit({
  text,
  style = {},
  label = '',
  boxWidth,
  boxHeight,
  measureText,
  autoFit = {}
}) {
  const base = Number(style.fontSize) || 40;
  const lineHeight = Number(style.lineHeight) || 1.2;
  const min = Number(autoFit.min) || 16;
  const max = Number(autoFit.max) || 120;
  const floor = Math.max(min, Math.floor(base * MIN_FACTOR));

  const heightFor = (size) => countLines(text, { fontSize: size, boxWidth, measureText }) * size * lineHeight;
  const measure = (size) => ({ size, height: heightFor(size) });

  const fits = (size) => measure(size).height <= boxHeight;

  // 1. Réduction (scaleDown) : pas de 2 px, jamais sous le plancher EF-09.30.
  if (autoFit.enabled !== false && autoFit.scaleDown !== false && !fits(base)) {
    let size = base;
    while (size > floor && !fits(size)) size -= 2;
    if (!fits(size)) {
      return { fontSize: size, factor: size / base, lines: countLines(text, { fontSize: size, boxWidth, measureText }), fits: false, clamped: true, label };
    }
    return { fontSize: size, factor: size / base, lines: countLines(text, { fontSize: size, boxWidth, measureText }), fits: true, clamped: size > floor };
  }

  // 2. Agrandissement (scaleUp) : seulement si demandé explicitement (EF-09.31).
  if (autoFit.scaleUp && autoFit.enabled !== false) {
    let size = base;
    while (size + 2 <= max && fits(size + 2)) size += 2;
    return { fontSize: size, factor: size / base, lines: countLines(text, { fontSize: size, boxWidth, measureText }), fits: true, clamped: false };
  }

  return { fontSize: base, factor: 1, lines: countLines(text, { fontSize: base, boxWidth, measureText }), fits: fits(base), clamped: false };
}

/**
 * Mesure Canvas 2D, avec repli déterministe si le contexte est indisponible.
 * Le repli sert aussi de `measureText` dans les tests hors navigateur.
 */
export function makeCanvasMeasure({ fontFamily = 'Inter', weight = 600, letterSpacing = 0 } = {}) {
  const fallback = (text, fontSize) => text.length * fontSize * 0.52 + text.length * letterSpacing;
  if (typeof document === 'undefined') return fallback;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return fallback;
  return (text, fontSize) => {
    ctx.font = `${weight} ${fontSize}px ${fontFamily}, sans-serif`;
    return ctx.measureText(text).width + text.length * letterSpacing;
  };
}

/** Mesure synthétique, utilisée par les tests (largeur ≈ 0,5 em par caractère). */
export const syntheticMeasure = (text, fontSize) => text.length * fontSize * 0.5;

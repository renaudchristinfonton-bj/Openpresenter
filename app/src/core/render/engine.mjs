// Moteur de rendu unique (ENF-42 / ch. 08 § 8.2).
//
// Le **même** module produit l'aperçu de l'éditeur, le canevas de l'éditeur et la
// page de sortie OBS/vMix. Aucune de ces vues n'a de code de rendu propre : c'est
// la condition du test A-10 (rendu pixel-identique).
//
// Module pur : il renvoie une chaîne HTML et une feuille de style. Il ne touche au
// DOM que dans `mountScene()`, appelée à l'identique par les deux vues.

import { resolveBind } from './content.mjs';
import { computeAutoFit, makeCanvasMeasure } from './autofit.mjs';

export const STAGE_WIDTH = 1920;
export const STAGE_HEIGHT = 1080;

const ALIGN_MAIN = { left: 'flex-start', center: 'center', right: 'flex-end', justify: 'stretch' };
const ALIGN_ITEMS = { top: 'flex-start', center: 'center', bottom: 'flex-end' };

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

const n = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback);

/** Position en pourcentage depuis le centre du calque (EF-09.2). */
export function layerBox(layer) {
  const w = n(layer.w, 100);
  const h = layer.h === null || layer.h === undefined ? null : n(layer.h, 100);
  return {
    left: n(layer.x, 50) - w / 2,
    top: n(layer.y, 50) - (h ?? 0) / 2,
    width: w,
    height: h
  };
}

function styleAttr(pairs) {
  return Object.entries(pairs)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}:${value}`)
    .join(';');
}

function shadowCss(shadow) {
  if (!shadow?.enabled) return '';
  const color = shadow.color || '#000000';
  const opacity = shadow.opacity ?? 0.5;
  const rgb = hexToRgb(color);
  const rgba = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})` : color;
  return `${n(shadow.offsetX)}px ${n(shadow.offsetY)}px ${n(shadow.blur)}px ${rgba}`;
}

function hexToRgb(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!m) return null;
  return {
    r: parseInt(m[1].slice(0, 2), 16),
    g: parseInt(m[1].slice(2, 4), 16),
    b: parseInt(m[1].slice(4, 6), 16)
  };
}

function commonAttrs(layer, box) {
  const transform = n(layer.rotate) ? `rotate(${n(layer.rotate)}deg)` : '';
  return {
    class: `op-layer op-${layer.type}`,
    'data-layer-id': layer.id,
    'data-layer-type': layer.type,
    style: styleAttr({
      left: `${box.left}%`,
      top: `${box.top}%`,
      width: `${box.width}%`,
      height: box.height === null ? undefined : `${box.height}%`,
      opacity: layer.opacity === undefined ? undefined : n(layer.opacity, 1),
      transform: transform || undefined,
      'z-index': layer.zIndex === null || layer.zIndex === undefined ? undefined : n(layer.zIndex),
      'mix-blend-mode': layer.blendMode && layer.blendMode !== 'normal' ? layer.blendMode : undefined,
      'box-shadow': shadowCss(layer.shadow) || undefined
    })
  };
}

function attrs(map) {
  return Object.entries(map)
    .filter(([, value]) => value !== undefined && value !== null && value !== false)
    .map(([key, value]) => `${key}="${escapeHtml(value)}"`)
    .join(' ');
}

// ---------------------------------------------------------------------------
// Calques
// ---------------------------------------------------------------------------

function renderBackground(layer, { transparent, assets }) {
  const box = layerBox(layer);
  const source = layer.source || { kind: 'color', color: '#05060a' };
  // En sortie transparente, le fond est ignoré sauf `forceVisible` (EF-09.9).
  if (transparent && !layer.forceVisible) return '';

  const filters = [
    n(source.blur) ? `blur(${n(source.blur)}px)` : '',
    n(source.brightness, 100) !== 100 ? `brightness(${n(source.brightness, 100)}%)` : '',
    n(source.contrast, 100) !== 100 ? `contrast(${n(source.contrast, 100)}%)` : '',
    n(source.saturate, 100) !== 100 ? `saturate(${n(source.saturate, 100)}%)` : '',
    n(source.grayscale) ? `grayscale(${n(source.grayscale)}%)` : ''
  ].filter(Boolean).join(' ');

  let media = '';
  const url = source.assetId ? assets?.[source.assetId] || null : null;
  if (source.kind === 'color') {
    media = `<div class="op-bg-fill" style="${styleAttr({ background: source.color || '#05060a' })}"></div>`;
  } else if (source.kind === 'gradient') {
    const angle = n(source.gradientAngle, 135);
    const gradient = source.gradientType === 'radial'
      ? `radial-gradient(circle at 50% 50%, ${source.color1 || '#111'} 0%, ${source.color2 || '#000'} 100%)`
      : `linear-gradient(${angle}deg, ${source.color1 || '#111'} 0%, ${source.color2 || '#000'} 100%)`;
    media = `<div class="op-bg-fill" style="${styleAttr({ background: gradient })}"></div>`;
  } else if (url) {
    const fit = source.fit || 'cover';
    const scale = n(source.scale, 100) / 100;
    const objectFit = fit === 'stretch' ? 'fill' : fit;
    media = source.kind === 'video'
      ? `<video class="op-bg-media" src="${escapeHtml(url)}" autoplay playsinline
           ${source.loop === false ? '' : 'loop'} ${source.muted === false ? '' : 'muted'}
           style="${styleAttr({
            'object-fit': objectFit,
            transform: `scale(${scale}) translate(${n(source.offsetX)}%, ${n(source.offsetY)}%)`,
            filter: filters || undefined
          })}"></video>`
      : `<div class="op-bg-media" style="${styleAttr({
          'background-image': `url("${url}")`,
          'background-size': source.repeat ? 'auto' : objectFit === 'fill' ? '100% 100%' : objectFit,
          'background-position': (source.position || 'center center').replace(' ', ' '),
          'background-repeat': source.repeat ? 'repeat' : 'no-repeat',
          transform: `scale(${scale}) translate(${n(source.offsetX)}%, ${n(source.offsetY)}%)`,
          filter: filters || undefined
        })}"></div>`;
  } else {
    // Asset non résolu : on garde la couleur de repli, jamais une image cassée.
    media = `<div class="op-bg-fill" style="${styleAttr({ background: source.color1 || '#05060a' })}"></div>`;
  }

  const tint = source.tint && n(source.tintOpacity) > 0
    ? `<div class="op-bg-tint" style="${styleAttr({
      background: source.tint,
      opacity: n(source.tintOpacity)
    })}"></div>`
    : '';

  return `<div ${attrs({ ...commonAttrs(layer, box), 'data-layer-name': layer.name })}>${media}${tint}</div>`;
}

function renderOverlay(layer) {
  const box = layerBox(layer);
  const border = layer.border || {};
  const sides = Array.isArray(border.sides) && border.sides.length ? border.sides : ['top', 'right', 'bottom', 'left'];
  const style = layer.shape === 'ellipse' ? '50%' : `${n(layer.radius)}px`;
  const borderCss = sides
    .map((side) => `border-${side}:${n(border.width)}px ${border.style || 'solid'} ${border.color || '#ffffff'}`)
    .join(';');

  const radii = Array.isArray(layer.cornerRadiusPerCorner) && layer.cornerRadiusPerCorner.length === 4
    ? layer.cornerRadiusPerCorner.map((r) => `${n(r)}px`).join(' ')
    : undefined;

  const inner = layer.shape === 'line'
    ? `<div class="op-overlay-fill" style="${styleAttr({ background: 'transparent', 'border-radius': style })}"></div>`
    : `<div class="op-overlay-fill" style="${styleAttr({
      background: layer.bg || 'rgba(8,10,16,.85)',
      'border-radius': radii || style
    })}"></div>`;

  const innerStyle = [styleAttr({ 'border-radius': radii || style }), borderCss].filter(Boolean).join(';');
  return `<div ${attrs({ ...commonAttrs(layer, box), 'data-layer-name': layer.name })}>
    <div class="op-overlay-inner" style="${innerStyle}">${inner}</div>
  </div>`;
}

function textCaseCss(textCase) {
  switch (textCase) {
    case 'uppercase': return { 'text-transform': 'uppercase' };
    case 'lowercase': return { 'text-transform': 'lowercase' };
    case 'capitalize': return { 'text-transform': 'capitalize' };
    case 'smallcaps': return { 'font-variant-caps': 'small-caps' };
    default: return {};
  }
}

function renderText(layer, content) {
  const box = layerBox(layer);
  const style = layer.style || {};
  const raw = resolveBind(layer.bind, layer, content);
  // EF-09.16 : une liaison vide n'affiche rien — et ne réserve pas de place.
  if (!raw) return '';

  const align = style.align || 'center';
  const vertical = style.verticalAlign || 'center';
  const padding = n(style.padding);
  const weight = style.bold ? Math.max(700, n(style.weight, 600)) : n(style.weight, 600);

  const textShadow = [];
  if (n(style.shadow) > 0) textShadow.push(`0 ${Math.round(n(style.shadow) / 2)}px ${n(style.shadow)}px rgba(0,0,0,.55)`);
  if (style.stroke?.enabled) textShadow.push(`0 0 1px ${style.stroke.color || '#000'}`);

  const innerStyle = styleAttr({
    display: 'flex',
    'flex-direction': 'column',
    'align-items': align === 'justify' ? 'stretch' : ALIGN_MAIN[align] || 'center',
    'justify-content': ALIGN_ITEMS[vertical] || 'center',
    height: '100%',
    padding: padding ? `${padding}px` : undefined,
    'box-sizing': 'border-box'
  });

  const bodyStyle = styleAttr({
    width: align === 'justify' ? '100%' : 'auto',
    'max-width': '100%',
    'text-align': align,
    'text-align-last': align === 'justify' ? (style.alignLast || 'auto') : undefined,
    'font-family': `"${style.fontFamily || 'Inter'}", system-ui, sans-serif`,
    'font-size': `${n(style.fontSize, 40)}px`,
    'font-weight': weight,
    color: style.color || '#ffffff',
    'line-height': n(style.lineHeight, 1.2),
    'letter-spacing': n(style.letterSpacing) ? `${n(style.letterSpacing)}px` : undefined,
    'word-spacing': n(style.wordSpacing) ? `${n(style.wordSpacing)}px` : undefined,
    'white-space': 'pre-wrap',
    'overflow-wrap': 'break-word',
    'font-style': style.italic ? 'italic' : undefined,
    'text-decoration': [style.underline ? 'underline' : '', style.strike ? 'line-through' : ''].filter(Boolean).join(' ') || undefined,
    '-webkit-text-stroke': style.stroke?.enabled ? `${n(style.stroke.width, 2)}px ${style.stroke.color || '#000'}` : undefined,
    'paint-order': style.stroke?.enabled ? 'stroke fill' : undefined,
    'text-shadow': textShadow.length ? textShadow.join(', ') : undefined,
    background: style.bg || undefined,
    'border-radius': style.bg ? `${n(style.radius, 12)}px` : undefined,
    ...textCaseCss(style.textCase)
  });

  // Géométrie utile pour l'auto-ajustement, en px du canevas 1920×1080.
  const boxW = Math.max(1, (box.width / 100) * STAGE_WIDTH - padding * 2);
  const boxH = box.height === null ? null : Math.max(1, (box.height / 100) * STAGE_HEIGHT - padding * 2);

  return `<div ${attrs({ ...commonAttrs(layer, box), 'data-layer-name': layer.name })}
      data-autofit="${layer.autoFit?.enabled === false ? '0' : '1'}"
      data-bind="${escapeHtml(layer.bind || '')}"
      data-box-w="${Math.round(boxW)}"
      data-box-h="${boxH === null ? '' : Math.round(boxH)}"
      data-base-size="${n(style.fontSize, 40)}"
      data-line-height="${n(style.lineHeight, 1.2)}"
      data-fit-min="${n(layer.autoFit?.min, 16)}"
      data-fit-max="${n(layer.autoFit?.max, 120)}"
      data-scale-up="${layer.autoFit?.scaleUp ? '1' : '0'}">
    <div class="op-text-inner" style="${innerStyle}">
      <div class="op-text-body" style="${bodyStyle}">${escapeHtml(raw)}</div>
    </div>
  </div>`;
}

function renderImage(layer, { assets, editing }) {
  const box = layerBox(layer);
  const url = layer.assetId ? assets?.[layer.assetId] || null : null;
  const radius = Array.isArray(layer.radiusPerCorner) && layer.radiusPerCorner.length === 4
    ? layer.radiusPerCorner.map((r) => `${n(r)}px`).join(' ')
    : `${n(layer.radius)}px`;

  // EF-09.35 : l'éditeur montre un emplacement, la sortie n'affiche rien.
  if (!url) {
    if (!editing) return '';
    return `<div ${attrs({ ...commonAttrs(layer, box), 'data-layer-name': layer.name })}>
      <div class="op-image-placeholder" style="${styleAttr({ 'border-radius': radius })}">＋ ${escapeHtml(layer.name)}</div>
    </div>`;
  }

  // `fit` : contain | cover | stretch ; `crop` : recadrage en % du cadre.
  const fit = layer.fit === 'stretch' ? 'fill' : layer.fit || 'contain';
  const offsetX = n(layer.offsetX);
  const offsetY = n(layer.offsetY);
  const scale = n(layer.scale, 100) / 100;
  const flip = `scale(${(layer.flipH ? -1 : 1) * scale}, ${(layer.flipV ? -1 : 1) * scale})`;
  // `crop` = marges en % du cadre, retirées par débordement négatif (EF-09.24).
  const crop = layer.crop && typeof layer.crop === 'object' ? layer.crop : null;

  return `<div ${attrs({ ...commonAttrs(layer, box), 'data-layer-name': layer.name })}>
    <div class="op-image-frame" style="${styleAttr({ 'border-radius': radius })}">
      <img class="op-image" src="${escapeHtml(url)}" alt="" draggable="false" style="${styleAttr({
        width: '100%',
        height: '100%',
        'object-fit': fit,
        'object-position': `${n(layer.positionX, 50)}% ${n(layer.positionY, 50)}%`,
        transform: `translate(${offsetX}%, ${offsetY}%) ${flip}`,
        'border-radius': radius,
        ...(crop ? { position: 'absolute', top: `-${n(crop.top)}%`, left: `-${n(crop.left)}%` } : {})
      })}">
    </div>
  </div>`;
}

function renderGroup(layer, ctx) {
  const box = layerBox(layer);
  const children = (layer.children || []).map((child) => renderLayer(child, ctx)).join('');
  return `<div ${attrs({ ...commonAttrs(layer, box), 'data-layer-name': layer.name })}>
    <div class="op-group-inner">${children}</div>
  </div>`;
}

function renderLayer(layer, ctx) {
  if (!layer || layer.visible === false) return '';
  // Un groupe est un conteneur positionné : ses enfants sont exprimés dans le
  // même repère, ce qui garde un système de coordonnées unique (EF-09.2).
  switch (layer.type) {
    case 'background': return renderBackground(layer, ctx);
    case 'overlay': return renderOverlay(layer);
    case 'text': return renderText(layer, ctx.content);
    case 'image': return renderImage(layer, ctx);
    case 'group': return renderGroup(layer, ctx);
    default: return '';
  }
}

// ---------------------------------------------------------------------------
// Scène
// ---------------------------------------------------------------------------

/**
 * Rend une scène en HTML.
 * @param {object} params
 * @param {object} params.scene
 * @param {object} [params.content] contexte de diffusion (verset, référence…)
 * @param {object} [params.assets] table `assetId → URL`
 * @param {boolean} [params.transparent] force la transparence (sortie alpha)
 * @param {boolean} [params.editing] mode éditeur (emplacements vides visibles)
 */
export function renderScene({ scene, content = {}, assets = {}, transparent, editing = false }) {
  if (!scene) return { html: '', css: SCENE_CSS };
  const isTransparent = transparent ?? Boolean(scene.transparent);
  const ctx = { content, assets, transparent: isTransparent, editing };

  const layers = [...(scene.layers || [])]
    .map((layer, index) => ({ layer, index }))
    .sort((a, b) => {
      const za = a.layer.zIndex ?? a.index;
      const zb = b.layer.zIndex ?? b.index;
      return za - zb;
    })
    .map(({ layer }) => renderLayer(layer, ctx))
    .filter(Boolean)
    .join('\n');

  const html = `<div class="op-scene${editing ? ' op-editing' : ''}" data-scene-id="${escapeHtml(scene.id || '')}"
    data-kind="${escapeHtml(scene.kind || '')}"
    data-transparent="${isTransparent ? '1' : '0'}"
    style="${styleAttr({
      width: `${STAGE_WIDTH}px`,
      height: `${STAGE_HEIGHT}px`,
      // Sortie alpha : la scène elle-même n'a pas de fond, sinon OBS compose
      // sur un rectangle noir (EF-09.9).
      background: isTransparent ? 'transparent' : scene.bgColor || '#05060a',
      '--op-accent': scene.accentColor || '#f5b942',
      '--op-text': scene.textColor || '#ffffff'
    })}">${layers}
${renderPartsHint(scene, content)}</div>`;

  return { html, css: SCENE_CSS };
}

/** Indicateur discret de parties, masquable par scène (EF-12.34). */
function renderPartsHint(scene, content) {
  if (scene.showPartsHint === false) return '';
  const total = Number(content.partCount) || 0;
  if (total <= 1) return '';
  const index = (Number(content.partIndex) || 0) + 1;
  return `<div class="op-parts" data-parts="${index}/${total}">${index} / ${total}</div>`;
}

// ---------------------------------------------------------------------------
// Montage (navigateur) — identique dans l'éditeur et dans la sortie
// ---------------------------------------------------------------------------

/**
 * Insère la scène dans un conteneur et applique l'auto-ajustement.
 * Appelée **à l'identique** par l'éditeur et la page de sortie.
 */
export function mountScene(root, { scene, content = {}, assets = {}, transparent, editing = false } = {}) {
  if (!root) return { html: '', applied: [] };
  const { html, css } = renderScene({ scene, content, assets, transparent, editing });
  root.innerHTML = html;
  applyAutoFit(root);
  return { html, css, applied: root.querySelectorAll('[data-autofit="1"]').length };
}

/** Applique l'auto-ajustement aux calques texte, dans l'ordre du document. */
export function applyAutoFit(root, { measureText } = {}) {
  if (!root?.querySelectorAll) return [];
  const measure = measureText || defaultMeasure(root);
  const applied = [];
  for (const node of root.querySelectorAll('[data-autofit="1"]')) {
    const body = node.querySelector('.op-text-body');
    if (!body) continue;
    const boxW = Number(node.dataset.boxW) || 0;
    const boxH = Number(node.dataset.boxH) || 0;
    const base = Number(node.dataset.baseSize) || 40;
    if (!boxW) continue;

    const result = computeAutoFit({
      text: body.textContent || '',
      style: { fontSize: base, lineHeight: Number(node.dataset.lineHeight) || 1.2 },
      boxWidth: boxW,
      boxHeight: boxH || Number.MAX_SAFE_INTEGER,
      measureText: measure,
      autoFit: {
        enabled: node.dataset.autofit !== '0',
        min: Number(node.dataset.fitMin) || 16,
        max: Number(node.dataset.fitMax) || 120,
        scaleUp: node.dataset.scaleUp === '1'
      }
    });
    body.style.fontSize = `${result.fontSize}px`;
    node.dataset.fitFactor = String(Math.round(result.factor * 100) / 100);
    if (result.clamped === false && !result.fits) node.dataset.overflow = '1';
    else delete node.dataset.overflow;
    applied.push({ layerId: node.dataset.layerId, ...result });
  }
  return applied;
}

function defaultMeasure(root) {
  // On récupère la police effective du premier calque texte pour une mesure juste.
  const first = root.querySelector?.('.op-text-body');
  const family = first ? getComputedStyle(first).fontFamily : 'Inter';
  const weight = first ? getComputedStyle(first).fontWeight : 600;
  return makeCanvasMeasure({
    fontFamily: String(family).split(',')[0].replace(/"/g, '').trim(),
    weight
  });
}

// ---------------------------------------------------------------------------
// Feuille de style — une seule source, servie aux deux vues
// ---------------------------------------------------------------------------

export const SCENE_CSS = `
.op-scene{position:relative;overflow:hidden;transform-origin:top left}
.op-layer{position:absolute;box-sizing:border-box}
.op-bg-media,.op-bg-fill,.op-bg-tint{position:absolute;inset:0;width:100%;height:100%}
.op-bg-media{object-fit:cover}
.op-bg-tint{mix-blend-mode:multiply}
.op-overlay-inner{position:absolute;inset:0;box-sizing:border-box;overflow:hidden}
.op-overlay-fill{position:absolute;inset:0}
.op-text-inner{position:absolute;inset:0;box-sizing:border-box}
.op-text-body{margin:0;overflow:hidden}
.op-image{display:block}
.op-image-frame{position:absolute;inset:0}
.op-image-placeholder{
  display:flex;align-items:center;justify-content:center;height:100%;
  border:3px dashed rgba(245,185,66,.65);color:#f5b942;font:600 28px/1.3 Inter,system-ui,sans-serif;
  background:rgba(245,185,66,.06);text-align:center;padding:10px;box-sizing:border-box
}
.op-group-inner{position:absolute;inset:0}
.op-parts{
  position:absolute;right:36px;bottom:28px;font:700 26px/1 Inter,system-ui,sans-serif;
  color:rgba(255,255,255,.55);letter-spacing:.08em
}
/* Repères d'édition : jamais rendus hors du mode éditeur, et jamais en sortie. */
.op-scene.op-editing .op-layer{outline:1px dashed transparent}
.op-scene.op-editing .op-layer:hover{outline-color:rgba(245,185,66,.55)}
`;

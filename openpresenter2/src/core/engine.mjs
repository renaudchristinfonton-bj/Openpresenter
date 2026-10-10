// ============================================================
// OpenPresenter 2 — moteur de scène à calques
// La même scène et le même renderer servent le contrôleur,
// l'éditeur, la sortie OBS et les affichages de scène.
// ============================================================

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const clone = (value) => JSON.parse(JSON.stringify(value));

function createId() {
  return globalThis.crypto?.randomUUID?.() || `layer_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function createLayer(type, options = {}) {
  const base = {
    id: createId(), type, name: type[0].toUpperCase() + type.slice(1),
    visible: true, locked: false, opacity: 1,
    x: 50, y: 50, w: 60, h: 20, rotate: 0,
    zIndex: null,
  };
  const types = {
    background: {
      name: 'Fond', x: 50, y: 50, w: 100, h: 100,
      source: { kind: 'gradient', color1: '#090b12', color2: '#171a25', image: null, blur: 0, fit: 'cover' },
    },
    overlay: {
      name: 'Panneau', x: 50, y: 50, w: 90, h: 60,
      bg: 'rgba(9,11,18,.82)', radius: 20,
      border: { width: 0, color: '#f59e0b', sides: [] },
    },
    text: {
      name: 'Texte', x: 50, y: 55, w: 80, h: 50,
      bind: 'custom', customText: 'Votre texte',
      style: {
        fontFamily: 'Merriweather', fontSize: 56, weight: 600, color: '#ffffff',
        align: 'center', letterSpacing: 0, lineHeight: 1.35,
        italic: false, bold: false, underline: false, strike: false,
        shadow: 4, padding: 0, bg: null,
      },
      autoFit: { min: 16, max: 120, scaleDown: true },
    },
    image: {
      name: 'Image', x: 50, y: 50, w: 35, h: 35,
      src: null, bind: null, fit: 'contain', opacity: 1,
    },
  };
  if (!types[type]) throw new TypeError(`Type de calque inconnu : ${type}`);
  return { ...base, ...clone(types[type]), ...options };
}

const FONTS = {
  bible: 'Merriweather', songs: 'Poppins', announcements: 'Inter', timer: 'Inter',
};
function textLayer(name, bind, x, y, w, h, style = {}, options = {}) {
  return createLayer('text', {
    name, bind, x, y, w, h,
    customText: '',
    style: { fontFamily: FONTS[options.kind] || 'Merriweather', fontSize: 48, weight: 600, color: '#fff', align: 'center', lineHeight: 1.3, shadow: 3, ...style },
    ...options,
  });
}

function defaultScene(preset = 'full', kind = 'bible') {
  const isSong = kind === 'songs';
  const isAnnouncement = kind === 'announcements';
  const isTimer = kind === 'timer';
  const accent = isSong ? '#a78bfa' : isAnnouncement ? '#34d399' : isTimer ? '#fb7185' : '#f5b942';
  const bodyFont = FONTS[kind] || 'Merriweather';
  const titleBind = kind === 'bible' ? 'ref' : 'title';
  const badgeBind = kind === 'bible' ? 'badge' : 'section';
  const bodyBind = isSong ? 'lyrics' : isAnnouncement ? 'announcement' : isTimer ? 'timer' : 'verse';
  const referenceLabel = kind === 'bible' ? 'Référence' : 'Titre';
  const badgeLabel = kind === 'bible' ? 'Version' : isTimer ? 'Mode' : 'Section';
  const bodyLabel = kind === 'bible' ? 'Verset' : isSong ? 'Paroles' : isAnnouncement ? 'Message' : 'Minuteur';
  const scenes = {
    full: {
      name: 'Cinéma — plein écran', preset: 'full', kind, bgColor: '#090b12', accentColor: accent,
      textColor: '#fff', shapeRadius: 22, bgOpacity: 96, transparent: false, bgImage: null,
      splitMode: 'none', splitChars: 220, splitByLines: true,
      layers: [
        createLayer('background', { name: 'Fond', source: { kind: 'gradient', color1: '#05060a', color2: '#19131a', fit: 'cover', blur: 0 } }),
        createLayer('overlay', { name: 'Cadre', x: 50, y: 52, w: 94, h: 88, bg: 'rgba(6,8,14,.52)', radius: 22, border: { width: 2, color: accent, sides: ['top', 'bottom'] } }),
        textLayer(referenceLabel, titleBind, 43, 17, 72, 9, { fontFamily: 'Cinzel', fontSize: 46, weight: 700, color: accent, align: 'center', shadow: 2 }, { kind }),
        textLayer(badgeLabel, badgeBind, 88, 16, 13, 6, { fontFamily: 'Inter', fontSize: 20, weight: 800, color: '#111318', bg: accent, align: 'center', shadow: 0, padding: 5 }, { kind }),
        textLayer(bodyLabel, bodyBind, 50, 57, 82, 62, { fontFamily: bodyFont, fontSize: isSong ? 68 : isTimer ? 150 : isAnnouncement ? 62 : 68, weight: 600, color: '#fff', align: 'center', lineHeight: 1.38, shadow: 6 }, { kind }),
      ],
    },
    screen80: {
      name: 'Galerie — 80 %', preset: 'screen80', kind, bgColor: '#080a10', accentColor: accent,
      textColor: '#fff', shapeRadius: 18, bgOpacity: 92, transparent: false, bgImage: null,
      splitMode: 'none', splitChars: 220, splitByLines: true,
      layers: [
        createLayer('background', { source: { kind: 'gradient', color1: '#05060a', color2: '#151b29', fit: 'cover', blur: 0 } }),
        createLayer('overlay', { name: 'Panneau', x: 50, y: 50, w: 80, h: 80, bg: 'rgba(7,10,18,.85)', radius: 18, border: { width: 4, color: accent, sides: ['top', 'bottom'] } }),
        textLayer(referenceLabel, titleBind, 45, 19, 68, 9, { fontFamily: 'Cinzel', fontSize: 40, weight: 700, color: accent }, { kind }),
        textLayer(badgeLabel, badgeBind, 86, 18, 12, 6, { fontFamily: 'Inter', fontSize: 18, weight: 800, color: '#111318', bg: accent, shadow: 0, padding: 4 }, { kind }),
        textLayer(bodyLabel, bodyBind, 50, 57, 74, 58, { fontFamily: bodyFont, fontSize: isSong ? 58 : isTimer ? 125 : isAnnouncement ? 58 : 60, weight: 600, color: '#fff', lineHeight: 1.38, shadow: 5 }, { kind }),
      ],
    },
    bottom: {
      name: 'Bandeau — bas centré', preset: 'bottom', kind, bgColor: 'rgba(0,0,0,0)', accentColor: accent,
      textColor: '#fff', shapeRadius: 14, bgOpacity: 92, transparent: true, bgImage: null,
      splitMode: 'auto', splitChars: isSong ? 115 : isAnnouncement ? 200 : 165, splitByLines: true,
      layers: [
        createLayer('background', { visible: false }),
        createLayer('overlay', { name: 'Bandeau', x: 50, y: 85, w: 82, h: 25, bg: 'rgba(8,10,16,.92)', radius: 14, border: { width: 7, color: accent, sides: ['left'] } }),
        textLayer(referenceLabel, titleBind, 51, 72, 68, 5, { fontFamily: 'Poppins', fontSize: 18, weight: 600, color: '#cbd5e1', align: 'left', letterSpacing: 1, shadow: 1 }, { kind }),
        textLayer(badgeLabel, badgeBind, 16, 83, 20, 12, { fontFamily: 'Inter', fontSize: 17, weight: 800, color: '#101116', bg: accent, shadow: 0, padding: 4 }, { kind }),
        textLayer(bodyLabel, bodyBind, 53, 88, 69, 15, { fontFamily: bodyFont, fontSize: isSong ? 37 : isTimer ? 58 : isAnnouncement ? 38 : 40, weight: 600, color: '#fff', align: isSong ? 'center' : 'left', lineHeight: 1.25, shadow: 4 }, { kind }),
      ],
    },
    'bottom-right': {
      name: 'Bandeau — bas droite', preset: 'bottom-right', kind, bgColor: 'rgba(0,0,0,0)', accentColor: accent,
      textColor: '#fff', shapeRadius: 14, bgOpacity: 92, transparent: true, bgImage: null,
      splitMode: 'auto', splitChars: isSong ? 95 : isAnnouncement ? 180 : 145, splitByLines: true,
      layers: [
        createLayer('background', { visible: false }),
        createLayer('overlay', { name: 'Bandeau', x: 78, y: 85, w: 42, h: 25, bg: 'rgba(8,10,16,.92)', radius: 14, border: { width: 7, color: accent, sides: ['right'] } }),
        textLayer(referenceLabel, titleBind, 77, 72, 39, 5, { fontFamily: 'Poppins', fontSize: 17, weight: 600, color: '#cbd5e1', align: 'right', letterSpacing: 1, shadow: 1 }, { kind }),
        textLayer(badgeLabel, badgeBind, 59, 82, 12, 11, { fontFamily: 'Inter', fontSize: 15, weight: 800, color: '#101116', bg: accent, shadow: 0, padding: 3 }, { kind }),
        textLayer(bodyLabel, bodyBind, 78, 88, 38, 15, { fontFamily: bodyFont, fontSize: isSong ? 34 : isTimer ? 50 : isAnnouncement ? 35 : 37, weight: 600, color: '#fff', align: 'right', lineHeight: 1.22, shadow: 4 }, { kind }),
      ],
    },
    lowerthird: {
      name: 'Lower third', preset: 'lowerthird', kind, bgColor: 'rgba(0,0,0,0)', accentColor: accent,
      textColor: '#fff', shapeRadius: 8, bgOpacity: 0, transparent: true, bgImage: null,
      splitMode: 'none', splitChars: 160, splitByLines: false,
      layers: [
        createLayer('background', { visible: false }),
        createLayer('overlay', { name: 'Bandeau', x: 28, y: 88, w: 52, h: 18, bg: 'rgba(4,6,10,.82)', radius: 8, border: { width: 5, color: accent, sides: ['left'] } }),
        textLayer(referenceLabel, titleBind, 31, 84, 47, 5, { fontFamily: 'Inter', fontSize: 19, weight: 700, color: accent, align: 'left', shadow: 1 }, { kind }),
        textLayer(isSong ? 'Section' : bodyLabel, isSong ? badgeBind : bodyBind, 31, 91, 47, 8, { fontFamily: bodyFont, fontSize: isSong ? 25 : isTimer ? 40 : isAnnouncement ? 22 : 26, weight: 600, color: '#fff', align: 'left', lineHeight: 1.15, shadow: 3 }, { kind }),
      ],
    },
  };
  const scene = clone(scenes[preset] || scenes.full);
  if (isAnnouncement) {
    const imageLayouts = {
      full: { x: 50, y: 50, w: 100, h: 100, opacity: .34, fit: 'cover' },
      screen80: { x: 50, y: 50, w: 100, h: 100, opacity: .28, fit: 'cover' },
      bottom: { x: 17, y: 51, w: 28, h: 48, opacity: 1, fit: 'cover' },
      'bottom-right': { x: 20, y: 51, w: 28, h: 48, opacity: 1, fit: 'cover' },
      lowerthird: { x: 80, y: 88, w: 30, h: 18, opacity: 1, fit: 'cover' },
    };
    scene.layers.splice(1, 0, createLayer('image', { name: 'Image annonce', bind: 'image', src: null, ...imageLayouts[scene.preset] }));
  }
  return scene;
}

function hexToRgba(hex, alpha = 1) {
  if (!hex) return `rgba(0,0,0,${alpha})`;
  if (/^rgba?\(/i.test(hex)) return hex;
  let value = String(hex).replace(/^#/, '');
  if (value.length === 3) value = [...value].map((char) => char + char).join('');
  if (!/^[\da-f]{6}$/i.test(value)) return `rgba(0,0,0,${alpha})`;
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
  return `rgba(${r},${g},${b},${clamp(Number(alpha), 0, 1)})`;
}

function rgbToHex(color) {
  if (!color) return '#000000';
  if (/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(color)) return color.length === 4 ? `#${[...color.slice(1)].map((c) => c + c).join('')}` : color;
  const match = String(color).match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (!match) return '#000000';
  return `#${match.slice(1, 4).map((n) => clamp(+n, 0, 255).toString(16).padStart(2, '0')).join('')}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function setLayerPosition(element, layer) {
  element.style.left = `${Number(layer.x ?? 50)}%`;
  element.style.top = `${Number(layer.y ?? 50)}%`;
  element.style.width = `${Math.max(0, Number(layer.w ?? 0))}%`;
  element.style.height = layer.h == null ? 'auto' : `${Math.max(0, Number(layer.h))}%`;
  const rotation = Number(layer.rotate || 0);
  element.style.transform = `translate(-50%, -50%) rotate(${rotation}deg)`;
}

function alignItems(align) {
  if (align === 'left') return 'flex-start';
  if (align === 'right') return 'flex-end';
  return 'center';
}

function applyTextStyle(element, style = {}) {
  element.style.fontFamily = `'${String(style.fontFamily || 'Merriweather').replace(/["'\\]/g, '')}', serif`;
  element.style.fontSize = `${Math.max(1, Number(style.fontSize) || 48)}px`;
  element.style.fontWeight = style.bold ? '700' : String(style.weight || 400);
  element.style.color = style.color || '#fff';
  element.style.textAlign = style.align || 'center';
  element.style.letterSpacing = `${Number(style.letterSpacing) || 0}px`;
  element.style.lineHeight = String(Number(style.lineHeight) || 1.35);
  const shadow = Math.max(0, Number(style.shadow) || 0);
  element.style.textShadow = shadow ? `0 ${shadow / 2}px ${shadow}px rgba(0,0,0,${Math.min(.9, .3 + shadow / 30)})` : 'none';
  element.style.fontStyle = style.italic ? 'italic' : 'normal';
  element.style.textDecoration = [style.underline ? 'underline' : '', style.strike ? 'line-through' : ''].filter(Boolean).join(' ') || 'none';
  element.style.padding = `${Math.max(0, Number(style.padding) || 0)}px`;
  element.style.background = style.bg || 'transparent';
  if (style.bg) element.style.borderRadius = `${Number(style.radius) || 999}px`;
  element.style.display = 'flex';
  element.style.flexDirection = 'column';
  element.style.alignItems = alignItems(style.align);
  element.style.justifyContent = 'center';
}

const mediaURLCache = new WeakMap();
function mediaURL(source) {
  if (typeof source === 'string') return source;
  if (typeof Blob !== 'undefined' && source instanceof Blob && typeof URL?.createObjectURL === 'function') {
    if (!mediaURLCache.has(source)) mediaURLCache.set(source, URL.createObjectURL(source));
    return mediaURLCache.get(source);
  }
  return '';
}

function elementForLayer(layer, bindings, scene, options = {}) {
  let element;
  if (layer.type === 'background') {
    element = document.createElement('div');
    element.className = 'scene-layer layer-background';
    const source = layer.source || {};
    const image = mediaURL(scene.bgImage || source.image || source.assetBlob);
    if (image) {
      element.style.backgroundImage = `url("${image.replace(/["\\]/g, '')}")`;
      element.style.backgroundSize = source.fit || (source.cover ? 'cover' : 'contain');
      element.style.backgroundPosition = source.position || 'center';
      element.style.backgroundRepeat = 'no-repeat';
    } else {
      const c1 = source.color1 || scene.bgColor || '#080a10';
      const c2 = source.color2 || '#171a25';
      element.style.backgroundImage = `linear-gradient(135deg, ${c1}, ${c2})`;
    }
    const blur = Math.max(0, Number(source.blur) || 0);
    if (blur) element.style.filter = `blur(${blur}px)`;
  } else if (layer.type === 'overlay') {
    element = document.createElement('div');
    element.className = 'scene-layer layer-overlay';
    element.style.background = layer.bg || 'transparent';
    element.style.borderRadius = `${Math.max(0, Number(layer.radius) || 0)}px`;
    const border = layer.border || {};
    if (Number(border.width) > 0) {
      const sides = border.sides?.length ? border.sides : ['top', 'right', 'bottom', 'left'];
      for (const side of sides) {
        if (['top', 'right', 'bottom', 'left'].includes(side)) {
          element.style[`border${side[0].toUpperCase()}${side.slice(1)}`] = `${Number(border.width)}px solid ${border.color || scene.accentColor || '#fff'}`;
        }
      }
    }
  } else if (layer.type === 'image') {
    const source = layer.bind && bindings[layer.bind] != null ? bindings[layer.bind] : layer.src;
    if (!source && !options.interactive) return null;
    element = document.createElement('div');
    element.className = `scene-layer layer-image${source ? '' : ' layer-image-empty'}`;
    if (!source) element.textContent = `＋ ${layer.name || 'Image'}`;
    else {
      const image = document.createElement('img');
      image.alt = layer.alt || layer.name || '';
      image.draggable = false;
      image.src = mediaURL(source);
      image.style.objectFit = layer.fit === 'cover' ? 'cover' : 'contain';
      element.appendChild(image);
    }
  } else if (layer.type === 'text') {
    element = document.createElement('div');
    element.className = `scene-layer layer-text align-${layer.style?.align || 'center'}`;
    const style = layer.style || {};
    let text = layer.bind && bindings[layer.bind] != null ? bindings[layer.bind] : (layer.customText || '');
    if (Array.isArray(text)) text = text.join('\n');
    if (bindings.parts?.length && layer.bind === 'verse' && Number.isInteger(bindings.partIndex)) {
      text = bindings.parts[clamp(bindings.partIndex, 0, bindings.parts.length - 1)] ?? text;
    }
    element.textContent = String(text ?? '');
    applyTextStyle(element, style);
  }
  if (!element) return null;
  element.dataset.layerId = layer.id;
  element.dataset.layerType = layer.type;
  element.dataset.rotate = String(Number(layer.rotate || 0));
  element.style.opacity = String(clamp(Number(layer.opacity ?? 1), 0, 1));
  setLayerPosition(element, layer);
  return element;
}

function autoFitText(root) {
  root.querySelectorAll('.layer-text').forEach((element) => {
    const layer = element;
    const width = layer.clientWidth;
    const height = layer.clientHeight;
    if (!width || !height) return;
    const widthRatio = layer.scrollWidth > width ? width / layer.scrollWidth : 1;
    const heightRatio = layer.scrollHeight > height ? height / layer.scrollHeight : 1;
    const ratio = Math.max(.35, Math.min(1, widthRatio, heightRatio));
    const rotation = Number(layer.dataset.rotate || 0);
    layer.style.transform = `translate(-50%, -50%) rotate(${rotation}deg) scale(${ratio})`;
  });
}

function render(scene, container, bindings = {}, options = {}) {
  if (!container || typeof document === 'undefined') return null;
  container.replaceChildren();
  const root = document.createElement('div');
  root.className = 'scene-root';
  root.dataset.preset = scene?.preset || '';
  root.dataset.sceneId = scene?.id || '';
  root.style.setProperty('--scene-accent-color', scene?.accentColor || '#fff');
  root.style.setProperty('--scene-text-color', scene?.textColor || '#fff');
  scene = scene || defaultScene('full', 'bible');
  if (scene?.transparent) root.classList.add('scene-transparent');
  if (bindings.parts?.length > 1 && scene?.splitMode === 'auto') root.classList.add('has-parts');
  container.appendChild(root);

  (scene?.layers || []).forEach((layer, index) => {
    if (!layer?.visible) return;
    // En sortie transparente, le calque de fond de scène ne doit pas remplir l'image.
    if (scene.transparent && layer.type === 'background' && !layer.forceVisible) return;
    const element = elementForLayer(layer, bindings, scene, options);
    if (!element) return;
    element.style.zIndex = String(options.interactive && options.selected === layer.id ? 10000 + index : (layer.zIndex == null ? index + 1 : Number(layer.zIndex)));
    element.style.pointerEvents = options.interactive ? (layer.locked ? 'none' : 'auto') : 'none';
    if (options.interactive && !layer.locked) installInteraction(element, layer, options);
    if (options.interactive && options.selected === layer.id && !layer.locked) {
      element.classList.add('selected');
      addHandles(element, layer, options);
    }
    root.appendChild(element);
  });

  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => autoFitText(root));
  else autoFitText(root);
  return root;
}

function installInteraction(element, layer, options) {
  element.style.cursor = 'move';
  element.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target.closest('.layer-handle')) return;
    event.preventDefault();
    options.onSelectLayer?.(layer.id);
    startDrag(event, layer, options, 'move');
  });
}

function addHandles(element, layer, options) {
  ['nw', 'ne', 'sw', 'se'].forEach((direction) => {
    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = `layer-handle ${direction}`;
    handle.setAttribute('aria-label', `Redimensionner ${layer.name} (${direction})`);
    handle.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      startDrag(event, layer, options, 'resize', direction);
    });
    element.appendChild(handle);
  });
}

function startDrag(event, layer, options, mode, direction = '') {
  const getRect = options.containerRect;
  if (typeof getRect !== 'function') return;
  const start = {
    x: event.clientX, y: event.clientY,
    layer: { x: Number(layer.x), y: Number(layer.y), w: Number(layer.w), h: Number(layer.h ?? 0), rotate: Number(layer.rotate || 0) },
  };
  let latestEvent = event;
  let frame = 0;
  const raf = globalThis.requestAnimationFrame || ((callback) => setTimeout(callback, 16));
  const caf = globalThis.cancelAnimationFrame || clearTimeout;
  const applyLatest = () => {
    const rect = getRect();
    if (!rect?.w || !rect?.h) return;
    const dx = (latestEvent.clientX - start.x) / rect.w * 100;
    const dy = (latestEvent.clientY - start.y) / rect.h * 100;
    const initial = start.layer;
    if (mode === 'move') {
      layer.x = clamp(initial.x + dx, -initial.w / 2 + 1, 100 + initial.w / 2 - 1);
      layer.y = clamp(initial.y + dy, -initial.h / 2 + 1, 100 + initial.h / 2 - 1);
    } else {
      let x = initial.x; let y = initial.y; let w = initial.w; let h = initial.h;
      if (direction.includes('e')) { w += dx; x += dx / 2; }
      if (direction.includes('w')) { w -= dx; x += dx / 2; }
      if (direction.includes('s')) { h += dy; y += dy / 2; }
      if (direction.includes('n')) { h -= dy; y += dy / 2; }
      w = clamp(w, 2, 300); h = clamp(h || 2, 2, 300);
      layer.w = w; layer.h = h;
      layer.x = clamp(x, -w / 2 + 1, 100 + w / 2 - 1);
      layer.y = clamp(y, -h / 2 + 1, 100 + h / 2 - 1);
    }
    options.onChange?.({ layer, mode });
  };
  const move = (nextEvent) => {
    latestEvent = nextEvent;
    if (frame) return;
    frame = raf(() => { frame = 0; applyLatest(); });
  };
  const up = (upEvent) => {
    if (upEvent) latestEvent = upEvent;
    if (frame) { caf(frame); frame = 0; applyLatest(); }
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    options.onCommit?.({ layer, mode });
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up, { once: true });
  window.addEventListener('pointercancel', up, { once: true });
}

function splitSmart(text, maxChars = 220) {
  const source = String(text ?? '').trim();
  const limit = Math.max(1, Number(maxChars) || 220);
  if (!source || source.length <= limit) return [source];
  const parts = [];
  const punctuation = /[.!?;:,—–\-]/g;
  let rest = source;
  while (rest.length > limit) {
    const window = rest.slice(0, limit + 1);
    let cut = -1;
    let match;
    punctuation.lastIndex = Math.floor(limit * .45);
    while ((match = punctuation.exec(window)) !== null && match.index < limit) cut = match.index + 1;
    if (cut < 0) {
      const newline = window.lastIndexOf('\n', limit);
      if (newline >= Math.floor(limit * .4)) cut = newline;
    }
    if (cut < 0) {
      const space = window.lastIndexOf(' ', limit);
      cut = space >= Math.floor(limit * .4) ? space : limit;
    }
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

const TEXT_BINDING_BY_KIND = Object.freeze({ bible: 'verse', songs: 'lyrics', announcements: 'announcement' });
function prepareBindingsForScene(scene, kind, bindings = {}, partIndex = 0) {
  const output = { ...bindings };
  delete output.parts;
  delete output.partIndex;
  const textBinding = TEXT_BINDING_BY_KIND[kind];
  const text = output[textBinding];
  if (scene?.splitMode !== 'auto' || typeof text !== 'string' || !text.trim()) return output;
  const parts = splitSmart(text, scene.splitChars || 220);
  if (parts.length <= 1) return output;
  const index = clamp(Number(partIndex) || 0, 0, parts.length - 1);
  output.parts = parts;
  output.partIndex = index;
  output[textBinding] = parts[index];
  return output;
}

// CSS autonome : tous les types de calques partagent un unique système x/y/w/h.
if (typeof document !== 'undefined' && !document.getElementById('openpresenter-engine-style')) {
  const style = document.createElement('style');
  style.id = 'openpresenter-engine-style';
  style.textContent = `
    .scene-root{position:absolute;inset:0;width:100%;height:100%;overflow:hidden;isolation:isolate;}
    .scene-layer{position:absolute;box-sizing:border-box;transform:translate(-50%,-50%);transform-origin:center center;}
    .layer-background{background-position:center;background-repeat:no-repeat;}
    .layer-overlay{overflow:hidden;}
    .layer-image{overflow:hidden;}
    .layer-image-empty{display:grid;place-items:center;background:rgba(20,22,29,.62);border:2px dashed rgba(255,255,255,.35);color:#fff;font:700 24px Inter,system-ui,sans-serif;text-shadow:0 1px 6px #000;}
    .layer-image img{display:block;width:100%;height:100%;object-position:center;pointer-events:none;}
    .layer-text{white-space:pre-wrap;overflow-wrap:anywhere;word-break:normal;}
    .scene-layer.selected{outline:2px solid #f5b942;outline-offset:2px;}
    .layer-handle{position:absolute;z-index:9999;width:12px;height:12px;padding:0;border:1px solid #161616;border-radius:3px;background:#f5b942;box-shadow:0 1px 4px #0008;}
    .layer-handle.nw{left:-6px;top:-6px;cursor:nwse-resize;}.layer-handle.ne{right:-6px;top:-6px;cursor:nesw-resize;}
    .layer-handle.sw{left:-6px;bottom:-6px;cursor:nesw-resize;}.layer-handle.se{right:-6px;bottom:-6px;cursor:nwse-resize;}
    .scene-root.has-parts::before,.scene-root.has-parts::after{content:'';position:absolute;top:0;width:14%;height:100%;z-index:999;pointer-events:none;opacity:.4;}
    .scene-root.has-parts::before{left:0;background:linear-gradient(90deg,rgba(245,185,66,.22),transparent);}
    .scene-root.has-parts::after{right:0;background:linear-gradient(-90deg,rgba(245,185,66,.22),transparent);}
  `;
  document.head.appendChild(style);
}

const Engine = Object.freeze({
  createLayer, defaultScene, render, splitSmart, prepareBindingsForScene, hexToRgba, rgbToHex, escapeHtml,
  clone(value) { return clone(value); },
});
export { createLayer, defaultScene, render, splitSmart, prepareBindingsForScene, hexToRgba, rgbToHex };
export default Engine;

// Visual, reusable scene editor. It edits the same normalized scene object
// that Engine.render consumes in the controller and OBS output.
import Engine from '../core/engine.mjs';
import { THEMES, applyThemeToScene } from '../core/themes.mjs';

const PRESETS = [
  ['full', 'Cinéma'], ['screen80', 'Galerie'], ['bottom', 'Bas centré'],
  ['bottom-right', 'Bas droite'], ['lowerthird', 'Lower third'],
];
const BINDINGS = [
  ['custom', 'Texte libre'], ['ref', 'Référence'], ['badge', 'Version / badge'],
  ['verse', 'Verset'], ['title', 'Titre'], ['section', 'Section'], ['lyrics', 'Paroles'],
  ['announcement', 'Message d’annonce'], ['timer', 'Minuteur'], ['image', 'Image liée'],
];

function copy(value) { return JSON.parse(JSON.stringify(value)); }
function safeText(value) { return String(value ?? ''); }

export function openSceneEditor({ kind = 'bible', scene, onSave = () => {}, sampleBindings = {}, onAsset, onThemeChange } = {}) {
  let state = copy(scene || Engine.defaultScene('full', kind));
  state.kind = kind;
  let selectedId = null;
  let history = [copy(state)];
  let historyIndex = 0;
  let closed = false;
  let pendingFrame = 0;
  const modal = buildShell();
  document.body.appendChild(modal);

  const $ = (selector) => modal.querySelector(selector);
  const canvas = $('#se-canvas');
  const canvasInner = $('#se-canvas-inner');
  const layerList = $('#se-layer-list');
  const inspector = $('#se-inspector');
  const presetList = $('#se-presets');
  const kindName = ({ songs: 'PAROLES', announcements: 'ANNONCES', timer: 'MINUTEUR' })[kind] || 'BIBLE';
  $('#se-kind').textContent = kindName;

  function close() {
    if (closed) return;
    closed = true;
    if (pendingFrame) cancelAnimationFrame(pendingFrame);
    document.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('resize', resizeCanvas);
    modal.remove();
  }
  function checkpoint() {
    history = history.slice(0, historyIndex + 1);
    history.push(copy(state));
    historyIndex = history.length - 1;
    if (history.length > 80) { history.shift(); historyIndex -= 1; }
    updateHistoryButtons();
  }
  function restore(index) {
    historyIndex = Math.max(0, Math.min(history.length - 1, index));
    state = copy(history[historyIndex]);
    if (!state.layers.some((layer) => layer.id === selectedId)) selectedId = null;
    render();
  }
  function undo() { if (historyIndex > 0) restore(historyIndex - 1); }
  function redo() { if (historyIndex < history.length - 1) restore(historyIndex + 1); }
  function updateHistoryButtons() {
    $('#se-undo').disabled = historyIndex <= 0;
    $('#se-redo').disabled = historyIndex >= history.length - 1;
  }

  function selectLayer(id) {
    selectedId = id;
    renderLayerList();
    renderInspector();
    renderCanvas();
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const scale = Math.min(rect.width / 1920, rect.height / 1080);
    canvasInner.style.width = '1920px';
    canvasInner.style.height = '1080px';
    canvasInner.style.transform = `scale(${scale})`;
  }

  function renderCanvas() {
    resizeCanvas();
    canvasInner.replaceChildren();
    Engine.render(state, canvasInner, sampleBindings, {
      interactive: true,
      selected: selectedId,
      // Coordinates for drag are measured against the visible 16:9 canvas.
      containerRect: () => {
        const rect = canvas.getBoundingClientRect();
        return { w: rect.width, h: rect.height };
      },
      onSelectLayer: (id) => selectLayer(id),
      onChange: () => {
        if (pendingFrame) return;
        pendingFrame = requestAnimationFrame(() => {
          pendingFrame = 0;
          renderCanvas();
          syncGeometryFields();
        });
      },
      onCommit: () => { checkpoint(); renderLayerList(); renderInspector(); },
    });
  }

  function renderLayerList() {
    layerList.replaceChildren();
    const layers = [...state.layers].reverse();
    if (!layers.length) {
      const empty = document.createElement('div');
      empty.className = 'se-empty-layers';
      empty.textContent = 'Ajoutez un calque pour construire votre scène.';
      layerList.appendChild(empty);
      return;
    }
    layers.forEach((layer) => {
      const row = document.createElement('div');
      row.className = `se-layer-row${layer.id === selectedId ? ' selected' : ''}${layer.visible ? '' : ' is-hidden'}`;
      row.dataset.layerId = layer.id;
      const select = document.createElement('button');
      select.type = 'button'; select.className = 'se-layer-select';
      select.setAttribute('aria-label', `Sélectionner le calque ${layer.name}`);
      const icon = document.createElement('span');
      icon.className = 'se-layer-icon'; icon.textContent = layer.type === 'text' ? 'T' : ({ background: '▧', overlay: '◩', image: '▣' }[layer.type] || '◇');
      const name = document.createElement('span'); name.className = 'se-layer-name'; name.textContent = layer.name || layer.type;
      const type = document.createElement('span'); type.className = 'se-layer-type'; type.textContent = layer.type;
      select.append(icon, name, type);
      select.onclick = () => selectLayer(layer.id);
      row.appendChild(select);

      const visibility = document.createElement('button');
      visibility.type = 'button'; visibility.className = 'se-layer-action';
      visibility.title = layer.visible ? 'Masquer le calque' : 'Afficher le calque';
      visibility.setAttribute('aria-label', visibility.title);
      visibility.textContent = layer.visible ? '◉' : '○';
      visibility.onclick = () => { layer.visible = !layer.visible; checkpoint(); render(); };
      row.appendChild(visibility);

      const lock = document.createElement('button');
      lock.type = 'button'; lock.className = 'se-layer-action';
      lock.title = layer.locked ? 'Déverrouiller' : 'Verrouiller';
      lock.setAttribute('aria-label', lock.title);
      lock.textContent = layer.locked ? '⌑' : '⌑';
      if (layer.locked) lock.classList.add('is-locked');
      lock.onclick = () => { layer.locked = !layer.locked; checkpoint(); render(); };
      row.appendChild(lock);
      layerList.appendChild(row);
    });
  }

  function makeField(label, control, hint = '') {
    const row = document.createElement('div');
    row.className = 'se-field';
    const caption = document.createElement('span'); caption.className = 'se-field-label'; caption.textContent = label;
    row.append(caption, control);
    if (hint) { const note = document.createElement('small'); note.textContent = hint; row.appendChild(note); }
    return row;
  }
  function makeInput(type, value, options = {}) {
    const input = document.createElement('input');
    input.type = type;
    if (value != null) input.value = String(value);
    if (options.min != null) input.min = String(options.min);
    if (options.max != null) input.max = String(options.max);
    if (options.step != null) input.step = String(options.step);
    if (options.className) input.className = options.className;
    if (options.title) input.title = options.title;
    return input;
  }
  function makeSelect(items, value) {
    const select = document.createElement('select'); select.className = 'se-control';
    items.forEach(([id, label]) => { const option = document.createElement('option'); option.value = id; option.textContent = label; select.appendChild(option); });
    select.value = value;
    return select;
  }
  function makeSection(title, hint = '') {
    const section = document.createElement('section'); section.className = 'se-inspector-section';
    const heading = document.createElement('h3'); heading.textContent = title; section.appendChild(heading);
    if (hint) { const small = document.createElement('p'); small.className = 'se-section-hint'; small.textContent = hint; section.appendChild(small); }
    return section;
  }
  function fieldNumber(section, label, value, min, max, step, setter, key) {
    const input = makeInput('number', value, { min, max, step });
    input.dataset.geometry = key || '';
    input.onchange = () => { const n = Number(input.value); if (!Number.isFinite(n)) return; setter(n); checkpoint(); renderCanvas(); renderLayerList(); };
    section.appendChild(makeField(label, input));
    return input;
  }
  function fieldRange(section, label, value, min, max, step, setter, suffix = '') {
    const wrap = document.createElement('div'); wrap.className = 'se-range-wrap';
    const input = makeInput('range', value, { min, max, step });
    const output = document.createElement('output'); output.textContent = `${value}${suffix}`;
    input.oninput = () => { const n = Number(input.value); output.textContent = `${n}${suffix}`; setter(n); renderCanvas(); };
    input.onchange = checkpoint;
    wrap.append(input, output); section.appendChild(makeField(label, wrap));
    return input;
  }
  function colorField(section, label, value, setter) {
    const input = makeInput('color', Engine.rgbToHex(value));
    input.oninput = () => { setter(input.value); renderCanvas(); };
    input.onchange = checkpoint;
    section.appendChild(makeField(label, input));
    return input;
  }

  function renderGlobalInspector() {
    inspector.replaceChildren();
    const intro = makeSection('Scène', 'Choisissez un thème, puis ajustez les calques à votre goût.');
    const sceneName = makeInput('text', state.name || 'Ma scène');
    sceneName.maxLength = 80;
    sceneName.onchange = () => { state.name = sceneName.value.trim() || 'Ma scène'; checkpoint(); };
    intro.appendChild(makeField('Nom', sceneName));
    colorField(intro, 'Couleur d’accent', state.accentColor || '#f5b942', (value) => { state.accentColor = value; });

    const themeWrap = document.createElement('div'); themeWrap.className = 'se-theme-grid';
    THEMES.forEach((theme) => {
      const button = document.createElement('button'); button.type = 'button';
      button.className = `se-theme-card${state.themeId === theme.id ? ' active' : ''}`;
      button.title = theme.name;
      button.style.setProperty('--theme-swatch', theme.accent);
      const swatch = document.createElement('span'); swatch.className = 'se-theme-swatch';
      const name = document.createElement('span'); name.textContent = theme.name;
      button.append(swatch, name);
      button.onclick = () => applyTheme(theme);
      themeWrap.appendChild(button);
    });
    intro.appendChild(makeField('Thèmes prêts', themeWrap));
    inspector.appendChild(intro);

    const output = makeSection('Affichage', 'Réglages propres à cette scène et à cette sortie.');
    const transparent = document.createElement('input'); transparent.type = 'checkbox'; transparent.checked = !!state.transparent;
    transparent.onchange = () => { state.transparent = transparent.checked; render(); checkpoint(); };
    output.appendChild(makeField('Fond transparent', transparent));
    const split = makeSelect([['none', 'Tout afficher'], ['auto', 'Découper le texte long']], state.splitMode || 'none');
    split.onchange = () => { state.splitMode = split.value; checkpoint(); renderCanvas(); };
    output.appendChild(makeField('Versets / paroles longs', split));
    fieldRange(output, 'Caractères par partie', state.splitChars || 180, 60, 360, 10, (n) => { state.splitChars = n; }, ' car.');
    inspector.appendChild(output);

    const bg = makeSection('Média de fond', 'Le fond est un vrai calque : sélectionnez-le à gauche pour le déplacer ou le redimensionner.');
    const picker = document.createElement('button'); picker.type = 'button'; picker.className = 'se-button secondary'; picker.textContent = '＋ Importer une image de fond';
    picker.onclick = () => $('#se-background-file').click();
    bg.appendChild(picker);
    const background = state.layers.find((layer) => layer.type === 'background');
    if (background?.source?.image || background?.source?.assetId) {
      const clear = document.createElement('button'); clear.type = 'button'; clear.className = 'se-button subtle'; clear.textContent = 'Retirer l’image du fond';
      clear.onclick = () => { background.source.image = null; background.source.assetId = null; background.source.kind = 'gradient'; checkpoint(); render(); };
      bg.appendChild(clear);
    }
    inspector.appendChild(bg);
    renderThemePresetButtons();
  }

  function renderThemePresetButtons() {
    presetList.replaceChildren();
    PRESETS.forEach(([id, label]) => {
      const button = document.createElement('button'); button.type = 'button';
      button.className = `se-preset${state.preset === id ? ' active' : ''}`;
      button.dataset.preset = id; button.textContent = label;
      button.onclick = () => {
        const old = state;
        const next = Engine.defaultScene(id, kind);
        next.themeId = old.themeId || 'cinema';
        // Keep an imported image and the chosen palette while replacing layout.
        const oldBackground = old.layers.find((layer) => layer.type === 'background');
        const newBackground = next.layers.find((layer) => layer.type === 'background');
        if (oldBackground?.source?.assetId && newBackground) newBackground.source = copy(oldBackground.source);
        next.accentColor = old.accentColor || next.accentColor;
        state = next;
        selectedId = null;
        checkpoint(); render();
      };
      presetList.appendChild(button);
    });
  }

  function applyTheme(theme) {
    applyThemeToScene(state, theme.id);
    checkpoint(); render(); onThemeChange?.(theme.id);
  }

  function renderInspector() {
    const layer = state.layers.find((item) => item.id === selectedId);
    if (!layer) { renderGlobalInspector(); return; }
    inspector.replaceChildren();
    const general = makeSection(`${layer.type === 'text' ? 'Texte' : layer.type === 'image' ? 'Image' : layer.type === 'background' ? 'Fond' : 'Panneau'}`, 'Modifiez ce calque sans affecter les autres.');
    const name = makeInput('text', layer.name || layer.type);
    name.maxLength = 80;
    name.onchange = () => { layer.name = name.value.trim() || layer.type; checkpoint(); renderLayerList(); };
    general.appendChild(makeField('Nom du calque', name));
    const opacity = makeInput('range', Math.round(Number(layer.opacity ?? 1) * 100), { min: 0, max: 100, step: 1 });
    const opacityValue = document.createElement('output'); opacityValue.textContent = `${opacity.value}%`;
    opacity.oninput = () => { layer.opacity = Number(opacity.value) / 100; opacityValue.textContent = `${opacity.value}%`; renderCanvas(); };
    opacity.onchange = checkpoint;
    const opacityWrap = document.createElement('div'); opacityWrap.className = 'se-range-wrap'; opacityWrap.append(opacity, opacityValue);
    general.appendChild(makeField('Opacité', opacityWrap));
    inspector.appendChild(general);

    if (layer.type === 'text') renderTextInspector(layer);
    if (layer.type === 'overlay') renderOverlayInspector(layer);
    if (layer.type === 'background') renderBackgroundInspector(layer);
    if (layer.type === 'image') renderImageInspector(layer);

    const geometry = makeSection('Position & taille', 'Valeurs en pourcentage du canevas. Glissez le calque ou ses poignées.');
    fieldNumber(geometry, 'X', layer.x, -200, 300, .1, (n) => { layer.x = n; }, 'x');
    fieldNumber(geometry, 'Y', layer.y, -200, 300, .1, (n) => { layer.y = n; }, 'y');
    fieldNumber(geometry, 'Largeur', layer.w, 1, 300, .1, (n) => { layer.w = n; }, 'w');
    fieldNumber(geometry, 'Hauteur', layer.h ?? 0, 0, 300, .1, (n) => { layer.h = n || null; }, 'h');
    fieldNumber(geometry, 'Rotation', layer.rotate || 0, -180, 180, 1, (n) => { layer.rotate = n; }, 'rotate');
    inspector.appendChild(geometry);

    const actions = document.createElement('div'); actions.className = 'se-inspector-actions';
    const up = document.createElement('button'); up.className = 'se-button secondary'; up.textContent = '↑ Monter'; up.onclick = () => moveLayer(layer.id, -1);
    const down = document.createElement('button'); down.className = 'se-button secondary'; down.textContent = '↓ Descendre'; down.onclick = () => moveLayer(layer.id, 1);
    const remove = document.createElement('button'); remove.className = 'se-button danger'; remove.textContent = 'Supprimer le calque'; remove.onclick = () => deleteLayer(layer.id);
    actions.append(up, down, remove); inspector.appendChild(actions);
  }

  function renderTextInspector(layer) {
    const style = layer.style || (layer.style = {});
    const content = makeSection('Contenu', 'Le texte lié suit automatiquement le verset ou la section active.');
    const binding = makeSelect(BINDINGS, layer.bind || 'custom');
    binding.onchange = () => { layer.bind = binding.value; checkpoint(); renderCanvas(); renderInspector(); };
    content.appendChild(makeField('Source du texte', binding));
    const custom = document.createElement('textarea'); custom.className = 'se-control se-textarea';
    custom.value = layer.customText || ''; custom.rows = 3; custom.maxLength = 2000;
    custom.disabled = layer.bind !== 'custom';
    custom.oninput = () => { layer.customText = custom.value; renderCanvas(); };
    custom.onchange = checkpoint;
    content.appendChild(makeField('Texte libre', custom));
    inspector.appendChild(content);

    const typography = makeSection('Typographie');
    colorField(typography, 'Couleur', style.color || '#fff', (value) => { style.color = value; });
    const fontOptions = ['Merriweather', 'Poppins', 'Inter', 'Cinzel', 'Lora', 'Montserrat', 'Georgia', 'Arial', 'system-ui'].map((font) => [font, font]);
    const font = makeSelect(fontOptions, style.fontFamily || 'Merriweather');
    font.onchange = () => { style.fontFamily = font.value; checkpoint(); renderCanvas(); };
    typography.appendChild(makeField('Police', font));
    fieldRange(typography, 'Taille', style.fontSize || 48, 10, 160, 1, (n) => { style.fontSize = n; }, ' px');
    const weight = makeSelect([['300', 'Léger'], ['400', 'Normal'], ['500', 'Moyen'], ['600', 'Semi-gras'], ['700', 'Gras'], ['800', 'Extra-gras']], String(style.weight || 400));
    weight.onchange = () => { style.weight = Number(weight.value); style.bold = style.weight >= 700; checkpoint(); renderCanvas(); };
    typography.appendChild(makeField('Graisse', weight));
    const align = makeSelect([['left', 'Gauche'], ['center', 'Centré'], ['right', 'Droite']], style.align || 'center');
    align.onchange = () => { style.align = align.value; checkpoint(); renderCanvas(); };
    typography.appendChild(makeField('Alignement', align));
    fieldRange(typography, 'Espacement lettres', style.letterSpacing || 0, 0, 20, .5, (n) => { style.letterSpacing = n; }, ' px');
    fieldRange(typography, 'Interligne', style.lineHeight || 1.3, .8, 2.2, .05, (n) => { style.lineHeight = n; }, '×');
    fieldRange(typography, 'Ombre', style.shadow || 0, 0, 30, 1, (n) => { style.shadow = n; }, ' px');
    const decorations = document.createElement('div'); decorations.className = 'se-check-row';
    [['bold', 'Gras'], ['italic', 'Italique'], ['underline', 'Souligné'], ['strike', 'Barré']].forEach(([key, label]) => {
      const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = !!style[key];
      checkbox.onchange = () => { style[key] = checkbox.checked; if (key === 'bold') style.weight = checkbox.checked ? 700 : 400; checkpoint(); renderCanvas(); };
      decorations.appendChild(makeField(label, checkbox));
    });
    typography.appendChild(decorations);
    const textBg = document.createElement('input'); textBg.type = 'checkbox'; textBg.checked = !!style.bg;
    textBg.onchange = () => { style.bg = textBg.checked ? 'rgba(0,0,0,.72)' : null; checkpoint(); renderCanvas(); renderInspector(); };
    typography.appendChild(makeField('Fond derrière le texte', textBg));
    inspector.appendChild(typography);
  }

  function renderOverlayInspector(layer) {
    const section = makeSection('Panneau & bordure');
    if (layer._editorAlpha == null) {
      const alpha = String(layer.bg || '').match(/rgba?\([^)]*,\s*([\d.]+)\s*\)/i);
      layer._editorAlpha = alpha ? Math.max(0, Math.min(1, Number(alpha[1]))) : 1;
      layer._editorBgHex = Engine.rgbToHex(layer.bg || '#090b12');
    }
    const bgColor = makeInput('color', Engine.rgbToHex(layer.bg || '#090b12'));
    bgColor.oninput = () => { layer._editorBgHex = bgColor.value; layer.bg = Engine.hexToRgba(bgColor.value, Number(layer._editorAlpha ?? .8)); renderCanvas(); };
    bgColor.onchange = checkpoint;
    section.appendChild(makeField('Couleur du panneau', bgColor));
    fieldRange(section, 'Opacité du panneau', Math.round(Number(layer._editorAlpha ?? .8) * 100), 0, 100, 1, (n) => { layer._editorAlpha = n / 100; layer.bg = Engine.hexToRgba(layer._editorBgHex || Engine.rgbToHex(layer.bg), n / 100); }, '%');
    fieldRange(section, 'Arrondi', layer.radius || 0, 0, 80, 1, (n) => { layer.radius = n; }, ' px');
    fieldRange(section, 'Épaisseur bordure', layer.border?.width || 0, 0, 24, 1, (n) => { layer.border ||= {}; layer.border.width = n; }, ' px');
    colorField(section, 'Couleur bordure', layer.border?.color || state.accentColor || '#f5b942', (value) => { layer.border ||= {}; layer.border.color = value; });
    inspector.appendChild(section);
  }

  function renderBackgroundInspector(layer) {
    layer.source ||= { kind: 'gradient', color1: '#05060a', color2: '#19131a', fit: 'cover', blur: 0 };
    const section = makeSection('Fond image / dégradé', 'Ce fond se déplace et se redimensionne comme les autres calques.');
    const image = document.createElement('button'); image.type = 'button'; image.className = 'se-button secondary'; image.textContent = layer.source.assetId ? 'Remplacer l’image' : 'Importer une image';
    image.onclick = () => $('#se-background-file').click();
    section.appendChild(image);
    if (!layer.source.assetId && !layer.source.image) {
      colorField(section, 'Dégradé — couleur A', layer.source.color1, (value) => { layer.source.color1 = value; });
      colorField(section, 'Dégradé — couleur B', layer.source.color2, (value) => { layer.source.color2 = value; });
    }
    const fit = makeSelect([['cover', 'Remplir'], ['contain', 'Contenir']], layer.source.fit || 'cover');
    fit.onchange = () => { layer.source.fit = fit.value; checkpoint(); renderCanvas(); };
    section.appendChild(makeField('Ajustement image', fit));
    fieldRange(section, 'Flou', layer.source.blur || 0, 0, 40, 1, (n) => { layer.source.blur = n; }, ' px');
    inspector.appendChild(section);
  }

  function renderImageInspector(layer) {
    const section = makeSection('Image');
    const binding = makeSelect([['', 'Fichier du calque'], ['image', 'Image de la diapositive / annonce']], layer.bind || '');
    binding.onchange = () => { layer.bind = binding.value || null; checkpoint(); renderCanvas(); };
    section.appendChild(makeField('Source', binding));
    const replace = document.createElement('button'); replace.type = 'button'; replace.className = 'se-button secondary'; replace.textContent = layer.src ? 'Remplacer l’image' : 'Choisir une image';
    replace.onclick = () => $('#se-image-file').click();
    section.appendChild(replace);
    const fit = makeSelect([['contain', 'Contenir'], ['cover', 'Remplir']], layer.fit || 'contain');
    fit.onchange = () => { layer.fit = fit.value; checkpoint(); renderCanvas(); };
    section.appendChild(makeField('Ajustement', fit));
    const alt = makeInput('text', layer.alt || ''); alt.maxLength = 120;
    alt.onchange = () => { layer.alt = alt.value; checkpoint(); };
    section.appendChild(makeField('Texte alternatif', alt));
    inspector.appendChild(section);
  }

  function syncGeometryFields() {
    const layer = state.layers.find((item) => item.id === selectedId);
    if (!layer) return;
    inspector.querySelectorAll('[data-geometry]').forEach((input) => {
      const key = input.dataset.geometry;
      if (key && layer[key] != null) input.value = String(Math.round(Number(layer[key]) * 10) / 10);
    });
  }

  function render() {
    renderThemePresetButtons();
    renderLayerList();
    renderInspector();
    renderCanvas();
    updateHistoryButtons();
  }

  function addLayer(type) {
    const layer = Engine.createLayer(type, {
      name: type === 'text' ? 'Nouveau texte' : type === 'overlay' ? 'Nouveau panneau' : type === 'image' ? 'Nouvelle image' : 'Fond',
    });
    if (type === 'text') { layer.x = 50; layer.y = 50; layer.w = 60; layer.h = 18; layer.bind = 'custom'; layer.customText = 'Nouveau texte'; }
    if (type === 'overlay') { layer.x = 50; layer.y = 50; layer.w = 55; layer.h = 30; layer.opacity = .85; }
    state.layers.push(layer); selectedId = layer.id; checkpoint(); render();
    if (type === 'image') $('#se-image-file').click();
  }
  function deleteLayer(id) {
    const index = state.layers.findIndex((layer) => layer.id === id);
    if (index < 0) return;
    state.layers.splice(index, 1); selectedId = null; checkpoint(); render();
  }
  function moveLayer(id, delta) {
    const index = state.layers.findIndex((layer) => layer.id === id);
    const next = index + delta;
    if (index < 0 || next < 0 || next >= state.layers.length) return;
    [state.layers[index], state.layers[next]] = [state.layers[next], state.layers[index]];
    state.layers.forEach((layer) => { layer.zIndex = null; });
    checkpoint(); render();
  }

  async function getAsset(file) {
    if (onAsset) return onAsset(file);
    const url = URL.createObjectURL(file);
    return { id: null, url };
  }
  async function applyFile(file, target) {
    if (!file || !file.type.startsWith('image/')) return;
    try {
      const asset = await getAsset(file);
      if (target === 'background') {
        let layer = state.layers.find((item) => item.type === 'background');
        if (!layer) { layer = Engine.createLayer('background'); state.layers.unshift(layer); }
        layer.visible = true; layer.forceVisible = true; layer.source ||= {};
        layer.source.kind = 'image'; layer.source.image = asset.url; layer.source.assetId = asset.id || null;
        layer.source.fit ||= 'cover'; state.transparent = false; selectedId = layer.id;
      } else {
        let layer = state.layers.find((item) => item.id === selectedId && item.type === 'image');
        if (!layer) { layer = state.layers.at(-1); }
        if (!layer || layer.type !== 'image') { layer = Engine.createLayer('image', { name: file.name.replace(/\.[^.]+$/, '') || 'Image' }); state.layers.push(layer); }
        layer.name ||= file.name; layer.src = asset.url; layer.assetId = asset.id || null;
        layer.fit ||= 'contain'; selectedId = layer.id;
      }
      checkpoint(); render();
    } catch (error) {
      const alert = document.createElement('div'); alert.className = 'se-alert'; alert.textContent = `Impossible d’ajouter cette image : ${error.message || error}`;
      modal.appendChild(alert); setTimeout(() => alert.remove(), 5000);
    }
  }

  function onKeyDown(event) {
    if (!modal.isConnected) return;
    const target = event.target;
    const editing = target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
    if (event.key === 'Escape') { close(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); return; }
    if (editing || !selectedId) return;
    const layer = state.layers.find((item) => item.id === selectedId);
    if (!layer || layer.locked) return;
    const step = event.shiftKey ? 1 : .2;
    if (event.key === 'ArrowLeft') layer.x = Math.max(-layer.w / 2 + 1, layer.x - step);
    else if (event.key === 'ArrowRight') layer.x = Math.min(100 + layer.w / 2 - 1, layer.x + step);
    else if (event.key === 'ArrowUp') layer.y = Math.max(-(layer.h || 0) / 2 + 1, layer.y - step);
    else if (event.key === 'ArrowDown') layer.y = Math.min(100 + (layer.h || 0) / 2 - 1, layer.y + step);
    else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); deleteLayer(layer.id); return; }
    else return;
    event.preventDefault(); renderCanvas(); syncGeometryFields(); checkpoint();
  }

  $('#se-undo').onclick = undo;
  $('#se-redo').onclick = redo;
  $('#se-cancel').onclick = close;
  $('#se-save').onclick = async () => {
    const result = copy(state);
    close();
    await onSave(result);
  };
  $('#se-add-text').onclick = () => addLayer('text');
  $('#se-add-overlay').onclick = () => addLayer('overlay');
  $('#se-add-image').onclick = () => addLayer('image');
  $('#se-add-background').onclick = () => $('#se-background-file').click();
  $('#se-image-file').onchange = (event) => { const file = event.target.files?.[0]; event.target.value = ''; applyFile(file, 'image'); };
  $('#se-background-file').onchange = (event) => { const file = event.target.files?.[0]; event.target.value = ''; applyFile(file, 'background'); };
  $('#se-reset').onclick = () => {
    if (!confirm('Réinitialiser le préréglage actuel ? Vos changements de mise en page seront perdus.')) return;
    state = Engine.defaultScene(state.preset || 'full', kind);
    state.themeId = state.themeId || 'cinema'; selectedId = null; checkpoint(); render();
  };
  window.addEventListener('resize', resizeCanvas);
  document.addEventListener('keydown', onKeyDown);
  modal.addEventListener('DOMNodeRemoved', (event) => { if (event.target === modal) { window.removeEventListener('resize', resizeCanvas); document.removeEventListener('keydown', onKeyDown); } });
  render();
  updateHistoryButtons();
  return modal;
}

function buildShell() {
  const modal = document.createElement('div');
  modal.className = 'se-modal';
  modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-label', 'Éditeur de thème OpenPresenter');
  modal.innerHTML = `
    <header class="se-topbar">
      <div class="se-brand"><span class="se-brand-mark">OP</span><span><strong>Studio de scène</strong><small id="se-kind"></small></span></div>
      <div class="se-preset-tabs" id="se-presets" aria-label="Préréglages de disposition"></div>
      <div class="se-actions">
        <button type="button" class="se-button subtle" id="se-undo" title="Annuler (Ctrl+Z)">↶</button>
        <button type="button" class="se-button subtle" id="se-redo" title="Rétablir (Ctrl+Shift+Z)">↷</button>
        <button type="button" class="se-button secondary" id="se-reset">Réinitialiser</button>
        <button type="button" class="se-button secondary" id="se-cancel">Fermer</button>
        <button type="button" class="se-button primary" id="se-save">Enregistrer la scène</button>
      </div>
    </header>
    <div class="se-workspace">
      <aside class="se-sidebar se-left">
        <div class="se-sidebar-heading"><h2>Calques</h2><span>ORDRE D’AFFICHAGE</span></div>
        <div class="se-add-tools">
          <button type="button" class="se-add-tool" id="se-add-text" title="Ajouter un texte"><b>T</b> Texte</button>
          <button type="button" class="se-add-tool" id="se-add-image" title="Ajouter une image">▣ Image</button>
          <button type="button" class="se-add-tool" id="se-add-overlay" title="Ajouter un panneau">◩ Panneau</button>
          <button type="button" class="se-add-tool" id="se-add-background" title="Importer un fond">▧ Fond</button>
        </div>
        <div class="se-layer-list" id="se-layer-list"></div>
        <footer class="se-side-footer">Cliquez un calque pour le régler · œil pour masquer · cadenas pour verrouiller</footer>
      </aside>
      <main class="se-stage-area">
        <div class="se-stage-toolbar"><span>APERÇU 16:9 · 1920 × 1080</span><span class="se-stage-hint">Glisser pour déplacer · poignées pour redimensionner · flèches pour ajuster</span></div>
        <div class="se-canvas-frame checker-bg" id="se-canvas"><div id="se-canvas-inner"></div></div>
        <div class="se-bottom-hint">La scène affichée ici est exactement celle envoyée à OBS.</div>
      </main>
      <aside class="se-sidebar se-right"><div class="se-inspector" id="se-inspector"></div></aside>
    </div>
    <input type="file" id="se-image-file" accept="image/*" hidden>
    <input type="file" id="se-background-file" accept="image/*" hidden>
  `;
  if (!document.getElementById('openpresenter-scene-editor-style')) {
    const style = document.createElement('style');
    style.id = 'openpresenter-scene-editor-style';
    style.textContent = `
      .se-modal{position:fixed;inset:0;z-index:1000;display:flex;flex-direction:column;background:#090a10;color:#e8eaf0;font-family:Inter,system-ui,sans-serif;}
      .se-modal *{box-sizing:border-box}.se-modal button,.se-modal input,.se-modal select,.se-modal textarea{font:inherit}
      .se-topbar{height:62px;flex:none;display:flex;align-items:center;gap:18px;padding:0 18px;background:linear-gradient(105deg,#151827,#11131c);border-bottom:1px solid #262937}
      .se-brand{display:flex;align-items:center;gap:9px;min-width:180px}.se-brand-mark{display:grid;place-items:center;width:34px;height:34px;border-radius:9px;background:linear-gradient(135deg,#f5b942,#ed7856);font-weight:900;color:#111}.se-brand strong{display:block;font-size:13px;color:#fff}.se-brand small{display:block;font-size:9px;letter-spacing:1.2px;color:#9ba2b4;margin-top:2px}
      .se-preset-tabs{display:flex;align-items:center;gap:4px;flex:1;overflow:auto}.se-preset{white-space:nowrap;padding:7px 10px;background:transparent;border:1px solid transparent;border-radius:6px;color:#aab0be;font-size:11px;cursor:pointer}.se-preset:hover{background:#222636;color:#fff}.se-preset.active{background:#343044;border-color:#6d5d81;color:#fff}
      .se-actions{display:flex;gap:6px;align-items:center}.se-button{border:1px solid #343949;border-radius:6px;padding:7px 11px;background:#1b1e29;color:#d9dce5;font-size:11px;font-weight:650;cursor:pointer;white-space:nowrap}.se-button:hover{filter:brightness(1.15)}.se-button:disabled{opacity:.35;cursor:default}.se-button.primary{background:linear-gradient(135deg,#f5b942,#ed9852);border-color:transparent;color:#17120b}.se-button.secondary{background:#1a1d27}.se-button.subtle{padding:6px 9px}.se-button.danger{color:#ff9a9a;border-color:#623737;background:#28191b}
      .se-workspace{min-height:0;flex:1;display:grid;grid-template-columns:260px minmax(0,1fr) 300px;overflow:hidden}.se-sidebar{min-height:0;background:#0e1017;overflow:auto}.se-left{border-right:1px solid #252936;display:flex;flex-direction:column}.se-right{border-left:1px solid #252936}.se-sidebar-heading{padding:17px 14px 12px;border-bottom:1px solid #222632}.se-sidebar-heading h2{font-size:13px;color:#f3f4f6}.se-sidebar-heading span{display:block;margin-top:4px;font-size:8px;letter-spacing:1.3px;color:#646c7f}
      .se-add-tools{display:grid;grid-template-columns:1fr 1fr;gap:5px;padding:10px;border-bottom:1px solid #222632}.se-add-tool{border:1px solid #292e3b;background:#141720;color:#bfc4d0;padding:7px 4px;border-radius:5px;font-size:10px;cursor:pointer}.se-add-tool:hover{background:#232838;color:#fff;border-color:#555d70}.se-add-tool b{color:#f5b942}
      .se-layer-list{padding:8px;overflow:auto;flex:1}.se-layer-row{display:flex;align-items:center;margin-bottom:4px;border:1px solid transparent;border-radius:6px;background:#131620;min-height:39px}.se-layer-row.selected{background:#222333;border-color:#65536f}.se-layer-row.is-hidden{opacity:.48}.se-layer-select{display:flex;align-items:center;gap:8px;min-width:0;flex:1;padding:7px 7px;background:transparent;color:#ced1dc;text-align:left;cursor:pointer}.se-layer-icon{display:grid;place-items:center;width:20px;height:20px;flex:none;border-radius:5px;background:#262b39;color:#f5c260;font-size:11px;font-weight:800}.se-layer-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.se-layer-type{margin-left:auto;font-size:8px;color:#788092;text-transform:uppercase}.se-layer-action{width:27px;height:28px;border-radius:4px;color:#9299aa;background:transparent;cursor:pointer}.se-layer-action:hover{background:#303545;color:#fff}.se-layer-action.is-locked{color:#f5b942}.se-empty-layers{padding:15px;color:#747c8e;font-size:11px;line-height:1.5}.se-side-footer{padding:10px;color:#737a8a;font-size:9px;line-height:1.5;border-top:1px solid #222632}
      .se-stage-area{min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;padding:20px 24px;background:#10121a;overflow:hidden}.se-stage-toolbar{width:100%;max-width:1250px;display:flex;justify-content:space-between;gap:12px;margin-bottom:9px;color:#7c8495;font-size:9px;letter-spacing:.8px}.se-stage-hint{letter-spacing:0;text-align:right}.se-canvas-frame{position:relative;width:min(100%,calc((100vh - 170px)*1.7778));max-height:calc(100% - 30px);aspect-ratio:16/9;border:1px solid #4a4d58;border-radius:5px;overflow:hidden;box-shadow:0 22px 70px #0009}.se-canvas-frame #se-canvas-inner{position:absolute;top:0;left:0;transform-origin:top left}.se-bottom-hint{position:absolute;bottom:7px;font-size:9px;color:#555d6b}.se-inspector{padding:12px}.se-inspector-section{padding:11px 0 13px;border-bottom:1px solid #252936}.se-inspector-section:first-child{padding-top:4px}.se-inspector-section h3{margin:0 0 8px;color:#e7e9ef;font-size:11px;font-weight:750;letter-spacing:.3px}.se-section-hint{margin:-3px 0 9px;color:#757d8f;font-size:9px;line-height:1.4}.se-field{display:grid;grid-template-columns:98px minmax(0,1fr);gap:8px;align-items:center;margin:6px 0;color:#aab0bd;font-size:10px}.se-field-label{min-width:0}.se-field small{grid-column:2;color:#788092;font-size:9px}.se-control,.se-field input[type=text],.se-field input[type=number],.se-field select,.se-field textarea{width:100%;min-width:0;border:1px solid #303543;border-radius:4px;padding:6px 7px;background:#12151e;color:#e4e6ec;font-size:10px}.se-field input[type=color]{width:100%;height:27px;padding:2px;background:#12151e;border:1px solid #303543;border-radius:4px}.se-field input[type=checkbox]{accent-color:#f5b942;justify-self:start}.se-field input[type=range]{width:100%;accent-color:#f5b942}.se-textarea{resize:vertical;line-height:1.4}.se-range-wrap{display:flex;align-items:center;gap:7px;min-width:0}.se-range-wrap input{min-width:0;flex:1}.se-range-wrap output{min-width:42px;text-align:right;color:#c4b478;font-size:9px;font-variant-numeric:tabular-nums}.se-theme-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.se-theme-card{display:flex;align-items:center;gap:7px;min-width:0;padding:6px;border:1px solid #2c303e;border-radius:5px;background:#131620;color:#aeb4c3;font-size:9px;cursor:pointer}.se-theme-card.active{border-color:#d2a648;color:#fff;background:#211f1b}.se-theme-swatch{width:16px;height:16px;border-radius:4px;background:var(--theme-swatch);box-shadow:0 0 9px color-mix(in srgb,var(--theme-swatch),transparent 55%)}.se-check-row{display:grid;grid-template-columns:1fr 1fr;gap:0 8px}.se-inspector-actions{display:flex;flex-wrap:wrap;gap:5px;padding:10px 0}.se-inspector-actions .se-button{flex:1}.se-alert{position:absolute;bottom:20px;left:50%;transform:translateX(-50%);padding:10px 14px;background:#4a2020;color:#ffe2e2;border-radius:6px;font-size:11px;box-shadow:0 5px 20px #0008}
      .se-modal .scene-root{overflow:hidden}
      @media(max-width:1100px){.se-workspace{grid-template-columns:220px minmax(0,1fr) 260px}.se-brand{min-width:150px}.se-topbar{gap:9px;padding:0 10px}.se-stage-area{padding:12px}}
      @media(max-width:800px){.se-topbar{height:auto;min-height:58px;flex-wrap:wrap;padding:8px}.se-brand{min-width:120px}.se-preset-tabs{order:3;flex-basis:100%}.se-workspace{grid-template-columns:175px minmax(0,1fr)}.se-right{position:absolute;right:0;top:95px;bottom:0;width:min(290px,80vw);z-index:10;box-shadow:-12px 0 30px #0008}.se-stage-hint{display:none}.se-canvas-frame{width:100%}}
    `;
    document.head.appendChild(style);
  }
  return modal;
}

export default { openSceneEditor };

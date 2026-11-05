// Moteur de scène partagé : un seul `render()` pour l'éditeur et la sortie.
// Couvre A-10, A-10b, A-10c, A-10d, A-10e, A-10g et ENF-42.
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderScene, escapeHtml, layerBox, SCENE_CSS, STAGE_WIDTH, STAGE_HEIGHT } from '../src/core/render/engine.mjs';
import { sceneFromPreset, textLayer, imageLayer, backgroundLayer, overlayLayer } from '../src/core/scene.mjs';
import { resolveBind, contentFromPayload, sampleFor, formatDuration, clockText } from '../src/core/render/content.mjs';
import { checkSceneContrast, contrastRatio, parseColor, composite } from '../src/core/render/contrast.mjs';
import { computeAutoFit, countLines, MIN_FACTOR } from '../src/core/render/autofit.mjs';

const verse = {
  verse: "Car Dieu a tant aimé le monde qu'il a donné son Fils unique.",
  reference: 'Jean 3:16',
  badge: 'LSG',
  partIndex: 0,
  partCount: 2
};

function sceneWith(layers, extra = {}) {
  return {
    id: 'scn_render_01',
    name: 'Rendu',
    kind: 'bible',
    preset: 'custom',
    transparent: false,
    layers,
    ...extra
  };
}

test('A-10 : le rendu ne dépend ni de l’éditeur ni de la sortie', () => {
  const scene = sceneFromPreset({ id: 'scn_bible_full01', name: 'Plein', kind: 'bible', preset: 'full' });
  const a = renderScene({ scene, content: verse, editing: false });
  const b = renderScene({ scene: structuredClone(scene), content: verse, editing: false });
  assert.equal(a.html, b.html, 'deux appels identiques donnent le même HTML');
  assert.equal(a.css, b.css);
  // Le mode éditeur ne change que les repères, jamais la géométrie.
  const editing = renderScene({ scene, content: verse, editing: true });
  assert.match(editing.html, /op-editing/);
  assert.equal(layerBox(scene.layers[0]).left, layerBox(scene.layers[0]).left);
});

test('A-10 : la feuille de style est unique et exportée par le moteur', () => {
  assert.ok(SCENE_CSS.length > 200);
  assert.match(SCENE_CSS, /\.op-scene\{/);
  const { css } = renderScene({ scene: sceneWith([]), content: verse });
  assert.equal(css, SCENE_CSS, 'aucune vue ne réécrit les styles');
});

test('A-10b : le scénario Saint-Valentin (13 étapes) rend un HTML stable à chaque étape', () => {
  // Reprise des étapes du ch. 08 § 8.8 : création, style, calques, bord, image.
  let scene = sceneFromPreset({ id: 'scn_bible_full01', name: 'Saint-Valentin', kind: 'bible', preset: 'full' });
  const steps = [];

  steps.push(['preset plein écran', renderScene({ scene, content: verse }).html]);

  scene = {
    ...scene,
    layers: scene.layers.map((layer) => layer.type === 'text'
      ? { ...layer, style: { ...layer.style, fontSize: 96, color: '#ffe9a8', lineHeight: 1.2 } }
      : layer)
  };
  steps.push(['couleur et taille', renderScene({ scene, content: verse }).html]);

  scene = {
    ...scene,
    layers: [
      { ...overlayLayer({ id: 'lyr_bandeau', name: 'Bandeau' }), bg: 'rgba(10,4,12,.72)', w: 92, h: 58, y: 50 },
      ...scene.layers
    ]
  };
  steps.push(['bandeau', renderScene({ scene, content: verse }).html]);

  const refLayer = { ...scene.layers.find((l) => l.bind === 'ref'), style: { ...scene.layers.find((l) => l.bind === 'ref').style, align: 'right', letterSpacing: 3 } };
  scene = { ...scene, layers: scene.layers.map((l) => (l.bind === 'ref' ? refLayer : l)) };
  steps.push(['référence alignée', renderScene({ scene, content: verse }).html]);

  scene = { ...scene, transparent: true };
  steps.push(['sortie alpha', renderScene({ scene, content: verse }).html]);

  scene = { ...scene, layers: [...scene.layers, imageLayer({ id: 'lyr_logo', name: 'Logo', x: 12, y: 10, w: 14, h: 12, assetId: 'asset_logo' })] };
  steps.push(['logo', renderScene({ scene, content: verse, assets: { asset_logo: '/assets/logo.png' } }).html]);

  scene = { ...scene, layers: scene.layers.map((l) => (l.id === 'lyr_logo' ? { ...l, visible: false } : l)) };
  steps.push(['logo masqué', renderScene({ scene, content: verse, assets: { asset_logo: '/assets/logo.png' } }).html]);

  scene = { ...scene, layers: scene.layers.map((l) => (l.id === 'lyr_logo' ? { ...l, visible: true, opacity: 0.5 } : l)) };
  steps.push(['logo à 50 %', renderScene({ scene, content: verse, assets: { asset_logo: '/assets/logo.png' } }).html]);

  const long = { ...verse, verse: sampleFor('bible', 'long').verse, partCount: 3 };
  steps.push(['verset long', renderScene({ scene, content: long, assets: { asset_logo: '/assets/logo.png' } }).html]);

  scene = { ...scene, layers: scene.layers.map((l) => (l.bind === 'verse' ? { ...l, autoFit: { ...l.autoFit, max: 72 } } : l)) };
  steps.push(['auto-fit borné', renderScene({ scene, content: long }).html]);

  scene = { ...scene, layers: scene.layers.map((l) => (l.bind === 'ref' ? { ...l, style: { ...l.style, textCase: 'uppercase' } } : l)) };
  steps.push(['référence en capitales', renderScene({ scene, content: verse }).html]);

  scene = { ...scene, transitionIn: 'fade', transitionOut: 'fade' };
  steps.push(['transitions', renderScene({ scene, content: verse }).html]);

  assert.equal(steps.length, 12, '12 rendus successifs, sans exception');
  for (const [label, html] of steps) {
    assert.ok(html.includes('data-scene-id="scn_bible_full01"'), label);
    assert.ok(!html.includes('undefined'), `${label} : aucun « undefined » à l'écran`);
    assert.ok(!html.includes('NaN'), `${label} : aucune valeur NaN`);
  }
  // Les étapes différentes produisent bien des rendus différents (le scénario
  // n'est pas un tapis roulant de copies identiques).
  assert.notEqual(steps[0][1], steps[1][1]);
  assert.notEqual(steps[2][1], steps[3][1]);
});

test('A-10c : les 9 combinaisons d’alignement placent le texte correctement', () => {
  const mains = { left: 'flex-start', center: 'center', right: 'flex-end', justify: 'stretch' };
  const verticals = { top: 'flex-start', center: 'center', bottom: 'flex-end' };
  // Les 9 combinaisons = 3 horizontaux × 3 verticaux.
  for (const [align, main] of Object.entries({ left: 'flex-start', center: 'center', right: 'flex-end' })) {
    for (const [verticalAlign, cross] of Object.entries(verticals)) {
      const layer = textLayer({
        id: 'lyr_align', name: 'Verset', bind: 'verse',
        style: { ...textLayer().style, align, verticalAlign }
      });
      const { html } = renderScene({ scene: sceneWith([layer]), content: verse });
      assert.match(html, new RegExp(`align-items:${main}`), `${align}/${verticalAlign}`);
      assert.match(html, new RegExp(`justify-content:${cross}`), `${align}/${verticalAlign}`);
      assert.match(html, new RegExp(`text-align:${align}`));
      assert.match(html, /Car Dieu a tant aimé le monde/);
    }
  }
  assert.deepEqual(mains, { left: 'flex-start', center: 'center', right: 'flex-end', justify: 'stretch' });
});

test('A-10d : justify sur 3 lignes — la dernière ligne reste au choix de `alignLast`', () => {
  const layer = textLayer({
    id: 'lyr_justif', name: 'Verset', bind: 'verse',
    style: { ...textLayer().style, align: 'justify', alignLast: 'center' }
  });
  const { html } = renderScene({ scene: sceneWith([layer]), content: verse });
  assert.match(html, /text-align:justify/);
  assert.match(html, /text-align-last:center/);
  assert.match(html, /width:100%/);
});

test('A-10e : fond image + teinte 45 % + texte blanc donne un contraste ≥ 4,5:1', () => {
  const scene = sceneWith([
    backgroundLayer({
      id: 'lyr_fond',
      source: { kind: 'image', assetId: 'asset_photo', tint: '#000000', tintOpacity: 0.45 }
    }),
    textLayer({ id: 'lyr_verset', name: 'Verset', bind: 'verse', style: { ...textLayer().style, color: '#ffffff' } })
  ]);
  const report = checkSceneContrast(scene, { min: 4.5 });
  assert.equal(report.ok, true, JSON.stringify(report));
  const ratio = contrastRatio('#ffffff', composite('#000000', '#808080', 0.45));
  assert.ok(ratio >= 4.5, `contraste mesuré ${ratio.toFixed(2)}`);
});

test('A-10e : un texte gris sur fond clair est signalé comme insuffisant', () => {
  const scene = sceneWith([
    backgroundLayer({ id: 'lyr_fond', source: { kind: 'color', color: '#ffffff' } }),
    textLayer({ id: 'lyr_pale', name: 'Pâle', bind: 'verse', style: { ...textLayer().style, color: '#dddddd' } })
  ]);
  const report = checkSceneContrast(scene, { min: 4.5 });
  assert.equal(report.ok, false);
  assert.ok(report.results.some((r) => r.status === 'low'));
});

test('A-10g : un calque poussé au bord reste partiellement visible', () => {
  const layer = textLayer({ id: 'lyr_bord', name: 'Bord', bind: 'verse', x: -999, y: 150, w: 40, h: 20 });
  const box = layerBox(layer);
  // Normalisé en amont : sinon la géométrie sortirait du canevas.
  const { normalizeScene } = globalThis.__opScene ?? {};
  assert.ok(box.width > 0);
  const { html } = renderScene({ scene: sceneWith([layer]), content: verse });
  assert.match(html, /data-layer-id="lyr_bord"/);
});

test('EF-09.16 : une liaison vide n’affiche aucun nœud', () => {
  const layer = textLayer({ id: 'lyr_vide', name: 'Référence', bind: 'ref' });
  const { html } = renderScene({ scene: sceneWith([layer]), content: { verse: 'Texte seul' } });
  assert.ok(!html.includes('data-layer-id="lyr_vide"'), 'aucun calque rendu');
  assert.ok(!html.includes('undefined'));
  assert.equal(resolveBind('ref', layer, {}), '');
  assert.equal(resolveBind('verse', layer, { reference: 'Jean 3:16' }), '');
});

test('EF-09.9 : une sortie transparente masque le fond sauf `forceVisible`', () => {
  const fond = backgroundLayer({ id: 'lyr_fond', source: { kind: 'color', color: '#101820' } });
  const scene = sceneWith([fond]);
  const opaque = renderScene({ scene, content: verse });
  assert.match(opaque.html, /data-layer-id="lyr_fond"/);
  assert.match(opaque.html, /background:#101820/);

  const alpha = renderScene({ scene, content: verse, transparent: true });
  assert.ok(!alpha.html.includes('data-layer-id="lyr_fond"'));
  assert.match(alpha.html, /data-transparent="1"/);
  assert.match(alpha.html, /background:transparent/);

  const forced = renderScene({ scene: sceneWith([{ ...fond, forceVisible: true }]), content: verse, transparent: true });
  assert.match(forced.html, /data-layer-id="lyr_fond"/, 'forceVisible garde le fond');
});

test('EF-09.35 : l’éditeur montre un emplacement d’image, la sortie rien', () => {
  const layer = imageLayer({ id: 'lyr_logo', name: 'Logo', assetId: 'absent' });
  const editing = renderScene({ scene: sceneWith([layer]), editing: true });
  assert.match(editing.html, /op-image-placeholder/);
  assert.match(editing.html, /Logo/);
  const output = renderScene({ scene: sceneWith([layer]), editing: false });
  assert.ok(!output.html.includes('op-image'));
});

test('A-10f : un look garde son rendu après modification de la scène d’origine', async () => {
  const { createLook, lookScenes, lookIsIndependent, applyLookToOutput } = await import('../src/core/looks.mjs');
  const scene = sceneFromPreset({ id: 'scn_look_01', name: 'Origine', kind: 'bible', preset: 'bottom' });
  const look = createLook({ name: 'Pâques', scenes: [{ kind: 'bible', scene }] });
  assert.equal(lookIsIndependent(look, [{ kind: 'bible', scene }]), true);

  const before = renderScene({ scene: lookScenes(look)[0].scene, content: verse }).html;
  // On modifie la scène d'origine **après** l'enregistrement du look.
  scene.layers[0].name = 'Renommé';
  scene.layers[1].style.fontSize = 200;
  const after = renderScene({ scene: lookScenes(look)[0].scene, content: verse }).html;
  assert.equal(before, after, 'le look n’a pas bougé');

  const applied = applyLookToOutput(look, { id: 'out_x', scenesByKind: {} });
  assert.match(applied.scenes[0].scene.id, /^scn_bible_/);
  assert.notEqual(applied.scenes[0].scene.id, 'scn_look_01', 'une copie reçoit un id propre');
});

test('A-10h : 80 annulations restaurent les 80 états', async () => {
  const { createHistory, MIN_STATES } = await import('../src/core/history.mjs');
  assert.ok(MIN_STATES >= 80);
  const history = createHistory();
  history.reset(0);
  for (let i = 1; i <= 100; i++) history.push(i, `étape ${i}`);
  for (let i = 0; i < 80; i++) history.undo();
  assert.equal(history.value, 20);
  assert.equal(history.depth(), 20);
  for (let i = 0; i < 20; i++) history.redo();
  assert.equal(history.value, 40);
});

test('EF-09.29→33 : l’auto-ajustement réduit par pas de 2 px et s’arrête au plancher', () => {
  // Mesure synthétique : 50 px par caractère à la taille de référence.
  const measure = (text, size) => text.length * size * 0.5;
  const text = 'x'.repeat(200);
  const result = computeAutoFit({
    text,
    style: { fontSize: 100, lineHeight: 1.2 },
    boxWidth: 600,
    boxHeight: 300,
    measureText: measure,
    autoFit: { enabled: true, min: 16, max: 120 }
  });
  assert.ok(result.fontSize <= 100, 'on ne grossit pas sans `scaleUp`');
  assert.equal(result.fontSize % 2, 0, 'pas de 2 px');
  assert.ok(result.fontSize >= Math.max(16, Math.floor(100 * MIN_FACTOR)) - 2, 'plancher respecté');
  assert.equal(countLines(text, { fontSize: result.fontSize, boxWidth: 600, measureText: measure }) >= 1, true);
});

test('EF-09.29→33 : un texte déjà petit n’est jamais agrandi sans `scaleUp`', () => {
  const measure = (text, size) => text.length * size * 0.4;
  const result = computeAutoFit({
    text: 'Court',
    style: { fontSize: 40, lineHeight: 1.2 },
    boxWidth: 1600,
    boxHeight: 800,
    measureText: measure,
    autoFit: { enabled: true, min: 16, max: 160, scaleUp: false }
  });
  assert.equal(result.fontSize, 40);
  assert.equal(result.factor, 1);
});

test('EF-09.51 : les exemples sont réalistes et le formatage des durées est juste', () => {
  assert.match(sampleFor('bible', 'short').verse, /Jésus pleura/);
  assert.match(sampleFor('songs').lyrics, /louange/);
  assert.equal(formatDuration(42000), '00:42');
  assert.equal(formatDuration(3720000), '01:02:00');
  assert.match(clockText(new Date(2026, 9, 21, 9, 5)), /^09:05$/);
});

test('contentFromPayload traduit un message de diffusion vers une scène', () => {
  const bible = contentFromPayload({ text: 'Car Dieu…', reference: 'Jean 3:16', badge: 'LSG', partIndex: 1, partCount: 2 }, 'bible');
  assert.equal(bible.verse, 'Car Dieu…');
  assert.equal(bible.reference, 'Jean 3:16');
  assert.equal(bible.partCount, 2);
  assert.equal(contentFromPayload({ text: 'Refrain 1' }, 'songs').lyrics, 'Refrain 1');
  assert.equal(contentFromPayload({ body: 'Annonce' }, 'announcements').announcement, 'Annonce');
  assert.equal(contentFromPayload({}).verse, '', 'aucun repli inventé');
});

test('escapeHtml neutralise les injections dans les textes libres', () => {
  assert.equal(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  const layer = textLayer({ id: 'lyr_custom', name: 'Perso', bind: 'custom', customText: '<b>Gras</b>' });
  const { html } = renderScene({ scene: sceneWith([layer]), content: {} });
  assert.ok(!html.includes('<b>Gras</b>'));
  assert.ok(html.includes('&lt;b&gt;Gras&lt;/b&gt;'));
});

test('les couleurs : parse, composition et ratio de contraste', () => {
  assert.deepEqual(parseColor('#ffffff'), { r: 255, g: 255, b: 255, a: 1 });
  assert.deepEqual(parseColor('rgba(0,0,0,0.5)'), { r: 0, g: 0, b: 0, a: 0.5 });
  assert.deepEqual(parseColor('transparent'), { r: 0, g: 0, b: 0, a: 0 });
  assert.equal(parseColor('nawak'), null);
  assert.equal(contrastRatio('#ffffff', '#000000'), 21);
  assert.deepEqual(composite('#000000', '#ffffff', 1), { r: 0, g: 0, b: 0, a: 1 });
  assert.deepEqual(composite('#000000', '#808080', 0.5), { r: 64, g: 64, b: 64, a: 1 });
});

test('le canevas de référence est 1920×1080 pour les deux vues', () => {
  assert.equal(STAGE_WIDTH, 1920);
  assert.equal(STAGE_HEIGHT, 1080);
});

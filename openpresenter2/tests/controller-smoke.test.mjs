import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';

const indexPath = fileURLToPath(new URL('../index.html', import.meta.url));
const html = readFileSync(indexPath, 'utf8');

// Exercise the actual module script against a browser-like DOM. Geometry is zero in
// happy-dom, but lifecycle, event wiring, importing, Preview/Program and editor mount
// all run through the real controller code.
test('controller boots, loads the demo Bible, previews, takes live, and opens editor', async (t) => {
  const window = new Window({ url: 'http://localhost:8000/openpresenter2/index.html' });
  const previous = new Map();
  const globals = {
    window,
    document: window.document,
    location: window.location,
    DOMParser: window.DOMParser,
    HTMLElement: window.HTMLElement,
    Event: window.Event,
    CSS: window.CSS,
    getComputedStyle: window.getComputedStyle.bind(window),
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
    indexedDB: window.indexedDB,
    confirm: () => true,
    prompt: () => null,
    fetch: async (url) => {
      assert.equal(url, './api/network-addresses');
      return { ok: true, json: async () => ({ port: 8788, addresses: [{ name: 'wlan0', address: '192.168.1.44' }] }) };
    },
  };
  Object.defineProperty(window.CSS, 'escape', { value: window.CSS.escape || ((value) => String(value).replace(/[^a-zA-Z0-9_-]/g, '\\$&')), configurable: true });
  for (const [key, value] of Object.entries(globals)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value, writable: true, configurable: true });
  }
  const channels = [];
  window.RemoteChannel = class {
    constructor(name) { this.name = name; this.messages = []; this.onmessage = null; channels.push(this); }
    postMessage(message) { this.messages.push(message); }
  };
  const modulePath = fileURLToPath(new URL('../.controller-smoke-module.mjs', import.meta.url));
  t.after(async () => {
    await window.happyDOM.abort();
    try { unlinkSync(modulePath); } catch { /* already removed */ }
    for (const [key] of Object.entries(globals)) {
      const descriptor = previous.get(key);
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });

  window.document.write(html.replace(/<script[\s\S]*?<\/script>/gi, ''));
  const moduleSource = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(moduleSource, 'controller module script exists');
  writeFileSync(modulePath, moduleSource);
  await import(`${pathToFileURL(modulePath).href}?smoke=${Date.now()}`);
  await new Promise((resolve) => setTimeout(resolve, 60));

  window.document.getElementById('bible-load-sample').click();
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.equal(window.document.querySelector('.book-item')?.querySelector('span')?.textContent, 'Jean');
  assert.equal(window.document.querySelectorAll('.verse-item').length, 4);
  const quickBibleEntry = window.document.getElementById('bible-quick-entry');
  quickBibleEntry.value = '3:16-17'; quickBibleEntry.dispatchEvent(new window.Event('input', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(window.document.querySelectorAll('.verse-item.quick-target').length, 2, 'rapid Bible input highlights a single verse range before take');
  quickBibleEntry.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 100));
  const quickBibleLive = [...channels.find((channel) => channel.name === 'op_channel_main').messages].reverse().find((message) => message.action === 'show' && message.scene.kind === 'bible' && message.bindings.ref === 'Jean 3:16-17');
  assert.ok(quickBibleLive, 'pressing Enter rapidly previews and diffuses the requested Bible range');

  window.document.querySelector('.nav-btn[data-module="plan"]').click();
  window.document.getElementById('plan-add').click();
  const planBook = window.document.getElementById('plan-bible-book');
  planBook.value = [...planBook.options].find((option) => option.textContent === 'Jean').value;
  planBook.dispatchEvent(new window.Event('change', { bubbles: true }));
  const planChapter = window.document.getElementById('plan-bible-chapter'); planChapter.value = '3'; planChapter.dispatchEvent(new window.Event('change', { bubbles: true }));
  window.document.getElementById('plan-bible-verse').value = '16';
  window.document.getElementById('plan-add-confirm').click();
  assert.equal(window.document.querySelector('.plan-cue-title')?.textContent, '📖 Jean 3:16');
  const planImport = window.document.getElementById('plan-import-file');
  Object.defineProperty(planImport, 'files', { value: [new window.File(['Jean 3:16\nPrière'], 'culte.csv', { type: 'text/csv' })], configurable: true });
  planImport.dispatchEvent(new window.Event('change', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(window.document.getElementById('plan-count').textContent, '2 étapes', 'CSV import replaces the existing order with Bible references and structural notes');
  window.document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.ok(channels.some((channel) => channel.name === 'op_channel_main' && channel.messages.some((message) => message.action === 'show' && message.bindings.ref === 'Jean 3:16')), 'advancing the service plan diffuses its Bible step');
  const planningJson = JSON.stringify({ plan: { items: [{ attributes: { item_type: 'scripture', title: 'Jean 3:17' } }, { attributes: { item_type: 'item', title: 'Offrande' } }] } });
  Object.defineProperty(planImport, 'files', { value: [new window.File([planningJson], 'planning-center.json', { type: 'application/json' })], configurable: true });
  planImport.dispatchEvent(new window.Event('change', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(window.document.getElementById('plan-count').textContent, '2 étapes');
  assert.equal(window.document.querySelectorAll('.plan-cue-title')[0]?.textContent, '📖 Jean 3:17', 'Planning Center JSON is converted into a structured Bible cue');
  assert.match(window.document.querySelectorAll('.plan-cue-title')[1]?.textContent || '', /Offrande/);

  const secondBibleXml = '<bible translation="Traduction témoin"><book number="43" name="Jean"><chapter number="3"><verse number="16">Texte parallèle version témoin numéro seize.</verse><verse number="17">Texte parallèle version témoin numéro dix-sept.</verse></chapter></book></bible>';
  const bibleFile = new window.File([secondBibleXml], 'parallele.xml', { type: 'application/xml' });
  const bibleInput = window.document.getElementById('bible-import-xml');
  Object.defineProperty(bibleInput, 'files', { value: [bibleFile], configurable: true });
  bibleInput.dispatchEvent(new window.Event('change', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 120));
  const primaryTab = [...window.document.querySelectorAll('#version-tabs .version-tab')].find((button) => button.textContent === 'Exemple LSG');
  assert.ok(primaryTab, 'the imported translation is available alongside the sample Bible');
  primaryTab.click();
  await new Promise((resolve) => setTimeout(resolve, 80));
  const dualToggle = window.document.getElementById('bible-dual-enable');
  const dualVersion = window.document.getElementById('bible-dual-version');
  assert.equal(dualToggle.disabled, false);
  dualVersion.value = [...dualVersion.options].find((option) => option.textContent === 'Traduction témoin').value;
  dualVersion.dispatchEvent(new window.Event('change', { bubbles: true }));
  dualToggle.checked = true; dualToggle.dispatchEvent(new window.Event('change', { bubbles: true }));
  window.document.querySelector('.book-item').click();
  [...window.document.querySelectorAll('#chapters-grid .chapter-btn')].find((button) => button.textContent === '3').click();
  assert.equal(window.document.querySelectorAll('.verse-item').length, 4);

  window.document.querySelector('.verse-item').click();
  assert.equal(window.document.getElementById('btn-take').disabled, false, 'a selected verse is available in Preview');
  window.document.getElementById('bible-note').click();
  assert.equal(window.document.getElementById('bible-annotation-modal').getAttribute('aria-hidden'), 'false');
  const annotationEditor = window.document.getElementById('bible-verse-editor');
  annotationEditor.innerHTML = 'Car Dieu a <strong onclick="alert(1)">tant aimé</strong> le monde qu\'il a donné son Fils unique, afin que quiconque croit en lui ne périsse point, mais qu\'il ait la vie éternelle.<script>alert(2)</script>';
  window.document.getElementById('bible-annotation-note').value = 'À lire lentement';
  window.document.getElementById('annotation-save').click();
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(window.document.getElementById('bible-annotation-modal').getAttribute('aria-hidden'), 'true');
  assert.ok(window.document.querySelector('#out-preview-canvas .parallel-version-copy strong'), 'rich Bible annotation is rendered in the Preview');
  window.document.getElementById('btn-take').click();
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.equal(window.document.querySelectorAll('#out-main-canvas .scene-root').length, 1);
  assert.equal(window.document.querySelectorAll('#out-annexe-canvas .scene-root').length, 1);
  assert.deepEqual([...window.document.querySelectorAll('#out-main-canvas .parallel-version-label')].map((label) => label.textContent), ['Exemple LSG', 'Traduction témoin']);
  assert.match(window.document.querySelector('#out-main-canvas .parallel-version-copy').textContent, /Car Dieu a tant aimé/);
  const annotatedLive = [...channels.find((channel) => channel.name === 'op_channel_main').messages].reverse().find((message) => message.action === 'show' && message.bindings.verseHtml);
  assert.ok(annotatedLive);
  assert.match(annotatedLive.bindings.verseHtml, /<strong>tant aimé<\/strong>/);
  assert.doesNotMatch(annotatedLive.bindings.verseHtml, /onclick|script|alert\(/i);
  assert.doesNotMatch(JSON.stringify(annotatedLive.bindings), /À lire lentement/, 'regie notes are never sent to projection outputs');
  assert.ok(channels.some((channel) => channel.messages.some((message) => message.action === 'show')));
  const mainChannel = channels.find((channel) => channel.name === 'op_channel_main');
  mainChannel.onmessage({ data: { action: 'ready', scene: 'main' } });
  mainChannel.onmessage({ data: { action: 'remoteHello', scene: 'main' } });
  mainChannel.onmessage({ data: { action: 'remoteCommand', command: 'next', scene: 'main' } });
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.ok(mainChannel.messages.some((message) => message.action === 'remoteAck'));
  assert.ok(mainChannel.messages.some((message) => message.action === 'show' && message.bindings.ref === 'Jean 3:17'));
  const parallelNextVerse = [...mainChannel.messages].reverse().find((message) => message.action === 'show' && message.bindings.ref === 'Jean 3:17');
  assert.equal(parallelNextVerse.bindings.parallelVersions[1].verse, 'Texte parallèle version témoin numéro dix-sept.', 'remote navigation advances the secondary translation to the matching verse');

  // The chapter picker should remain visible after selecting a book.
  window.document.getElementById('bible-back').click();
  window.document.querySelector('.book-item').click();
  assert.equal(window.document.getElementById('chapters-grid').classList.contains('visible'), true);
  [...window.document.querySelectorAll('#chapters-grid .chapter-btn')].find((button) => button.textContent === '3').click();
  assert.equal(window.document.querySelectorAll('.verse-item').length, 4);

  const bibleMultiButton = window.document.getElementById('bible-multiselect');
  bibleMultiButton.click();
  const bibleRows = [...window.document.querySelectorAll('.verse-item')];
  bibleRows[0].click(); bibleRows[1].click();
  assert.equal(window.document.getElementById('bible-selection-count').textContent, '2', 'Bible supports selecting multiple verses in one chapter');
  window.document.getElementById('bible-selection-preview').click();
  assert.equal(window.document.getElementById('bible-multiselect').classList.contains('active'), false, 'preparing the passage exits selection mode');
  assert.equal(window.document.getElementById('btn-take').disabled, false);
  const passagePreview = window.document.querySelector('#out-preview-canvas .parallel-version-copy');
  assert.match(passagePreview.textContent, /Car Dieu a tant aimé le monde/);
  window.document.getElementById('btn-take').click();
  await new Promise((resolve) => setTimeout(resolve, 100));
  const combinedPassage = [...mainChannel.messages].reverse().find((message) => message.action === 'show' && message.bindings.ref === 'Jean 3:16-17');
  assert.ok(combinedPassage, 'the combined reference is broadcast to the live outputs');
  assert.match(combinedPassage.bindings.parallelVersions[1].verse, /numéro seize\. Texte parallèle version témoin numéro dix-sept/);
  assert.match(combinedPassage.bindings.verseHtml, /<strong>tant aimé<\/strong>/, 'verse annotations are retained in a multi-verse passage');
  window.document.querySelector('.verse-item').click(); window.document.getElementById('btn-take').click();
  await new Promise((resolve) => setTimeout(resolve, 100));

  window.document.getElementById('output-scene-select').value = 'annexe';
  window.document.getElementById('btn-editor').click();
  await new Promise((resolve) => setTimeout(resolve, 40));
  assert.equal(window.document.querySelectorAll('.se-modal').length, 1);
  assert.equal(window.document.querySelectorAll('.se-preset').length, 5);
  assert.ok(window.document.querySelectorAll('.se-layer-row').length >= 4);
  assert.equal(window.document.querySelectorAll('#se-canvas .parallel-version-label').length, 2, 'the WYSIWYG editor previews both Bible translations together');
  const customLookSection = [...window.document.querySelectorAll('#se-inspector .se-inspector-section')].find((section) => section.querySelector('h3')?.textContent === 'Looks personnalisés');
  assert.ok(customLookSection, 'the scene inspector exposes reusable custom looks');
  const customLookName = customLookSection.querySelector('input[type="text"]');
  customLookName.value = 'Look test Bible';
  [...customLookSection.querySelectorAll('button')].find((button) => button.textContent === 'Enregistrer').click();
  await new Promise((resolve) => setTimeout(resolve, 80));
  const lookPicker = [...window.document.querySelectorAll('#se-inspector .se-inspector-section')].find((section) => section.querySelector('h3')?.textContent === 'Looks personnalisés')?.querySelector('select');
  assert.ok([...lookPicker.options].some((option) => option.textContent === 'Look test Bible'), 'custom look is added to the reusable list');
  window.document.querySelector('.se-theme-card[title="Néon"]').click();
  const customLookActions = [...window.document.querySelectorAll('#se-inspector .se-inspector-section')].find((section) => section.querySelector('h3')?.textContent === 'Looks personnalisés');
  [...customLookActions.querySelectorAll('button')].find((button) => button.textContent === 'Appliquer à cette sortie').click();
  assert.equal(window.document.querySelector('.se-theme-card.active')?.title, 'Cinéma', 'applying a saved look restores its full scene style');
  const editorCanvas = window.document.getElementById('se-canvas');
  editorCanvas.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 960, bottom: 540, width: 960, height: 540 });
  window.dispatchEvent(new window.Event('resize'));
  window.document.querySelector('.se-theme-card[title="Néon"]').click();
  const outputInspector = [...window.document.querySelectorAll('#se-inspector .se-inspector-section')].find((section) => section.querySelector('h3')?.textContent === 'Affichage');
  const splitMode = outputInspector.querySelector('select');
  assert.equal(splitMode.value, 'auto', 'the annexe preset starts with its own long-text split mode');
  const splitChars = window.document.querySelector('#se-inspector input[type="range"]');
  splitChars.value = '60';
  splitChars.dispatchEvent(new window.Event('input', { bubbles: true }));
  splitChars.dispatchEvent(new window.Event('change', { bubbles: true }));
  const verseLayerRow = [...window.document.querySelectorAll('.se-layer-row')].find((row) => row.textContent.includes('Verset'));
  verseLayerRow.querySelector('.se-layer-select').click();
  const layerSelector = `#se-canvas-inner [data-layer-id="${verseLayerRow.dataset.layerId}"]`;
  const verseLayer = window.document.querySelector(layerSelector);
  const startX = Number(verseLayer.style.left.replace('%', ''));
  verseLayer.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: 480, clientY: 270 }));
  window.dispatchEvent(new window.PointerEvent('pointermove', { bubbles: true, button: 0, clientX: 510, clientY: 270 }));
  window.dispatchEvent(new window.PointerEvent('pointerup', { bubbles: true, button: 0, clientX: 510, clientY: 270 }));
  await new Promise((resolve) => setTimeout(resolve, 50));
  const movedX = Number(window.document.querySelector(layerSelector).style.left.replace('%', ''));
  assert.ok(movedX > startX, 'WYSIWYG layer dragging updates the normalized scene geometry');
  window.document.getElementById('se-save').click();
  await new Promise((resolve) => setTimeout(resolve, 250));
  const annexeChannel = channels.find((channel) => channel.name === 'op_channel_annexe');
  assert.ok(annexeChannel.messages.some((message) => message.action === 'show' && message.scene.themeId === 'neon' && message.scene.layers.some((layer) => layer.name === 'Verset' && layer.x > 53)));
  assert.ok(mainChannel.messages.some((message) => message.action === 'show' && message.scene.themeId === 'cinema'));
  let annexeBible = [...annexeChannel.messages].reverse().find((message) => message.action === 'show' && message.scene.kind === 'bible');
  let mainBible = [...mainChannel.messages].reverse().find((message) => message.action === 'show' && message.scene.kind === 'bible');
  assert.ok(annexeBible.bindings.parts?.length > 1, 'the annexe splits long Bible text using its own scene settings');
  assert.match(annexeBible.bindings.verseHtml, /<strong>tant aimé<\/strong>/, 'rich formatting follows the matching split segment');
  assert.ok(window.document.querySelector('#out-annexe-canvas .parallel-version-copy strong'));
  assert.equal(annexeBible.bindings.verse, annexeBible.bindings.parts[0]);
  assert.equal(mainBible.bindings.parts, undefined, 'the main output keeps full text according to its independent scene settings');
  annexeChannel.onmessage({ data: { action: 'remoteCommand', command: 'part-next', scene: 'annexe' } });
  await new Promise((resolve) => setTimeout(resolve, 100));
  annexeBible = [...annexeChannel.messages].reverse().find((message) => message.action === 'show' && message.scene.kind === 'bible');
  mainBible = [...mainChannel.messages].reverse().find((message) => message.action === 'show' && message.scene.kind === 'bible');
  assert.equal(annexeBible.bindings.partIndex, 1, 'part navigation advances only the annexe output');
  assert.equal(mainBible.bindings.parts, undefined);

  window.document.querySelector('.nav-btn[data-module="songs"]').click();
  window.document.getElementById('songs-new').click();
  window.document.getElementById('song-edit-title').value = 'Amazing Grace';
  window.document.getElementById('song-edit-artist').value = 'John Newton';
  window.document.getElementById('song-edit-source').value = '[Verse 1]\nAmazing grace\n\n[Chorus]\nI will sing';
  window.document.getElementById('song-edit-source').dispatchEvent(new window.Event('input', { bubbles: true }));
  window.document.getElementById('song-edit-save').click();
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(window.document.getElementById('song-title').textContent, 'Amazing Grace');
  assert.equal(window.document.querySelectorAll('.song-section-card').length, 2);
  window.document.getElementById('btn-editor').click();
  await new Promise((resolve) => setTimeout(resolve, 60));
  const songLookSection = [...window.document.querySelectorAll('#se-inspector .se-inspector-section')].find((section) => section.querySelector('h3')?.textContent === 'Looks personnalisés');
  const songLookPicker = songLookSection.querySelector('select');
  songLookPicker.value = [...songLookPicker.options].find((option) => option.textContent === 'Look test Bible').value;
  songLookPicker.dispatchEvent(new window.Event('change', { bubbles: true }));
  window.document.querySelector('.se-theme-card[title="Chaleureux"]').click();
  const songLookUpdate = [...window.document.querySelectorAll('#se-inspector .se-inspector-section')].find((section) => section.querySelector('h3')?.textContent === 'Looks personnalisés');
  [...songLookUpdate.querySelectorAll('button')].find((button) => button.textContent === 'Mettre à jour').click();
  await new Promise((resolve) => setTimeout(resolve, 80));
  window.document.getElementById('se-cancel').click();
  window.document.querySelector('.nav-btn[data-module="bible"]').click();
  window.document.getElementById('btn-editor').click();
  await new Promise((resolve) => setTimeout(resolve, 60));
  const bibleLookSection = [...window.document.querySelectorAll('#se-inspector .se-inspector-section')].find((section) => section.querySelector('h3')?.textContent === 'Looks personnalisés');
  const bibleLookPicker = bibleLookSection.querySelector('select');
  bibleLookPicker.value = [...bibleLookPicker.options].find((option) => option.textContent === 'Look test Bible').value;
  bibleLookPicker.dispatchEvent(new window.Event('change', { bubbles: true }));
  const applyPairedLook = [...window.document.querySelectorAll('#se-inspector button')].find((button) => button.textContent === 'Appliquer Bible + Paroles');
  assert.ok(applyPairedLook, 'a named custom look can store Bible and song scenes together, as in V1');
  applyPairedLook.click();
  await new Promise((resolve) => setTimeout(resolve, 100));
  window.document.getElementById('se-cancel').click();
  window.document.querySelector('.nav-btn[data-module="songs"]').click();
  const songQuickEntry = window.document.getElementById('song-quick-entry');
  songQuickEntry.value = '2'; songQuickEntry.dispatchEvent(new window.Event('input', { bubbles: true }));
  assert.ok(window.document.querySelectorAll('.song-section-card')[1].classList.contains('quick-target'));
  songQuickEntry.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.ok([...channels.find((channel) => channel.name === 'op_channel_main').messages].reverse().find((message) => message.action === 'show' && message.scene.kind === 'songs')?.bindings.lyrics.includes('I will sing'), 'quick section input takes the selected song section');
  window.document.getElementById('song-take').click();
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.ok(channels.find((channel) => channel.name === 'op_channel_main').messages.some((message) => message.action === 'show' && message.scene.kind === 'songs' && message.bindings.title === 'Amazing Grace'));
  window.document.getElementById('songs-multiselect').click();
  const songCards = [...window.document.querySelectorAll('.song-section-card')];
  songCards[0].click(); songCards[1].click();
  assert.equal(window.document.getElementById('song-selection-count').textContent, '2', 'multiple song sections can be selected');
  window.document.getElementById('song-selection-preview').click();
  const multiSongPreview = window.document.getElementById('out-preview-canvas').textContent;
  assert.match(multiSongPreview, /Couplet 1 \+ Refrain/, 'the selected song sections are combined in song order');
  assert.match(multiSongPreview, /Amazing grace[\s\S]*I will sing/);
  window.document.getElementById('song-take').click();
  await new Promise((resolve) => setTimeout(resolve, 100));
  const multiSongLive = [...mainChannel.messages].reverse().find((message) => message.action === 'show' && message.scene.kind === 'songs' && message.bindings.section === 'Couplet 1 + Refrain');
  assert.ok(multiSongLive);
  assert.match(multiSongLive.bindings.lyrics, /Amazing grace[\s\S]*I will sing/);

  window.document.querySelector('.nav-btn[data-module="slides"]').click();
  window.document.getElementById('announcement-title').value = 'Bienvenue';
  window.document.getElementById('announcement-body').value = 'Nous sommes heureux de vous accueillir.';
  window.document.getElementById('announcement-save').click();
  await new Promise((resolve) => setTimeout(resolve, 30));
  window.document.getElementById('announcement-preview').click();
  window.document.getElementById('slides-take').click();
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.ok(mainChannel.messages.some((message) => message.action === 'show' && message.scene.kind === 'announcements' && message.bindings.announcement.includes('accueillir')));

  window.document.getElementById('announcement-new').click();
  window.document.getElementById('announcement-title').value = 'Annonce suivante';
  window.document.getElementById('announcement-body').value = 'Deuxième annonce de la séquence.';
  window.document.getElementById('announcement-save').click();
  await new Promise((resolve) => setTimeout(resolve, 30));
  mainChannel.onmessage({ data: { action: 'remoteCommand', command: 'next', scene: 'main' } });
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.ok([...mainChannel.messages].reverse().find((message) => message.action === 'show')?.bindings.title === 'Annonce suivante', 'remote next advances the live announcement');
  mainChannel.onmessage({ data: { action: 'remoteCommand', command: 'prev', scene: 'main' } });
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.ok([...mainChannel.messages].reverse().find((message) => message.action === 'show')?.bindings.title === 'Bienvenue', 'remote previous returns to the prior live announcement');

  window.document.querySelector('.nav-btn[data-module="lowerthird"]').click();
  window.document.getElementById('lowerthird-name').value = 'Pasteur invité';
  window.document.getElementById('lowerthird-title').value = 'Jean Dupont';
  window.document.getElementById('lowerthird-subtitle').value = 'Église de la Grâce · Cotonou';
  window.document.getElementById('lowerthird-duration').value = '1';
  window.document.getElementById('lowerthird-save').click();
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(window.document.getElementById('lowerthird-preset-select').options.length, 2, 'saved lower thirds are reusable local presets');
  window.document.querySelector('.nav-btn[data-module="plan"]').click();
  window.document.getElementById('plan-add').click();
  const planKind = window.document.getElementById('plan-cue-kind'); planKind.value = 'lowerthird'; planKind.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(window.document.getElementById('plan-lowerthird').options.length, 1);
  window.document.getElementById('plan-add-confirm').click();
  assert.match([...window.document.querySelectorAll('.plan-cue-title')].at(-1).textContent, /Pasteur invité/);
  [...window.document.querySelectorAll('.plan-cue-row .fire')].at(-1).click();
  await new Promise((resolve) => setTimeout(resolve, 100));
  const lowerThirdChannel = channels.find((channel) => channel.name === 'op_channel_lt');
  let lowerThirdLive = [...lowerThirdChannel.messages].reverse().find((message) => message.action === 'show' && message.scene.kind === 'lowerthird');
  assert.ok(lowerThirdLive);
  assert.equal(lowerThirdLive.bindings.announcement, 'Église de la Grâce · Cotonou');
  window.document.querySelector('.nav-btn[data-module="lowerthird"]').click();
  window.document.getElementById('lowerthird-take').click();
  await new Promise((resolve) => setTimeout(resolve, 1150));
  assert.ok(lowerThirdChannel.messages.some((message) => message.action === 'hide'), 'the configured duration automatically clears the lower-third output');
  const legacyLowerThirdExport = { 'Invité rétro': { texts: { t: 'Jean Dupont', s: 'Pasteur invité' }, media: { url: '' }, global: { duration: '0', animIn: 'popIn', animOut: 'zoomOut', posx: '50', posy: '85', scale: '1' }, title: { font: 'Inter', weight: '700', size: '2', bg1: '#111827', bg2: '#312e81', opa: '0.9', bordl: '4', bordc: '#f5b942' }, sub: { font: 'Inter', weight: '500', size: '1.2', bg1: '#111827', bg2: '#1f2937', opa: '0.8' }, logo: {} } };
  const lowerThirdImport = window.document.getElementById('lowerthird-import-file');
  Object.defineProperty(lowerThirdImport, 'files', { value: [new window.File([JSON.stringify(legacyLowerThirdExport)], 'lowerthird-presets.json', { type: 'application/json' })], configurable: true });
  lowerThirdImport.dispatchEvent(new window.Event('change', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 100));
  const importedLegacyOption = [...window.document.getElementById('lowerthird-preset-select').options].find((option) => option.textContent === 'Invité rétro');
  assert.ok(importedLegacyOption, 'the V1 lower-third preset JSON format can be imported');
  window.document.getElementById('lowerthird-preset-select').value = importedLegacyOption.value;
  window.document.getElementById('lowerthird-preset-select').dispatchEvent(new window.Event('change', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 80));
  window.document.getElementById('lowerthird-preview').click(); window.document.getElementById('lowerthird-take').click();
  await new Promise((resolve) => setTimeout(resolve, 80));
  const importedLegacyLive = [...lowerThirdChannel.messages].reverse().find((message) => message.action === 'show' && message.scene.kind === 'lowerthird');
  assert.equal(importedLegacyLive.scene.transitionIn, 'zoom', 'legacy lower-third entrance animation is mapped to the V2 scene transition');
  assert.equal(importedLegacyLive.bindings.title, 'Jean Dupont');

  window.document.querySelector('.nav-btn[data-module="timer"]').click();
  window.document.getElementById('timer-minutes').value = '0';
  window.document.getElementById('timer-seconds').value = '3';
  window.document.getElementById('timer-seconds').dispatchEvent(new window.Event('change', { bubbles: true }));
  window.document.getElementById('timer-preview').click();
  window.document.getElementById('timer-take').click();
  window.document.getElementById('timer-start').click();
  await new Promise((resolve) => setTimeout(resolve, 1100));
  assert.ok(mainChannel.messages.some((message) => message.action === 'show' && message.scene.kind === 'timer' && message.bindings.timer === '00:02'));
  const bibleSelectionBeforeTimerNavigation = window.document.getElementById('bible-selection-info').textContent;
  const liveUpdatesBeforeTimerNavigation = mainChannel.messages.filter((message) => message.action === 'show').length;
  mainChannel.onmessage({ data: { action: 'remoteCommand', command: 'next', scene: 'main' } });
  await new Promise((resolve) => setTimeout(resolve, 80));
  assert.equal(window.document.getElementById('bible-selection-info').textContent, bibleSelectionBeforeTimerNavigation, 'remote next while the timer is live must not navigate the Bible');
  assert.equal(mainChannel.messages.filter((message) => message.action === 'show').length, liveUpdatesBeforeTimerNavigation, 'remote next while the timer is live must not replace the live timer');
  window.document.getElementById('timer-pause').click();
  window.document.getElementById('output-scene-select').value = 'annexe';
  window.document.getElementById('output-scene-select').dispatchEvent(new window.Event('change', { bubbles: true }));

  window.document.getElementById('btn-remote').click();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(window.document.getElementById('remote-network-picker').style.display, 'block');
  assert.match(window.document.getElementById('remote-url').textContent, /^http:\/\/192\.168\.1\.44:8000\/openpresenter2\/app\/remote\.html\?scene=annexe/);
  assert.equal(window.document.getElementById('remote-network-address').value, '192.168.1.44');
  window.document.getElementById('remote-network-custom').value = '10.0.0.22';
  window.document.getElementById('remote-network-apply').click();
  assert.match(window.document.getElementById('remote-url').textContent, /^http:\/\/10\.0\.0\.22:8000\/openpresenter2\/app\/remote\.html\?scene=annexe/);

  // Dynamic outputs keep their own name, dimensions, framing, theme, and live channel.
  window.document.getElementById('btn-outputs').click();
  window.document.getElementById('output-new-name').value = 'Écran musiciens';
  window.document.getElementById('output-new-preset').value = 'lowerthird';
  window.document.getElementById('output-new-width').value = '1280';
  window.document.getElementById('output-new-height').value = '720';
  window.document.getElementById('output-new-fit').value = 'cover';
  window.document.getElementById('output-create-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  await new Promise((resolve) => setTimeout(resolve, 180));
  let outputRow = [...window.document.querySelectorAll('.output-manager-row')].find((row) => row.querySelector('input[type="text"]')?.value === 'Écran musiciens');
  assert.ok(outputRow, 'a user-named output is created in the manager');
  const customOutputId = outputRow.dataset.outputId;
  assert.equal(window.document.getElementById('output-scene-select').value, customOutputId, 'a newly created output becomes the selected scene target');
  assert.ok(window.document.getElementById(`out-${customOutputId}`), 'the new output receives its own live card');
  assert.equal(window.document.querySelector(`[data-output-target="${customOutputId}"]`).checked, true);

  const nameInput = outputRow.querySelector('input[type="text"]');
  nameInput.value = 'Écran musiciens (renommé)';
  nameInput.dispatchEvent(new window.Event('change', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 100));
  outputRow = window.document.querySelector(`.output-manager-row[data-output-id="${customOutputId}"]`);
  const [customWidth, customHeight] = outputRow.querySelectorAll('input[type="number"]');
  customWidth.value = '1366'; customWidth.dispatchEvent(new window.Event('change', { bubbles: true }));
  customHeight.value = '768'; customHeight.dispatchEvent(new window.Event('change', { bubbles: true }));
  const customFit = outputRow.querySelector('select'); customFit.value = 'contain';
  customFit.dispatchEvent(new window.Event('change', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.match(window.document.querySelector(`#out-${customOutputId} .output-meta`).textContent, /1366 × 768/);

  outputRow.querySelector('.output-row-actions .btn:nth-child(2)').click();
  await new Promise((resolve) => setTimeout(resolve, 40));
  window.document.querySelector('.se-theme-card[title="Chaleureux"]').click();
  window.document.getElementById('se-save').click();
  await new Promise((resolve) => setTimeout(resolve, 100));
  const mainTimerTheme = [...mainChannel.messages].reverse().find((message) => message.action === 'show' && message.scene.kind === 'timer').scene.themeId;
  assert.equal(mainTimerTheme, 'cinema', 'editing a new output theme does not mutate the existing main output');
  window.document.querySelector(`#out-${customOutputId} .output-card-actions .btn-primary`).click();
  await new Promise((resolve) => setTimeout(resolve, 140));
  const customChannel = channels.find((channel) => channel.name === `op_channel_${customOutputId}`);
  const customTimer = [...customChannel.messages].reverse().find((message) => message.action === 'show');
  assert.equal(customTimer.scene.themeId, 'warm', 'the renamed output streams its own independently themed scene');
  assert.equal(customTimer.scene.kind, 'timer');

  window.document.getElementById('btn-links').click();
  const customLink = [...window.document.querySelectorAll('.obs-link-row')].find((row) => row.querySelector('.obs-link-name')?.textContent.includes('Écran musiciens (renommé)'));
  assert.match(customLink.querySelector('.obs-link-name').textContent, /1366 × 768/);
  const customObsUrl = new URL(customLink.querySelector('.obs-link-url').textContent);
  assert.equal(customObsUrl.searchParams.get('scene'), customOutputId);
  assert.equal(customObsUrl.searchParams.get('res'), '1366x768');
  assert.equal(customObsUrl.searchParams.has('lockMode'), false);
  window.document.getElementById('links-close').click();

  window.document.getElementById('btn-outputs').click();
  outputRow = window.document.querySelector(`.output-manager-row[data-output-id="${customOutputId}"]`);
  outputRow.querySelector('.btn-danger').click();
  await new Promise((resolve) => setTimeout(resolve, 140));
  assert.equal(window.document.getElementById(`out-${customOutputId}`), null, 'deleting an output removes its card');
  assert.notEqual(window.document.getElementById('output-scene-select').value, customOutputId, 'deleting the selected output chooses a valid remaining output');
  assert.ok(customChannel.messages.some((message) => message.action === 'hide'), 'deleting a live output sends OBS a hide command');
});

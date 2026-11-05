// Modules ajoutés au studio unique : Médias (EF-16), Habillage (EF-19),
// Minuteur (EF-18) — et la règle « couper un calque ne coupe pas le reste ».
import test from 'node:test';
import assert from 'node:assert/strict';
import { freshProject, cleanup, freePort, startServer } from './helpers.mjs';
import { ensureProject, writeProject } from '../src/core/project.mjs';
import { defaultScenes, mediaScene, lowerThirdScene, fallbackSceneFor } from '../src/core/scene.mjs';
import { renderScene } from '../src/core/render/engine.mjs';
import { contentFromPayload } from '../src/core/render/content.mjs';
import { importBuffer } from '../src/core/assets.mjs';
import {
  pickOverlayTargets, makeOverlayOutput, acceptsKind, isOverlayOnly, overlayRouteLabel
} from '../src/core/overlay.mjs';
import * as live from '../src/core/live.mjs';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64'
);

function bootServer() {
  return (async () => {
    const { base: folder, dir } = await freshProject();
    await ensureProject({ name: 'Modules' });
    const srv = await startServer({ projectDir: dir, port: await freePort() });
    return { folder, dir, base: srv.base, srv };
  })();
}

async function send(base, path, body) {
  const res = await fetch(base + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

// ---------------------------------------------------------------------------
// Scènes livrées
// ---------------------------------------------------------------------------

test('scène de média : l’image vient du contenu diffusé, pas de la scène (EF-16.5)', () => {
  const scene = mediaScene({ preset: 'full' });
  const image = scene.layers.find((layer) => layer.type === 'image');
  assert.equal(image.assetSource, 'content', 'la scène est réutilisable pour toute la bibliothèque');
  assert.equal(image.assetId, null);

  const rendered = renderScene({
    scene,
    content: contentFromPayload({ assetId: 'as_1', mediaName: 'bapteme.jpg', fit: 'cover' }, 'media'),
    assets: { as_1: '/api/assets/as_1' }
  });
  assert.match(rendered.html, /<img class="op-image" src="\/api\/assets\/as_1"/);
  assert.match(rendered.html, /object-fit:cover/);

  // Aucune image = rien à l'antenne, jamais une image cassée.
  const empty = renderScene({ scene, content: {}, assets: {} });
  assert.doesNotMatch(empty.html, /<img/);
});

test('scène de média : une vidéo est lue dans la sortie, contrôlée dans l’éditeur (EF-16.6)', () => {
  const scene = mediaScene({ preset: 'full' });
  const payload = { assetId: 'as_v', assetKind: 'video', mediaName: 'culte.mp4' };
  const out = renderScene({ scene, content: contentFromPayload(payload, 'media'), assets: { as_v: '/api/assets/as_v' }, editing: false });
  assert.match(out.html, /<video class="op-image" src="\/api\/assets\/as_v" autoplay muted loop playsinline/);
  assert.doesNotMatch(out.html, /controls/);

  const edit = renderScene({ scene, content: contentFromPayload(payload, 'media'), assets: { as_v: '/api/assets/as_v' }, editing: true });
  assert.match(edit.html, /controls/, 'l’éditeur peut mettre en pause');
});

test('habillage : bandeau nom + fonction, fond transparent pour la caméra (EF-19)', () => {
  const scene = lowerThirdScene();
  assert.equal(scene.transparent, true);
  assert.ok(scene.layers.some((layer) => layer.type === 'overlay'));
  const nom = scene.layers.find((layer) => layer.bind === 'title');
  const fonction = scene.layers.find((layer) => layer.bind === 'announcement');
  assert.ok(nom && fonction, 'deux lignes : le nom et la fonction');

  const rendered = renderScene({
    scene,
    content: contentFromPayload({ title: 'Pasteur Jean Koffi', body: 'Prédicateur', text: 'Prédicateur' }, 'lowerthird'),
    assets: {},
    transparent: true
  });
  assert.match(rendered.html, /Pasteur Jean Koffi/);
  assert.match(rendered.html, /Prédicateur/);
  assert.match(rendered.html, /data-transparent="1"/);
});

test('un projet neuf reçoit aussi les scènes média et habillage', () => {
  const list = defaultScenes();
  const kinds = new Set(list.map((entry) => entry.kind));
  assert.deepEqual([...kinds].sort(), ['bible', 'lowerthird', 'media', 'songs', 'timer']);
  for (const entry of list) assert.equal(entry.scene.kind, entry.kind);
});

// ---------------------------------------------------------------------------
// Diffusion sélective
// ---------------------------------------------------------------------------

test('couper un habillage ne coupe pas le verset affiché (EF-19.5)', async () => {
  const { base: folder, dir } = await freshProject();
  try {
    await ensureProject({ name: 'Modules' });
    const published = [];
    const relay = {
      publish: (channel, message) => published.push({ channel, message }),
      broadcast: () => {}
    };
    // La salle reçoit le verset, le bandeau se pose sur la sortie transparente.
    assert.equal((await live.show(relay, {
      targets: ['out_full'], kind: 'bible', payload: { text: 'Jean 3:16' }
    })).delivered.length, 1);
    assert.equal((await live.show(relay, {
      targets: ['out_bottom'], kind: 'lowerthird', payload: { title: 'Jean Koffi' }
    })).delivered.length, 1);

    // Une coupe ciblée sur un type ne doit jamais éteindre l'autre sortie.
    const cut = await live.clear(relay, { targets: ['out_full', 'out_bottom'], kind: 'lowerthird' });
    assert.deepEqual(cut.cleared, ['out_bottom'], 'seule la sortie qui portait le bandeau est coupée');
    assert.deepEqual(cut.kept, ['out_full'], 'la salle est épargnée');
    assert.equal(live.getState('out_full').kind, 'bible', 'le verset est toujours à l’antenne');
    assert.equal(live.getState('out_bottom'), null);
    assert.ok(published.some((entry) => entry.channel === 'op_out_out_bottom' && entry.message.t === 'clear'));
    assert.ok(!published.some((entry) => entry.channel === 'op_out_out_full' && entry.message.t === 'clear'),
      'aucun ordre de coupe envoyé à la salle');

    // Sans `kind`, on continue de tout couper : c'est le geste « Échap » du régisseur.
    const all = await live.clear(relay, { targets: ['out_full'] });
    assert.deepEqual(all.cleared, ['out_full']);
  } finally {
    await cleanup(folder);
  }
});

// ---------------------------------------------------------------------------
// Bibliothèque de médias
// ---------------------------------------------------------------------------

test('/api/media ne renvoie que ce qui peut être affiché, avec recherche sans accents', async () => {
  const { base, srv, folder, dir } = await bootServer();
  try {
    const imported = await importBuffer(PNG, { name: 'Croix du culte.png', mime: 'image/png', kind: 'media' });
    assert.equal(imported.asset.originalName, 'Croix du culte.png');
    await writeProject(JSON.parse(await (await fetch(`${base}/api/project`)).text()));

    const all = await (await fetch(`${base}/api/media`)).json();
    assert.equal(all.total, 1);
    assert.match(all.items[0].url, /^\/api\/assets\/[0-9a-f]{64}$/);
    assert.equal(all.items[0].assetId, imported.asset.assetId);

    const found = await (await fetch(`${base}/api/media?q=croix%20du%20culte`)).json();
    assert.equal(found.total, 1, 'la recherche ignore les accents et la casse');

    const missing = await (await fetch(`${base}/api/media?q=zorglub`)).json();
    assert.equal(missing.total, 0);
  } finally {
    await srv.stop();
    await cleanup(folder);
  }
});

test('le studio expose les trois modules sur un seul écran, avec raccourcis', async () => {
  const { base, srv, folder } = await bootServer();
  try {
    const studio = await (await fetch(`${base}/studio.html`)).text();
    for (const id of ['modeMedia', 'modeLt', 'modeTimer', 'mod-media', 'mod-lt', 'mod-timer',
      'mediaGrid', 'mediaSearch', 'mediaImport', 'mediaPick', 'mediaFit',
      'ltName', 'ltRole', 'ltHold', 'ltGo', 'ltCutBtn', 'timerClock', 'timerStart', 'timerAir', 'timerOff']) {
      assert.match(studio, new RegExp(`id="${id}"`), `élément manquant : ${id}`);
    }
    assert.match(studio, /Alt\+4/);
    assert.match(studio, /Alt\+5/);
    assert.match(studio, /Alt\+6/);
    assert.match(studio, /4: 'media', 5: 'lowerthird', 6: 'timer'/, 'Alt+4/5/6 changent de module');
    assert.match(studio, /Un clic = à l’antenne/, 'un média s’affiche en un geste');

    const output = await (await fetch(`${base}/o/out_full`)).text();
    assert.match(output, /function timerText\(/, 'la sortie calcule elle-même le temps restant');
    assert.match(output, /content\?\.assetId/, 'la sortie résout le média diffusé');
  } finally {
    await srv.stop();
    await cleanup(folder);
  }
});

// ---------------------------------------------------------------------------
// Routage des calques (module partagé, utilisé par le studio)
// ---------------------------------------------------------------------------

const FULL = {
  id: 'out_full', name: 'Plein écran — Salle', enabled: true, transparent: false, preset: 'full',
  receives: { bible: true, songs: true, media: true, announcements: true, lowerthird: false, timer: false, plan: false }
};
const BANNER = {
  id: 'out_bottom', name: 'Bas centré — Stream', enabled: true, transparent: true, preset: 'bottom',
  receives: { bible: true, songs: true, media: true, announcements: true, lowerthird: true, timer: true, plan: false }
};
const LOWER = {
  id: 'out_lower', name: 'Habillage', enabled: true, transparent: true, preset: 'lowerthird',
  receives: { bible: false, songs: false, media: false, announcements: false, lowerthird: true, timer: true, plan: false }
};

test('routage des calques : le porteur dédié prime, jamais au détriment du contenu principal', () => {
  // Sortie dédiée existante : on l'utilise, le régisseur n'a rien à cocher.
  const withDedicated = pickOverlayTargets([FULL, BANNER, LOWER], ['out_full', 'out_bottom'], 'lowerthird');
  assert.deepEqual(withDedicated.ids, ['out_lower']);
  assert.equal(withDedicated.dedicated, true);
  assert.equal(withDedicated.moved, false);
  assert.equal(overlayRouteLabel(withDedicated), 'sur « Habillage »');

  // Pas de dédiée : on se pose sur une sortie cochée qui accepte le type.
  const fallback = pickOverlayTargets([FULL, BANNER], ['out_full', 'out_bottom'], 'lowerthird');
  assert.deepEqual(fallback.ids, ['out_bottom']);
  assert.equal(fallback.dedicated, false);

  // Rien de coché mais un porteur existe quand même : on le signale (`moved`).
  const moved = pickOverlayTargets([FULL, BANNER], [], 'timer');
  assert.deepEqual(moved.ids, ['out_bottom']);
  assert.equal(moved.moved, true);

  // Aucun porteur possible : il faut créer la sortie, et on n'écrase rien.
  const none = pickOverlayTargets([FULL], ['out_full'], 'lowerthird');
  assert.deepEqual(none.ids, []);
  assert.equal(none.needsCreation, true);

  assert.equal(acceptsKind(FULL, 'lowerthird'), false);
  assert.equal(isOverlayOnly(LOWER), true);
  assert.equal(isOverlayOnly(BANNER), false, 'le bandeau porte aussi la Bible : ce n’est pas un porteur dédié');
});

test('la sortie de calque créée est transparente, dédiée et jamais visée par défaut', () => {
  const made = makeOverlayOutput('lowerthird', ['out_full', 'out_bottom']);
  assert.equal(made.id, 'out_lower');
  assert.equal(made.transparent, true);
  assert.equal(made.targetByDefault, false, 'un verset ne partira pas sur le porteur de calque');
  assert.equal(made.receives.lowerthird, true);
  assert.equal(made.receives.bible, false);
  assert.equal(made.receives.songs, false);

  const timerOnly = makeOverlayOutput('timer', ['out_full', 'out_lower']);
  assert.equal(timerOnly.receives.timer, true);
  assert.equal(timerOnly.receives.lowerthird, false);
  assert.notEqual(timerOnly.id, 'out_lower', 'pas de collision d’identifiant');

  // Et surtout : après création, le routage trouve le porteur.
  const route = pickOverlayTargets([FULL, BANNER, made], ['out_full'], 'lowerthird');
  assert.deepEqual(route.ids, ['out_lower']);
  assert.equal(route.dedicated, true);
});

test('API : la sortie de calque est acceptée par le projet et diffuse un habillage', async () => {
  const { base, srv, folder } = await bootServer();
  try {
    const doc = await (await fetch(`${base}/api/outputs`)).json();
    const made = makeOverlayOutput('lowerthird', doc.outputs.map((o) => o.id));
    doc.outputs.push(made);
    doc.rev = (Number(doc.rev) || 1) + 1;
    const put = await fetch(`${base}/api/outputs`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(doc)
    });
    assert.equal(put.status, 200, await put.text());

    // Le verset reste à l'antenne sur la salle, le bandeau se pose sur la nouvelle sortie.
    assert.equal((await send(base, '/api/live/show', {
      targets: ['out_full'], kind: 'bible', payload: { reference: 'Ps 23:1', text: 'L’Éternel est mon berger.' }
    })).status, 200);
    const shown = await send(base, '/api/live/show', {
      targets: [made.id], kind: 'lowerthird', payload: { title: 'Jean Koffi', body: 'Prédicateur' }
    });
    assert.deepEqual(shown.data.delivered, [made.id]);

    const state = await (await fetch(`${base}/api/live/state`)).json();
    assert.equal(state.channels.out_full.kind, 'bible');
    assert.equal(state.channels[made.id].kind, 'lowerthird');
  } finally {
    await srv.stop();
    await cleanup(folder);
  }
});

test('un calque ne prend jamais la place d’un contenu principal en direct (EF-18.6, EF-19.5)', () => {
  // Bandeau libre : il peut accueillir le minuteur.
  const free = pickOverlayTargets([FULL, BANNER], ['out_full', 'out_bottom'], 'timer', { onAir: {} });
  assert.deepEqual(free.ids, ['out_bottom']);
  assert.equal(free.needsCreation, false);

  // Le bandeau porte le verset : écraserait le texte => on crée un porteur.
  const busy = pickOverlayTargets([FULL, BANNER], ['out_full', 'out_bottom'], 'timer',
    { onAir: { out_bottom: 'bible' } });
  assert.deepEqual(busy.ids, []);
  assert.equal(busy.needsCreation, true);
  assert.equal(busy.reason, 'occupied');

  // Création du porteur, puis à nouveau routage : la Bible n'est pas touchée.
  const created = makeOverlayOutput('timer', [FULL.id, BANNER.id]);
  const after = pickOverlayTargets([FULL, BANNER, created], ['out_full'], 'timer',
    { onAir: { out_full: 'bible' } });
  assert.deepEqual(after.ids, [created.id]);
  assert.equal(after.dedicated, true);

  // Une sortie sans calque à offrir : création aussi, mais pour une autre raison.
  const missing = pickOverlayTargets([FULL], ['out_full'], 'lowerthird', { onAir: { out_full: 'bible' } });
  assert.equal(missing.needsCreation, true);
  assert.equal(missing.reason, 'missing');
});

test('scène de repli : un calque ou un média n’hérite jamais du gabarit Bible (A-10b)', () => {
  const lt = fallbackSceneFor({ kind: 'lowerthird', preset: 'bottom', transparent: true });
  assert.equal(lt.kind, 'lowerthird');
  assert.equal(lt.layers.some((layer) => layer.bind === 'verse'), false, 'pas de verset dans un habillage');
  assert.ok(lt.layers.some((layer) => layer.bind === 'title'));

  const media = fallbackSceneFor({ kind: 'media', preset: 'bottom', transparent: true });
  assert.equal(media.kind, 'media');
  const image = media.layers.find((layer) => layer.type === 'image');
  assert.equal(image.assetSource, 'content');

  const bible = fallbackSceneFor({ kind: 'bible', preset: 'bottom', transparent: true });
  assert.ok(bible.layers.some((layer) => layer.bind === 'verse'), 'la Bible garde son gabarit');
});

test('moteur : un contenu peut imposer sa couleur et un clignotement doux (EF-18.9)', () => {
  const scene = fallbackSceneFor({ kind: 'timer', preset: 'full' });
  const calm = renderScene({ scene, content: { timer: '04:12' }, assets: {} });
  assert.doesNotMatch(calm.html, /op-blink/);

  const critique = renderScene({
    scene,
    content: { timer: '00:41', accent: '#ef5360', blink: true },
    assets: {}
  });
  assert.match(critique.html, /class="op-scene op-blink"/);
  assert.match(critique.html, /--op-accent:#ef5360/);
});

test('session-state.json : écrire le minuteur ne peut pas effacer l’antenne (EF-18.8)', async () => {
  const { base, srv, folder } = await bootServer();
  try {
    await fetch(`${base}/api/session`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ plan: { eventId: 'evt_x', index: 2 } })
    });
    const afterTimer = await fetch(`${base}/api/session`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ timer: { running: true, remainingMs: 60_000 } })
    }).then((r) => r.json());
    assert.equal(afterTimer.session.plan.index, 2, 'les autres clés sont conservées');
    assert.equal(afterTimer.session.timer.remainingMs, 60_000);

    // Une clé envoyée à `null` est retirée, pas remplacée par un objet vide.
    const cleared = await fetch(`${base}/api/session`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ timer: null })
    }).then((r) => r.json());
    assert.equal(cleared.session.timer, undefined);
    assert.equal(cleared.session.plan.index, 2);
  } finally {
    await srv.stop();
    await cleanup(folder);
  }
});

test('les bandeaux sont des objets du projet, nommés et réutilisables (EF-19.6)', async () => {
  const { base, srv, folder } = await bootServer();
  try {
    const body = {
      id: 'lt_pasteur_jean_koffi', rev: 1, name: 'Pasteur Jean Koffi',
      title: 'Pasteur Jean Koffi', subtitle: 'Prédicateur', holdSec: 8,
      layout: 'classic', animationIn: 'slide-left', animationOut: 'slide-left', animationMs: 400
    };
    const put = await fetch(`${base}/api/library/lowerthirds/${body.id}`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
    });
    assert.equal(put.status, 200, await put.text());

    const list = await fetch(`${base}/api/library/lowerthirds`).then((r) => r.json());
    assert.equal(list.items.length, 1);
    assert.equal(list.items[0].subtitle, 'Prédicateur');

    // Ré-enregistrer le même nom incrémente la révision, sans doublon.
    const again = await fetch(`${base}/api/library/lowerthirds/${body.id}`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...body, subtitle: 'Animateur' })
    }).then((r) => r.json());
    assert.equal(again.rev, 2);
    const list2 = await fetch(`${base}/api/library/lowerthirds`).then((r) => r.json());
    assert.equal(list2.items.length, 1);
    assert.equal(list2.items[0].subtitle, 'Animateur');

    const del = await fetch(`${base}/api/library/lowerthirds/${body.id}`, { method: 'DELETE' });
    assert.equal(del.status, 200);
    const list3 = await fetch(`${base}/api/library/lowerthirds`).then((r) => r.json());
    assert.equal(list3.items.length, 0);
  } finally {
    await srv.stop();
    await cleanup(folder);
  }
});

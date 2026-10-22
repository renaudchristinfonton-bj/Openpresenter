// Plan de déroulement (EF-23, tests A-12g → A-12k).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { freshProject, cleanup, freePort, startServer, json } from './helpers.mjs';
import { ensureProject, seedSampleSongs } from '../src/core/project.mjs';
import { parsePlanText, parsePlanningCenter, planToText, planView, refToRange } from '../src/core/plan.mjs';

const SONGS = [
  { id: 'sng_grace_infinie', title: 'Grâce infinie' },
  { id: 'sng_tu_es_saint', title: 'Tu es saint' }
];

test('A-12g — import texte : chaque ligne reconnue comme prévu (§ 14.4.3)', () => {
  const { cues, report } = parsePlanText(`Accueil
Grâce infinie
Jean 3:16-18
# Offrande
Tu es saint
Prédication
incroyable amour`, { songs: SONGS, bibles: [{ id: 'bible_lsg', abbreviation: 'LSG' }] });

  assert.deepEqual(report.map((entry) => entry.kind), ['note', 'song', 'bible', 'note', 'song', 'note', 'note']);
  assert.equal(cues.length, 7);
  assert.equal(cues[1].payload.songId, 'sng_grace_infinie');
  assert.equal(cues[2].label, 'Jean 3:16-18');
  assert.equal(cues[2].payload.ref, '43-3-16..43-3-18');
  assert.equal(cues[2].payload.bibleId, 'bible_lsg');
  assert.match(report[5].detail, /aucun élément correspondant/);
  assert.equal(cues[6].label, 'incroyable amour', 'une correspondance partielle reste un repère');
});

test('A-12g — les lignes vides sont ignorées, les commentaires deviennent des notes', () => {
  const { cues } = parsePlanText('\n\n# Prière\n\n// Bénédiction\n\n', { songs: [] });
  assert.equal(cues.length, 2);
  assert.deepEqual(cues.map((cue) => cue.label), ['Prière', 'Bénédiction']);
});

test('EF-23.15 / EF-23.16 — import Planning Center avec appariement par titre', () => {
  const bundle = {
    data: {
      attributes: {
        items: [
          { attributes: { title: 'Grâce infinie', length: 240 } },
          { attributes: { title: 'Jean 3:16', length: 120 } },
          { attributes: { title: 'Annonces diverses', length: 300 } }
        ]
      }
    }
  };
  const { cues, report } = parsePlanningCenter(bundle, { songs: SONGS });
  assert.equal(cues.length, 3);
  assert.equal(cues[0].kind, 'song');
  assert.equal(cues[0].durationSec, 240);
  assert.equal(cues[1].kind, 'bible');
  assert.equal(cues[1].payload.ref, '43-3-16');
  assert.equal(cues[2].kind, 'note');
  assert.equal(report.filter((entry) => entry.kind === 'song').length, 1);

  assert.throws(() => parsePlanningCenter({ hello: 'world' }), /Planning Center/);
});

test('EF-23.5 / EF-23.4 — durée estimée et panneaux En cours / Suivant / Après', () => {
  const cues = [
    { id: 'cue_a', kind: 'note', label: 'Accueil', durationSec: 300 },
    { id: 'cue_b', kind: 'song', label: 'Chant', durationSec: 240, skipped: true },
    { id: 'cue_c', kind: 'bible', label: 'Verset', durationSec: 120 },
    { id: 'cue_d', kind: 'note', label: 'Prière', durationSec: 600 }
  ];
  const view = planView(cues, 0);
  assert.equal(view.current.label, 'Accueil');
  assert.equal(view.next.label, 'Verset', 'une étape sautée n’est pas proposée');
  assert.equal(view.after.label, 'Prière');
  assert.equal(view.estimatedSec, 1020);
});

test('EF-23.18 — le plan s’imprime en texte lisible', () => {
  const text = planToText({
    name: 'Culte du dimanche',
    startsAt: '2026-10-26T08:30:00+01:00',
    plan: { cues: [
      { label: 'Accueil', durationSec: 300 },
      { label: 'Grâce infinie', durationSec: 240 },
      { label: 'Jean 3:16-18', durationSec: 120 }
    ] }
  }, { org: { name: 'ICC Pahou' }, place: { name: 'Temple principal' } });
  assert.match(text.split('\n')[0], /^PLAN DE CULTE — Culte du dimanche du \d{2}\/\d{2}\/2026/);
  assert.match(text, /ICC Pahou · Temple principal/);
  assert.match(text, /1\. Accueil\s+5 min/);
  assert.match(text, /Durée estimée : 11 min/);
});

test('EF-23.1 — la forme machine accepte une plage et se relit', () => {
  assert.deepEqual(refToRange('43-3-16..43-3-18'), { bookNum: 43, chapter: 3, first: 16, last: 18 });
  assert.deepEqual(refToRange('19-23-1'), { bookNum: 19, chapter: 23, first: 1, last: 1 });
  assert.equal(refToRange('Jean 3:16'), null);
});

async function boot() {
  const { base: folder, dir } = await freshProject();
  await ensureProject({ name: 'Plan' });
  await seedSampleSongs();
  const srv = await startServer({ projectDir: dir, port: await freePort() });
  const event = (await json(srv.base, '/api/events', {
    method: 'POST',
    body: {
      name: 'Culte',
      startsAt: new Date().toISOString(),
      plan: {
        cues: [
          { id: 'cue_001_accueil', kind: 'note', label: 'Accueil', durationSec: 300 },
          { id: 'cue_002_verset', kind: 'bible', label: 'Jean 3:16', durationSec: 120, payload: { ref: '43-3-16..43-3-16' } },
          { id: 'cue_003_sautee', kind: 'note', label: 'Sautée', skipped: true },
          { id: 'cue_004_priere', kind: 'note', label: 'Prière', durationSec: 600 }
        ]
      }
    }
  })).data;
  return { base: srv.base, dir, srv, folder, event };
}

test('A-12h / A-12i — Espace avance, une note ne diffuse rien, reculer rejoue', async () => {
  const { base, dir, srv, folder, event } = await boot();
  try {
    const read = await json(base, `/api/events/${event.id}/plan`);
    assert.equal(read.status, 200);
    assert.equal(read.data.cues.length, 4);
    assert.equal(read.data.view.index, -1, 'le plan n’a pas encore commencé');
    assert.equal(read.data.view.next.label, 'Accueil');

    // Étape 1 : une note, aucune sortie touchée.
    const first = await json(base, `/api/events/${event.id}/plan/advance`, { method: 'POST', body: { delta: 1 } });
    assert.equal(first.status, 200);
    assert.equal(first.data.index, 0);
    assert.equal(first.data.note, true);
    assert.deepEqual(first.data.delivered, []);
    const state = await json(base, '/api/live/state');
    assert.deepEqual(state.data.channels, {}, 'une note ne met rien à l’antenne');
    assert.match(first.data.message, /^TXT: Accueil/);

    // Étape 2 : un verset, diffusé sur les sorties qui reçoivent la Bible.
    const second = await json(base, `/api/events/${event.id}/plan/advance`, { method: 'POST', body: { delta: 1 } });
    assert.equal(second.data.index, 1);
    assert.ok(second.data.delivered.length >= 1);
    const live = await json(base, '/api/live/state');
    const message = live.data.channels[second.data.delivered[0]];
    assert.equal(message.kind, 'bible');
    assert.match(message.payload.reference, /Jean 3:16/);
    assert.match(message.payload.text, /./);

    // L’étape sautée est franchie sans s’y arrêter.
    const third = await json(base, `/api/events/${event.id}/plan/advance`, { method: 'POST', body: { delta: 1 } });
    assert.equal(third.data.index, 3);
    assert.equal(third.data.view.current.label, 'Prière');

    // Fin du plan : on ne dépasse pas.
    const end = await json(base, `/api/events/${event.id}/plan/advance`, { method: 'POST', body: { delta: 1 } });
    assert.equal(end.data.atEnd, true);
    assert.equal(end.data.message, 'TXT: Fin du plan.');
    assert.equal(end.data.index, 3);

    // A-12i : reculer rejoue le contenu précédent.
    const back = await json(base, `/api/events/${event.id}/plan/advance`, { method: 'POST', body: { delta: -1 } });
    assert.equal(back.data.index, 1);
    assert.ok(back.data.delivered.length >= 1);

    // A-12k : la position survit à un rechargement (session-state.json).
    const stateOnDisk = JSON.parse(await fs.readFile(path.join(dir, 'session-state.json'), 'utf8'));
    assert.equal(stateOnDisk.plan.index, 1);
    assert.equal(stateOnDisk.plan.eventId, event.id);

    const reread = await json(base, `/api/events/${event.id}/plan`);
    assert.equal(reread.data.view.index, 1, 'le rechargement retrouve l’étape');
  } finally { await srv.stop(); await cleanup(folder); }
});

test('EF-23.14 — import avec prévisualisation, remplacement ou ajout', async () => {
  const { base, srv, folder, event } = await boot();
  try {
    const text = 'Accueil\nGrâce infinie\nJean 3:16\n# Offrande';
    const preview = await json(base, `/api/events/${event.id}/plan/import`, {
      method: 'POST', body: { text, mode: 'preview' }
    });
    assert.equal(preview.status, 200);
    assert.equal(preview.data.preview, true);
    assert.equal(preview.data.cues.length, 4);
    assert.equal(preview.data.report[1].kind, 'song', 'le chant d’exemple est apparié');

    // La prévisualisation n'écrit rien.
    const before = await json(base, `/api/events/${event.id}/plan`);
    assert.equal(before.data.cues.length, 4);

    const appended = await json(base, `/api/events/${event.id}/plan/import`, {
      method: 'POST', body: { text, mode: 'append' }
    });
    assert.equal(appended.status, 200);
    assert.equal(appended.data.cues, 8);
    assert.equal(appended.data.report.length, 4);

    const replaced = await json(base, `/api/events/${event.id}/plan/import`, {
      method: 'POST', body: { text: '# Prière', mode: 'replace' }
    });
    assert.equal(replaced.data.cues, 1);
  } finally { await srv.stop(); await cleanup(folder); }
});

test('EF-23.5 / EF-23.18 — l’API expose la durée et l’impression du plan', async () => {
  const { base, srv, folder, event } = await boot();
  try {
    const read = await json(base, `/api/events/${event.id}/plan`);
    assert.equal(read.data.estimatedSec, 1020);
    const printed = await fetch(`${base}/api/events/${event.id}/plan/print`);
    assert.equal(printed.status, 200);
    assert.match(printed.headers.get('content-type'), /text\/plain/);
    const text = await printed.text();
    assert.match(text, /1\. Accueil\s+5 min/);
    assert.match(text, /4\. Prière\s+10 min/);

    const reset = await json(base, `/api/events/${event.id}/plan/reset`, { method: 'POST' });
    assert.equal(reset.data.index, 0);
  } finally { await srv.stop(); await cleanup(folder); }
});

test('la page Plan est servie, avec les panneaux et les raccourcis du § 14.4.2', async () => {
  const { base, srv, folder } = await boot();
  try {
    const res = await fetch(`${base}/plan.html?event=evt_test`);
    assert.equal(res.status, 200);
    const html = await res.text();
    for (const id of ['cueList', 'nowLabel', 'nextLabel', 'afterLabel', 'advance', 'back',
      'cut', 'importDlg', 'importText', 'importReport', 'estimate']) {
      assert.match(html, new RegExp(`id="${id}"`), id);
    }
    // Espace/→ avance, ← recule, Échap coupe : une seule touche en direct (EF-23.3).
    assert.match(html, /event_\.key === ' '/);
    assert.match(html, /ArrowLeft/);
    assert.match(html, /event_\.key === 'Escape'/);
    // La page Événements mène au plan.
    const events = await (await fetch(`${base}/events.html`)).text();
    assert.match(events, /\/plan\.html\?event=/);
  } finally { await srv.stop(); await cleanup(folder); }
});

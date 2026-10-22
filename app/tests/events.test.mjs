// Organisations, lieux et événements (EF-21, EF-22, tests A-12f → A-12k).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { freshProject, cleanup, freePort, startServer, json } from './helpers.mjs';
import { ensureProject } from '../src/core/project.mjs';
import { normalizeEvent, nextOccurrences, eventStatus, planDuration } from '../src/core/events.mjs';

async function boot() {
  const { base: folder, dir } = await freshProject();
  await ensureProject({ name: 'Événements' });
  const srv = await startServer({ projectDir: dir, port: await freePort() });
  return { base: srv.base, dir, srv, folder };
}

const CUE = (label, kind = 'note', extra = {}) => ({ id: `cue_${label.replace(/\W+/g, '').toLowerCase().slice(0, 10)}`, kind, label, durationSec: 300, ...extra });

test('EF-21 — une organisation contient ses lieux et ses écrans', async () => {
  const { base, dir, srv, folder } = await boot();
  try {
    const created = await json(base, '/api/orgs', {
      method: 'POST',
      body: {
        name: 'ICC Pahou',
        kind: 'church',
        contact: { address: 'Pahou, Bénin' },
        places: [
          { name: 'Temple principal', capacity: 800, screens: ['Projecteur salle', 'Retour scène'] },
          { name: 'Salle annexe', capacity: 120, screens: [] }
        ]
      }
    });
    assert.equal(created.status, 201);
    const org = created.data;
    assert.match(org.id, /^org_[a-z0-9]{10}$/);
    assert.equal(org.places.length, 2);
    assert.ok(org.places.every((place) => /^plc_/.test(place.id)), 'chaque lieu reçoit son identifiant');
    assert.deepEqual(org.places[0].screens, ['Projecteur salle', 'Retour scène']);

    const events = await json(base, '/api/events', {
      method: 'POST',
      body: {
        name: 'Culte du dimanche',
        startsAt: '2026-10-26T08:30:00+01:00',
        endsAt: '2026-10-26T11:00:00+01:00',
        orgId: org.id,
        placeId: org.places[0].id,
        plan: { cues: [CUE('Accueil', 'note'), CUE('Jean 3:16', 'bible')] }
      }
    });
    assert.equal(events.status, 201);

    const detail = await json(base, `/api/orgs/${org.id}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.data.events.length, 1);
    assert.equal(detail.data.events[0].name, 'Culte du dimanche');

    // Le fichier est bien sur disque, un par organisation.
    const file = path.join(dir, 'orgs', `${org.id}.json`);
    assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).name, 'ICC Pahou');
  } finally { await srv.stop(); await cleanup(folder); }
});

test('EF-21.3 — supprimer une organisation ne supprime aucun événement', async () => {
  const { base, srv, folder } = await boot();
  try {
    const org = (await json(base, '/api/orgs', { method: 'POST', body: { name: 'École Bethel', kind: 'school', places: [{ name: 'Salle 1' }] } })).data;
    const event = (await json(base, '/api/events', {
      method: 'POST', body: { name: 'Rentrée', startsAt: '2026-09-01T09:00:00+01:00', orgId: org.id, placeId: org.places[0].id }
    })).data;
    const removed = await json(base, `/api/orgs/${org.id}`, { method: 'DELETE' });
    assert.equal(removed.status, 200);
    assert.equal(removed.data.detachedEvents, 1);

    const after = await json(base, `/api/events/${event.id}`);
    assert.equal(after.status, 200);
    assert.equal(after.data.orgId, null);
    assert.equal(after.data.placeId, null);
    assert.equal(after.data.name, 'Rentrée');
  } finally { await srv.stop(); await cleanup(folder); }
});

test('EF-22.1 → EF-22.3 — événement récurrent et occurrences à la demande', async () => {
  const model = normalizeEvent({
    name: 'Culte',
    startsAt: '2026-10-26T08:30:00+01:00',
    endsAt: '2026-10-26T11:00:00+01:00',
    recurrence: { freq: 'weekly', byDay: ['SU'], until: '2026-12-31T23:59:00Z' }
  });
  const next = nextOccurrences(model, { count: 4 }).map((iso) => iso.slice(0, 10));
  assert.deepEqual(next, ['2026-11-01', '2026-11-08', '2026-11-15', '2026-11-22']);
  assert.equal(eventStatus(model, new Date('2026-10-26T09:00:00+01:00')), 'live');
  assert.equal(eventStatus(model, new Date('2026-10-27T09:00:00+01:00')), 'past');

  const daily = normalizeEvent({
    name: 'Prière', startsAt: '2026-10-26T18:00:00+01:00', recurrence: { freq: 'daily', until: '2026-10-28T23:59:00Z' }
  });
  assert.equal(nextOccurrences(daily, { count: 5 }).length, 2, 'la date de fin arrête la récurrence');

  const { base, srv, folder } = await boot();
  try {
    const created = (await json(base, '/api/events', {
      method: 'POST', body: { name: 'Culte', startsAt: '2026-10-26T08:30:00+01:00', recurrence: { freq: 'weekly', byDay: ['SU'] } }
    })).data;
    const materialised = await json(base, `/api/events/${created.id}/occurrences`, { method: 'POST', body: { count: 3 } });
    assert.equal(materialised.status, 201);
    assert.equal(materialised.data.created.length, 3);
    // Deuxième appel : aucune occurrence en double.
    const again = await json(base, `/api/events/${created.id}/occurrences`, { method: 'POST', body: { count: 3 } });
    assert.equal(again.data.created.length, 0);
  } finally { await srv.stop(); await cleanup(folder); }
});

test('A-12f / A-12j — dupliquer un événement copie le plan, pas l’historique', async () => {
  const { base, dir, srv, folder } = await boot();
  try {
    const event = (await json(base, '/api/events', {
      method: 'POST',
      body: {
        name: 'Culte du dimanche',
        startsAt: '2026-10-26T08:30:00+01:00',
        color: '#38bdf8',
        plan: { cues: [CUE('Accueil'), CUE('Jean 3:16', 'bible', { durationSec: 120 })] }
      }
    })).data;
    await json(base, `/api/events/${event.id}/history`, {
      method: 'POST', body: { label: 'Jean 3:16', kind: 'bible', outputs: ['out_full'] }
    });

    const copy = await json(base, `/api/events/${event.id}/duplicate`, { method: 'POST' });
    assert.equal(copy.status, 201);
    assert.match(copy.data.name, /\(copie\)$/);
    assert.equal(copy.data.plan.cues.length, 2);
    assert.equal(copy.data.color, '#38bdf8');
    assert.equal(copy.data.history.length, 0);
    assert.equal(copy.data.templateSourceId, event.id);
    assert.notEqual(copy.data.id, event.id);

    // Le plan de l'original garde son identifiant de cue (copie profonde).
    const original = await json(base, `/api/events/${event.id}`);
    assert.equal(original.data.history.length, 1);

    const removed = await json(base, `/api/events/${copy.data.id}`, { method: 'DELETE' });
    assert.equal(removed.status, 409);
    assert.match(removed.data.error.message, /^TXT: Supprimer « Culte du dimanche \(copie\) » \?/);
    assert.match(removed.data.error.message, /2 étape\(s\)/);
    const confirmed = await json(base, `/api/events/${copy.data.id}`, { method: 'DELETE', body: { confirm: true } });
    assert.equal(confirmed.status, 200);
    await assert.rejects(fs.stat(path.join(dir, 'events', `${copy.data.id}.json`)));
  } finally { await srv.stop(); await cleanup(folder); }
});

test('EF-22.6 / EF-22.7 — historique append-only et export CSV', async () => {
  const { base, srv, folder } = await boot();
  try {
    const event = (await json(base, '/api/events', {
      method: 'POST', body: { name: 'Culte', startsAt: '2026-10-26T08:30:00+01:00' }
    })).data;

    // Ouvrir l'événement le rend actif : chaque diffusion suivante est journalisée.
    await json(base, `/api/events/${event.id}/open`, { method: 'POST' });
    await json(base, '/api/live/show', {
      method: 'POST', body: { targets: ['out_full'], kind: 'bible', payload: { reference: 'Jean 3:16', verse: 'Car Dieu…' } }
    });

    const after = await json(base, `/api/events/${event.id}`);
    assert.equal(after.data.history.length, 1);
    assert.equal(after.data.history[0].label, 'Jean 3:16');
    assert.equal(after.data.history[0].kind, 'bible');
    assert.deepEqual(after.data.history[0].outputs, ['out_full']);

    const csv = await fetch(`${base}/api/events/${event.id}/history.csv`);
    assert.equal(csv.status, 200);
    assert.match(csv.headers.get('content-type'), /text\/csv/);
    const text = await csv.text();
    assert.match(text.split('\n')[0], /^date,heure,etape,type,sorties/);
    assert.match(text, /"Jean 3:16"/);
  } finally { await srv.stop(); await cleanup(folder); }
});

test('EF-22.8 — un événement passé est en lecture seule, sauf demande explicite', async () => {
  const { base, srv, folder } = await boot();
  try {
    const event = (await json(base, '/api/events', {
      method: 'POST', body: { name: 'Ancien culte', startsAt: '2025-01-05T08:30:00+01:00', endsAt: '2025-01-05T11:00:00+01:00' }
    })).data;

    const refused = await json(base, `/api/events/${event.id}`, { method: 'PUT', body: { name: 'Corrigé' } });
    assert.equal(refused.status, 409);
    assert.equal(refused.data.error.code, 'PAST_EVENT');
    assert.match(refused.data.error.message, /^TXT: Cet événement est passé\./);
    assert.equal((await json(base, `/api/events/${event.id}`)).data.name, 'Ancien culte');

    const forced = await json(base, `/api/events/${event.id}`, { method: 'PUT', body: { name: 'Corrigé', force: true } });
    assert.equal(forced.status, 200);
    assert.equal(forced.data.name, 'Corrigé');
  } finally { await srv.stop(); await cleanup(folder); }
});

test('EF-22.5 — l’accueil reçoit aujourd’hui, à venir et passés', async () => {
  const { base, srv, folder } = await boot();
  try {
    const now = new Date();
    const inTwoHours = new Date(now.getTime() + 2 * 3600_000).toISOString();
    const inThreeDays = new Date(now.getTime() + 3 * 86_400_000).toISOString();
    const lastWeek = new Date(now.getTime() - 7 * 86_400_000).toISOString();

    await json(base, '/api/events', { method: 'POST', body: { name: 'Aujourd’hui', startsAt: now.toISOString(), endsAt: inTwoHours } });
    await json(base, '/api/events', { method: 'POST', body: { name: 'Bientôt', startsAt: inThreeDays } });
    await json(base, '/api/events', { method: 'POST', body: { name: 'Déjà passé', startsAt: lastWeek, endsAt: new Date(now.getTime() - 6 * 86_400_000).toISOString() } });

    const list = await json(base, '/api/events');
    assert.equal(list.status, 200);
    assert.equal(list.data.today.length, 1);
    assert.equal(list.data.today[0].name, 'Aujourd’hui');
    assert.equal(list.data.upcoming.length, 1);
    assert.equal(list.data.past.length, 1);
  } finally { await srv.stop(); await cleanup(folder); }
});

test('EF-22.10 — un événement sans plan est valide ; la durée totale ignore les étapes sautées', async () => {
  const event = normalizeEvent({ name: 'Sans plan', startsAt: '2026-11-01T10:00:00+01:00' });
  assert.deepEqual(event.plan.cues, []);
  assert.equal(planDuration([]), 0);
  const withCues = normalizeEvent({
    name: 'Avec plan',
    startsAt: '2026-11-01T10:00:00+01:00',
    plan: { cues: [CUE('A', 'note', { durationSec: 600 }), CUE('B', 'song', { skipped: true }), CUE('C', 'bible', { durationSec: 120 })] }
  });
  assert.equal(planDuration(withCues.plan.cues), 720);
  assert.equal(eventStatus(event, new Date('2026-11-01T10:30:00+01:00')), 'live');
});

test('la page Événements est servie et contient les formulaires attendus', async () => {
  const { base, srv, folder } = await boot();
  try {
    const res = await fetch(`${base}/events.html`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    const html = await res.text();
    for (const id of ['orgList', 'orgForm', 'placeRows', 'eventList', 'eventForm',
      'evName', 'evStart', 'evEnd', 'evOrg', 'evPlace', 'evProfile', 'evFreq', 'evDays']) {
      assert.match(html, new RegExp(`id="${id}"`), id);
    }
    assert.match(html, /\/api\/events\/\$\{event\.id\}\/occurrences/);
    assert.match(html, /DELETE_CONFIRM|requiresConfirmation|status === 409/);

    // L'accueil met l'événement du jour en avant.
    const accueil = await fs.readFile(path.join(process.cwd(), 'app', 'web', 'accueil.html'), 'utf8');
    assert.match(accueil, /id="todayEvents"/);
    assert.match(accueil, /\/events\.html/);
  } finally { await srv.stop(); await cleanup(folder); }
});

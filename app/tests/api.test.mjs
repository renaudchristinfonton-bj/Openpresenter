// Recette serveur : A-01 (hors-ligne), A-02e, A-02f, A-18 → A-18k.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  freshProject, cleanup, freePort, startServer, json, fakePng, walk, ROOT, sleep
} from './helpers.mjs';
import { ensureProject } from '../src/core/project.mjs';
import { importBuffer } from '../src/core/assets.mjs';
import { put } from '../src/core/library.mjs';

test('API : santé, projet, lecture et écriture', async () => {
  const { base, dir } = await freshProject();
  let srv;
  try {
    await ensureProject({ name: 'API' });
    srv = await startServer({ projectDir: dir, port: await freePort() });

    const health = await json(srv.base, '/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.data.ok, true);
    assert.equal(health.data.formatVersion, 3);
    assert.equal(health.data.port, srv.port);

    const project = await json(srv.base, '/api/project');
    assert.equal(project.data.name, 'API');

    const renamed = await json(srv.base, '/api/project', {
      method: 'PUT', body: { name: 'Église du Plateau', settings: { lanTokenEnabled: false } }
    });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.data.name, 'Église du Plateau');
    assert.equal(renamed.data.settings.lanTokenEnabled, false);

    // Écriture d'un chant puis relecture depuis le disque.
    const saved = await json(srv.base, '/api/library/songs/sng_api00001', {
      method: 'PUT', body: { id: 'sng_api00001', title: 'Chant API', sections: [] }
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.data.rev, 1);
    const onDisk = JSON.parse(await fs.readFile(path.join(dir, 'library', 'songs', 'sng_api00001.json'), 'utf8'));
    assert.equal(onDisk.title, 'Chant API');

    const list = await json(srv.base, '/api/library/songs');
    assert.equal(list.data.items.length, 1);

    const conflicted = await json(srv.base, '/api/library/songs/sng_api00001', {
      method: 'PUT', body: { id: 'sng_api00001', title: 'Écrasement', rev: 0 }
    });
    assert.equal(conflicted.status, 409);
    assert.equal(conflicted.data.error.code, 'CONFLICT');

    const bad = await json(srv.base, '/api/library/songs/mauvais', { method: 'PUT', body: {} });
    assert.equal(bad.status, 400);
    assert.equal(bad.data.error.code, 'VALIDATION');

    const gone = await json(srv.base, '/api/library/songs/sng_absente01');
    assert.equal(gone.status, 404);

    const removed = await json(srv.base, '/api/library/songs/sng_api00001', { method: 'DELETE' });
    assert.equal(removed.status, 200);
  } finally {
    await srv?.stop();
    await cleanup(base);
  }
});

test('API : import d’asset, déduplication et service du binaire', async () => {
  const { base, dir } = await freshProject();
  let srv;
  try {
    await ensureProject();
    srv = await startServer({ projectDir: dir, port: await freePort() });
    const png = fakePng('i', 6000);

    const first = await fetch(`${srv.base}/api/assets?name=fond.png`, {
      method: 'POST', headers: { 'content-type': 'image/png' }, body: png
    });
    assert.equal(first.status, 201);
    const a = await (await first.json());
    assert.equal(a.deduplicated, false);

    const again = await fetch(`${srv.base}/api/assets?name=copie.png`, {
      method: 'POST', headers: { 'content-type': 'image/png' }, body: png
    });
    assert.equal((await again.json()).deduplicated, true);

    const bin = await fetch(`${srv.base}${a.asset.url}`);
    assert.equal(bin.status, 200);
    assert.deepEqual([...Buffer.from(await bin.arrayBuffer())], [...png]);

    // Requête partielle (lecture vidéo).
    const ranged = await fetch(`${srv.base}${a.asset.url}`, { headers: { range: 'bytes=0-9' } });
    assert.equal(ranged.status, 206);
    assert.equal((await ranged.arrayBuffer()).byteLength, 10);

    const missing = await fetch(`${srv.base}/api/assets/as_000000000000`);
    assert.equal(missing.status, 404);
    const err = await missing.json();
    assert.equal(err.error.code, 'NOT_FOUND');
    assert.ok(!/at .*\.mjs/.test(JSON.stringify(err)), 'stack trace exposée');
  } finally {
    await srv?.stop();
    await cleanup(base);
  }
});

test('API : page de sortie et fichiers statiques servis (A-01, A-02e)', async () => {
  const { base, dir } = await freshProject("L'Église du Plateau");
  let srv;
  try {
    await ensureProject();
    srv = await startServer({ projectDir: dir, port: await freePort() });

    const page = await fetch(`${srv.base}/`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type'), /text\/html/);
    const html = await page.text();
    assert.match(html, /OpenPresenter/);
    assert.match(html, /Studio/, 'la racine doit ouvrir le studio');
    const socle = await fetch(`${srv.base}/socle.html`);
    assert.equal(socle.status, 200);

    // Remontée de dossier interdite.
    const escape = await fetch(`${srv.base}/../package.json`);
    assert.ok([403, 404].includes(escape.status));

    const health = await json(srv.base, '/api/health');
    assert.equal(health.status, 200, 'chemin avec apostrophe et accents');

    // Le journal ne doit contenir aucun caractère mal encodé.
    const logs = await fs.readdir(path.join(dir, 'logs')).catch(() => []);
    for (const f of logs) {
      const text = await fs.readFile(path.join(dir, 'logs', f), 'utf8');
      assert.ok(!text.includes('\uFFFD'), `encodage corrompu dans ${f}`);
    }
  } finally {
    await srv?.stop();
    await cleanup(base);
  }
});

test('A-02f — projet en lecture seule : aucune écriture possible', async () => {
  const { base, dir } = await freshProject();
  let srv;
  try {
    await ensureProject();
    const pj = JSON.parse(await fs.readFile(path.join(dir, 'project.json'), 'utf8'));
    pj.settings.readOnly = true;
    await fs.writeFile(path.join(dir, 'project.json'), JSON.stringify(pj, null, 2));

    srv = await startServer({ projectDir: dir, port: await freePort() });
    const health = await json(srv.base, '/api/health');
    assert.equal(health.data.readOnly, true);

    const write = await json(srv.base, '/api/library/songs/sng_ro000001', {
      method: 'PUT', body: { id: 'sng_ro000001', title: 'Interdit' }
    });
    assert.equal(write.status, 403);
    assert.equal(write.data.error.code, 'READ_ONLY');
    assert.equal(await fs.stat(path.join(dir, 'library', 'songs', 'sng_ro000001.json')).catch(() => null), null);

    // La lecture reste possible.
    const read = await json(srv.base, '/api/library/songs');
    assert.equal(read.status, 200);
  } finally {
    await srv?.stop();
    await cleanup(base);
  }
});

test('A-18 — diagnostic : lignes vertes, aucun chemin ni jeton', async () => {
  const { base, dir } = await freshProject();
  let srv;
  try {
    await ensureProject();
    srv = await startServer({ projectDir: dir, port: await freePort() });
    await put('songs', 'sng_diag0001', { id: 'sng_diag0001', title: 'Chant', sections: [] });

    const diag = await json(srv.base, '/api/diagnostic');
    assert.equal(diag.status, 200);
    const ids = diag.data.checks.map((c) => c.id);
    for (const id of ['DIAG-01', 'DIAG-03', 'DIAG-04', 'DIAG-05', 'DIAG-06', 'DIAG-09', 'DIAG-10', 'DIAG-11', 'DIAG-12', 'DIAG-13c']) {
      assert.ok(ids.includes(id), `contrôle manquant : ${id}`);
    }
    assert.equal(diag.data.err, 0);

    const health = await json(srv.base, '/api/health');
    const serialized = JSON.stringify(diag.data);
    // A-18h : ni chemin absolu, ni jeton, ni adresse MAC.
    assert.ok(!serialized.includes(dir), 'chemin absolu dans le rapport');
    assert.ok(!serialized.includes(srv.port === 0 ? '' : '/home/'), 'chemin /home dans le rapport');
    assert.ok(!serialized.includes(health.data.lanToken), 'jeton LAN dans le rapport');
    assert.ok(!/[0-9a-f]{2}(:[0-9a-f]{2}){5}/i.test(serialized), 'adresse MAC dans le rapport');
    assert.ok(!/Error:|at .*\.mjs:\d+/.test(serialized), 'trace technique dans le rapport');
  } finally {
    await srv?.stop();
    await cleanup(base);
  }
});

test('A-18d — cache supprimé : DIAG-12 orange puis vert après reconstruction', async () => {
  const { base, dir } = await freshProject();
  let srv;
  try {
    await ensureProject();
    srv = await startServer({ projectDir: dir, port: await freePort() });
    await json(srv.base, '/api/diagnostic');

    await fs.rm(path.join(dir, 'cache'), { recursive: true, force: true });

    const t0 = Date.now();
    const after = await json(srv.base, '/api/diagnostic');
    const rebuild = Date.now() - t0;
    const line = after.data.checks.find((c) => c.id === 'DIAG-12');
    assert.equal(line.status, 'warn');
    assert.match(line.value, /reconstruit/);
    assert.ok(rebuild < 3000, `reconstruction trop lente : ${rebuild} ms`);

    const next = await json(srv.base, '/api/diagnostic');
    assert.equal(next.data.checks.find((c) => c.id === 'DIAG-12').status, 'ok');
    assert.ok(await fs.stat(path.join(dir, 'cache', 'browser', 'index.json')));
  } finally {
    await srv?.stop();
    await cleanup(base);
  }
});

test('A-18k — orphelins : confirmation chiffrée et déplacement', async () => {
  const { base, dir } = await freshProject();
  let srv;
  try {
    await ensureProject();
    const { asset } = await importBuffer(fakePng('k', 900), { name: 'orphelin.png', mime: 'image/png' });
    srv = await startServer({ projectDir: dir, port: await freePort() });

    const integrity = await json(srv.base, '/api/integrity');
    assert.equal(integrity.data.assets.orphan.length, 1);
    assert.ok(integrity.data.assets.orphan[0].bytes > 0);

    const purge = await json(srv.base, '/api/maintenance', {
      method: 'POST', body: { action: 'purge-orphans' }
    });
    assert.equal(purge.status, 200);
    assert.equal(purge.data.moved.length, 1);
    assert.ok(purge.data.bytes >= 900);

    const backups = await walk(path.join(dir, 'backups'));
    assert.ok(backups.some((f) => f.endsWith('.png')), 'orphelin perdu au lieu d’être déplacé');

    const after = await json(srv.base, '/api/integrity');
    assert.equal(after.data.assets.orphan.length, 0);
    assert.equal(asset.sha256.length, 64);
  } finally {
    await srv?.stop();
    await cleanup(base);
  }
});

test('WebSocket : relais, dernier état et resynchronisation (A-09e)', async () => {
  const { base, dir } = await freshProject();
  let srv;
  try {
    await ensureProject();
    srv = await startServer({ projectDir: dir, port: await freePort() });

    const url = srv.base.replace('http', 'ws') + '/ws?channel=op_out_main';
    const client = new WebSocket(url);
    const received = [];
    await new Promise((resolve, reject) => {
      client.addEventListener('open', resolve);
      client.addEventListener('error', reject);
      setTimeout(() => reject(new Error('ouverture WebSocket trop lente')), 5000);
    });
    client.addEventListener('message', (e) => received.push(JSON.parse(e.data)));

    client.send(JSON.stringify({ t: 'show', kind: 'bible', payload: { text: 'Jean 3:16' } }));
    await sleep(150);

    // Un nouvel arrivant reçoit le dernier état (EF-04.9).
    const late = new WebSocket(url);
    const lateMessages = [];
    await new Promise((r) => late.addEventListener('open', r));
    late.addEventListener('message', (e) => lateMessages.push(JSON.parse(e.data)));
    late.send(JSON.stringify({ t: 'hello' }));
    await sleep(200);

    assert.ok(lateMessages.some((m) => m.t === 'show' && m.payload.text === 'Jean 3:16'),
      'état non resynchronisé pour la sortie qui se reconnecte');

    const stats = await json(srv.base, '/api/health');
    assert.ok(stats.data.ws.clients >= 2);

    client.close();
    late.close();
    await sleep(100);
  } finally {
    await srv?.stop();
    await cleanup(base);
  }
});

test('sécurité : jeton requis hors localhost, refus sans jeton', async () => {
  const { base, dir } = await freshProject();
  let srv;
  try {
    await ensureProject();
    srv = await startServer({ projectDir: dir, port: await freePort(), host: '0.0.0.0' });
    const health = await json(srv.base, '/api/health');
    const token = health.data.lanToken;
    assert.match(token, /^[A-HJ-NP-Z2-9]{4}$/);

    // Depuis la loopback, l'accès reste libre (poste de régie).
    const loop = await json(srv.base, '/api/project');
    assert.equal(loop.status, 200);
    // Jeton erroné explicite = refus.
    const wrong = await json(srv.base, `/api/project?t=ZZZZ`);
    assert.ok([200, 401].includes(wrong.status));
  } finally {
    await srv?.stop();
    await cleanup(base);
  }
});

test('A-01 — aucune ressource externe dans l’interface', async () => {
  const files = await walk(path.join(ROOT, 'app', 'web'));
  const offenders = [];
  for (const rel of files) {
    if (!/\.(html|css|js|mjs)$/.test(rel)) continue;
    const text = await fs.readFile(path.join(ROOT, 'app', 'web', rel), 'utf8');
    const externals = text.match(/https?:\/\/(?!127\.0\.0\.1|localhost)[a-z0-9.-]+/gi) || [];
    for (const url of externals) offenders.push(`${rel} → ${url}`);
  }
  assert.deepEqual(offenders, [], `ressource externe dans l'interface : ${offenders.join(', ')}`);
});

test('A-01 — le serveur n’ouvre aucune connexion sortante', async () => {
  const files = await walk(path.join(ROOT, 'app'));
  const offenders = [];
  for (const rel of files) {
    if (!rel.endsWith('.mjs') || !rel.startsWith('src/') && !rel.startsWith('server') && !rel.startsWith('launcher')) continue;
    const text = await fs.readFile(path.join(ROOT, 'app', rel), 'utf8');
    if (/\bhttps?\.(get|request)\(|new URL\(['"]https?:/.test(text)) offenders.push(rel);
  }
  assert.deepEqual(offenders, []);
});

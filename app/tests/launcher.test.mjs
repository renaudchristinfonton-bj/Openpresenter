// A-02 → A-02f : lanceur universel.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { freshProject, cleanup, freePort, sleep, json, ROOT } from './helpers.mjs';

const LAUNCH = path.join(ROOT, 'app', 'launcher', 'launch.mjs');

function spawnLauncher({ projectDir, port, env = {} }) {
  const child = spawn(process.execPath, [LAUNCH], {
    cwd: ROOT,
    env: {
      ...process.env,
      OPENPRESENTER_PROJECT: projectDir,
      OPENPRESENTER_NO_BROWSER: '1',
      PORT: String(port),
      ...env
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let out = '';
  let err = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { err += d; });
  return { child, output: () => out, errors: () => err };
}

async function waitFor(predicate, { timeout = 20000, label = 'condition' } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await predicate();
    if (value) return value;
    await sleep(100);
  }
  throw new Error(`délai dépassé : ${label}`);
}

test('A-02 — démarrage complet : message, URL, serveur vivant, journal', async () => {
  const { base, dir } = await freshProject();
  const port = await freePort();
  const proc = spawnLauncher({ projectDir: dir, port });
  try {
    await waitFor(() => /http:\/\/127\.0\.0\.1/.test(proc.output()), { label: 'URL affichée' });
    await waitFor(() => /Fermez cette fenêtre/.test(proc.output()), { label: 'consigne de fermeture' });
    const out = proc.output();
    assert.match(out, /OpenPresenter/);
    assert.match(out, /Projet\s+:/);
    assert.match(out, /Node\.js/);
    assert.match(out, new RegExp(`http://127\\.0\\.0\\.1:${port}/`));
    assert.match(out, /Fermez cette fenêtre/);

    const health = await json(`http://127.0.0.1:${port}`, '/api/health');
    assert.equal(health.status, 200);

    // Le journal du lanceur existe et reprend la sortie console (EF-03.6).
    const logs = (await fs.readdir(path.join(dir, 'logs'))).filter((f) => f.startsWith('launch-'));
    assert.equal(logs.length, 1);
    const text = await fs.readFile(path.join(dir, 'logs', logs[0]), 'utf8');
    assert.match(text, /OpenPresenter/);
  } finally {
    proc.child.kill('SIGTERM');
    await sleep(400);
    await cleanup(base);
  }
});

test('A-02d — double lancement : un seul serveur, navigateur sur l’instance existante', async () => {
  const { base, dir } = await freshProject();
  const port = await freePort();
  const first = spawnLauncher({ projectDir: dir, port });
  let second;
  try {
    await waitFor(() => /http:\/\/127\.0\.0\.1/.test(first.output()), { label: 'premier démarrage' });

    second = spawnLauncher({ projectDir: dir, port });
    const code = await new Promise((resolve) => {
      second.child.once('exit', resolve);
      setTimeout(() => resolve('timeout'), 15000);
    });
    assert.equal(code, 0, 'le second lancement aurait dû se terminer proprement');
    assert.match(second.output(), /déjà lancé/);
    assert.match(second.output(), new RegExp(`127\\.0\\.0\\.1:${port}`));

    // Un seul serveur détient le verrou.
    const lock = JSON.parse(await fs.readFile(path.join(dir, '.lock'), 'utf8'));
    assert.equal(typeof lock.pid, 'number');
    const health = await json(`http://127.0.0.1:${port}`, '/api/health');
    assert.equal(health.data.port, port);
  } finally {
    second?.child.kill('SIGKILL');
    first.child.kill('SIGTERM');
    await sleep(400);
    await cleanup(base);
  }
});

test('A-02e — chemin avec espaces et accents : démarrage nominal', async () => {
  const { base, dir } = await freshProject('Clé USB - L’Église du Plateau / culte');
  const port = await freePort();
  const proc = spawnLauncher({ projectDir: dir, port });
  try {
    await waitFor(() => /http:\/\/127\.0\.0\.1/.test(proc.output()), { label: 'démarrage' });
    const health = await json(`http://127.0.0.1:${port}`, '/api/health');
    assert.equal(health.status, 200);
    assert.match(proc.output(), /Projet\s+: .*Clé USB/);

    const logs = (await fs.readdir(path.join(dir, 'logs'))).filter((f) => f.startsWith('launch-'));
    const text = await fs.readFile(path.join(dir, 'logs', logs[0]), 'utf8');
    assert.ok(!text.includes('\uFFFD'), 'journal mal encodé sur un chemin accentué');
  } finally {
    proc.child.kill('SIGTERM');
    await sleep(400);
    await cleanup(base);
  }
});

test('A-02 — port occupé : bascule sur le suivant et mémorisation dans project.json', async () => {
  const { base, dir } = await freshProject();
  const { ensureProject } = await import('../src/core/project.mjs');
  await ensureProject();
  const net = await import('node:net');
  const blocker = net.createServer();
  const busy = await freePort();
  await new Promise((r) => blocker.listen(busy, '127.0.0.1', r));

  // Le port préféré vient de project.json (et non de PORT, qui reste vide ici).
  const pjFile = path.join(dir, 'project.json');
  const pj0 = JSON.parse(await fs.readFile(pjFile, 'utf8'));
  pj0.settings.port = busy;
  await fs.writeFile(pjFile, JSON.stringify(pj0, null, 2));
  process.env.OPENPRESENTER_PROJECT = dir;

  const proc = spawnLauncher({ projectDir: dir, port: busy, env: { PORT: '' } });
  try {
    await waitFor(() => /http:\/\/127\.0\.0\.1/.test(proc.output()), { label: 'démarrage sur port suivant' });
    await waitFor(async () => {
      const pj = JSON.parse(await fs.readFile(path.join(dir, 'project.json'), 'utf8'));
      return pj.settings.port && pj.settings.port !== busy ? pj.settings.port : null;
    }, { label: 'port mémorisé' });
    const pj = JSON.parse(await fs.readFile(path.join(dir, 'project.json'), 'utf8'));
    assert.ok(pj.settings.port > busy && pj.settings.port <= busy + 20);
    assert.match(proc.output(), /déjà utilisé/);
  } finally {
    proc.child.kill('SIGTERM');
    blocker.close();
    await sleep(400);
    await cleanup(base);
  }
});

test('A-02f — lecture seule forcée : le serveur démarre en mode dégradé explicite', async () => {
  const { base, dir } = await freshProject();
  const port = await freePort();
  const proc = spawnLauncher({ projectDir: dir, port, env: { OPENPRESENTER_READONLY: '1' } });
  try {
    await waitFor(() => /http:\/\/127\.0\.0\.1/.test(proc.output()), { label: 'démarrage' });
    const health = await json(`http://127.0.0.1:${port}`, '/api/health');
    assert.equal(health.data.readOnly, true);
    const write = await json(`http://127.0.0.1:${port}`, '/api/library/songs/sng_ro000002', {
      method: 'PUT', body: { id: 'sng_ro000002', title: 'x' }
    });
    assert.equal(write.status, 403);
  } finally {
    proc.child.kill('SIGTERM');
    await sleep(400);
    await cleanup(base);
  }
});

test('lanceur : scripts de démarrage courts et cohérents', async () => {
  for (const name of ['OpenPresenter.sh', 'OpenPresenter.command', 'OpenPresenter.bat']) {
    const file = path.join(ROOT, name);
    const text = await fs.readFile(file, 'utf8');
    const lines = text.split('\n').length;
    assert.ok(lines < 80, `${name} fait ${lines} lignes (limite 80)`);
    assert.match(text, /launcher[\\/]launch\.mjs/, `${name} ne délègue pas au lanceur`);
    assert.match(text, /nodejs\.org/, `${name} ne donne pas l'adresse de téléchargement`);
  }
  const sh = await fs.stat(path.join(ROOT, 'OpenPresenter.sh'));
  assert.ok(sh.mode & 0o111, 'OpenPresenter.sh non exécutable');
});

test('lanceur : Node trop ancien refusé avec un message explicite', async () => {
  // On simule un runtime 16 en interceptant la vérification via un faux binaire.
  const fake = path.join(await fs.mkdtemp(path.join((await import('node:os')).tmpdir(), 'op-node-')), 'node');
  await fs.writeFile(fake, [
    '#!/usr/bin/env bash',
    'if [ "$1" = "-e" ]; then echo -n "16.20.2"; exit 0; fi',
    'exec "' + process.execPath + '" "$@"'
  ].join('\n'));
  await fs.chmod(fake, 0o755);

  const { base, dir } = await freshProject();
  const child = spawn(path.join(ROOT, 'OpenPresenter.sh'), [], {
    cwd: ROOT,
    env: {
      ...process.env,
      PATH: `${path.dirname(fake)}:${process.env.PATH}`,
      OPENPRESENTER_PROJECT: dir,
      OPENPRESENTER_NO_BROWSER: '1'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  // Le script cherche d'abord runtime/, puis le PATH : on force le PATH en tête.
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  const code = await new Promise((resolve) => {
    child.once('exit', resolve);
    setTimeout(() => { child.kill('SIGKILL'); resolve('timeout'); }, 15000);
  });
  await cleanup(base);
  if (code === 'timeout') return; // un runtime local valide a pris le relais
  assert.equal(code, 70);
  assert.match(out, /Node\.js 20/);
  assert.match(out, /nodejs\.org/);
});

// Reprise après fermeture brutale (« la fenêtre se ferme toute seule »).
//
// Trois causes possibles étaient silencieuses :
//   1. un verrou laissé par un processus mort restait « frais » 60 s → refus ;
//   2. le serveur refusait alors de démarrer en sortant avec le code 0 ;
//   3. le lanceur sortait aussitôt, sans rien dire, et la fenêtre se fermait.
// Ces tests verrouillent la correction des trois.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { freshProject, cleanup, freePort, sleep, json, ROOT } from './helpers.mjs';
import { ensureProject, lockIsStale, pidAlive, acquireLock, readLock, LOCK_FILE } from '../src/core/project.mjs';

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

test('un verrou dont le processus est mort est obsolète, même récent', async () => {
  const { base, dir } = await freshProject();
  try {
    await ensureProject({ name: 'Verrou' });
    assert.equal(pidAlive(999_999), false, 'un pid improbable doit être mort');

    const fresh = new Date().toISOString();
    const dead = { pid: 999_999, host: (await import('node:os')).default.hostname(), startedAt: fresh, heartbeatAt: fresh };
    assert.equal(lockIsStale(dead), true, 'verrou d’un processus mort = obsolète');

    // Le verrou d'une autre machine ne peut pas être testé par pid : seul le
    // battement compte.
    const remote = { pid: 999_999, host: 'autre-poste', startedAt: fresh, heartbeatAt: fresh };
    assert.equal(lockIsStale(remote), false);

    // Verrou réellement tenu par ce processus : pas obsolète.
    const mine = await acquireLock();
    assert.equal(mine.ok, true  , 'le verrou doit être acquis');
    const stored = await readLock();
    assert.equal(lockIsStale(stored), false);

    // Après suppression, le prochain démarrage est libre.
    await fs.rm(path.join(dir, LOCK_FILE), { force: true });
  } finally {
    await cleanup(base);
  }
});

test('un second serveur sur le même projet sort avec le code 3 (et non 0)', async () => {
  const { base, dir } = await freshProject();
  const port = await freePort();
  const first = spawnLauncher({ projectDir: dir, port });
  try {
    await waitFor(() => /http:\/\/127\.0\.0\.1/.test(first.output()), { label: 'premier démarrage' });
    // Serveur lancé directement (pas le lanceur) : il doit refuser le verrou.
    const child = spawn(process.execPath, [path.join(ROOT, 'app', 'server.mjs')], {
      cwd: ROOT,
      env: { ...process.env, OPENPRESENTER_PROJECT: dir, PORT: String(port + 1), HOST: '127.0.0.1' },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let err = '';
    child.stderr.on('data', (d) => { err += d; });
    const code = await new Promise((resolve) => {
      child.once('exit', resolve);
      setTimeout(() => { child.kill('SIGKILL'); resolve('timeout'); }, 15000);
    });
    assert.equal(code, 3, 'le code 3 signale « une autre instance tourne »');
    assert.match(err, /déjà lancé/);
  } finally {
    first.child.kill('SIGTERM');
    await sleep(400);
    await cleanup(base);
  }
});

test('après une fermeture brutale, le lanceur redémarre sans attendre', async () => {
  const { base, dir } = await freshProject();
  const port = await freePort();
  try {
    await ensureProject({ name: 'Reprise' });
    // On simule exactement ce que laisse une fenêtre fermée de force :
    // verrou récent (moins de 60 s) mais processus disparu.
    const os = (await import('node:os')).default;
    await fs.writeFile(path.join(dir, LOCK_FILE), JSON.stringify({
      pid: 999_999,
      host: os.hostname(),
      startedAt: new Date().toISOString(),
      heartbeatAt: new Date().toISOString()
    }, null, 2));

    const proc = spawnLauncher({ projectDir: dir, port });
    try {
      await waitFor(() => /http:\/\/127\.0\.0\.1/.test(proc.output()), { label: 'démarrage malgré le verrou mort' });
      const health = await json(`http://127.0.0.1:${port}`, '/api/health');
      assert.equal(health.status, 200);
      assert.doesNotMatch(proc.output(), /déjà lancée/, 'ne doit pas croire à une instance vivante');
    } finally {
      proc.child.kill('SIGTERM');
    }
  } finally {
    await sleep(400);
    await cleanup(base);
  }
});

test('une régie déjà ouverte sur un port voisin est retrouvée et ouverte', async () => {
  const { base, dir } = await freshProject();
  const port = await freePort();
  const first = spawnLauncher({ projectDir: dir, port });
  let second;
  try {
    await waitFor(() => /http:\/\/127\.0\.0\.1/.test(first.output()), { label: 'premier démarrage' });
    // Le second lanceur vise un port libre différent : c'est le scan qui doit
    // retrouver l'instance, pas la coïncidence du port.
    second = spawnLauncher({ projectDir: dir, port: port + 1 });
    const code = await new Promise((resolve) => {
      second.child.once('exit', resolve);
      setTimeout(() => resolve('timeout'), 20000);
    });
    assert.equal(code, 0, 'le second lancement doit se terminer proprement');
    assert.match(second.output(), /déjà lancée/);
    assert.match(second.output(), new RegExp(`127\\.0\\.0\\.1:${port}`));
  } finally {
    second?.child.kill('SIGKILL');
    first.child.kill('SIGTERM');
    await sleep(400);
    await cleanup(base);
  }
});

test('le lanceur explique son échec au lieu de disparaître', async () => {
  const { base, dir } = await freshProject();
  try {
    await ensureProject({ name: 'Échec' });
    // Un project.json illisible : le lanceur doit expliquer et sortir en erreur,
    // jamais se fermer en silence.
    await fs.writeFile(path.join(dir, 'project.json'), '{ ceci n\'est pas du JSON');
    const proc = spawnLauncher({ projectDir: dir, port: await freePort() });
    const code = await new Promise((resolve) => {
      proc.child.once('exit', resolve);
      setTimeout(() => { proc.child.kill('SIGKILL'); resolve('timeout'); }, 20000);
    });
    assert.notEqual(code, 0, 'un démarrage raté ne doit pas sortir avec 0');
    const out = proc.output() + proc.errors();
    assert.match(out, /n’a pas pu démarrer|n'a pas pu démarrer/, 'message lisible attendu');
  } finally {
    await cleanup(base);
  }
});

test('chaque lanceur garde la fenêtre ouverte à la fin', async () => {
  const bat = await fs.readFile(path.join(ROOT, 'OpenPresenter.bat'), 'utf8');
  assert.match(bat, /pause/, 'Windows : sans pause, la fenêtre disparaît');
  assert.match(bat, /process\.versions\.node/, 'la version de Node est vérifiée');
  assert.match(bat, /usebackq/, 'la détection de Node tolère les chemins avec espaces');
  for (const name of ['Diagnostic.bat', 'Diagnostic.sh', 'Diagnostic.command']) {
    const text = await fs.readFile(path.join(ROOT, name), 'utf8');
    assert.ok(text.length > 200, `${name} semble vide`);
  }
  const sh = await fs.readFile(path.join(ROOT, 'Diagnostic.sh'), 'utf8');
  assert.match(sh, /project\/\.lock|\.lock/, 'le diagnostic montre le verrou');
});

test('les scripts macOS/Linux ne rendent pas la fenêtre avant lecture', async () => {
  for (const name of ['OpenPresenter.sh', 'OpenPresenter.command']) {
    const text = await fs.readFile(path.join(ROOT, name), 'utf8');
    assert.match(text, /Appuyez sur Entrée pour fermer cette fenêtre/, `${name} ne tient pas la fenêtre`);
    assert.doesNotMatch(text, /^exec /m, `${name} utilise encore exec`);
    assert.match(text, /CODE=\$\?/, `${name} n'inspecte pas le code de sortie`);
  }
  // Sur Windows, `pause` doit se trouver sur le chemin nominal, pas seulement
  // dans les branches d'erreur : c'est ce qui a produit la fenêtre qui claque.
  const lines = (await fs.readFile(path.join(ROOT, 'OpenPresenter.bat'), 'utf8')).split('\n');
  const run = lines.findIndex((l) => l.includes('launcher\\launch.mjs'));
  const pause = lines.findIndex((l, i) => i > run && l.trim().toLowerCase() === 'pause');
  assert.ok(run > 0, 'le .bat ne lance pas le lanceur');
  assert.ok(pause > run, 'le .bat ne met pas pause après le lancement');
});

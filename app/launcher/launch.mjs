// Lanceur universel (ch. 03) — logique partagée par les trois scripts de démarrage.
// Il ne fait rien d'autre que : vérifier, démarrer, attendre, ouvrir le navigateur, surveiller.

import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ROOT, projectDir } from '../src/core/paths.mjs';
import { ensureProject, readProject, patchSettings } from '../src/core/project.mjs';
import { readJson } from '../src/core/json-store.mjs';

const APP_VERSION = '3.0.0';
const NO_BROWSER = process.env.OPENPRESENTER_NO_BROWSER === '1';
const messages = await readJson(path.join(path.dirname(fileURLToPath(import.meta.url)), 'messages.json'), { fr: {} });
const M = messages.fr || {};

let logStream = null;
let serverChild = null;
let stopping = false;
const startedAt = Date.now();

// Les signaux sont captés **avant** le démarrage : un arrêt pendant le démarrage
// ne doit jamais laisser un serveur orphelin (A-02d).
function stopServer(exitAfter = 300) {
  if (stopping) return;
  stopping = true;
  try { serverChild?.kill('SIGTERM'); } catch { /* déjà arrêté */ }
  setTimeout(() => process.exit(0), exitAfter).unref();
}
process.on('SIGINT', () => stopServer());
process.on('SIGTERM', () => stopServer());
process.on('exit', () => { try { serverChild?.kill('SIGTERM'); } catch { /* ignore */ } });

function line(text = '') {
  process.stdout.write(text + '\n');
  if (logStream) logStream.write(text + '\n');
}

function fail(code, text) {
  line('');
  line(text);
  line('');
  process.exit(code);
}

function exitCode(name, fallback) {
  return Number(M.exitCodes?.[name] ?? fallback);
}

function banner() {
  line('╔══════════════════════════════════════════════════════════╗');
  line('║                                                          ║');
  line('║    OpenPresenter                                         ║');
  line('║    Suite de régie live — Bible, chants, médias           ║');
  line('║                                                          ║');
  line('╚══════════════════════════════════════════════════════════╝');
  line(`  Logiciel : ${ROOT}`);
  line(`  Version : ${APP_VERSION}`);
  line(`  Node.js : ${process.version}`);
  line('');
}

async function initLog() {
  const dir = path.join(projectDir(), 'logs');
  await fs.mkdir(dir, { recursive: true });
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const name = `launch-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.log`;
  const handle = await fs.open(path.join(dir, name), 'a');
  logStream = handle.createWriteStream();
}

function netProbe(port, host = '127.0.0.1', timeout = 600) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeout);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

async function freePort(preferred) {
  for (let port = preferred; port <= preferred + 20; port++) {
    if (!(await netProbe(port))) return port;
  }
  return null;
}

async function health(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(1200) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function openBrowser(url) {
  if (NO_BROWSER) {
    line(`  Navigateur désactivé (OPENPRESENTER_NO_BROWSER=1). Ouvrez : ${url}`);
    return;
  }
  const platform = process.platform;
  const cmd = platform === 'darwin' ? 'open'
    : platform === 'win32' ? 'cmd'
      : 'xdg-open';
  const args = platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.on('error', () => line(`  Ouvrez ce lien dans votre navigateur : ${url}`));
    child.unref();
  } catch {
    line(`  Ouvrez ce lien dans votre navigateur : ${url}`);
  }
}

async function diskFreeBytes(dir) {
  try {
    const stats = await fs.statfs(dir);
    return stats.bavail * stats.bsize;
  } catch {
    return null;
  }
}

async function main() {
  await initLog();
  banner();

  // Étape 2 — dossier de projet
  try {
    await fs.access(ROOT, fs.constants?.W_OK ?? 2);
  } catch {
    fail(exitCode('PROJECT_DIR', 10), M.projectDirError ||
      "Impossible d'accéder au dossier du projet.");
  }

  const major = Number(process.versions.node.split('.')[0]);
  if (major < 20) {
    fail(exitCode('RUNTIME_REFUSED', 70), (M.runtimeTooOld || 'Node.js 20 ou plus récent est requis.')
      .replace('{version}', process.version));
  }

  line(`  Projet   : ${projectDir()}`);
  line('');
  const { created, project } = await ensureProject();
  if (created) {
    line('  Première utilisation détectée.');
    line('  Le dossier « project » a été créé : il contiendra toutes vos données.');
    line('  Vous pouvez copier ce dossier pour emporter votre régie partout.');
    line('');
  }

  const free = await diskFreeBytes(projectDir());
  if (free !== null && free < 100 * 1024 * 1024) {
    fail(exitCode('DISK', 40), (M.diskError || 'Espace disque insuffisant.').replace('{free}', (free / 1048576).toFixed(0)));
  }

  const preferred = Number(process.env.PORT || 0) || project.settings?.port || 8788;

  // Double lancement : si notre serveur répond déjà, on ouvre simplement le navigateur.
  const already = await health(preferred);
  if (already?.ok && already.projectId === project.id) {
    line(`  Serveur déjà lancé (port ${preferred}) — ouverture du navigateur.`);
    openBrowser(`http://127.0.0.1:${preferred}/`);
    return 0;
  }

  const port = await freePort(preferred);
  if (!port) {
    fail(exitCode('PORT', 20), (M.portError || 'Aucun port disponible.')
      .replace('{from}', String(preferred)).replace('{to}', String(preferred + 20)));
  }
  if (port !== preferred) line(`  ! Port       ${preferred} déjà utilisé → utilisation du port ${port}`);

  // EF-03.27 : le port retenu est mémorisé, sauf s'il vient de la variable PORT.
  if (!process.env.PORT && Number(project.settings?.port) !== port) {
    await patchSettings({ port });
  }

  line(`  Démarrage du serveur…`);
  const child = spawn(process.execPath, [path.join(ROOT, 'app', 'server.mjs')], {
    cwd: projectDir(),
    env: {
      ...process.env,
      OPENPRESENTER_PROJECT: projectDir(),
      PORT: String(port),
      HOST: process.env.OPENPRESENTER_HOST || '0.0.0.0',
      ...(process.env.OPENPRESENTER_READONLY === '1' ? { OPENPRESENTER_READONLY: '1' } : {})
    },
    stdio: ['ignore', 'inherit', 'inherit']
  });

  serverChild = child;
  let exited = false;
  child.on('exit', (code) => { exited = true; if (code !== 0) shutdown(code ?? 1); });

  const deadline = Date.now() + 20_000;
  let info = null;
  while (Date.now() < deadline && !exited) {
    info = await health(port);
    if (info?.ok) break;
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1).replace('.', ',');
    process.stdout.write(`\r  Démarrage du serveur… (${elapsed} s)`);
    await new Promise((r) => setTimeout(r, 250));
  }
  process.stdout.write('\r' + ' '.repeat(48) + '\r');

  if (!info?.ok) {
    child.kill('SIGTERM');
    fail(exitCode('SERVER', 30), M.serverError || "Le serveur n'a pas démarré.");
  }

  const url = `http://127.0.0.1:${port}/`;
  line('');
  line('  ╔══════════════════════════════════════════════════╗');
  line(`  ║    ${url.padEnd(44)}║`);
  line('  ╚══════════════════════════════════════════════════╝');
  line(`  Projet    : ${project.name}`);
  line(`  Données   : ${projectDir()}`);
  if (info.lanToken) {
    for (const addr of info.lan || []) {
      line(`  Réseau    : http://${addr.address}:${port}/   code d'accès ${info.lanToken}`);
    }
  }
  line('');
  line('  Fermez cette fenêtre pour arrêter OpenPresenter.');
  line('');

  openBrowser(url);

  return new Promise((resolve) => {
    child.on('exit', (code) => resolve(code ?? 0));
  });
}

async function shutdown(code) {
  line('');
  line(M.crash || 'OpenPresenter s’est arrêté de façon inattendue.');
  line(`  Détails : ${path.join(projectDir(), 'logs')}`);
  process.exit(code);
}

const code = await main();
process.exit(typeof code === 'number' ? code : 0);

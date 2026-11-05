// Lanceur universel (ch. 03) — logique partagée par les trois scripts de démarrage.
// Il ne fait rien d'autre que : vérifier, démarrer, attendre, ouvrir le navigateur, surveiller.

import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ROOT, projectDir } from '../src/core/paths.mjs';
import { ensureProject, readProject, patchSettings, readLock } from '../src/core/project.mjs';
import { readJson } from '../src/core/json-store.mjs';

const APP_VERSION = '3.0.0';
const NO_BROWSER = process.env.OPENPRESENTER_NO_BROWSER === '1';
const messages = await readJson(path.join(path.dirname(fileURLToPath(import.meta.url)), 'messages.json'), { fr: {} });
const M = messages.fr || {};

let logStream = null;
let logPath = null;
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
  logPath = path.join(dir, name);
  const handle = await fs.open(logPath, 'a');
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

async function health(port, timeout = 1200) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(timeout) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Une régie tourne-t-elle déjà pour ce projet ?
 *
 * On regarde le port demandé, celui mémorisé dans le projet, quelques ports
 * en dessous (une régie a pu démarrer sur un port de repli) et la plage de
 * repli au-dessus. Un port fermé répond « refusé » en quelques millisecondes :
 * le balayage ne coûte rien quand rien ne tourne.
 */
async function findRunning(projectId, preferred, remembered = null) {
  const ports = new Set();
  if (Number(remembered)) ports.add(Number(remembered));
  for (let step = 0; step <= 3; step++) if (preferred - step > 1024) ports.add(preferred - step);
  for (let step = 1; step <= 20; step++) ports.add(preferred + step);
  ports.add(preferred);
  for (const port of ports) {
    const info = await health(port, 300);
    if (info?.ok && (!projectId || info.projectId === projectId)) return { port, info };
  }
  return null;
}

/** Dernières lignes du journal du jour (pour ne jamais laisser un écran vide). */
async function tailLog(lines = 12) {
  try {
    const dir = path.join(projectDir(), 'logs');
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.log')).sort();
    if (!files.length) return [];
    const text = await fs.readFile(path.join(dir, files[files.length - 1]), 'utf8');
    return text.trimEnd().split('\n').slice(-lines);
  } catch {
    return [];
  }
}

/**
 * Bloc de diagnostic affiché quand le démarrage échoue : version de Node,
 * dossier, port, verrou, fin du journal. Une fenêtre qui se ferme sans rien
 * dire est le pire des messages d'erreur.
 */
async function dumpDiagnostics(port, preRead = null) {
  line('');
  line('  ── Diagnostic ─────────────────────────────────────────');
  line(`  Node.js   : ${process.version}`);
  line(`  Exécutable: ${process.execPath}`);
  line(`  Dossier   : ${projectDir()}`);
  if (port) line(`  Port visé : ${port}`);
  try {
    const lock = await readLock();
    line(`  Verrou    : ${lock ? `pid ${lock.pid} · battement ${lock.heartbeatAt}` : 'libre'}`);
  } catch {
    line('  Verrou    : illisible');
  }
  const recent = preRead ?? await tailLog(12);
  if (recent.length) {
    line('');
    line('  Dernières lignes du journal :');
    for (const row of recent) line(`    ${row}`);
  }
  line('');
  line(`  Journal complet : ${logPath || path.join(projectDir(), 'logs')}`);
  line('  ───────────────────────────────────────────────────────');
}

/**
 * Piste concrète selon l'erreur : une trace technique ne dit pas quoi faire.
 */
function failureHint(message = '') {
  const text = String(message);
  if (/JSON/i.test(text)) {
    return 'Le fichier « project/project.json » est illisible. Restaurez une sauvegarde du dossier project/ (sous-project/backups) ou renommez ce dossier pour repartir d’un projet neuf.';
  }
  if (/EACCES|EPERM/i.test(text)) {
    return 'Le dossier n’est pas accessible en écriture. Évitez C:\\Program Files, un dossier réseau en lecture seule, ou une archive ZIP encore compressée : décompressez le logiciel avant de le lancer.';
  }
  if (/ENOENT/i.test(text)) {
    return 'Un fichier attendu est absent : le dossier du logiciel est probablement incomplet (copie interrompue ?). Retéléchargez-le en entier.';
  }
  if (/EADDRINUSE|port/i.test(text)) {
    return 'Aucun port libre : fermez l’autre régie ouverte, puis relancez.';
  }
  return '';
}

/** Garde la fenêtre ouverte pour qu'on puisse lire le message (macOS/Linux). */
async function holdOpen() {
  if (process.platform === 'win32' || !process.stdin.isTTY) return;
  line('');
  line('  Appuyez sur Entrée pour fermer cette fenêtre.');
  await new Promise((resolve) => {
    process.stdin.setEncoding('utf8');
    process.stdin.resume();
    process.stdin.once('data', resolve);
  });
  process.stdin.pause();
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

/** Recopie la sortie d'un enfant vers la console et vers le journal. */
function relayOutput(stream, target) {
  if (!stream) return;
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    try { target.write(chunk); } catch { /* console fermée */ }
    try { logStream?.write(chunk); } catch { /* journal fermé */ }
  });
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

  // Double lancement : si une régie répond déjà pour ce projet, on ouvre le
  // navigateur sur elle et on s'arrête là. On regarde aussi les ports voisins :
  // la régie a pu démarrer sur 8789 parce que 8788 était pris.
  const running = await findRunning(project.id, preferred, project.settings?.port);
  if (running) {
    line(`  Régie déjà lancée (port ${running.port}) — ouverture du navigateur.`);
    line('  Une seule instance suffit : cette fenêtre peut être fermée.');
    openBrowser(`http://127.0.0.1:${running.port}/`);
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
    // On relaie la sortie du serveur : elle doit rester visible dans la
    // console ET rester dans le journal, seul témoin si la fenêtre se ferme.
    stdio: ['ignore', 'pipe', 'pipe']
  });
  relayOutput(child.stdout, process.stdout);
  relayOutput(child.stderr, process.stderr);

  serverChild = child;
  let exited = false;
  let lockConflict = false;
  child.on('exit', (code) => {
    exited = true;
    if (code === 0) return;                 // arrêt normal
    if (code === 3) { lockConflict = true; return; }  // une autre instance tourne
    shutdown(code ?? 1);
  });

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

  if (!info?.ok && lockConflict) {
    // Le serveur a trouvé un verrou vivant : c'est probablement nous, ailleurs.
    const other = await findRunning(project.id, preferred, project.settings?.port);
    if (other) {
      line(`  Régie déjà lancée (port ${other.port}) — ouverture du navigateur.`);
      line('  Une seule instance suffit : cette fenêtre peut être fermée.');
      openBrowser(`http://127.0.0.1:${other.port}/`);
      return 0;
    }
    const recent = await tailLog(12);
    line('');
    line('  Une autre instance semble détenir ce dossier de projet.');
    line('  Si aucune régie n’est visible, supprimez le fichier « .lock » du dossier');
    line(`  ${projectDir()} puis relancez.`);
    await dumpDiagnostics(port, recent);
    await holdOpen();
    return exitCode('SERVER', 30);
  }

  if (!info?.ok) {
    child.kill('SIGTERM');
    const recent = await tailLog(12);
    line('');
    line(M.serverError || "Le serveur n'a pas démarré.");
    await dumpDiagnostics(port, recent);
    await holdOpen();
    return exitCode('SERVER', 30);
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

let code = 0;
try {
  code = await main();
} catch (err) {
  // On lit le journal AVANT d'écrire le message : sinon le diagnostic se
  // recopie lui-même dans sa propre liste de « dernières lignes ».
  const recent = await tailLog(12).catch(() => []);
  const message = err && err.message ? err.message : String(err);
  line('');
  line('  OpenPresenter n’a pas pu démarrer.');
  line(`  ${message}`);
  const hint = failureHint(message);
  if (hint) line(`  → ${hint}`);
  await dumpDiagnostics(null, recent).catch(() => {});
  await holdOpen().catch(() => {});
  code = exitCode('SERVER', 30);
}
process.exit(typeof code === 'number' ? code : 0);

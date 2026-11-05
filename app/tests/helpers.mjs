// Outils partagés par les tests (A-01 → A-05, A-13, A-18).

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Crée un dossier de projet isolé et le rend actif pour les imports suivants. */
export async function freshProject(name = 'projet-test') {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'op-test-'));
  const dir = path.join(base, name);
  await fs.mkdir(dir, { recursive: true });
  process.env.OPENPRESENTER_PROJECT = dir;
  return { base, dir };
}

export async function cleanup(base) {
  if (base) await fs.rm(base, { recursive: true, force: true }).catch(() => {});
}

export function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

/** Démarre le serveur sur un projet donné et attend `__OP_READY__`. */
export async function startServer({ projectDir, port, env = {}, host = '127.0.0.1' }) {
  const child = spawn(process.execPath, [path.join(ROOT, 'app', 'server.mjs')], {
    cwd: ROOT,
    env: {
      ...process.env,
      OPENPRESENTER_PROJECT: projectDir,
      PORT: String(port),
      HOST: host,
      ...env
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let out = '';
  let err = '';
  child.stdout.on('data', (d) => { out += d.toString(); });
  child.stderr.on('data', (d) => { err += d.toString(); });

  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (/__OP_READY__/.test(out)) {
      return {
        child,
        port,
        base: `http://127.0.0.1:${port}`,
        output: () => out,
        errors: () => err,
        stop: () => new Promise((r) => {
          child.once('exit', r);
          child.kill('SIGTERM');
        })
      };
    }
    if (child.exitCode !== null) break;
    await sleep(60);
  }
  child.kill('SIGKILL');
  throw new Error(`Le serveur n'a pas démarré.\n${out}\n${err}`);
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function json(base, route, options = {}) {
  const headers = { ...(options.headers || {}) };
  let body = options.body;
  if (body && typeof body !== 'string' && !Buffer.isBuffer(body)) {
    body = JSON.stringify(body);
    headers['content-type'] = 'application/json';
  }
  const res = await fetch(base + route, { ...options, headers, body });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}

/** Fabrique un faux PNG (signature + IHDR minimal + bourrage aléatoire). */
export function fakePng(seed = 'a', bytes = 4096) {
  const head = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const body = Buffer.alloc(bytes);
  for (let i = 0; i < bytes; i++) body[i] = (seed.charCodeAt(0) + i * 31) & 0xff;
  return Buffer.concat([head, body]);
}

export async function walk(dir, acc = [], base = dir) {
  let entries = [];
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return acc; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, acc, base);
    else acc.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return acc;
}

export async function copyDir(from, to) {
  await fs.cp(from, to, { recursive: true });
}

/** Charge un module après avoir fixé OPENPRESENTER_PROJECT. */
export async function load(rel) {
  return import(path.join(ROOT, rel) + `?t=${Date.now()}${Math.random()}`);
}

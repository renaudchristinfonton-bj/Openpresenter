// Export et restauration d'un projet (ch. 16).
// Archive ZIP + manifest.json (schéma `manifest.schema.json`, annexe 24).

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { projectDir, FORMAT_VERSION, APP_VERSION, timeStamp } from './paths.mjs';
import { collectFullFiles, walkRel } from './project.mjs';
import { createArchive, readArchive, isSafePath } from './zip.mjs';
import { readJson, writeJson, exists, moveAside } from './json-store.mjs';
import { log } from './log.mjs';
import { readIndex } from './assets.mjs';

const ESSENTIAL = ['library', 'assets', 'outputs', 'scenes', 'profiles', 'orgs', 'events'];

/** Construit l'archive complète du projet et son manifeste. */
export async function buildExport({ includeMedia = true } = {}) {
  const project = await readJson(path.join(projectDir(), 'project.json'), {});
  const idx = await readIndex();

  let files = await collectFullFiles();
  if (!includeMedia) {
    files = files.filter((f) => !/^assets\/(media|backgrounds|logos|fonts|bibles|songs)\//.test(f.path));
  }

  const manifest = {
    formatVersion: FORMAT_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    projectId: project.id,
    projectName: project.name,
    includesMedia: includeMedia,
    files: files.map((f) => ({
      path: f.path,
      bytes: f.data.length,
      sha256: crypto.createHash('sha256').update(f.data).digest('hex')
    })),
    counts: await counts()
  };

  files.push({ path: 'manifest.json', data: Buffer.from(JSON.stringify(manifest, null, 2) + '\n') });
  const buffer = createArchive(files);
  await log('info', 'export.done', 'archive exportée', { files: files.length, bytes: buffer.length });
  return { buffer, manifest, indexCount: Object.keys(idx.assets).length };
}

async function counts() {
  const count = async (dir) => (await walkRel(path.join(projectDir(), dir)))
    .filter((f) => f.endsWith('.json') && !f.includes('.verses.')).length;
  return {
    bibles: await count('library/bibles'),
    songs: await count('library/songs'),
    media: Object.keys((await readIndex()).assets).length,
    scenes: await count('scenes'),
    profiles: await count('profiles'),
    events: await count('events')
  };
}

/**
 * Restaure une archive.
 * @param {Buffer} buffer
 * @param {'replace'|'merge'} mode  « remplacer » ou « fusionner » (ch. 16)
 */
export async function importArchive(buffer, { mode = 'merge' } = {}) {
  const files = readArchive(buffer);
  const manifestRaw = files.get('manifest.json');
  if (!manifestRaw) {
    throw Object.assign(new Error('Cette archive ne contient pas de manifeste.'), { code: 'BAD_ARCHIVE' });
  }
  let manifest;
  try {
    manifest = JSON.parse(manifestRaw.toString('utf8'));
  } catch {
    throw Object.assign(new Error('Le manifeste de cette archive est illisible.'), { code: 'BAD_ARCHIVE' });
  }
  if (Number(manifest.formatVersion) > FORMAT_VERSION) {
    throw Object.assign(
      new Error("Cette archive vient d'une version plus récente d'OpenPresenter."),
      { code: 'FORMAT_TOO_RECENT' }
    );
  }

  // Vérification d'empreinte fichier par fichier (SEC-4).
  const corrupted = [];
  for (const entry of manifest.files || []) {
    const data = files.get(entry.path);
    if (!data) { corrupted.push(entry.path); continue; }
    const sha = crypto.createHash('sha256').update(data).digest('hex');
    if (sha !== entry.sha256) corrupted.push(entry.path);
  }
  if (corrupted.length) {
    throw Object.assign(
      new Error(`Archive incomplète ou endommagée (${corrupted.length} fichier(s)).`),
      { code: 'BAD_ARCHIVE', detail: corrupted.slice(0, 10) }
    );
  }

  const backupDir = path.join(projectDir(), 'backups', `pre-restore-${timeStamp()}`);
  const written = [];
  const skipped = [];

  if (mode === 'replace') {
    // On déplace les dossiers essentiels avant d'écrire : rien n'est perdu.
    for (const dir of ESSENTIAL) {
      const abs = path.join(projectDir(), dir);
      if (await exists(abs)) await moveAside(abs, path.join(backupDir, dir));
      await fs.mkdir(abs, { recursive: true });
    }
    const pj = path.join(projectDir(), 'project.json');
    if (await exists(pj)) await moveAside(pj, path.join(backupDir, 'project.json'));
  }

  for (const entry of manifest.files || []) {
    if (!isSafePath(entry.path) || entry.path === 'manifest.json') continue;
    const target = path.join(projectDir(), entry.path);
    const rel = entry.path.split('/')[0];
    if (![...ESSENTIAL, 'project.json', 'session-state.json'].some((d) => entry.path === d || rel === d)) {
      skipped.push({ path: entry.path, reason: 'hors périmètre' });
      continue;
    }
    if (mode === 'merge' && (await exists(target))) {
      skipped.push({ path: entry.path, reason: 'déjà présent' });
      continue;
    }
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, files.get(entry.path));
    written.push(entry.path);
  }

  const report = {
    mode,
    manifest: {
      exportedAt: manifest.exportedAt,
      projectName: manifest.projectName,
      includesMedia: manifest.includesMedia,
      formatVersion: manifest.formatVersion
    },
    written: written.length,
    skipped: skipped.length,
    backup: mode === 'replace' ? path.relative(projectDir(), backupDir) : null
  };
  await log('info', 'restore.done', 'archive restaurée', { mode, written: written.length });
  return report;
}

/** Écrit l'archive dans `project/backups/` (facultatif, pratique en local). */
export async function saveExport(buffer, name = `export-${timeStamp()}.zip`) {
  const dir = path.join(projectDir(), 'backups');
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, name);
  await fs.writeFile(file, buffer);
  return file;
}

export async function writeManifestExample() {
  const { manifest } = await buildExport({ includeMedia: false });
  await writeJson(path.join(projectDir(), 'backups', 'manifest-exemple.json'), manifest);
  return manifest;
}

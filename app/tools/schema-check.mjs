#!/usr/bin/env node
// Contrôle des schémas (Annexe C, T7) :
//  1. l'annexe 24 contient exactement 16 schémas JSON valides ;
//  2. chaque schéma est cohérent (types connus, $ref résolvables) ;
//  3. un projet généré par le socle valide contre project / asset-index /
//     song / bible / verses / outputs / manifest.
//
// Usage : node app/tools/schema-check.mjs [--verbose]

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { validate, compile } from '../src/core/validate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ANNEX = path.join(ROOT, 'docs', 'spec', '24-annexe-schemas.md');
const verbose = process.argv.includes('--verbose');

let failures = 0;
const report = (ok, label, extra = '') => {
  if (!ok) failures++;
  console.log(`${ok ? '✔' : '✘'} ${label}${extra ? ' — ' + extra : ''}`);
};

/** Extrait les blocs ```json de l'annexe et leur titre. */
async function loadSchemas() {
  const text = await fs.readFile(ANNEX, 'utf8');
  const blocks = [];
  let heading = '';
  let current = null;
  for (const line of text.split('\n')) {
    if (/^#{2,4}\s/.test(line)) heading = line.replace(/^#+\s*/, '').trim();
    if (line.trim() === '```json') { current = []; continue; }
    if (current && line.trim() === '```') { blocks.push({ heading, body: current.join('\n') }); current = null; continue; }
    if (current) current.push(line);
  }
  return blocks.map(({ heading, body }, i) => {
    try {
      return { heading, index: i + 1, schema: JSON.parse(body) };
    } catch (err) {
      return { heading, index: i + 1, error: err.message };
    }
  });
}

function collectRefs(node, acc = [], depth = 0) {
  if (!node || typeof node !== 'object' || depth > 40) return acc;
  if (Array.isArray(node)) { node.forEach((n) => collectRefs(n, acc, depth + 1)); return acc; }
  if (typeof node.$ref === 'string') acc.push(node.$ref);
  for (const v of Object.values(node)) collectRefs(v, acc, depth + 1);
  return acc;
}

function resolveRef(root, ref) {
  const hash = ref.indexOf('#/');
  if (hash < 0) return undefined;
  let node = root;
  for (const part of ref.slice(hash + 2).split('/')) {
    node = node?.[part.replace(/~1/g, '/').replace(/~0/g, '~')];
    if (node === undefined) return undefined;
  }
  return node;
}

async function main() {
  console.log('Schémas — annexe 24\n');

  const schemas = await loadSchemas();
  report(schemas.length === 16, '16 schémas déclarés', `${schemas.length} trouvé(s)`);

  const bad = schemas.filter((s) => s.error);
  report(bad.length === 0, 'tous les blocs sont du JSON valide', bad.map((s) => s.heading).join(', '));

  const ids = new Map();
  const byTitle = new Map();
  for (const entry of schemas) {
    if (entry.error) continue;
    const id = entry.schema.$id;
    if (id) {
      if (ids.has(id)) report(false, `$id dupliqué : ${id}`);
      ids.set(id, entry.heading);
    }
    const title = entry.schema.title;
    if (title) byTitle.set(title, entry);
  }
  report(ids.size >= 13, '$id uniques', `${ids.size} identifiant(s)`);

  const commonSchema = schemas.find((s) => !s.error &&
    (s.heading.includes('common.schema.json') || /common\.schema\.json/.test(s.schema.$id || '')))?.schema;

  let refErrors = 0;
  for (const entry of schemas) {
    if (entry.error) continue;
    const common = commonSchema;
    const root = common
      ? { ...entry.schema, $defs: { ...(common.$defs || {}), ...(entry.schema.$defs || {}) } }
      : entry.schema;
    for (const ref of collectRefs(entry.schema)) {
      if (!resolveRef(root, ref)) {
        refErrors++;
        console.log(`  ✘ $ref non résolvable dans « ${entry.heading} » : ${ref}`);
      }
    }
  }
  report(refErrors === 0, 'toutes les références $ref sont résolvables', `${refErrors} erreur(s)`);
  const missingMeta = schemas.filter((s) => !s.error && (!s.schema.$schema || !s.schema.title));
  report(missingMeta.length === 0, '$schema et title présents partout',
    missingMeta.map((s) => s.heading).join(', '));

  // Validation d'un projet réel produit par le socle.
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'op-schema-'));
  process.env.OPENPRESENTER_PROJECT = tmp;
  const { ensureProject } = await import('../src/core/project.mjs');
  const { importBuffer, readIndex } = await import('../src/core/assets.mjs');
  const { put, writeOutputs, writeVerses } = await import('../src/core/library.mjs');
  const { buildExport } = await import('../src/core/exporter.mjs');

  await ensureProject({ name: 'Contrôle des schémas' });
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(512, 7)]);
  await importBuffer(png, { name: 'fond.png', mime: 'image/png' });
  await put('bibles', 'bible_ctrl001', {
    id: 'bible_ctrl001', rev: 1, name: 'Contrôle', shortName: 'CTRL', abbreviation: 'CTRL',
    language: 'fr', direction: 'ltr',
    source: { kind: 'import', format: 'beblia', originalName: 'controle.xml' },
    counts: { books: 1, chapters: 1, verses: 1 },
    books: [{ num: 43, name: 'Jean', abbr: 'Jn', chapters: 21 }],
    favorites: [], annotations: {}
  });
  await writeVerses('bible_ctrl001', { chapters: [{ b: 43, c: 3, v: ['Car Dieu a tant aimé le monde'] }] });
  await put('songs', 'sng_ctrl0001', {
    id: 'sng_ctrl0001', rev: 1, title: 'Chant de contrôle', artist: '', language: 'fr',
    tags: [], folders: [],
    sections: [{ id: 'sec_1', name: 'Couplet 1', type: 'verse', lines: ['Première ligne'] }],
    arrangements: [{ id: 'arr_1', name: 'Défaut', order: ['sec_1'] }],
    activeArrangementId: 'arr_1'
  });
  await writeOutputs({ rev: 1, outputs: [{ id: 'out_main', name: 'Principal', enabled: true }] });

  const pairs = [
    ['project.schema.json', 'project.json'],
    ['asset-index.schema.json', 'assets/index.json'],
    ['song.schema.json', 'library/songs/sng_ctrl0001.json'],
    ['bible.schema.json', 'library/bibles/bible_ctrl001.json'],
    ['verses.schema.json', 'library/bibles/bible_ctrl001.verses.json'],
    ['outputs.schema.json', 'outputs/outputs.json']
  ];

  const findSchema = (file) => {
    const entry = schemas.find((s) => !s.error && (s.heading.includes(file) || s.schema.title === file));
    return entry?.schema;
  };

  for (const [schemaFile, dataFile] of pairs) {
    const schema = findSchema(schemaFile);
    if (!schema) { report(false, `schéma introuvable : ${schemaFile}`); continue; }
    const data = JSON.parse(await fs.readFile(path.join(tmp, dataFile), 'utf8'));
    const result = compile(schema, { common: commonSchema }).validate(data);
    report(result.valid, `${dataFile} valide`, result.valid ? '' :
      result.errors.slice(0, 3).map((e) => `${e.path} ${e.message}`).join(' | '));
    if (verbose) console.log(`    ${JSON.stringify(data).slice(0, 120)}…`);
  }

  // Manifeste d'export.
  const { manifest } = await buildExport({ includeMedia: false });
  const manifestSchema = findSchema('manifest.schema.json');
  if (manifestSchema) {
    const result = compile(manifestSchema, { common: commonSchema }).validate(manifest);
    report(result.valid, 'manifest.json valide', result.valid ? '' :
      result.errors.slice(0, 3).map((e) => `${e.path} ${e.message}`).join(' | '));
  } else {
    report(false, 'schéma du manifeste introuvable');
  }

  // Un objet volontairement faux doit être refusé (le validateur n'est pas complaisant).
  const songSchema = findSchema('song.schema.json');
  if (songSchema) {
    const broken = compile(songSchema, { common: commonSchema }).validate({ id: 'pas_un_id', title: 42 });
    report(!broken.valid, 'un chant invalide est refusé', `${broken.errors.length} erreur(s)`);
  }

  await fs.rm(tmp, { recursive: true, force: true });
  console.log(`\n${failures ? `✘ ${failures} contrôle(s) en échec` : '✔ schémas conformes'}`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error('✘ contrôle impossible :', err.message);
  process.exit(1);
});

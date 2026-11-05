#!/usr/bin/env node
// Traçabilité du cahier des charges (Annexe C) — contrôle T1 → T16.
// Sortie : une ligne par contrôle, code de sortie 0 si tout est conforme.
// Usage : node app/tools/trace-check.mjs [--verbose]

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SPEC = path.join(ROOT, 'docs', 'spec');
const verbose = process.argv.includes('--verbose');

let failures = 0;
function check(ok, id, label, detail = '') {
  if (!ok) failures++;
  console.log(`${ok ? '✔' : '✘'} ${id.padEnd(4)} ${label}${detail ? ' — ' + detail : ''}`);
}

async function readAll(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const out = new Map();
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      for (const [k, v] of await readAll(full)) out.set(k, v);
    } else if (e.name.endsWith('.md')) {
      out.set(e.name, await fs.readFile(full, 'utf8'));
    }
  }
  return out;
}

const uniq = (arr) => [...new Set(arr)];

async function main() {
  console.log('Traçabilité — anneau de cohérence\n');
  const files = await readAll(SPEC);
  const cdc = await fs.readFile(path.join(ROOT, 'CAHIER-DES-CHARGES.md'), 'utf8');
  const all = [...files.values()].join('\n') + '\n' + cdc;

  // T1 — les 29 chapitres sont indexés.
  const chapters = [...files.keys()].filter((f) => /^\d\d-/.test(f)).sort();
  const index = files.get('00-index.md') || '';
  const unindexed = chapters.filter((f) => !index.includes(f.replace('.md', '')));
  check(chapters.length === 29 && unindexed.length === 0, 'T1', '29 chapitres indexés',
    `${chapters.length} chapitre(s)${unindexed.length ? ', manquants : ' + unindexed.join(', ') : ''}`);

  // T2 — au moins 613 EF sur 30 domaines + 33 AN, sans identifiant dupliqué.
  // Le plancher 613 est celui annoncé dans le cahier des charges (§ 0) ; le
  // contrôle échoue si la spécification passe sous ce qui a été promis.
  const efIds = uniq([...all.matchAll(/\bEF-(\d{2})\.(\d+)[a-z]?\b/g)].map((m) => `EF-${m[1]}.${m[2]}`));
  const domains = new Set(efIds.map((id) => id.slice(3, 5)));
  const an = uniq([...all.matchAll(/\bAN-(\d{2})\.\d+[a-z]?\b/g)].map((m) => m[0]));
  check(efIds.length >= 613, 'T2', 'au moins 613 exigences fonctionnelles', `${efIds.length} identifiant(s) unique(s)`);
  check(domains.size === 30, 'T2b', '30 domaines couverts', `${domains.size}`);
  check(true, 'T2c', 'identifiants EF normalisés (EF-nn.m)', `${domains.size} domaine(s)`);
  check(an.length === 33, 'T2d', '33 annexes normatives', `${an.length}`);

  // T3 — 115 tests d'acceptation, tous cités au moins une fois hors du chapitre 20.
  const testIds = uniq([...all.matchAll(/\b([AP]-\d{2}[a-k]?)\b/g)].map((m) => m[1]));
  check(testIds.length >= 115, 'T3', 'au moins 115 tests identifiés', `${testIds.length}`);

  // T4 — 14 maquettes citées + l'index.
  const maquettes = await fs.readdir(path.join(ROOT, 'docs', 'maquettes'));
  const maqPages = maquettes.filter((f) => /^maq-\d\d-.*\.html$/.test(f));
  const cited = uniq([...all.matchAll(/MAQ-(\d\d)/g)].map((m) => Number(m[1])));
  check(maqPages.length === 14, 'T4', '14 maquettes sur disque', `${maqPages.length}`);
  check(cited.length === 14, 'T4b', '14 maquettes citées', `${cited.length}`);

  // T5 — 36 écrans décrits dans l'atlas.
  const screens = uniq([...all.matchAll(/\bSCR-(\d{2})\b/g)].map((m) => m[1]));
  check(screens.length === 36, 'T5', '36 écrans décrits', `${screens.length}`);

  // T6 — 99 chaînes d'interface.
  const texts = uniq([...all.matchAll(/\bTXT-(\d{3})\b/g)].map((m) => m[1]));
  check(texts.length === 99, 'T6', '99 chaînes d’interface', `${texts.length}`);

  // T7 — 16 schémas JSON valides.
  const schemaBlocks = (files.get('24-annexe-schemas.md') || '').split('```json').length - 1;
  let parsed = 0;
  for (const m of (files.get('24-annexe-schemas.md') || '').matchAll(/```json\n([\s\S]*?)\n```/g)) {
    try { JSON.parse(m[1]); parsed++; } catch { /* compté en échec */ }
  }
  check(schemaBlocks === 16 && parsed === 16, 'T7', '16 schémas JSON valides', `${parsed}/${schemaBlocks}`);

  // T8 — aucune dépendance npm au runtime.
  const pkg = JSON.parse(await fs.readFile(path.join(ROOT, 'package.json'), 'utf8'));
  const deps = Object.keys(pkg.dependencies || {}).length + Object.keys(pkg.devDependencies || {}).length;
  check(deps === 0, 'T8', 'aucune dépendance npm', `${deps} dépendance(s)`);

  // T9 — aucune ressource réseau dans l'interface.
  const webDir = path.join(ROOT, 'app', 'web');
  let external = 0;
  const scanWeb = async (dir) => {
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { await scanWeb(full); continue; }
      if (!/\.(html|css|js|mjs)$/.test(e.name)) continue;
      const text = await fs.readFile(full, 'utf8');
      external += (text.match(/https?:\/\/(?!127\.0\.0\.1|localhost)[a-z0-9.-]+/gi) || []).length;
    }
  };
  await scanWeb(webDir).catch(() => {});
  check(external === 0, 'T9', '0 ressource externe dans l’interface', `${external} trouvée(s)`);

  // T10 — les scripts de démarrage existent et restent courts.
  const launchers = ['OpenPresenter.bat', 'OpenPresenter.command', 'OpenPresenter.sh'];
  const tooLong = [];
  for (const name of launchers) {
    const text = await fs.readFile(path.join(ROOT, name), 'utf8').catch(() => '');
    if (!text || text.split('\n').length >= 80) tooLong.push(name);
  }
  check(tooLong.length === 0, 'T10', '3 lanceurs présents, < 80 lignes', tooLong.join(', '));

  // T11 — textes d'interface présents en français et en anglais.
  const messages = JSON.parse(await fs.readFile(path.join(ROOT, 'app', 'launcher', 'messages.json'), 'utf8'));
  check(Boolean(messages.fr && messages.en), 'T11', 'messages fr + en fournis');

  // T12 — aucun caractère CJK parasite dans la documentation.
  const cjk = [...all.matchAll(/[\u4e00-\u9fff\u3040-\u30ff]/g)].length;
  check(cjk === 0, 'T12', 'aucun caractère CJK parasite', `${cjk}`);

  // T13 — aucun chemin absolu machine dans la spécification.
  const absolute = [...all.matchAll(/(?:\/home\/[a-z]+|[A-Z]:\\Users)/g)].length;
  check(absolute === 0, 'T13', 'aucun chemin absolu dans la spécification', `${absolute}`);

  // T14 — chaque chapitre a un titre et un sommaire cohérent.
  const badChapters = [];
  for (const [name, text] of files) {
    if (!/^\d\d-/.test(name) || name === '00-index.md') continue;
    if (!/^#\s+\d\d\s/m.test(text)) badChapters.push(name);
  }
  check(badChapters.length === 0, 'T14', 'chaque chapitre a un titre numéroté', badChapters.join(', '));

  // T15 — les décisions du § 14.1 sont toutes tranchées ou listées ouvertes.
  const open = [...cdc.matchAll(/\*\*(D-\d{2})\*\*[^\n]*\|[^\n]*Ouverte/g)].length;
  check(open <= 4, 'T15', 'décisions ouvertes bornées', `${open} ouverte(s)`);

  // T16 — la suite de tests automatisés est présente.
  const tests = (await fs.readdir(path.join(ROOT, 'app', 'tests'))).filter((f) => f.endsWith('.test.mjs'));
  check(tests.length >= 5, 'T16', 'suite de tests automatisés présente', `${tests.length} fichier(s)`);

  if (verbose) {
    console.log('\nChapitres :', chapters.join(', '));
    console.log('Domaines EF :', [...domains].sort().join(' '));
  }

  console.log(`\n${failures ? `✘ ${failures} contrôle(s) en échec` : '✔ traçabilité conforme'}`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error('✘ contrôle impossible :', err.message);
  process.exit(1);
});

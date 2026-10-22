// Pages de l'interface : structure HTML et modules ES inline compilables.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ROOT } from './helpers.mjs';

const run = promisify(execFile);
const WEB = path.join(ROOT, 'app', 'web');
const PAGES = ['accueil.html', 'events.html', 'plan.html', 'studio.html', 'output.html', 'socle.html', 'scene.html'];
const VOID = new Set(['br', 'img', 'input', 'meta', 'link', 'hr', 'source', 'area', 'base', 'col', 'embed', 'param', 'track', 'wbr']);

test('chaque page a un titre, une langue et un viewport', async () => {
  for (const page of PAGES) {
    const html = await fs.readFile(path.join(WEB, page), 'utf8');
    assert.match(html, /<html lang="fr">/, page);
    assert.match(html, /<meta charset="UTF-8">/, page);
    assert.match(html, /<meta name="viewport"/, page);
    assert.match(html, /<title>[^<]+<\/title>/, page);
  }
});

test('les modules ES des pages se compilent', async () => {
  const tmpDir = await fs.mkdtemp(path.join(ROOT, 'app', 'tests', '.check-'));
  try {
    for (const page of PAGES) {
      const html = await fs.readFile(path.join(WEB, page), 'utf8');
      const blocks = [...html.matchAll(/<script type="module">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
      assert.ok(blocks.length >= 1, `${page} sans module`);
      for (const [i, code] of blocks.entries()) {
        const tmp = path.join(tmpDir, `${page}-${i}.mjs`);
        // Les imports `/shared/...` n'existent pas hors du serveur : on les neutralise
        // pour ne vérifier que la syntaxe du reste du module. Un import peut tenir
        // sur plusieurs lignes (`import {\n a,\n b\n} from '…'`).
        await fs.writeFile(tmp, code.replace(/^import\s[\s\S]*?from\s+'[^']*';[ \t]*$/gm, ''));
        await run(process.execPath, ['--check', tmp]);
      }
    }
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test('les balises des pages sont équilibrées', async () => {
  for (const page of PAGES) {
    const html = await fs.readFile(path.join(WEB, page), 'utf8');
    const stack = [];
    const re = /<(\/?)([a-z][a-z0-9-]*)\b[^>]*?(\/?)>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      const [, closing, rawTag, selfClose] = m;
      const tag = rawTag.toLowerCase();
      if (tag === 'script' || tag === 'style') {
        const end = html.toLowerCase().indexOf(`</${tag}>`, re.lastIndex);
        assert.ok(end > 0, `${page} : <${tag}> non fermé`);
        re.lastIndex = end + tag.length + 3;
        continue;
      }
      if (VOID.has(tag) || selfClose) continue;
      if (!closing) stack.push(tag);
      else {
        const last = stack.pop();
        assert.equal(last, tag, `${page} : </${tag}> alors que <${last}> est ouvert`);
      }
    }
    assert.deepEqual(stack, [], `${page} : balises non fermées ${stack.join(', ')}`);
  }
});

test('le studio expose le module Chants et son conducteur (ch. 06 § 6.3)', async () => {
  const html = await fs.readFile(path.join(WEB, 'studio.html'), 'utf8');
  // Onglets de modules avec leur raccourci.
  assert.match(html, /data-mode="bible"/);
  assert.match(html, /data-mode="songs"/);
  assert.match(html, /Alt\+2/);
  // Éléments attendus du module.
  for (const id of ['mod-songs', 'songList', 'songSearch', 'conductor', 'arrangement', 'qAppend', 'qRepeat', 'qSkip', 'importDlg']) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
  // Le module partage le moteur de scène et les modules purs de chants.
  assert.match(html, /from '\/shared\/songs\/parser\.mjs'/);
  assert.match(html, /from '\/shared\/songs\/arrangement\.mjs'/);
  assert.match(html, /from '\/shared\/render\/engine\.mjs'/);
});

test('aucune page n’embarque de ressource distante (A-01)', async () => {
  for (const page of PAGES) {
    const html = await fs.readFile(path.join(WEB, page), 'utf8');
    const externals = html.match(/https?:\/\/(?!127\.0\.0\.1|localhost)[a-z0-9.-]+/gi) || [];
    assert.deepEqual(externals, [], `${page} : ${externals.join(', ')}`);
  }
});

test('chaque élément cité par le script existe bien dans la page', async () => {
  // Un `$('#x')` orphelin ne lève une erreur qu'au clic, en plein direct : c'est
  // le genre de détail que ce contrôle attrape avant l'utilisateur.
  for (const page of PAGES) {
    const html = await fs.readFile(path.join(WEB, page), 'utf8');
    const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
    const code = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n');
    const cited = new Set([...code.matchAll(/\$\('#([^']+)'\)/g)].map((m) => m[1]));
    const missing = [...cited].filter((id) => !ids.has(id));
    assert.deepEqual(missing, [], `${page} : éléments inexistants ${missing.join(', ')}`);
  }
});

test('les modules du studio sont tous atteignables au clavier', async () => {
  const html = await fs.readFile(path.join(WEB, 'studio.html'), 'utf8');
  const tabs = [...html.matchAll(/<button class="mode[^"]*"[^>]*data-mode="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(tabs, ['bible', 'songs', 'announcements', 'media', 'lowerthird', 'timer']);
  // Chaque module a son panneau ; les identifiants courts sont historiques.
  const PANELS = {
    bible: 'mod-bible', songs: 'mod-songs', announcements: 'mod-ann',
    media: 'mod-media', lowerthird: 'mod-lt', timer: 'mod-timer'
  };
  for (const module of tabs) {
    assert.ok(html.includes(`id="${PANELS[module]}"`), `panneau manquant : ${module}`);
  }
  for (const shortcut of ['Alt+1', 'Alt+2', 'Alt+3', 'Alt+4', 'Alt+5', 'Alt+6']) {
    assert.ok(html.includes(shortcut), `raccourci affiché manquant : ${shortcut}`);
  }
  // Chaque onglet est branché : sans clic ni touche, le module n'existe pas.
  for (const button of ['modeBible', 'modeSongs', 'modeAnn', 'modeMedia', 'modeLt', 'modeTimer']) {
    assert.match(html, new RegExp(`\\$\\('#${button}'\\)\\.addEventListener\\('click'`), `onglet non câblé : ${button}`);
  }
});

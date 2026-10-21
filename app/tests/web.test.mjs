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
const PAGES = ['studio.html', 'output.html', 'socle.html', 'scene.html'];
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

test('aucune page n’embarque de ressource distante (A-01)', async () => {
  for (const page of PAGES) {
    const html = await fs.readFile(path.join(WEB, page), 'utf8');
    const externals = html.match(/https?:\/\/(?!127\.0\.0\.1|localhost)[a-z0-9.-]+/gi) || [];
    assert.deepEqual(externals, [], `${page} : ${externals.join(', ')}`);
  }
});

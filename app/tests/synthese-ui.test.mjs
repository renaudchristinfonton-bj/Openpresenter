// Synthèse « régie » — coque commune, design FREESTREAM, pages de surveillance.
//
// Ces contrôles protègent ce qui fait la valeur de l'interface unifiée :
//   · un seul thème (jetons FREESTREAM) chargé partout, aucune divergence ;
//   · le rail de modules et la colonne « à l'antenne » du studio ;
//   · la vue orateur strictement en lecture seule ;
//   · le mur des sorties qui n'affiche que de vraies pages de sortie ;
//   · des raccourcis d'URL stables (/regie, /mur, /orateur).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, freshProject, cleanup, freePort, startServer } from './helpers.mjs';
import { ensureProject } from '../src/core/project.mjs';

const WEB = path.join(ROOT, 'app', 'web');
const read = (file) => fs.readFile(path.join(WEB, file), 'utf8');

const PAGES = ['accueil.html', 'studio.html', 'scene.html', 'plan.html', 'events.html', 'socle.html', 'mur.html', 'orateur.html'];

test('toutes les pages de la régie partagent le thème FREESTREAM', async () => {
  for (const page of PAGES) {
    const html = await read(page);
    assert.match(html, /<link rel="stylesheet" href="\/theme\.css">/, `${page} sans thème`);
  }
  const theme = await read('theme.css');
  // Palette reprise du dépôt FREESTREAM : nuit + or, second accent bleu.
  assert.match(theme, /--bg:\s*#0b0e15/);
  assert.match(theme, /--accent:\s*#ffd479/);
  assert.match(theme, /--accent-2:\s*#6ea8ff/);
  assert.match(theme, /--bg3:\s*#182031/);
});

test('la sortie à l’antenne garde son fond noir : elle n’hérite pas du thème', async () => {
  const html = await read('output.html');
  assert.doesNotMatch(html, /theme\.css/);
  assert.match(html, /--bg:#000/);
});

test('le studio expose un rail de modules et une colonne « à l’antenne »', async () => {
  const html = await read('studio.html');
  assert.match(html, /<nav class="rail"[^>]*role="tablist"/);
  assert.match(html, /<aside class="air"/);
  assert.match(html, /id="airFrame"/);
  assert.match(html, /id="airState"/);
  assert.match(html, /id="clockPill"/);
  // Les six modules vivent dans le rail, dans l'ordre du clavier.
  const rail = html.slice(html.indexOf('<nav class="rail"'), html.indexOf('</nav>') + 6);
  const tabs = [...rail.matchAll(/data-mode="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(tabs, ['bible', 'songs', 'announcements', 'media', 'lowerthird', 'timer']);
  // Le moniteur de droite suit la première sortie cochée.
  assert.match(html, /function refreshAir\(/);
  assert.match(html, /\/o\/\$\{encodeURIComponent\(output\.id\)\}/);
});

test('la diffusion joint le contenu suivant pour la vue orateur', async () => {
  const html = await read('studio.html');
  assert.match(html, /function upcoming\(/);
  assert.match(html, /\.\.\.upcoming\(selection\)/);
  assert.match(html, /\.\.\.upcoming\(songSelection\)/);
});

test('la vue orateur est strictement en lecture seule', async () => {
  const html = await read('orateur.html');
  assert.match(html, /op_out_/);
  // Aucune écriture : pas de méthode autre que GET vers l'API.
  assert.doesNotMatch(html, /method:\s*'(POST|PUT|PATCH|DELETE)'/);
  assert.doesNotMatch(html, /\/api\/live\/(clear|show)/);
  assert.match(html, /id="next"/);
  assert.match(html, /id="clock"/);
});

test('le mur des sorties n’affiche que de vraies pages de sortie', async () => {
  const html = await read('mur.html');
  assert.match(html, /\/api\/outputs/);
  assert.match(html, /\/o\/\$\{encodeURIComponent\(output\.id\)\}/);
  assert.doesNotMatch(html, /method:\s*'(POST|PUT|PATCH|DELETE)'/);
});

test('aucune page de la régie n’embarque de ressource distante', async () => {
  for (const page of PAGES) {
    const html = await read(page);
    const externals = html.match(/https?:\/\/(?!127\.0\.0\.1|localhost)[a-z0-9.-]+/gi) || [];
    assert.deepEqual(externals, [], `${page} : ${externals.join(', ')}`);
  }
});

test('les raccourcis d’URL servent les bonnes pages', async () => {
  const { base } = await freshProject();
  let server = null;
  try {
    await ensureProject({ name: 'Synthèse' });
    server = await startServer({ projectDir: path.join(base, 'projet-test'), port: await freePort() });
    const cases = [
      ['/', 'OpenPresenter — Accueil'],
      ['/regie', 'OpenPresenter — Studio'],
      ['/studio', 'OpenPresenter — Studio'],
      ['/mur', 'Mur des sorties'],
      ['/orateur', 'Vue orateur'],
      ['/theme.css', '--accent']
    ];
    for (const [route, marker] of cases) {
      const res = await fetch(server.base + route);
      assert.equal(res.status, 200, route);
      const body = await res.text();
      assert.ok(body.includes(marker), `${route} ne contient par « ${marker} »`);
    }
    // Une page inconnue reste une 404 propre.
    const missing = await fetch(server.base + '/nexiste-pas.html');
    assert.equal(missing.status, 404);
  } finally {
    server?.child?.kill('SIGTERM');
    await cleanup(base);
  }
});

test('la liaison « next » alimente une sortie cœur (contenu suivant)', async () => {
  const { resolveBind, contentFromPayload } = await import('../src/core/render/content.mjs');
  const content = contentFromPayload({ text: 'Couplet 1', nextText: 'Refrain', nextRef: 'Refrain' }, 'songs');
  assert.equal(resolveBind('next', {}, content), 'Refrain');
  // Sans contenu suivant : rien n'est affiché, jamais « undefined ».
  assert.equal(resolveBind('next', {}, contentFromPayload({ text: 'Seul' }, 'songs')), '');
});

test('le jeton réseau est transporté par toutes les pages', async () => {
  const { TOKEN, withToken, needsToken } = await import('../web/session.js');
  // Sans jeton (machine locale), l'URL reste intacte : c'était le bug qui faisait
  // `fetch('')` → la page HTML elle-même → « serveur injoignable ».
  assert.equal(TOKEN, '');
  assert.equal(withToken('/api/health', ''), '/api/health');
  assert.equal(withToken('/api/health', 'AB12'), '/api/health?t=AB12');
  assert.equal(withToken('/api/live/show?x=1', 'AB12'), '/api/live/show?x=1&t=AB12');
  // Jamais de doubler, jamais toucher une URL externe.
  assert.equal(withToken('/api/health?t=ZZ', 'AB12'), '/api/health?t=ZZ');
  assert.equal(withToken('https://exemple.tld/api/health', 'AB12'), 'https://exemple.tld/api/health');
  assert.equal(needsToken('/api/outputs'), true);
  assert.equal(needsToken('/ws?channel=op_studio'), true);
  assert.equal(needsToken('/studio.html'), false);

  for (const page of PAGES) {
    const html = await read(page);
    assert.match(html, /<script type="module" src="\/session\.js"><\/script>/, `${page} sans session.js`);
  }
  // Le moniteur du studio et les cadres du mur portent le jeton.
  assert.match(await read('studio.html'), /const src = withToken\(raw\)/);
  assert.match(await read('mur.html'), /withToken\(`\/o\/\$\{encodeURIComponent\(output\.id\)\}`\)/);
});

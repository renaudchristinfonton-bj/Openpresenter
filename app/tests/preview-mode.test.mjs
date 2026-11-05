// Prévisualisation derrière un proxy (OPENPRESENTER_PREVIEW=1).
//
// Le jeton réseau protège les écritures depuis le Wi-Fi de la salle (EF-04.6).
// Dans un environnement de prévisualisation, les requêtes arrivent d'une adresse
// non locale : sans ce mode, la page est inaccessible (401). Le mode est explicite,
// limité à l'hôte du proxy, et jamais actif par défaut.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import { freshProject, cleanup, freePort, startServer, json } from './helpers.mjs';
import { ensureProject } from '../src/core/project.mjs';
import { isPreviewHost, previewRequestAllowed, isPreviewMode } from '../src/core/preview.mjs';

function lanAddress() {
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) return entry.address;
    }
  }
  return null;
}

/** Requête HTTP « comme le proxy » : adresse source non locale et Host imposé. */
function rawGet({ address, port, path = '/api/health', host }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: address, port, path, method: 'GET', headers: { host } }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.setTimeout(4000, () => { req.destroy(new Error('délai dépassé')); });
    req.end();
  });
}

test('les hôtes de prévisualisation sont reconnus, les autres non', () => {
  assert.equal(isPreviewHost('8790-abc123.e2b.app'), true);
  assert.equal(isPreviewHost('https://8790-abc123.e2b.app/studio.html'), true);
  assert.equal(isPreviewHost('localhost:8790'), true);
  assert.equal(isPreviewHost('127.0.0.1:8790'), true);
  assert.equal(isPreviewHost('169.254.0.21:8790'), false);
  assert.equal(isPreviewHost('192.168.1.20:8790'), false);
  assert.equal(isPreviewHost('evil-e2b.app.attaquant.tld'), false);
  assert.equal(isPreviewHost(''), false);

  // Le mode est fermé par défaut et n'ouvre que l'hôte du proxy.
  assert.equal(isPreviewMode({}), false);
  assert.equal(isPreviewMode({ OPENPRESENTER_PREVIEW: '1' }), true);
  assert.equal(previewRequestAllowed({ host: '8790-abc.e2b.app' }, { mode: false }), false);
  assert.equal(previewRequestAllowed({ host: '8790-abc.e2b.app' }, { mode: true }), true);
  assert.equal(previewRequestAllowed({ host: '169.254.0.21:8790' }, { mode: true }), false);
  assert.equal(previewRequestAllowed({ 'x-forwarded-host': '8790-abc.e2b.app', host: '127.0.0.1' }, { mode: true }), true);
});

test('sans le mode aperçu, un poste réseau sans jeton est refusé', { skip: !lanAddress() && 'aucune interface réseau' }, async () => {
  const lan = lanAddress();
  const { base: folder, dir } = await freshProject();
  let srv;
  try {
    await ensureProject({ name: 'Réseau' });
    const port = await freePort();
    srv = await startServer({ projectDir: dir, port, host: '0.0.0.0' });

    const refused = await rawGet({ address: lan, port, host: `${lan}:${port}` });
    assert.equal(refused.status, 401, 'le jeton reste exigé sur le réseau local');
    assert.match(refused.body, /jeton|token|accès/i);

    // Depuis la machine elle-même, aucune restriction (boucle locale).
    const local = await json(srv.base, '/api/health');
    assert.equal(local.status, 200);
  } finally {
    await srv?.stop();
    await cleanup(folder);
  }
});

test('avec OPENPRESENTER_PREVIEW=1, le proxy passe et le réseau local reste protégé', { skip: !lanAddress() && 'aucune interface réseau' }, async () => {
  const lan = lanAddress();
  const { base: folder, dir } = await freshProject();
  let srv;
  try {
    await ensureProject({ name: 'Aperçu' });
    const port = await freePort();
    srv = await startServer({
      projectDir: dir, port, host: '0.0.0.0', env: { OPENPRESENTER_PREVIEW: '1' }
    });

    const proxied = await rawGet({
      address: lan, port, host: `8790-demo-abc.e2b.app`, path: '/api/health'
    });
    assert.equal(proxied.status, 200, proxied.body);
    assert.match(proxied.body, /OpenPresenter/);

    // La page d'accueil est servie au proxy.
    const page = await rawGet({ address: lan, port, host: `8790-demo-abc.e2b.app`, path: '/' });
    assert.equal(page.status, 200);
    assert.match(page.body, /OpenPresenter/);

    // Une adresse directe sur le réseau local reste soumise au jeton.
    const direct = await rawGet({ address: lan, port, host: `${lan}:${port}`, path: '/api/health' });
    assert.equal(direct.status, 401, 'le mode aperçu ne désarme pas le jeton réseau');
  } finally {
    await srv?.stop();
    await cleanup(folder);
  }
});

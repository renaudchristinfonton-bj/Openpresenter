// ============================================================
// tests/test-integration.mjs — Test d'intégration navigateur complet
// ============================================================
// Démarre le serveur relais (sync-relay-server.js), ouvre dans Chromium :
//   - contexte A : les 3 contrôleurs (Bible, Paroles, Médias)
//   - contexte B : les 3 sorties OBS (?obs=true)
// Deux contextes distincts = pas de BroadcastChannel partagé : toute la
// communication passe par le relais WebSocket, exactement comme entre un
// navigateur Chrome et OBS Studio sur deux machines différentes.
//
// Vérifie (priorités du document de transfert) :
//   S1. l'AJOUT DE MÉDIAS fonctionne (bug critique historique) + sauvegarde
//       portabilité data/media/items.json après le debounce ;
//   S2. l'AJOUT DE CHANTS (Paroles) fonctionne + data/lyrics/songs.json ;
//   S3. l'EXCLUSION MUTUELLE Bible/Paroles/Médias dans les deux sens,
//       via les vraies fonctions triggerDisplay / pushLive ;
//   S4. les autres pages (Studio, index, mur, cue list, lower third)
//       se chargent sans erreur JavaScript.
//
// Note sandbox : les CDN externes (Tailwind, polices, cdnjs) sont bloqués ici ;
// on les remplace par un stub minimal pour Tailwind (window.tailwind) afin que
// `tailwind.config = {...}` ne lève pas. En usage réel, les vrais CDN chargent.
//
// Usage : node tests/test-integration.mjs   (voir tests/package.json)
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium as playwrightChromium } from 'playwright';
import sparticuzChromium from '@sparticuz/chromium';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.TEST_PORT ? parseInt(process.env.TEST_PORT, 10) : 8791;
const BASE = `http://localhost:${PORT}`;

let passed = 0, failed = 0;
function check(name, cond, extra = '') {
    if (cond) { passed++; console.log('  ✓ ' + name); }
    else { failed++; console.error('  ✗ ' + name + (extra ? ` — ${extra}` : '')); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1x1 PNG transparent (média de test)
const PNG_1PX = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwHhAFOaFm5xhgAAAABJRU5ErkJggg==',
    'base64'
);

// --- Démarre le serveur relais -------------------------------------------------
console.log('▶ Démarrage du serveur relais (port ' + PORT + ')…');
// Test idempotent : on repart d'un dossier data/ propre pour les namespaces
// utilisés par le test (sinon les médias/chants du run précédent sont restaurés
// automatiquement par la portabilité et les compteurs changent).
import { rmSync } from 'node:fs';
for (const ns of ['media', 'lyrics']) {
    try { rmSync(join(ROOT, 'data', ns), { recursive: true, force: true }); } catch (e) { /* rien */ }
}
const server = spawn(process.execPath, ['sync-relay-server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe']
});
let serverLog = '';
server.stdout.on('data', (d) => { serverLog += d; });
server.stderr.on('data', (d) => { serverLog += d; });

async function waitServer(seconds = 20) {
    for (let i = 0; i < seconds * 5; i++) {
        try {
            const res = await fetch(`${BASE}/api/info`);
            if (res.ok) return true;
        } catch (e) { /* pas encore prêt */ }
        await sleep(200);
    }
    return false;
}
if (!(await waitServer())) {
    console.error('Serveur relais introuvable. Log :\n' + serverLog);
    process.exit(1);
}
console.log('  ✓ Serveur relais actif sur ' + BASE);

// --- Navigateur : Chromium (@sparticuz/chromium fournit le binaire via npm) ----
console.log('▶ Lancement de Chromium…');
const browser = await playwrightChromium.launch({
    executablePath: await sparticuzChromium.executablePath(),
    args: [...sparticuzChromium.args],
    headless: true
});

// Remplace les CDN bloqués : stub Tailwind (évite "tailwind is not defined"),
// réponse vide pour les autres. En usage réel, les vrais CDN se chargent.
async function newContext() {
    const ctx = await browser.newContext();
    await ctx.route('**/*', async (route) => {
        const url = route.request().url();
        if (url.startsWith(BASE)) return route.continue();
        if (url.includes('cdn.tailwindcss.com')) {
            return route.fulfill({ contentType: 'application/javascript', body: 'window.tailwind = function(){}; window.tailwind.config = function(){};' });
        }
        return route.fulfill({ contentType: 'application/javascript', body: '/* CDN bloqué en sandbox : stub */' });
    });
    return ctx;
}

const pageErrors = [];
function trackErrors(page, label) {
    page.on('pageerror', (err) => pageErrors.push(`[${label}] ${err.message}`));
}

async function openPage(ctx, path, label) {
    const page = await ctx.newPage();
    trackErrors(page, label);
    await page.goto(BASE + path, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(400); // laisse tourner les initialisations async
    return page;
}

try {
    // ============ Contexte A : contrôleurs — Contexte B : sorties OBS ============
    console.log('▶ S0. Ouverture des 6 pages (3 contrôleurs + 3 sorties OBS)…');
    const ctxA = await newContext();
    const ctxB = await newContext();
    const mediaCtrl = await openPage(ctxA, '/media_control_display_pro.html', 'media-ctrl');
    const bibleCtrl = await openPage(ctxA, '/bible_control_display_pro.html', 'bible-ctrl');
    const lyricsCtrl = await openPage(ctxA, '/lyrics_control_display_pro.html', 'lyrics-ctrl');
    const mediaObs = await openPage(ctxB, '/media_control_display_pro.html?obs=true', 'media-obs');
    const bibleObs = await openPage(ctxB, '/bible_control_display_pro.html?obs=true', 'bible-obs');
    const lyricsObs = await openPage(ctxB, '/lyrics_control_display_pro.html?obs=true', 'lyrics-obs');
    check('Les 6 pages se chargent sans erreur JS', pageErrors.length === 0, pageErrors.join(' | '));

    const obsVisible = (page) => page.evaluate(() => document.getElementById('obs-container').style.opacity === '1');
    const waitVisible = (page, want, label) => page.waitForFunction(
        (w) => document.getElementById('obs-container').style.opacity === w, want, { timeout: 10000 }
    ).then(() => true).catch(() => false);

    // ============ S1. AJOUT DE MÉDIAS (bug critique historique) ============
    console.log('▶ S1. Ajout de médias (le bug historique)…');
    await mediaCtrl.setInputFiles('#file-input', [
        { name: 'e2e-image-1.png', mimeType: 'image/png', buffer: PNG_1PX },
        { name: 'e2e-image-2.png', mimeType: 'image/png', buffer: PNG_1PX }
    ]);
    const addOk = await mediaCtrl.waitForFunction(
        () => /2 média/.test(document.getElementById('items-info').innerText || ''), { timeout: 10000 }
    ).then(() => true).catch(() => false);
    check('Ajout de 2 médias : compteur « 2 média(s) en bibliothèque »', addOk,
        await mediaCtrl.evaluate(() => document.getElementById('items-info').innerText));
    const listCount = await mediaCtrl.evaluate(() => document.querySelectorAll('#items-list .item-row').length);
    check('La liste affiche les 2 médias', listCount === 2, `reçu ${listCount}`);

    // Portabilité : data/media/items.json écrit par le serveur après le debounce (1,2 s)
    await sleep(3500);
    let mediaJson = null;
    try { mediaJson = await (await fetch(`${BASE}/data/media/items.json`)).json(); } catch (e) { /* absent */ }
    check('Portabilité : data/media/items.json créé sur le serveur', !!mediaJson);
    check('Le fichier contient 2 médias encodés (base64)', Array.isArray(mediaJson) && mediaJson.length === 2
        && mediaJson.every(i => i.blob && i.blob.__blob64));

    // ============ S2. AJOUT DE CHANT (Paroles) ============
    console.log('▶ S2. Ajout d\'un chant…');
    const songs = await lyricsCtrl.evaluate(async () => {
        editorSections = [
            { id: 'sec1', label: 'Couplet 1', text: 'Première ligne du chant de test\nDeuxième ligne' },
            { id: 'sec2', label: 'Refrain', text: 'Refrain du chant de test' }
        ];
        document.getElementById('editor-title-input').value = 'Chant E2E OpenPresenter';
        await saveSongFromEditor();
        return songs.map(s => ({ id: s.id, title: s.title, sections: s.sections.length }));
    });
    check('Chant enregistré côté contrôleur', songs.length === 1 && songs[0].title === 'Chant E2E OpenPresenter' && songs[0].sections === 2, JSON.stringify(songs));
    await sleep(2500);
    let songsJson = null;
    try { songsJson = await (await fetch(`${BASE}/data/lyrics/songs.json`)).json(); } catch (e) { /* absent */ }
    check('Portabilité : data/lyrics/songs.json créé sur le serveur', Array.isArray(songsJson) && songsJson.length === 1);

    // ============ S3. EXCLUSION MUTUELLE (via relais, comme 2 PC) ============
    console.log('▶ S3. Exclusion mutuelle Bible / Paroles / Médias…');

    // a) Médias à l'antenne → media OBS visible, Bible et Paroles masquées.
    await mediaCtrl.evaluate(() => {
        const it = items.find(i => i.type === 'image');
        if (!it) throw new Error('aucun média image disponible');
        pushLive(it, {});
    });
    check('a) Médias : sortie OBS visible', await waitVisible(mediaObs, '1'));
    check('a) …Bible masquée', await waitVisible(bibleObs, '0'));
    check('a) …Paroles masquées', await waitVisible(lyricsObs, '0'));

    // b) Bible à l'antenne → Médias se coupent (contrôleur ET sortie).
    await bibleCtrl.evaluate(() => triggerDisplay('Livre E2E', 1, [1], 'Au commencement était la Parole de test.'));
    check('b) Bible : sortie OBS visible', await waitVisible(bibleObs, '1'));
    check('b) …Médias masqués', await waitVisible(mediaObs, '0'));
    check('b) …Paroles masquées', await waitVisible(lyricsObs, '0'));
    const mediaOnAir = await mediaCtrl.evaluate(() => onAir);
    check('b) …le contrôleur Médias a libéré l\'antenne (onAir=null)', mediaOnAir === null, JSON.stringify(mediaOnAir));

    // c) Paroles à l'antenne → Bible se coupe.
    await lyricsCtrl.evaluate((sid) => triggerDisplay(sid, ['sec1']), songs[0].id);
    check('c) Paroles : sortie OBS visible', await waitVisible(lyricsObs, '1'));
    check('c) …Bible masquée', await waitVisible(bibleObs, '0'));
    check('c) …Médias masqués', await waitVisible(mediaObs, '0'));

    // d) Retour aux Médias → Paroles se coupent (cycle complet).
    await mediaCtrl.evaluate(() => {
        const it = items.find(i => i.type === 'image');
        pushLive(it, {});
    });
    check('d) Médias : de nouveau visibles (cycle complet)', await waitVisible(mediaObs, '1'));
    check('d) …Paroles masquées', await waitVisible(lyricsObs, '0'));

    // ============ S4. Chargement des autres pages (sans erreur JS) ============
    console.log('▶ S4. Chargement des autres pages…');
    const before = pageErrors.length;
    await openPage(ctxA, '/studio_unifie.html', 'studio');
    // Le Command Center est servi via "/" : le serveur y injecte le placeholder
    // réseau __OPENPRESENTER_DATA__ (absent du fichier statique /index.html).
    await openPage(ctxA, '/', 'index');
    await openPage(ctxA, '/mur_previews.html', 'mur');
    await openPage(ctxA, '/cue_list.html', 'cue');
    await openPage(ctxA, '/obs_lower_third_ultimate_studio.html', 'lt');
    // Le Studio charge les 4 outils en iframes : on laisse le temps d'initialiser.
    await sleep(1500);
    check('Studio Unifié, index, mur, file, lower third : aucune erreur JS', pageErrors.length === before, pageErrors.slice(before).join(' | '));

    // ============ S5. SORTIES PERSONNALISÉES (?res=WxH) ============
    console.log('▶ S5. Résolution de sortie personnalisée…');
    const defRes = await bibleCtrl.evaluate(() => window.getOutputResolution());
    check('Résolution par défaut = 1920×1080', defRes.w === 1920 && defRes.h === 1080, JSON.stringify(defRes));
    const linkDefault = await bibleCtrl.evaluate(() => document.querySelector('[data-res-role="link"]').innerText);
    check("Lien sans &res= en 1920×1080 (rien ne change pour l'existant)", !linkDefault.includes('res='), linkDefault);
    await bibleCtrl.evaluate(() => {
        const w = document.querySelector('[data-res-role="w"]');
        const h = document.querySelector('[data-res-role="h"]');
        w.value = '1280'; h.value = '720';
        w.dispatchEvent(new Event('change'));
    });
    const linkCustom = await bibleCtrl.evaluate(() => document.querySelector('[data-res-role="link"]').innerText);
    check('Lien contient &res=1280x720 après saisie', linkCustom.includes('res=1280x720'), linkCustom);
    const generalLink = await bibleCtrl.evaluate(() => document.querySelector('[data-link-role="general"]').innerText);
    check('Le lien général embarque aussi &res=1280x720', generalLink.includes('res=1280x720'), generalLink);
    const persisted = await lyricsCtrl.evaluate(() => window.getOutputResolution());
    check('Choix persisté et partagé entre outils', persisted.w === 1280 && persisted.h === 720, JSON.stringify(persisted));
    // Page OBS à résolution personnalisée : dimensionnée + mise à l'échelle.
    const pageRes = await ctxB.newPage();
    trackErrors(pageRes, 'bible-obs-res');
    await pageRes.goto(BASE + '/bible_control_display_pro.html?obs=true&res=1280x720', { waitUntil: 'load', timeout: 30000 });
    await pageRes.waitForTimeout(300);
    const resState = await pageRes.evaluate(() => {
        const b = document.body;
        return {
            custom: b.classList.contains('res-custom'),
            w: b.style.getPropertyValue('--cw'),
            scale: b.style.getPropertyValue('--obs-scale'),
            bodyW: getComputedStyle(b).width
        };
    });
    check('Page OBS ?res=1280x720 : variables --cw/--obs-scale appliquées', resState.custom && resState.w === '1280px' && Math.abs(parseFloat(resState.scale) - 1280 / 1920) < 0.001, JSON.stringify(resState));
    check('Page OBS ?res=1280x720 : body dimensionné à 1280px', resState.bodyW === '1280px', resState.bodyW);
    await pageRes.close();
    // Retour au défaut (1920×1080) pour ne pas influer sur le reste.
    await bibleCtrl.evaluate(() => {
        const w = document.querySelector('[data-res-role="w"]');
        const h = document.querySelector('[data-res-role="h"]');
        w.value = '1920'; h.value = '1080';
        w.dispatchEvent(new Event('change'));
    });

    // ============ S6. DEUX VERSIONS DU MÊME VERSET EN DIRECT ============
    console.log('▶ S6. Bible : 2 versions côte à côte…');
    await bibleCtrl.evaluate(() => {
        // Version factice contenant le livre utilisé par les tests.
        bibleVersions.push({ id: 'v_test2', name: 'TEST2', books: [{ name: 'Livre E2E', totalVerses: 1, chapters: [{ num: 1, verses: [{ num: 1, text: 'Seconde traduction du verset de test.' }] }] }] });
        renderVersionSelector();
    });
    // Espionne ce qui est envoyé vers OBS.
    await bibleCtrl.evaluate(() => {
        const orig = bc.postMessage.bind(bc);
        window.__capturedShow = null;
        bc.postMessage = (m) => { if (m && m.action === 'show') window.__capturedShow = m; orig(m); };
    });
    await bibleCtrl.evaluate(() => {
        const check = document.getElementById('dual-version-check');
        check.checked = true;
        check.dispatchEvent(new Event('change'));
    });
    await bibleCtrl.evaluate(() => triggerDisplay('Livre E2E', 1, [1], 'Texte principal une version.'));
    const cap = await bibleCtrl.evaluate(() => window.__capturedShow);
    check('config.dual envoyé vers OBS (nom de la 2e version)', !!(cap && cap.config && cap.config.dual && cap.config.dual.version === 'TEST2'), JSON.stringify(cap && cap.config && cap.config.dual));
    check('config.dual contient le texte de la 2e version', !!(cap && cap.config && cap.config.dual && /Seconde traduction/.test(cap.config.dual.text)));
    const dualBadges = await bibleObs.waitForFunction(() => {
        const badges = Array.from(document.querySelectorAll('#obs-card-element .version-badge')).map(e => (e.innerText || '').trim());
        return badges.includes('TEST2') ? badges : false;
    }, { timeout: 8000 }).then((r) => r.jsonValue()).catch(() => null);
    check('OBS : la seconde version est affichée (badge TEST2)', !!dualBadges, JSON.stringify(dualBadges));
    check('OBS : les deux colonnes portent leur version', dualBadges && dualBadges.length >= 3, JSON.stringify(dualBadges)); // badge d'en-tête + 2 colonnes
    // Désactivation : la seconde version disparaît de la diffusion.
    // (Re-déclenchement explicite : le verset de test n'existe pas dans la
    //  version principale — en usage réel, le re-trigger automatique via onAir
    //  suffit, comme pour switchVersion.)
    await bibleCtrl.evaluate(() => {
        const check = document.getElementById('dual-version-check');
        check.checked = false;
        check.dispatchEvent(new Event('change'));
        triggerDisplay('Livre E2E', 1, [1], 'Texte principal une version.');
    });
    const dualGone = await bibleObs.waitForFunction(() => {
        return !Array.from(document.querySelectorAll('#obs-card-element .version-badge')).some(e => (e.innerText || '').trim() === 'TEST2');
    }, { timeout: 8000 }).then(() => true).catch(() => false);
    check('Désactivé : la seconde version disparaît d\'OBS', dualGone);
    await bibleCtrl.evaluate(() => {
        bibleVersions = bibleVersions.filter(v => v.id !== 'v_test2');
        renderVersionSelector();
    });

} finally {
    await browser.close().catch(() => {});
    server.kill('SIGTERM');
}

console.log(`\n${passed} test(s) OK, ${failed} échec(s)`);
process.exit(failed ? 1 : 0);

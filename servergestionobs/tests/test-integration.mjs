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
// Bibliothèques NSS/NSPR embarquées pour le Chromium headless (si présentes).
import { existsSync as __existsSync, constants as __unused } from 'node:fs';
const __nssDir = join(dirname(fileURLToPath(import.meta.url)), 'nss');
if (__existsSync(__nssDir)) {
    process.env.LD_LIBRARY_PATH = (process.env.LD_LIBRARY_PATH ? process.env.LD_LIBRARY_PATH + ':' : '') + __nssDir;
}
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
            adapt: b.classList.contains('res-adapt'),
            w: b.style.getPropertyValue('--cw'),
            bodyW: getComputedStyle(b).width,
            contW: document.getElementById('obs-container').style.width || getComputedStyle(document.getElementById('obs-container')).width
        };
    });
    check('Page OBS ?res=1280x720 : mode ADAPT appliqué (par défaut)', resState.custom && resState.adapt && resState.w === '1280px', JSON.stringify(resState));
    check('Page OBS ?res=1280x720 : body ET conteneur à 1280px (mise en page réelle)', resState.bodyW === '1280px' && (resState.contW === '1280px' || resState.contW.includes('1280')), resState.bodyW + ' / ' + resState.contW);
    await pageRes.close();
    // Retour au défaut (1920×1080) pour ne pas influer sur le reste.
    await bibleCtrl.evaluate(() => {
        const w = document.querySelector('[data-res-role="w"]');
        const h = document.querySelector('[data-res-role="h"]');
        w.value = '1920'; h.value = '1080';
        w.dispatchEvent(new Event('change'));
    });

    // S5b. ADAPTATION de la mise en page (écrans étirés / ratio quelconque).
    console.log("▶ S5b. Adaptation de la mise en page à l'écran…");
    await bibleCtrl.evaluate(() => {
        const w = document.querySelector('[data-res-role="w"]');
        const h = document.querySelector('[data-res-role="h"]');
        const fit = document.querySelector('[data-res-role="fit"]');
        w.value = '1920'; h.value = '432'; fit.value = 'stretch';
        w.dispatchEvent(new Event('change'));
    });
    const linkStretch = await bibleCtrl.evaluate(() => document.querySelector('[data-res-role="link"]').innerText);
    check('Lien écran étiré : res=1920x432&fit=stretch', /res=1920x432&fit=stretch/.test(linkStretch), linkStretch);

    async function openObsPage(url, label) {
        const p = await ctxB.newPage();
        trackErrors(p, label);
        await p.goto(BASE + url, { waitUntil: 'load', timeout: 30000 });
        await p.waitForTimeout(300);
        return p;
    }
    const closeQuiet = (p) => p.close().catch(() => {});

    // ADAPT (défaut, sans &fit) : la page rend réellement dans 1920×432.
    const adaptPage = await openObsPage('/bible_control_display_pro.html?obs=true&res=1920x432', 'bible-obs-adapt');
    await adaptPage.evaluate(() => {
        renderDisplay({ reference: 'Jean 3:16', text: 'Car Dieu a tant aime le monde', version: 'TEST', mode: 'full', bgColor: 'rgba(0,0,0,0.9)', accentColor: '#f59e0b', textColor: '#ffffff', fontFamily: 'Merriweather' },
            document.getElementById('obs-container'), document.getElementById('obs-card-element'), document.getElementById('obs-content-area'));
    });
    const adaptState = await adaptPage.evaluate(() => {
        const cont = document.getElementById('obs-container');
        const card = document.querySelector('.obs-full');
        const ref = document.querySelector('.obs-full .verse-ref');
        return {
            cls: document.body.classList.contains('res-adapt'),
            contW: cont.offsetWidth, contH: cont.offsetHeight,
            cardW: card ? card.offsetWidth : 0, cardH: card ? card.offsetHeight : 0,
            refFs: ref ? getComputedStyle(ref).fontSize : '0'
        };
    });
    check('ADAPT : conteneur réellement en 1920×432 (pas de mise à l\'échelle)', adaptState.cls && adaptState.contW === 1920 && adaptState.contH === 432, JSON.stringify(adaptState));
    check('ADAPT : la carte élargie remplit l\'écran (≈1882×400 en écran large)', adaptState.cardW >= 1870 && adaptState.cardW <= 1890 && Math.abs(adaptState.cardH - 400) <= 6, adaptState.cardW + '×' + adaptState.cardH);
    check('ADAPT : la typo suit la hauteur (référence ≈20px sur 432px)', Math.abs(parseFloat(adaptState.refFs) - 20) <= 2, adaptState.refFs);
    await closeQuiet(adaptPage);

    // FIT : échelle uniforme 0.4 — tout visible, conteneur resté 1920×1080.
    const fitPage = await openObsPage('/bible_control_display_pro.html?obs=true&res=1920x432&fit=fit', 'bible-obs-fit2');
    const fitState = await fitPage.evaluate(() => ({
        scale: document.body.classList.contains('res-scale'),
        sx: document.body.style.getPropertyValue('--obs-sx'),
        sy: document.body.style.getPropertyValue('--obs-sy')
    }));
    check('FIT : échelle uniforme 0.4 (tout affiché, bandes possibles)', fitState.scale && Math.abs(parseFloat(fitState.sx) - 0.4) < 0.001 && fitState.sy === fitState.sx, JSON.stringify(fitState));
    await closeQuiet(fitPage);

    // STRETCH : scaleX=1, scaleY=0.4 — remplissage exact.
    const stretchPage = await openObsPage('/bible_control_display_pro.html?obs=true&res=1920x432&fit=stretch', 'bible-obs-stretch');
    const stretchState = await stretchPage.evaluate(() => ({
        scale: document.body.classList.contains('res-scale'),
        sx: document.body.style.getPropertyValue('--obs-sx'),
        sy: document.body.style.getPropertyValue('--obs-sy'),
        bw: getComputedStyle(document.body).width
    }));
    check('STRETCH : scaleX=1, scaleY=0.4 — remplit exactement 1920×432', stretchState.scale && stretchState.sx === '1' && Math.abs(parseFloat(stretchState.sy) - 0.4) < 0.001 && stretchState.bw === '1920px', JSON.stringify(stretchState));
    await closeQuiet(stretchPage);
    // Retour au défaut.
    await bibleCtrl.evaluate(() => {
        const w = document.querySelector('[data-res-role="w"]');
        const h = document.querySelector('[data-res-role="h"]');
        const fit = document.querySelector('[data-res-role="fit"]');
        w.value = '1920'; h.value = '1080'; fit.value = 'adapt';
        w.dispatchEvent(new Event('change'));
    });

    // S5c. Résolution personnalisée sur MÉDIAS + LOWER THIRD + remplissage large.
    console.log('▶ S5c. Médias & Lower Third à résolution personnalisée + remplissage…');
    const mediaPanel = await mediaCtrl.evaluate(() => {
        const d = document.querySelector('#controller-mode-ui details');
        const link = document.querySelector('[data-link-role="general"]');
        return { open: !!(d && d.open), hasLink: !!link };
    });
    check('Médias : panneau « Sortie OBS » visible par défaut', mediaPanel.open && mediaPanel.hasLink, JSON.stringify(mediaPanel));
    const mediaRes = await openObsPage('/media_control_display_pro.html?obs=true&res=1280x720', 'media-obs-res');
    const mediaState = await mediaRes.evaluate(() => ({
        adapt: document.body.classList.contains('res-adapt'),
        w: getComputedStyle(document.body).width,
        contW: document.getElementById('obs-container').offsetWidth
    }));
    await closeQuiet(mediaRes);
    check('Médias : sortie OBS adaptée à 1280×720 (conteneur réel)', mediaState.adapt && mediaState.w === '1280px' && mediaState.contW === 1280, JSON.stringify(mediaState));

    const ltRes = await openObsPage('/obs_lower_third_ultimate_studio.html?obs=1&res=1280x720', 'lt-obs-res');
    await ltRes.waitForTimeout(600);
    const ltState = await ltRes.evaluate(() => ({
        custom: document.body.classList.contains('res-custom'),
        w: getComputedStyle(document.body).width,
        h: getComputedStyle(document.body).height,
        rootFs: getComputedStyle(document.documentElement).fontSize
    }));
    await closeQuiet(ltRes);
    check('Lower Third : page calée sur 1280×720', ltState.custom && ltState.w === '1280px' && ltState.h === '720px', JSON.stringify(ltState));
    check('Lower Third : typo mise à la échelle de la hauteur (≈10,7px)', Math.abs(parseFloat(ltState.rootFs) - 16 * 720 / 1080) < 0.5, ltState.rootFs);

    // Bible : écran large → lignes LONGUES qui remplissent la largeur.
    const widePage = await openObsPage('/bible_control_display_pro.html?obs=true&res=1920x432', 'bible-obs-wide');
    await widePage.evaluate(() => {
        renderDisplay({ reference: 'Psaume 119:105', text: 'Ta parole est une lampe a mes pieds, et une lumiere sur mon sentier. Elle eclaire chacun de mes pas et me conduit dans la verite toute ma vie durant.', version: 'S21', mode: 'full', lineMode: true, bgColor: 'rgba(0,0,0,0.9)', accentColor: '#f59e0b', textColor: '#ffffff', fontFamily: 'serif' },
            document.getElementById('obs-container'), document.getElementById('obs-card-element'), document.getElementById('obs-content-area'));
    });
    const wideState = await widePage.evaluate(() => {
        const area = document.getElementById('obs-content-area');
        const lines = Array.from(document.querySelectorAll('.verse-line'));
        const first = lines[0];
        let textW = 0;
        if (first) {
            const r = document.createRange();
            r.selectNodeContents(first);
            textW = r.getBoundingClientRect().width;
        }
        return { nLines: lines.length, textW, areaW: area.clientWidth, ratio: textW / Math.max(area.clientWidth, 1) };
    });
    await closeQuiet(widePage);
    check('Bible écran large : verset long sur PLUSIEURS lignes', wideState.nLines >= 2, 'n=' + wideState.nLines);
    check('Bible écran large : les lignes REMPLISSENT la largeur (≥70%)', wideState.ratio >= 0.7, Math.round(wideState.ratio * 100) + '%');

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

    // ============ S7. ANNOTATION DE VERSET (✏️ surligner/gras/couleurs) ============
    console.log('▶ S7. Bible : annotation du verset…');
    // Ajoute un livre de test dans la version PRINCIPALE (nécessaire pour la
    // recherche du verset) puis une annotation enregistrée.
    await bibleCtrl.evaluate(() => {
        bibleVersions.find(v => v.id === currentVersionId).books.push({
            name: 'Livre E2E', totalVerses: 1,
            chapters: [{ num: 1, verses: [{ num: 1, text: 'Texte principal avec annotation.' }] }]
        });
        renderBooksList(currentBooks());
    });
    const modalOk = await bibleCtrl.evaluate(() => {
        openVerseEditor(null, 'Livre E2E', 1, 1);
        const m = document.getElementById('verse-editor-modal');
        return !m.classList.contains('hidden') && document.getElementById('verse-editor-field').innerText.includes('annotation');
    });
    check('Éditeur ✏️ : la modale s\'ouvre avec le texte du verset', modalOk);
    await bibleCtrl.evaluate(() => {
        // Simule la mise en forme (sélection + boutons) puis l'enregistrement.
        document.getElementById('verse-editor-field').innerHTML = 'Texte <b>principal</b> avec <span style="background-color: rgb(253, 224, 71);">annotation surlignée</span>.';
        saveVerseEditor();
    });
    const annSaved = await bibleCtrl.evaluate(() => !!verseAnnotations['Livre E2E|1|1']);
    check('Annotation enregistrée (clé livre|chap|verset)', annSaved);
    await bibleCtrl.evaluate(() => triggerDisplay('Livre E2E', 1, [1], null));
    const capAnn = await bibleCtrl.evaluate(() => window.__capturedShow);
    check('config.textHtml transmis vers OBS (HTML non échappé)', !!(capAnn && capAnn.config && capAnn.config.textHtml && /<b>/.test(capAnn.config.textHtml)), JSON.stringify(capAnn && capAnn.config && capAnn.config.textHtml));
    const annRendered = await bibleObs.waitForFunction(() => {
        const b = document.querySelector('#obs-card-element .verse-text b');
        const hl = document.querySelector('#obs-card-element .verse-text span');
        return (b && hl) ? true : false;
    }, { timeout: 8000 }).then(() => true).catch(() => false);
    check('OBS : le verset annoté est rendu (gras + surlignage visibles)', annRendered);
    // Contraste intelligent : couleur de texte adaptée à la couleur de surlignage.
    const contrast = await bibleCtrl.evaluate(() => ({
        onYellow: bestTextColorFor('#fde047'),
        onWhite: bestTextColorFor('#ffffff'),
        onNavy: bestTextColorFor('#1e3a8a'),
        onBlack: bestTextColorFor('#000000')
    }));
    check('Contraste : surlignage clair → texte sombre', contrast.onYellow === '#0f172a' && contrast.onWhite === '#0f172a', JSON.stringify(contrast));
    check('Contraste : surlignage foncé → texte blanc', contrast.onNavy === '#ffffff' && contrast.onBlack === '#ffffff', JSON.stringify(contrast));
    // Application réelle : surlignage sur tout le champ → texte contrasté appliqué.
    const hlApplied = await bibleCtrl.evaluate(() => {
        openVerseEditor(null, 'Livre E2E', 1, 1);
        const field = document.getElementById('verse-editor-field');
        field.innerHTML = 'mot a surligner';
        const range = document.createRange();
        range.selectNodeContents(field);
        const sel = window.getSelection();
        sel.removeAllRanges(); sel.addRange(range);
        const inp = document.querySelector('[data-fmt-color="hiliteColor"]');
        inp.value = '#0f766e'; // surlignage foncé → texte blanc attendu
        inp.dispatchEvent(new Event('input'));
        const html = field.innerHTML;
        closeVerseEditor();
        return { dark: /background-color[^;]*0f766e|background-color[^;]*rgb\(15,\s*118,\s*110\)/i.test(html), whiteText: /#ffffff|rgb\(255,\s*255,\s*255\)/i.test(html) };
    });
    check('Surlignage appliqué ET texte automatiquement contrasté (blanc sur fond foncé)', hlApplied.dark && hlApplied.whiteText, JSON.stringify(hlApplied));
    // Nettoyage : retire l'annotation et le livre de test.
    await bibleCtrl.evaluate(() => {
        delete verseAnnotations['Livre E2E|1|1'];
        persistAnnotations();
        const v = bibleVersions.find(x => x.id === currentVersionId);
        v.books = v.books.filter(b => b.name !== 'Livre E2E');
        renderBooksList(currentBooks());
    });

    // ============ S8. DÉCOUPAGE DES VERSETS LONGS (sorties bas uniquement) ============
    console.log('▶ S8. Découpage des versets longs (uniquement sorties bas centré / bas droite)…');
    await bibleCtrl.evaluate(() => {
        const longText = 'Au commencement Dieu crea le ciel et la terre, et la terre etait sans forme et vide, et les tenebres etaient sur la face de labime, et lesprit de Dieu se mouvait sur les eaux, et Dieu dit.';
        bibleVersions.find(v => v.id === currentVersionId).books.push({
            name: 'Livre E2E', totalVerses: 1,
            chapters: [{ num: 1, verses: [{ num: 1, text: longText }] }]
        });
        renderBooksList(currentBooks());
        // Active l'option « ligne par ligne » (pilote du découpage). Le mode du
        // contrôleur reste « plein écran » : le découpage ne doit PAS en dépendre.
        displaySettings.lineMode = true;
        document.getElementById('set-line-mode').checked = true;
    });
    await bibleCtrl.evaluate(() => triggerDisplay('Livre E2E', 1, [1], null));
    // Robustesse : renvoie l'affichage courant (une page OBS dont la WebSocket
    // se reconnectait à l'instant de l'envoiinitial raterait le message — pas
    // de rejeu par conception ; un renvoi idempotent garantit la réception).
    await bibleCtrl.evaluate(() => relaunchLast());
    const split = await bibleCtrl.evaluate(() => ({
        parts: window.__capturedShow && window.__capturedShow.config.parts,
        partIndex: window.__capturedShow && window.__capturedShow.config.partIndex,
        mode: window.__capturedShow && window.__capturedShow.config.mode,
        navVisible: !document.getElementById('verse-parts-nav').classList.contains('hidden'),
        indicator: document.getElementById('verse-parts-indicator').innerText
    }));
    check('Verset long + option ligne par ligne : parties diffusées (config.parts)', !!(split.parts && split.parts.length >= 2), JSON.stringify(split.parts && split.parts.length));
    check('…même en mode plein écran au contrôleur (le découpage suit la SORTIE, pas le mode)', split.mode === 'full', split.mode);
    check('Indicateur x/y visible (1/N)', split.navVisible && split.indicator === '1/' + split.parts.length, split.indicator);
    // Sortie GÉNÉRALE (suit le mode plein écran) : verset ENTIer, jamais découpé.
    const fullOnGeneral = await bibleObs.waitForFunction(() => {
        // Le verset est réparti sur plusieurs .verse-line : on lit TOUTE la zone.
        const el = document.querySelector('#obs-content-area');
        return el && el.innerText.indexOf('et Dieu dit') >= 0;
    }, { timeout: 8000 }).then(() => true).catch(() => false);
    check('Sortie plein écran : verset ENTIer affiché (non affectée)', fullOnGeneral);
    // Sortie VERROUILLÉE bas centré : affiche une partie à la fois.
    const bottomObs = await ctxB.newPage();
    trackErrors(bottomObs, 'bible-obs-bottom');
    await bottomObs.goto(BASE + '/bible_control_display_pro.html?obs=true&lockMode=bottom', { waitUntil: 'load', timeout: 30000 });
    await bottomObs.waitForTimeout(400);
    // La page vient de se charger : on lui renvoie l'affichage courant (les pages
    // OBS ne rejouent pas les messages passés — comportement normal du projet).
    await bibleCtrl.evaluate(() => relaunchLast());
    const part1OnBottom = await bottomObs.waitForFunction(() => {
        const el = document.querySelector('#obs-card-element .verse-text');
        return el && el.innerText.length > 0 && el.innerText.length < 170 ? true : false;
    }, { timeout: 10000 }).then(() => true).catch(() => false);
    const bottomTxt = part1OnBottom ? await bottomObs.evaluate(() => document.querySelector('#obs-card-element .verse-text').innerText) : '';
    check('Sortie bas centré verrouillée : seule la partie 1 est affichée', part1OnBottom && bottomTxt.indexOf('et Dieu dit') < 0, bottomTxt.slice(0, 40));
    // Navigation : la sortie bas passe à la partie 2, la sortie plein écran reste entière.
    await bibleCtrl.evaluate(() => navigatePart(1));
    const part2OnBottom = await bottomObs.waitForFunction((start) => {
        const el = document.querySelector('#obs-card-element .verse-text');
        return el && el.innerText.indexOf(start) >= 0 && el.innerText.length < 170;
    }, split.parts[1].slice(0, 14), { timeout: 10000 }).then(() => true).catch(() => false);
    check('navigatePart(1) : la sortie bas affiche la partie 2', part2OnBottom);
    const fullStillFull = await bibleObs.evaluate(() => {
        const el = document.querySelector('#obs-content-area');
        return el && el.innerText.indexOf('et Dieu dit') >= 0;
    });
    check('…tandis que la sortie plein écran affiche toujours le verset entier', !!fullStillFull);
    await bottomObs.close();
    // Option désactivée : plus aucun découpage, navigation masquée.
    await bibleCtrl.evaluate(() => {
        displaySettings.lineMode = false;
        document.getElementById('set-line-mode').checked = false;
        triggerDisplay('Livre E2E', 1, [1], null);
    });
    const noSplit = await bibleCtrl.evaluate(() => ({
        parts: window.__capturedShow.config.parts,
        navVisible: !document.getElementById('verse-parts-nav').classList.contains('hidden')
    }));
    check('Option ligne par ligne désactivée : aucun découpage, navigation masquée', !noSplit.parts && !noSplit.navVisible, JSON.stringify(noSplit));
    await bibleCtrl.evaluate(() => {
        const v = bibleVersions.find(x => x.id === currentVersionId);
        v.books = v.books.filter(b => b.name !== 'Livre E2E');
        renderBooksList(currentBooks());
    });

} finally {
    await browser.close().catch(() => {});
    server.kill('SIGTERM');
}

console.log(`\n${passed} test(s) OK, ${failed} échec(s)`);
process.exit(failed ? 1 : 0);

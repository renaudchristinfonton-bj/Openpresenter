// ============================================================
// tests/capture-adaptation.mjs — Captures de preuve du mode ADAPT
// ============================================================
// Ouvre de vraies pages OBS (?res=WxH) dans Chromium et capture des
// captures d'écran montrant l'adaptation de la mise en page à des
// écrans non 16:9 (bandeau large 1920×432, écran portrait 720×1280).
// Usage : node tests/capture-adaptation.mjs   (sortie dans captures/)
import { chromium as playwrightChromium } from 'playwright';
import sparticuzChromium from '@sparticuz/chromium';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// Bibliothèques NSS/NSPR embarquées pour le Chromium headless (si présentes).
import { existsSync as __existsSync, constants as __unused } from 'node:fs';
const __nssDir = join(dirname(fileURLToPath(import.meta.url)), 'nss');
if (__existsSync(__nssDir)) {
    process.env.LD_LIBRARY_PATH = (process.env.LD_LIBRARY_PATH ? process.env.LD_LIBRARY_PATH + ':' : '') + __nssDir;
}
const OUT = join(ROOT, '..', 'captures');
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BASE || 'http://localhost:8787';

const VERSE_LONG = 'Au commencement, Dieu crea le ciel et la terre. La terre etait sans forme et vide, les tenebres couvraient la face de labime, et lesprit de Dieu se mouvait au-dessus des eaux.';

const browser = await playwrightChromium.launch({
    executablePath: await sparticuzChromium.executablePath(),
    args: [...sparticuzChromium.args],
    headless: true
});

// NB : un SEUL contexte réutilisé (ce Chromium --single-process plante quand
// on ferme un browserContext) ; le viewport est réglé par page.
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
await ctx.route('**/*', async (route) => {
    const u = route.request().url();
    if (u.startsWith(BASE)) return route.continue();
    if (u.includes('cdn.tailwindcss.com')) return route.fulfill({ contentType: 'application/javascript', body: 'window.tailwind=function(){};window.tailwind.config=function(){};' });
    return route.fulfill({ contentType: 'application/javascript', body: '/* stub */' });
});

async function shot(name, url, viewport, render) {
    const page = await ctx.newPage();
    await page.setViewportSize(viewport);
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(400);
    if (render) await page.evaluate(render);
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(OUT, name) });
    await page.close().catch(() => {});
    console.log('📸 ' + name);
}

const renderFull = () => renderDisplay(
    { reference: 'Jean 3:16', text: 'Car Dieu a tant aime le monde, qu\'il a donne son Fils unique, afin que quiconque croit en lui ne perisse point, mais qu\'il ait la vie eternelle.', version: 'S21', mode: 'full', bgColor: 'rgba(10, 20, 40, 0.95)', accentColor: '#f59e0b', textColor: '#ffffff', fontFamily: 'serif' },
    document.getElementById('obs-container'), document.getElementById('obs-card-element'), document.getElementById('obs-content-area'));

const renderDual = () => renderDisplay(
    { reference: 'Jean 3:16', text: 'Car Dieu a tant aime le monde, qu\'il a donne son Fils unique.', version: 'S21', dual: { version: 'LSG', text: 'Car Dieu a tant aime le monde, qu\'il a donne son Fils unique.' }, mode: 'full', bgColor: 'rgba(10, 20, 40, 0.95)', accentColor: '#f59e0b', textColor: '#ffffff', fontFamily: 'serif' },
    document.getElementById('obs-container'), document.getElementById('obs-card-element'), document.getElementById('obs-content-area'));

const renderBottomPart = () => {
    const VERSE_LONG = 'Au commencement, Dieu crea le ciel et la terre. La terre etait sans forme et vide, les tenebres couvraient la face de labime, et lesprit de Dieu se mouvait au-dessus des eaux.';
    renderDisplay(
        { reference: 'Genese 1:1-2', text: VERSE_LONG, version: 'S21', mode: 'bottom', parts: [VERSE_LONG.slice(0, 148), VERSE_LONG.slice(149)], partIndex: 0, bgColor: 'rgba(10, 20, 40, 0.92)', accentColor: '#f59e0b', textColor: '#ffffff', fontFamily: 'serif' },
        document.getElementById('obs-container'), document.getElementById('obs-card-element'), document.getElementById('obs-content-area'));
};

const renderAnnot = () => renderDisplay(
    { reference: 'Jean 3:16', text: 'Car Dieu a tant aime le monde', version: 'S21', mode: 'full', textHtml: 'Car Dieu a tant <span style="background-color: rgb(253, 224, 71); color: rgb(15, 23, 42);">aime le monde</span> — et <span style="background-color: rgb(30, 58, 138); color: rgb(255, 255, 255);">il a donne</span> son Fils', bgColor: 'rgba(10, 20, 40, 0.95)', accentColor: '#f59e0b', textColor: '#ffffff', fontFamily: 'serif' },
    document.getElementById('obs-container'), document.getElementById('obs-card-element'), document.getElementById('obs-content-area'));

try {
    // 1. Bible plein écran ADAPTÉ à un bandeau 1920×432 (écran étiré réel).
    await shot('1-adapt-bandeau-1920x432.png', BASE + '/bible_control_display_pro.html?obs=true&res=1920x432', { width: 1920, height: 432 }, renderFull);
    // 2. Bible plein écran ADAPTÉ à un écran portrait 720×1280.
    await shot('2-adapt-portrait-720x1280.png', BASE + '/bible_control_display_pro.html?obs=true&res=720x1280', { width: 720, height: 1280 }, renderFull);
    // 3. Deux versions côte à côte sur bandeau 1920×432.
    await shot('3-adapt-2versions-bandeau.png', BASE + '/bible_control_display_pro.html?obs=true&res=1920x432', { width: 1920, height: 432 }, renderDual);
    // 4. Découpage : sortie bas verrouillée sur bandeau — partie 1 d'un verset long.
    await shot('4-decoupage-bas-verrouille-part1.png', BASE + '/bible_control_display_pro.html?obs=true&res=1920x432&lockMode=bottom', { width: 1920, height: 432 }, renderBottomPart);
    // 5. Annotation avec contraste intelligent (jaune→texte sombre, bleu→texte blanc).
    await shot('5-annotation-contraste.png', BASE + '/bible_control_display_pro.html?obs=true&res=1280x720', { width: 1280, height: 720 }, renderAnnot);
    // 6. Paroles adaptées au portrait.
    await shot('6-paroles-adapt-portrait.png', BASE + '/lyrics_control_display_pro.html?obs=true&res=720x1280', { width: 720, height: 1280 }, () => renderDisplay(
        { reference: 'Grâce Infinie', sectionLabel: 'Refrain', text: 'Quand je marche dans la vallee\nde l\'ombre de la mort,\\ntu es avec moi.', mode: 'full', bgColor: 'rgba(20, 10, 40, 0.95)', accentColor: '#8b5cf6', textColor: '#ffffff', fontFamily: 'serif' },
        document.getElementById('obs-container'), document.getElementById('obs-card-element'), document.getElementById('obs-content-area'), document.getElementById('obs-bg-layer'), 'obs'));
} finally {
    await browser.close().catch(() => {});
}
console.log('Captures enregistrées dans ' + OUT);

// Vérifications navigateur des fonctionnalités V1 ajoutées : recherche Bible,
// découpage « bas » sans altérer le plein écran, et nouveau rendu/zoom des Chants.
// Usage : node tests/test-v1-features.mjs
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium as playwrightChromium } from 'playwright';
import sparticuzChromium, { inflate } from '@sparticuz/chromium';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.TEST_V1_PORT || 8798);
const BASE = `http://127.0.0.1:${PORT}`;
const DATA_DIR = mkdtempSync(join(tmpdir(), 'openpresenter-v1-features-'));
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const server = spawn(process.execPath, ['sync-relay-server.js'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT), OPENPRESENTER_DATA_DIR: DATA_DIR },
    stdio: ['ignore', 'pipe', 'pipe']
});
let serverLog = '';
server.stdout.on('data', data => { serverLog += data; });
server.stderr.on('data', data => { serverLog += data; });
let browser;

async function waitForServer() {
    for (let i = 0; i < 150; i++) {
        try {
            const response = await fetch(`${BASE}/api/info`);
            if (response.ok) return true;
        } catch (_) { /* serveur en démarrage */ }
        await sleep(100);
    }
    return false;
}

try {
    assert(await waitForServer(), `Serveur local indisponible.\n${serverLog}`);
    // Le Chromium fourni par @sparticuz s'appuie sur les bibliothèques NSS du paquet
    // al2023; les extraire aussi hors AWS/Lambda pour les runners Linux génériques.
    const al2023Lib = join(tmpdir(), 'al2023', 'lib');
    if (!existsSync(join(al2023Lib, 'libnspr4.so'))) {
        await inflate(join(ROOT, 'tests', 'node_modules', '@sparticuz', 'chromium', 'bin', 'al2023.tar.br'));
    }
    process.env.LD_LIBRARY_PATH = [al2023Lib, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');
    browser = await playwrightChromium.launch({
        executablePath: await sparticuzChromium.executablePath(),
        args: [...sparticuzChromium.args],
        headless: true
    });
    const context = await browser.newContext({ serviceWorkers: 'block' });
    await context.route('**/*', async route => {
        const url = route.request().url();
        if (url.startsWith(BASE)) return route.continue();
        if (url.includes('cdn.tailwindcss.com')) {
            return route.fulfill({ contentType: 'application/javascript', body: 'window.tailwind=function(){};window.tailwind.config=function(){};' });
        }
        const contentType = route.request().resourceType() === 'stylesheet' ? 'text/css' : 'application/javascript';
        return route.fulfill({ contentType, body: '/* external resource stub */' });
    });

    // Bible : recherche E-S / J-E, Entrée vers la saisie chapitre-verset,
    // découpes numérotées et navigation vers le verset suivant.
    const bible = await context.newPage();
    const pageErrors = [];
    bible.on('pageerror', error => pageErrors.push(`Bible: ${error.message}`));
    await bible.goto(`${BASE}/bible_control_display_pro.html`, { waitUntil: 'load', timeout: 30000 });
    await bible.waitForSelector('#book-search');
    await bible.waitForFunction(() => typeof getBookSearchMatches === 'function' && typeof splitByWordBudget === 'function');

    const longVerse = Array.from({ length: 84 }, (_, i) => `mot${i + 1}${[8, 20, 41, 62].includes(i) ? '.' : ''}`).join(' ');
    const searchResults = await bible.evaluate(text => {
        const book = (name, chapters) => ({
            name,
            totalVerses: chapters.reduce((sum, chapter) => sum + chapter.verses.length, 0),
            chapters
        });
        bibleVersions = [{
            id: 'synthetic-v1',
            name: 'Test V1',
            books: [
                book('Esdras', [{ num: '1', verses: [{ num: '1', text: 'Au commencement du test.' }] }]),
                book('Esther', [{ num: '8', verses: [{ num: '9', text }, { num: '10', text: 'Le messager arriva le lendemain.' }] }]),
                book('Jean', [{ num: '1', verses: [{ num: '1', text: 'Au commencement était la Parole.' }] }]),
                book('Jérémie', [{ num: '1', verses: [{ num: '1', text: 'Parole de Dieu.' }] }])
            ]
        }];
        currentVersionId = 'synthetic-v1';
        renderVersionSelector();
        renderBooksList(currentBooks());
        return {
            es: getBookSearchMatches('E-S').map(item => item.name),
            je: getBookSearchMatches('J-E').map(item => item.name),
            accent: normalizeBookSearch('J-É')
        };
    }, longVerse);
    assert(searchResults.es.includes('Esdras') && searchResults.es.includes('Esther'), 'E-S doit filtrer les livres correspondants');
    assert.equal(searchResults.je[0], 'Jean', 'J-E doit placer Jean en premier');
    assert.equal(searchResults.accent, 'je', 'la recherche doit ignorer accents et séparateurs');

    await bible.locator('#book-search').fill('E-S');
    await bible.locator('#book-search').press('Enter');
    await bible.waitForFunction(() => activeBookName === 'Esdras');
    assert.equal(await bible.evaluate(() => document.activeElement.id), 'smart-input', 'Entrée doit sélectionner le premier livre et focaliser la saisie chapitre-verset');
    await bible.locator('#smart-input').fill('1 1');
    await bible.locator('#smart-input').press('Enter');
    await bible.waitForFunction(() => onAir && onAir.bookName === 'Esdras');
    assert.equal(await bible.evaluate(() => String(onAir.verseNums[0])), '1', 'la saisie chapitre espace verset doit projeter le verset');

    // Deux Sources OBS verrouillées partagent la diffusion : le bandeau se découpe,
    // le plein écran reçoit toujours le verset entier.
    const fullOutput = await context.newPage();
    const bottomOutput = await context.newPage();
    fullOutput.on('pageerror', error => pageErrors.push(`OBS plein écran: ${error.message}`));
    bottomOutput.on('pageerror', error => pageErrors.push(`OBS bas centré: ${error.message}`));
    await Promise.all([
        fullOutput.goto(`${BASE}/bible_control_display_pro.html?obs=true&lockMode=full`, { waitUntil: 'load', timeout: 30000 }),
        bottomOutput.goto(`${BASE}/bible_control_display_pro.html?obs=true&lockMode=bottom-default`, { waitUntil: 'load', timeout: 30000 })
    ]);
    await Promise.all([
        fullOutput.waitForSelector('#obs-content-area', { state: 'attached' }),
        bottomOutput.waitForSelector('#obs-content-area', { state: 'attached' })
    ]);

    await bible.locator('#book-search').fill('Esther');
    await bible.locator('#book-search').press('Enter');
    await bible.waitForFunction(() => activeBookName === 'Esther');
    await bible.locator('#obs-mode-select').selectOption('bottom-default');
    await bible.locator('#smart-input').fill('8 9');
    await bible.locator('#smart-input').press('Enter');
    await bible.waitForFunction(() => onAir && onAir.bookName === 'Esther' && onAir.parts && onAir.parts.length >= 4);

    const splitInfo = await bible.evaluate(() => ({
        parts: onAir.parts,
        current: onAir.partIndex,
        navCount: document.querySelectorAll('#verse-part-buttons button').length,
        navLabel: document.getElementById('verse-parts-indicator').textContent
    }));
    assert(splitInfo.parts.length >= 4, 'un long verset doit avoir au moins quatre parties');
    assert(splitInfo.parts.every(part => part.trim().split(/\s+/).length <= 22), 'les parties doivent respecter le budget de mots par défaut');
    assert.equal(splitInfo.navCount, splitInfo.parts.length, 'chaque partie doit avoir son bouton direct');

    await Promise.all([
        fullOutput.waitForFunction(() => document.querySelector('#obs-content-area .scene-root')),
        bottomOutput.waitForFunction(() => document.querySelector('#obs-content-area .scene-root'))
    ]);
    const fullText = await fullOutput.locator('#obs-content-area').evaluate(node => node.textContent.replace(/\s+/g, ' ').trim());
    const fullClasses = await fullOutput.locator('#obs-content-area .scene-root').getAttribute('class');
    const bottomText = await bottomOutput.locator('#obs-content-area').evaluate(node => node.textContent.replace(/\s+/g, ' ').trim());
    assert(fullText.includes(longVerse), 'la Source OBS plein écran doit conserver le texte complet');
    assert(!fullClasses.includes('has-parts'), 'le plein écran ne doit pas afficher les indicateurs de découpe');
    assert(bottomText.includes(splitInfo.parts[0]), 'le bas centré par défaut doit afficher la première partie');
    assert(!bottomText.includes(longVerse), 'le bas centré par défaut ne doit pas afficher le verset entier d’un coup');

    assert.notEqual(await bible.evaluate(() => document.activeElement.id), 'smart-input', 'la saisie doit libérer le clavier après projection');
    await bible.keyboard.press('ArrowRight');
    await bible.waitForFunction(() => onAir && onAir.partIndex === 1);
    await bible.locator('#verse-part-buttons button').nth(2).click();
    await bible.waitForFunction(() => onAir && onAir.partIndex === 2);
    assert.equal(await bible.locator('#verse-parts-indicator').textContent(), `3/${splitInfo.parts.length}`);
    await bible.keyboard.press('ArrowRight');
    await bible.waitForFunction(() => onAir && onAir.partIndex === onAir.parts.length - 1);
    await bible.keyboard.press('ArrowRight');
    await bible.waitForFunction(() => onAir && String(onAir.verseNums[0]) === '10' && !onAir.parts);
    assert.equal(await bible.evaluate(() => String(onAir.verseNums[0])), '10', 'la flèche droite doit passer au verset suivant après la dernière partie');

    // Chants : fond noir serré derrière chaque ligne, texte blanc et commandes A−/A+.
    const lyrics = await context.newPage();
    lyrics.on('pageerror', error => pageErrors.push(`Chants: ${error.message}`));
    await lyrics.goto(`${BASE}/lyrics_control_display_pro.html`, { waitUntil: 'load', timeout: 30000 });
    await lyrics.waitForSelector('#btn-lyrics-text-larger');
    await lyrics.waitForFunction(() => typeof triggerDisplay === 'function' && document.getElementById('songs-info')?.textContent !== 'Chargement...');
    await lyrics.evaluate(() => {
        songs = [{
            id: 'synthetic-song',
            title: 'Test de projection',
            artist: '',
            sections: [{ id: 'section-1', label: 'Couplet', text: 'Même saisie petite, le texte reste bien lisible sur le grand écran.' }]
        }];
        currentSongId = 'synthetic-song';
        displaySettings.textScale = 100;
        document.getElementById('obs-mode-select').value = 'bottom-default';
        triggerDisplay('synthetic-song', ['section-1']);
    });
    await lyrics.waitForSelector('#preview-content .scene-root.tpl-mode-bottom-default .lyric-line');
    const before = await lyrics.locator('#preview-content .lyric-line').first().evaluate(node => ({
        bg: getComputedStyle(node).backgroundColor,
        color: getComputedStyle(node).color,
        fontSize: parseFloat(getComputedStyle(node).fontSize),
        padding: getComputedStyle(node).padding
    }));
    assert.equal(before.bg, 'rgb(0, 0, 0)', 'chaque ligne projetée doit avoir son fond noir');
    assert.equal(before.color, 'rgb(255, 255, 255)', 'le texte des Chants doit rester blanc');
    await lyrics.locator('#btn-lyrics-text-larger').click();
    await lyrics.waitForFunction(() => Number(displaySettings.textScale) === 110);
    await lyrics.waitForTimeout(180);
    const after = await lyrics.locator('#preview-content .lyric-line').first().evaluate(node => parseFloat(getComputedStyle(node).fontSize));
    assert(after > before.fontSize, 'A+ doit agrandir le texte projeté indépendamment de la saisie');
    assert.equal(await lyrics.evaluate(() => Number(displaySettings.textScale)), 110);

    assert.deepEqual(pageErrors, [], `erreurs JavaScript navigateur: ${pageErrors.join('; ')}`);
    console.log('✓ Recherche Bible E-S/J-E et saisie directe chapitre-verset');
    console.log(`✓ Esther 8:9 découpé en ${splitInfo.parts.length} parties; boutons et navigation clavier jusqu’au verset suivant`);
    console.log('✓ Source OBS plein écran intacte pendant le découpage du bas centré');
    console.log(`✓ Chants : fond noir/blanc vérifié, A+ augmente la taille (${before.fontSize}px → ${after}px)`);
} finally {
    if (browser) await browser.close().catch(() => {});
    if (server.exitCode === null) {
        await new Promise(resolve => {
            server.once('exit', resolve);
            server.kill('SIGTERM');
        });
    }
    rmSync(DATA_DIR, { recursive: true, force: true });
}

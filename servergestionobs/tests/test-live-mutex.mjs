// ============================================================
// tests/test-live-mutex.mjs — Test unitaire de js/live-mutex.js
// ============================================================
// Simule RemoteChannel (BroadcastChannel local + relais réseau) en mémoire et
// vérifie les garanties du module d'exclusion mutuelle à 3 outils :
//   1. un claim masque les AUTRES outils, jamais l'émetteur lui-même ;
//   2. les doublons (message reçu par les deux transports) sont inoffensifs ;
//   3. les messages malformés ne lèvent jamais d'exception ;
//   4. une callback qui lève une exception ne casse jamais la page ;
//   5. le module fonctionne même sans RemoteChannel disponible.
//
// Usage : node tests/test-live-mutex.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'js', 'live-mutex.js'), 'utf8');

// --- Simulation du transport --------------------------------------------
// Chaque message est livré à tous les abonnés SAUF l'émetteur, exactement
// comme BroadcastChannel et sync-relay-server.js (broadcast sans écho).
function makeWorld() {
    const w = { subs: new Set(), thrown: [], LiveMutex: null };
    class FakeRemoteChannel {
        constructor() { this.onmessage = null; this._owner = ++makeWorld._seq; w.subs.add(this); }
        postMessage(d) {
            for (const s of w.subs) {
                if (s === this) continue; // pas d'écho vers l'émetteur
                setTimeout(() => s.deliver(d), 0);
            }
        }
        deliver(d) { if (typeof this.onmessage === 'function') this.onmessage({ data: d }); }
    }
    w.RemoteChannel = FakeRemoteChannel;
    w.window = w;
    w.loadModule = () => {
        try {
            // Évalue la source du module avec window/RemoteChannel injectés.
            new Function('window', 'RemoteChannel', src)(w, w.RemoteChannel);
        } catch (e) { w.thrown.push(e); }
        return w.LiveMutex;
    };
    return w;
}
makeWorld._seq = 0;

// --- Mini framework ------------------------------------------------------
let passed = 0, failed = 0;
function check(name, cond) {
    if (cond) { passed++; console.log('  ✓ ' + name); }
    else { failed++; console.error('  ✗ ' + name); }
}
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

// 1) Claim de base : les autres se masquent, pas l'émetteur.
{
    const w = makeWorld();
    const LiveMutex = w.loadModule();
    const hidden = { bible: [], lyrics: [], media: [] };
    const b = LiveMutex.claim('bible', (by) => hidden.bible.push(by));
    const l = LiveMutex.claim('lyrics', (by) => hidden.lyrics.push(by));
    const m = LiveMutex.claim('media', (by) => hidden.media.push(by));
    b.show();
    await tick();
    check('Bible masque Paroles', hidden.lyrics.length === 1 && hidden.lyrics[0] === 'bible');
    check('Bible masque Médias', hidden.media.length === 1 && hidden.media[0] === 'bible');
    check('Bible ne se masque pas elle-même', hidden.bible.length === 0);
    // Puis les Médias prennent l'antenne : Bible et Paroles se masquent.
    m.show();
    await tick();
    check('Médias masquent Bible (retour)', hidden.bible.length === 1 && hidden.bible[0] === 'media');
    check('Médias masquent Paroles (2e masquage)', hidden.lyrics.length === 2 && hidden.lyrics[1] === 'media');
    check('Médias masquées une seule fois (par la Bible), jamais par elles-mêmes', hidden.media.length === 1 && hidden.media[0] === 'bible');
    check("Aucune exception ne s'est échappée du module", w.thrown.length === 0);
}

// 2) Doublons : le même claim livré deux fois (BroadcastChannel + relais).
{
    const w = makeWorld();
    const LiveMutex = w.loadModule();
    let lyricsHidden = 0, mediaHidden = 0, bibleHidden = 0;
    const l = LiveMutex.claim('lyrics', () => lyricsHidden++);
    const m = LiveMutex.claim('media', () => mediaHidden++);
    const b = LiveMutex.claim('bible', () => bibleHidden++);
    b.show();
    await tick();
    const afterFirst = { lyricsHidden, mediaHidden, bibleHidden };
    // Ré-injection manuelle des doublons (comme un second transport) :
    l.channel.deliver({ action: 'show', source: 'bible' });
    m.channel.deliver({ action: 'show', source: 'bible' });
    b.channel.deliver({ action: 'show', source: 'bible' }); // self → ignoré
    await tick();
    check('Doublons : Paroles reste masquée (compteur stable)', lyricsHidden === afterFirst.lyricsHidden + 1 && lyricsHidden >= 1);
    check('Doublons : Médias reste masqué (compteur stable)', mediaHidden === afterFirst.mediaHidden + 1 && mediaHidden >= 1);
    check('Doublons : Bible ne s\'est jamais masquée', bibleHidden === 0);
    check('Doublons : aucune exception', w.thrown.length === 0);
}

// 3) Messages malformés : jamais d'exception.
{
    const w = makeWorld();
    const LiveMutex = w.loadModule();
    let hidden = 0;
    const m = LiveMutex.claim('media', () => hidden++);
    m.channel.deliver(null);
    m.channel.deliver({ action: 'hide', source: 'bible' });
    m.channel.deliver({ action: 'show' });             // pas de source
    m.channel.deliver({ action: 'show', source: 42 }); // source invalide
    await tick();
    check('Messages malformés ignorés sans exception', hidden === 0 && w.thrown.length === 0);
}

// 4) Callback qui lève : l'exception ne sort jamais du module.
{
    const w = makeWorld();
    const LiveMutex = w.loadModule();
    let boom = 0;
    LiveMutex.claim('bible', () => { boom++; throw new Error('page cassée'); });
    const l = LiveMutex.claim('lyrics', () => {});
    l.show();
    await tick();
    check('Callback fautive : appelée mais exception avalée', boom === 1 && w.thrown.length === 0);
}

// 5) Sans RemoteChannel du tout : claim()/show() restent utilisables.
{
    const w = makeWorld();
    delete w.RemoteChannel;
    const LiveMutex = w.loadModule();
    let ok = false;
    try {
        const m = LiveMutex.claim('media', () => {});
        m.show();
        ok = true;
    } catch (e) { ok = false; }
    check('Sans RemoteChannel : claim()/show() ne lancent jamais', ok && w.thrown.length === 0);
}

// --- Bilan ----------------------------------------------------------------
console.log(`\n${passed} test(s) OK, ${failed} échec(s)`);
process.exit(failed ? 1 : 0);

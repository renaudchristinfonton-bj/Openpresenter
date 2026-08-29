// ============================================================
// js/demo-content.js — Contenu de démonstration (idempotent)
// ============================================================
// Installe des chansons, Bibles, médias et looks de démonstration
// au premier lancement, pour avoir de quoi tester immédiatement sans
// avoir à rien configurer. Les appels sont idempotents : si des données
// existent déjà, rien n'est écrasé.
(function () {
    'use strict';

    const DEMO_SONGS = [
        {
            id: 'demo_grace_infinie',
            title: "Grâce infinie",
            author: "Démo",
            sections: [
                { id: 'sec1', label: 'Couplet 1',
                  text: "Grâce infinie, ô doux son\nQui sauva un misérable !\nJ'étais perdu, mais je suis retrouvé,\nJ'étais aveugle, mais maintenant je vois." },
                { id: 'sec2', label: 'Refrain',
                  text: "Ô grâce infinie, tu m'as sauvé,\nTon amour m'a trouvé,\nJe crierai ta gloire, ô Dieu,\nPour l'éternité." }
            ]
        }
    ];

    function isPopulated(val) {
        if (Array.isArray(val)) return val.length > 0;
        if (val && typeof val === 'object') return Object.keys(val).length > 0;
        return !!val;
    }

    async function install() {
        if (!window.OpenStore) return;
        try {
            // Chants : ne rien faire si des chants existent déjà
            const existing = await OpenStore.fetchFromServer('lyrics', 'songs');
            if (isPopulated(existing)) return;
            const local = OpenStore.get('lyrics', 'songs', null);
            if (isPopulated(local)) return;
            // Sinon, déposer les chants de démo
            OpenStore.set('lyrics', 'songs', DEMO_SONGS);
            // Notifier les abonnés (Paroles, Studio, …) pour rafraîchir
            try {
                const ch = new RemoteChannel('obs_lyrics_channel');
                ch.postMessage({ action: 'songs-updated' });
            } catch (e) { /* silencieux */ }
            // Log (visible sur la page d'accueil si #demo-log est présent)
            const log = document.getElementById('demo-log');
            if (log) log.innerText = '✓ Contenu de démonstration installé (' + DEMO_SONGS.length + ' chant(s)).';
        } catch (e) { /* ne jamais casser le chargement */ }
    }

    window.OpenDemo = { install: install };

    // Auto-installation si la page d'accueil signale qu'elle veut la démo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (document.getElementById('btn-demo')) install();
        });
    } else if (document.getElementById('btn-demo')) {
        install();
    }
})();

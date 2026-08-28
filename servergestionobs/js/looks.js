// ============================================================
// js/looks.js — Looks : habillage global de la régie en 1 clic
// ============================================================
// Un « look » = un jeu de couleurs/police/forme appliqué À LA FOIS à la Bible
// et aux Paroles (les deux outils « plein écran » textuels). Cliquer un look
// dans le Command Center :
//   1. enregistre les réglages fusionnés (localStorage + dossier data/ de
//      chaque outil) → look persistant, suit la portabilité du projet ;
//   2. diffuse le look en direct (canal relais looks_channel) aux contrôleurs
//      ouverts, qui rafraîchissent leur réglage ET leur affichage en cours.
// Additif : les réglages manuels par outil continuent de fonctionner ; un look
// ne touche ni aux médias, ni aux contenus, ni aux sorties.
(function () {
    'use strict';

    // Jeux de réglages compatibles displaySettings (Bible & Paroles).
    const PRESETS = [
        { id: 'sobre',  name: 'Sobre',  icon: '🕊️', settings: { bgColor: 'rgba(15, 23, 42, 0.95)', accentColor: '#f59e0b', textColor: '#ffffff', shapeRadius: 20 } },
        { id: 'festif', name: 'Festif', icon: '🎉', settings: { bgColor: 'rgba(76, 29, 149, 0.95)', accentColor: '#facc15', textColor: '#ffffff', shapeRadius: 32 } },
        { id: 'careme', name: 'Carême', icon: '🕯️', settings: { bgColor: 'rgba(2, 6, 23, 0.96)', accentColor: '#94a3b8', textColor: '#e2e8f0', shapeRadius: 0 } },
        { id: 'noel',   name: 'Noël',   icon: '✨', settings: { bgColor: 'rgba(2, 44, 34, 0.95)', accentColor: '#ef4444', textColor: '#ffffff', shapeRadius: 24 } },
        { id: 'aube',   name: 'Aube',   icon: '🌅', settings: { bgColor: 'rgba(250, 248, 242, 0.96)', accentColor: '#b45309', textColor: '#1e293b', shapeRadius: 28 } },
        { id: 'mission',name: 'Mission',icon: '🌍', settings: { bgColor: 'rgba(4, 47, 46, 0.95)', accentColor: '#2dd4bf', textColor: '#ffffff', shapeRadius: 16 } }
    ];

    const STORE = [
        { tool: 'bible',  key: 'bibleDisplaySettings',  ns: 'bible' },
        { tool: 'lyrics', key: 'lyricsDisplaySettings', ns: 'lyrics' }
    ];

    // Applique un jeu de réglages (look) : persiste + diffuse en direct.
    function apply(settings) {
        STORE.forEach(function (s) {
            let cur = null;
            try { cur = JSON.parse(localStorage.getItem(s.key) || 'null'); } catch (e) { cur = null; }
            const merged = Object.assign({}, cur || {}, settings);
            try { localStorage.setItem(s.key, JSON.stringify(merged)); } catch (e) { /* silencieux */ }
            if (window.OpenStore) { try { window.OpenStore.set(s.ns, 'displaySettings', merged); } catch (e) { /* silencieux */ } }
        });
        // Diffusion en direct aux contrôleurs ouverts (même PC ou autre).
        try {
            const ch = new RemoteChannel('looks_channel');
            ch.postMessage({ type: 'look', settings: settings });
        } catch (e) { /* silencieux */ }
    }

    function applyPreset(id) {
        const p = PRESETS.find(function (x) { return x.id === id; });
        if (p) apply(p.settings);
        return !!p;
    }

    // Écouteur à installer dans un contrôleur (Bible / Paroles) : applique le
    // look reçu en direct. Fourni pour rester identique dans les deux pages.
    function installLiveListener(ctx) {
        try {
            const ch = new RemoteChannel('looks_channel');
            ch.onmessage = function (ev) {
                try {
                    const d = ev.data || {};
                    if (d.type !== 'look' || !d.settings) return;
                    if (ctx && typeof ctx.apply === 'function') ctx.apply(d.settings);
                } catch (e) { /* jamais casser la page */ }
            };
            return ch;
        } catch (e) { return null; }
    }

    window.OpenLooks = { presets: PRESETS, apply: apply, applyPreset: applyPreset, installLiveListener: installLiveListener };
})();

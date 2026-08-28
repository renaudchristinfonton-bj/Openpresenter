// ============================================================
// js/looks.js — Looks : habillage global de la régie (v2)
// ============================================================
// Un « look » = UN jeu de réglages qui peut être DIFFÉRENT pour la Bible et
// les Paroles (mais sauvegardé et appliqué ensemble, en 1 clic) :
//   { id, name, icon?, bible: {...}, lyrics: {...} }
// Chaque réglage d'outil = champs displaySettings de l'outil (fond + opacité,
// accent, texte, police, coins, image de fond dataURL, flou) + `layout` :
// la géométrie de CHAQUE mode d'affichage (plein écran, bas centré, bas droite,
// ruban défilant) — largeur/hauteur/écarts en % → comme les modèles de FreeShow.
//
// - 6 préréglages intégrés (identiques Bible/Paroles) ;
// - looks PERSONNALISÉS créés dans looks_editor.html, stockés dans le dossier
//   du projet (data/looks/list.json via OpenStore) → portables ;
// - application : persistée dans les réglages de chaque outil + diffusée en
//   direct (canal relais looks_channel) aux contrôleurs ouverts.
(function () {
    'use strict';

    const PRESETS = [
        { id: 'sobre',  name: 'Sobre',  icon: '🕊️', bible: { bgColor: 'rgba(15, 23, 42, 0.95)', accentColor: '#f59e0b', textColor: '#ffffff', shapeRadius: 20 }, lyrics: { bgColor: 'rgba(15, 23, 42, 0.95)', accentColor: '#f59e0b', textColor: '#ffffff', shapeRadius: 20 } },
        { id: 'festif', name: 'Festif', icon: '🎉', bible: { bgColor: 'rgba(76, 29, 149, 0.95)', accentColor: '#facc15', textColor: '#ffffff', shapeRadius: 32 }, lyrics: { bgColor: 'rgba(76, 29, 149, 0.95)', accentColor: '#facc15', textColor: '#ffffff', shapeRadius: 32 } },
        { id: 'careme', name: 'Carême', icon: '🕯️', bible: { bgColor: 'rgba(2, 6, 23, 0.96)', accentColor: '#94a3b8', textColor: '#e2e8f0', shapeRadius: 0 }, lyrics: { bgColor: 'rgba(2, 6, 23, 0.96)', accentColor: '#94a3b8', textColor: '#e2e8f0', shapeRadius: 0 } },
        { id: 'noel',   name: 'Noël',   icon: '✨', bible: { bgColor: 'rgba(2, 44, 34, 0.95)', accentColor: '#ef4444', textColor: '#ffffff', shapeRadius: 24 }, lyrics: { bgColor: 'rgba(2, 44, 34, 0.95)', accentColor: '#ef4444', textColor: '#ffffff', shapeRadius: 24 } },
        { id: 'aube',   name: 'Aube',   icon: '🌅', bible: { bgColor: 'rgba(250, 248, 242, 0.96)', accentColor: '#b45309', textColor: '#1e293b', shapeRadius: 28 }, lyrics: { bgColor: 'rgba(250, 248, 242, 0.96)', accentColor: '#b45309', textColor: '#1e293b', shapeRadius: 28 } },
        { id: 'mission',name: 'Mission',icon: '🌍', bible: { bgColor: 'rgba(4, 47, 46, 0.95)', accentColor: '#2dd4bf', textColor: '#ffffff', shapeRadius: 16 }, lyrics: { bgColor: 'rgba(4, 47, 46, 0.95)', accentColor: '#2dd4bf', textColor: '#ffffff', shapeRadius: 16 } }
    ];

    const STORE = [
        { tool: 'bible',  key: 'bibleDisplaySettings',  ns: 'bible' },
        { tool: 'lyrics', key: 'lyricsDisplaySettings', ns: 'lyrics' }
    ];

    function chan() { try { return new RemoteChannel('looks_channel'); } catch (e) { return null; } }

    // Applique un look complet (bible + lyrics distincts possibles).
    function apply(look) {
        if (!look) return false;
        STORE.forEach(function (s) {
            const part = look[s.tool] || look.bible || {};
            let cur = null;
            try { cur = JSON.parse(localStorage.getItem(s.key) || 'null'); } catch (e) { cur = null; }
            const merged = Object.assign({}, cur || {}, part);
            try { localStorage.setItem(s.key, JSON.stringify(merged)); } catch (e) { /* silencieux */ }
            if (window.OpenStore) { try { window.OpenStore.set(s.ns, 'displaySettings', merged); } catch (e) { /* silencieux */ } }
        });
        try { chan().postMessage({ type: 'look', name: look.name, bible: look.bible || null, lyrics: look.lyrics || null }); } catch (e) { /* silencieux */ }
        return true;
    }

    function applyPreset(id) {
        const p = PRESETS.find(function (x) { return x.id === id; });
        return p ? apply(p) : false;
    }

    // Écouteur d'un contrôleur : reçoit la part de SON outil et l'applique.
    function installLiveListener(tool, ctx) {
        try {
            const c = chan();
            c.onmessage = function (ev) {
                try {
                    const d = ev.data || {};
                    if (d.type !== 'look') return;
                    const part = d[tool] || null;
                    if (part && ctx && typeof ctx.apply === 'function') ctx.apply(part);
                } catch (e) { /* jamais casser la page */ }
            };
            return c;
        } catch (e) { return null; }
    }

    // ---- Looks personnalisés (dossier du projet + localStorage) ----
    function loadCustom() {
        return (async function () {
            let list = null;
            try { list = JSON.parse(localStorage.getItem('looksCustom') || 'null'); } catch (e) { list = null; }
            if ((!list || !list.length) && window.OpenStore) {
                try { list = await window.OpenStore.fetchFromServer('looks', 'list'); } catch (e) { list = null; }
                if (list && list.length) { try { localStorage.setItem('looksCustom', JSON.stringify(list)); } catch (e) {} }
            }
            return Array.isArray(list) ? list : [];
        })();
    }

    function saveCustomList(list) {
        try { localStorage.setItem('looksCustom', JSON.stringify(list)); } catch (e) { /* silencieux */ }
        if (window.OpenStore) { try { window.OpenStore.set('looks', 'list', list); } catch (e) { /* silencieux */ } }
    }

    function saveCustom(look) {
        return loadCustom().then(function (list) {
            const i = list.findIndex(function (x) { return x.id === look.id; });
            if (i >= 0) list[i] = look; else list.push(look);
            saveCustomList(list);
            return list;
        });
    }

    function deleteCustom(id) {
        return loadCustom().then(function (list) {
            saveCustomList(list.filter(function (x) { return x.id !== id; }));
        });
    }

    window.OpenLooks = {
        presets: PRESETS, apply: apply, applyPreset: applyPreset,
        installLiveListener: installLiveListener,
        loadCustom: loadCustom, saveCustom: saveCustom, deleteCustom: deleteCustom
    };
})();

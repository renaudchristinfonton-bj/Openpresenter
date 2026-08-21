// ============================================================
// js/ui.js — Helpers partagés (refactor, axe E)
// ============================================================
// Petits utilitaires identiques entre outils (lecture safe du localStorage,
// conversion de couleurs). Auparavant dupliqués dans Bible et Paroles.
(function () {
    'use strict';

    // Lecture d'une valeur localStorage sans risque (retourne fallback en cas d'erreur).
    function safeParseLocal(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return fallback;
            const parsed = JSON.parse(raw);
            return parsed || fallback;
        } catch (e) {
            return fallback;
        }
    }

    // "rgba(15, 23, 42, 0.92)" -> { hex: '#0f172a', opacity: 92 }
    function rgbaToHexAndOpacity(rgba) {
        const m = String(rgba).match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s]+([\d.]+))?\s*\)/);
        if (!m) return { hex: '#0f172a', opacity: 92 };
        const toHex = n => Number(n).toString(16).padStart(2, '0');
        const hex = `#${toHex(m[1])}${toHex(m[2])}${toHex(m[3])}`;
        const opacity = m[4] !== undefined ? Math.round(parseFloat(m[4]) * 100) : 100;
        return { hex, opacity };
    }

    // "#0f172a" + pourcentage d'opacité (0-100) -> "rgba(...)".
    function hexToRgba(hex, opacityPct) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${(opacityPct / 100).toFixed(2)})`;
    }

    window.safeParseLocal = safeParseLocal;
    window.rgbaToHexAndOpacity = rgbaToHexAndOpacity;
    window.hexToRgba = hexToRgba;
})();

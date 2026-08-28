// ============================================================
// js/pwa.js — enregistrement du service worker (PWA / hors ligne)
// ============================================================
// Inclus par chaque page. Sans effet en file:// ou si le navigateur ne
// supporte pas les service workers ; n'interfère jamais avec la régie.
(function () {
    'use strict';
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function () { /* silencieux : la régie marche sans */ });
    });
})();

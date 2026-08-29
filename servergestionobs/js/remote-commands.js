// ============================================================
// js/remote-commands.js — Écoute des commandes distantes (relaunch/cut)
// ============================================================
// Doit être chargé APRÈS js/remote-channel.js.
// Écoute le canal `api_remote_channel` :
//   - { cmd: 'relaunch' } : rappelle triggerDisplay avec le dernier texte
//                           diffusé (relaunchLast) SI on est actuellement en
//                           cours de diffusion (onAir).
//   - { action: 'hide' }  : cache la sortie OBS (utilisé par la commande cut).
(function () {
    'use strict';
    if (!window.RemoteChannel) return;
    try {
        const ch = new RemoteChannel('api_remote_channel');
        ch.onmessage = function (ev) {
            try {
                const d = ev.data || {};
                if (d.action === 'hide') {
                    if (typeof window.clearOBS === 'function') {
                        try { window.clearOBS(); } catch (e) {}
                    } else if (typeof window.hideDisplay === 'function') {
                        try { window.hideDisplay(); } catch (e) {}
                    }
                    return;
                }
                if (d.cmd === 'relaunch') {
                    if (typeof window.relaunchLast === 'function') {
                        // Ne relance rien si rien n'était en cours (fallbackText)
                        if (window.onAir && window.onAir.fallbackText != null) {
                            try { window.relaunchLast(); } catch (e) {}
                        }
                    }
                }
            } catch (e) { /* silencieux */ }
        };
    } catch (e) { /* silencieux — pas de canal, pas de commandes */ }
})();

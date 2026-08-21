// ============================================================
// js/live-mutex.js — Exclusion mutuelle des sorties plein écran
// ============================================================
// Règle produit : si UN des trois outils « plein écran » (Bible, Paroles,
// Médias) passe à l'antenne, les deux autres se masquent automatiquement.
// Le Lower Third est PERMANENT : il ne participe jamais à cette exclusion.
//
// Pourquoi un module partagé ? Historiquement, chaque outil portait sa propre
// copie du gestionnaire d'exclusion écrite à la main — c'est ainsi qu'est né
// le bug critique (une variable utilisée avant sa déclaration dans le module
// Médias, qui empêchait l'ajout de médias). Une seule implémentation ici,
// testée une fois pour les trois outils (voir tests/test-live-mutex.mjs).
//
// Garanties de robustesse :
//   - Aucune exception ne peut sortir de ce module : chaque callback est protégé.
//   - Un outil ne peut jamais se masquer lui-même (sa propre source est ignorée).
//   - Les doublons (un même message reçu par BroadcastChannel ET par le relais
//     réseau) sont sans effet : « se masquer » est idempotent, et un claim ne
//     fait jamais « apparaître » un outil — seul son propre contrôleur le peut.
//     L'ordre d'arrivée des messages n'a donc aucune importance.
//   - Fonctionne en mode contrôleur comme en mode OBS (?obs=true) : c'est
//     l'appelant qui fournit la callback « comment me masquer ».
//
// Utilisation :
//   const mutex = LiveMutex.claim('bible', () => { /* me masquer */ });
//   mutex.show();   // je passe à l'antenne : les autres outils se masquent
(function () {
    'use strict';

    const MUTEX_CHANNEL = 'obs_mutex_channel';

    function claim(source, onSuperseded) {
        let channel = null;
        try {
            if (typeof RemoteChannel === 'function') channel = new RemoteChannel(MUTEX_CHANNEL);
        } catch (e) { channel = null; }

        if (channel) {
            channel.onmessage = function (ev) {
                try {
                    const d = ev && ev.data;
                    if (!d || d.action !== 'show') return;
                    if (typeof d.source !== 'string' || d.source === source) return; // jamais soi-même
                    if (typeof onSuperseded === 'function') onSuperseded(d.source);
                } catch (e) { /* l'exclusion ne doit JAMAIS casser une page */ }
            };
        }

        return {
            // À appeler à chaque fois que CET outil passe à l'antenne.
            show: function () {
                if (!channel) return;
                try { channel.postMessage({ action: 'show', source: source, ts: Date.now() }); }
                catch (e) { /* silencieux : l'affichage local reste prioritaire */ }
            },
            // Canal sous-jacent, si un outil veut écouter d'autres événements (rare).
            get channel() { return channel; }
        };
    }

    window.LiveMutex = { claim: claim };
})();

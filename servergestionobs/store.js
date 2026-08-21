// ============================================================
// OpenStore — synchronisation des données utilisateur (portable)
// ============================================================
// Objectif : faire en sorte que TOUT le contenu du projet (chants, Bibles,
// médias avec leurs fichiers, présets, favoris, réglages, file de déroulement,
// groupes) soit sauvegardé DANS LE DOSSIER du projet, via le serveur relais
// (/data/... sur disque). Ainsi on peut copier le dossier sur un autre PC et
// continuer exactement là où on s'était arrêté, sans rien reconfigurer.
//
// Principe :
//   - L'écriture va TOUJOURS dans le stockage local (localStorage) : filet de
//     secours instantané, qui marche même en file://.
//   - EN PLUS, si la page est servie par le serveur relais (http://...), on
//     envoie une copie vers /data/<namespace>/<cle>.json. La copie du dossier
//     embarque donc tout le contenu.
//   - À la lecture, on lit d'abord le local ; et on propose fetchFromServer()
//     pour restaurer la version du dossier si on arrive avec un stockage vide
//     (cas d'un nouveau PC, ou d'un navigateur reconfiguré).
//
// Aucune donnée ne sort du réseau local.
window.OpenStore = (function () {
    'use strict';
    const serverAvailable = location.protocol !== 'file:';

    // ---- encodage/décodage Blob <-> base64 (pour transporter les fichiers) ----
    async function encodeValue(v) {
        if (v instanceof Blob) {
            const dataUrl = await new Promise((res, rej) => {
                const r = new FileReader();
                r.onload = () => res(r.result);
                r.onerror = rej;
                r.readAsDataURL(v);
            });
            return { __blob64: true, mime: v.type || 'application/octet-stream', data: dataUrl };
        }
        if (Array.isArray(v)) { const out = []; for (const x of v) out.push(await encodeValue(x)); return out; }
        if (v && typeof v === 'object') { const out = {}; for (const k in v) out[k] = await encodeValue(v[k]); return out; }
        return v;
    }
    function decodeValue(v) {
        if (v && typeof v === 'object' && v.__blob64) {
            const dataUrl = v.data;
            const b64 = dataUrl.split(',')[1];
            const mime = (dataUrl.match(/^data:([^;]+)/) || [, 'application/octet-stream'])[1];
            const bin = atob(b64);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            return new Blob([bytes], { type: mime });
        }
        if (Array.isArray(v)) return v.map(decodeValue);
        if (v && typeof v === 'object') { const out = {}; for (const k in v) out[k] = decodeValue(v[k]); return out; }
        return v;
    }

    function set(ns, key, value) {
        // Écriture locale (toujours)
        try { localStorage.setItem(ns + ':' + key, JSON.stringify(value)); } catch (e) { /* silencieux */ }
        // Synchronisation serveur (best-effort, en arrière-plan)
        if (serverAvailable) {
            try {
                fetch('/data/' + encodeURIComponent(ns) + '/' + encodeURIComponent(key) + '.json', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(value)
                }).catch(() => { /* silencieux */ });
            } catch (e) { /* silencieux */ }
        }
    }

    function get(ns, key, fallback) {
        try {
            const raw = localStorage.getItem(ns + ':' + key);
            if (raw != null) return JSON.parse(raw);
        } catch (e) { /* silencieux */ }
        return fallback;
    }

    async function fetchFromServer(ns, key) {
        if (!serverAvailable) return null;
        try {
            const res = await fetch('/data/' + encodeURIComponent(ns) + '/' + encodeURIComponent(key) + '.json');
            if (res.ok) return await res.json();
        } catch (e) { /* silencieux */ }
        return null;
    }

    // Récupère la version serveur si le stockage local est vide ou sans contenu.
    async function pullIfLocalEmpty(ns, key, hasContent) {
        if (!serverAvailable) return false;
        const serverVal = await fetchFromServer(ns, key);
        if (serverVal == null) return false;
        const localVal = get(ns, key, null);
        if (localVal != null && hasContent(localVal)) return false;
        try { localStorage.setItem(ns + ':' + key, JSON.stringify(serverVal)); } catch (e) { /* silencieux */ }
        return true;
    }

    // ---- Persistance de grosses données (avec Blobs) sur le dossier serveur ----
    // Encode (Blob -> base64) puis envoie vers /data/<ns>/<key>.json.
    async function saveHeavy(ns, key, value) {
        if (!serverAvailable) return false;
        try {
            const encoded = await encodeValue(value);
            const res = await fetch('/data/' + encodeURIComponent(ns) + '/' + encodeURIComponent(key) + '.json', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(encoded)
            });
            return res.ok;
        } catch (e) { return false; }
    }

    // Récupère (depuis le dossier serveur) une donnée pouvant contenir des Blobs.
    async function loadHeavy(ns, key) {
        const raw = await fetchFromServer(ns, key);
        if (raw == null) return null;
        try { return decodeValue(raw); } catch (e) { return null; }
    }

    return { set, get, fetchFromServer, pullIfLocalEmpty, saveHeavy, loadHeavy };
})();

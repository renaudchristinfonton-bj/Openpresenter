// ============================================================
// js/remote-channel.js — Module partagé (refactor, axe E)
// ============================================================
// Historiquement, la classe RemoteChannel et la fonction updateSyncBadge étaient
// dupliquées à l'identique dans les 4 outils (Bible, Paroles, Médias, Lower Third).
// Centralisées ici, une seule version sert tous les outils.
//
// RemoteChannel — pont réseau optionnel au-dessus de BroadcastChannel.
//
// BroadcastChannel ne fonctionne qu'entre pages ouvertes dans le MÊME processus
// navigateur (ex: un Dock OBS + une Source Navigateur OBS, car tous deux tournent
// dans le moteur Chromium interne à OBS). Il NE fonctionne PAS entre un navigateur
// externe (Chrome, Edge...) et OBS, ni entre deux PC différents.
//
// RemoteChannel garde BroadcastChannel comme transport local (gratuit, zéro
// config, marche toujours), et ajoute EN PLUS une connexion WebSocket vers le petit
// serveur relais local (sync-relay-server.js) quand la page est chargée depuis ce
// serveur (via une adresse http://..., pas en ouvrant le fichier directement). Cela
// permet de piloter l'affichage OBS depuis un navigateur classique, en plein écran,
// sur le même PC ou sur un autre PC du même réseau — sans rien changer d'autre au
// fonctionnement de l'application.
(function () {
    'use strict';

    class RemoteChannel {
        constructor(name) {
            this.name = name;
            this.onmessage = null;
            this._bc = null;
            this._ws = null;
            this._wsReady = false;
            this._reconnectTimer = null;
            this._statusListeners = [];

            try {
                this._bc = new BroadcastChannel(name);
                this._bc.onmessage = (ev) => this._deliver(ev.data);
            } catch (e) { this._bc = null; }

            // Seule une page servie en http(s) (donc via sync-relay-server.js) peut se
            // connecter au relais réseau ; une page ouverte en double-clic (file://) reste
            // en mode local uniquement, exactement comme avant.
            if (location.protocol !== 'file:') this._connectWS();
        }

        onStatusChange(fn) {
            this._statusListeners.push(fn);
            fn(this._wsReady ? 'connected' : (location.protocol === 'file:' ? 'unavailable' : 'disconnected'));
        }
        _notifyStatus(state) { this._statusListeners.forEach(fn => { try { fn(state); } catch (e) { /* silencieux */ } }); }

        _connectWS() {
            try {
                const proto = location.protocol === 'https:' ? 'wss' : 'ws';
                const url = `${proto}://${location.host}/ws?channel=${encodeURIComponent(this.name)}`;
                const ws = new WebSocket(url);
                this._ws = ws;
                ws.onopen = () => { this._wsReady = true; this._notifyStatus('connected'); };
                ws.onclose = () => { this._wsReady = false; this._notifyStatus('disconnected'); this._scheduleReconnect(); };
                ws.onerror = () => { this._wsReady = false; };
                ws.onmessage = (ev) => {
                    try {
                        const parsed = JSON.parse(ev.data);
                        this._deserialize(parsed.payload).then(data => this._deliver(data));
                    } catch (e) { /* silencieux */ }
                };
            } catch (e) {
                this._scheduleReconnect();
            }
        }

        _scheduleReconnect() {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = setTimeout(() => this._connectWS(), 3000);
        }

        _deliver(data) {
            if (typeof this.onmessage === 'function') this.onmessage({ data });
        }

        postMessage(data) {
            if (this._bc) { try { this._bc.postMessage(data); } catch (e) { /* silencieux */ } }
            if (this._ws && this._wsReady) {
                this._serialize(data).then(payload => {
                    try { this._ws.send(JSON.stringify({ channel: this.name, payload })); }
                    catch (e) { /* silencieux */ }
                }).catch(() => { /* silencieux */ });
            }
        }

        // Convertit récursivement tout Blob en base64 pour le transport JSON (WebSocket),
        // et inversement à la réception. Nécessaire par ex. pour les fonds image/vidéo du
        // module Paroles, qui passent par de vrais objets Blob avec BroadcastChannel natif.
        async _serialize(value) {
            if (value instanceof Blob) {
                const dataUrl = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(value);
                });
                return { __blob: true, mime: value.type || 'application/octet-stream', data: (dataUrl.split(',')[1] || '') };
            }
            if (Array.isArray(value)) return Promise.all(value.map(v => this._serialize(v)));
            if (value && typeof value === 'object') {
                const out = {};
                for (const k in value) out[k] = await this._serialize(value[k]);
                return out;
            }
            return value;
        }

        async _deserialize(value) {
            if (value && typeof value === 'object' && value.__blob) {
                const byteChars = atob(value.data);
                const bytes = new Uint8Array(byteChars.length);
                for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
                return new Blob([bytes], { type: value.mime });
            }
            if (Array.isArray(value)) return Promise.all(value.map(v => this._deserialize(v)));
            if (value && typeof value === 'object') {
                const out = {};
                for (const k in value) out[k] = await this._deserialize(value[k]);
                return out;
            }
            return value;
        }
    }

    // Met à jour le petit badge de synchronisation (en-tête des outils).
    function updateSyncBadge(state) {
        const dot = document.getElementById('sync-dot');
        const label = document.getElementById('sync-label');
        const badge = document.getElementById('sync-badge');
        if (!dot || !label) return;
        if (state === 'connected') {
            dot.className = 'w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0';
            label.innerText = 'Relais réseau actif';
            if (badge) badge.title = 'Synchronisé via le serveur relais : pilotable depuis un autre PC du réseau.';
        } else if (state === 'unavailable') {
            dot.className = 'w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0';
            label.innerText = 'Local uniquement';
            if (badge) badge.title = "Ouvrez cette page via l'adresse du serveur relais (http://...) pour activer le pilotage réseau.";
        } else {
            dot.className = 'w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 animate-pulse';
            label.innerText = 'Connexion au relais...';
            if (badge) badge.title = 'Tentative de connexion au serveur relais en cours.';
        }
    }

    window.RemoteChannel = RemoteChannel;
    window.updateSyncBadge = updateSyncBadge;
})();

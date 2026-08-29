#!/usr/bin/env node
'use strict';

/**
 * Serveur relais pour les outils "OBS Control/Display" (Bible, Paroles, Lower Third).
 *
 * Rôle :
 *  1) Servir les fichiers HTML (les 3 outils) en http://, comme un mini-site local.
 *  2) Relayer en WebSocket les messages entre toutes les pages ouvertes sur un même
 *     "canal" (obs_bible_channel / obs_lyrics_channel / obs_lt_channel), qu'elles
 *     soient dans le même navigateur, dans OBS, ou sur un AUTRE PC du réseau.
 *
 * Pourquoi c'est nécessaire :
 *  BroadcastChannel (utilisé par les 3 outils) ne fonctionne qu'à l'intérieur d'un
 *  seul et même processus navigateur. Un Dock OBS et une Source Navigateur OBS
 *  partagent ce processus (le moteur Chromium interne d'OBS), donc ça marchait déjà.
 *  Mais un Chrome/Edge externe, ou un navigateur sur un autre PC, n'y a pas accès.
 *  Ce serveur comble ce manque : dès qu'une page est ouverte via http://<ce PC>:PORT/...
 *  au lieu d'être ouverte en double-clic (file://), elle se connecte automatiquement
 *  à ce relais en plus de BroadcastChannel.
 *
 * Utilisation :
 *   1. npm install
 *   2. node sync-relay-server.js          (ou: npm start)
 *   3. Ouvrir les URL affichées dans le terminal.
 *
 * Aucune donnée ne sort de votre réseau local : tout reste sur votre machine / LAN.
 * Il n'y a pas d'authentification — ne l'exposez pas directement sur Internet.
 */

const http = require('http');
const zlib = require('zlib'); // gzip des fichiers texte (ouverture quasi instantanée)
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT, 10) || 8787;
// SEA (Single Executable Application) : si on tourne depuis un binaire Node
// compilé (node --experimental-sea-config), les fichiers sont à côté de l'exe
// et non à côté de ce script (qui est alors embarqué dans le binaire).
let ROOT_DIR = __dirname;
try {
    const sea = require('node:sea');
    if (sea.isSea && sea.isSea()) {
        ROOT_DIR = path.dirname(process.execPath);
    }
} catch (e) { /* node:sea indisponible sur Node ancien — rien à faire */ }
// Dossier de stockage des données utilisateur (favoris, chants, présets...) pour que
// vos réglages "vous suivent" d'un PC à l'autre sur le réseau.
const DATA_DIR = path.join(ROOT_DIR, 'data');

const MIME_TYPES = {
    '.webmanifest': 'application/manifest+json; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
};

// ============================================================
// 1) SERVEUR HTTP STATIQUE (sert les fichiers .html du dossier)
// ============================================================
// Extensions compressibles (texte) : les pages HTML (100+ Ko) descendent à
// ~20-30 Ko sur le réseau local —ouverture quasi instantanée, y compris depuis
// un autre PC du réseau en WiFi. Les binaires (images, vidéos, polices) sont
// déjà compressés : on ne les gzippe pas (CPU gaspillé pour rien).
const COMPRESSIBLE = new Set(['.html', '.js', '.css', '.json', '.svg', '.txt', '.webmanifest']);

function sendFile(res, filePath, req) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 - Fichier introuvable : ' + filePath);
            return;
        }
        const headers = { 'Content-Type': contentType };
        // Cache navigateur : les fichiers statiques du projet ne changent pas
        // pendant une session (les données vivent dans /data/). 1 h de cache
        // évite de re-télécharger les 4 pages à chaque ouverture d'onglet.
        headers['Cache-Control'] = 'public, max-age=3600';
        const accept = (req && req.headers && req.headers['accept-encoding']) || '';
        if (COMPRESSIBLE.has(ext) && /gzip/.test(accept) && data.length > 1024) {
            try {
                const gz = zlib.gzipSync(data, { level: 6 });
                headers['Content-Encoding'] = 'gzip';
                headers['Content-Length'] = gz.length;
                res.writeHead(200, headers);
                res.end(gz);
                return;
            } catch (e) { /* repli : envoi non compressé */ }
        }
        headers['Content-Length'] = data.length;
        res.writeHead(200, headers);
        res.end(data);
    });
}

function listHtmlFiles() {
    try {
        return fs.readdirSync(ROOT_DIR).filter(f => f.toLowerCase().endsWith('.html')).sort();
    } catch (e) {
        return [];
    }
}

const server = http.createServer((req, res) => {
    let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath === '/') {
        // Page d'accueil : si un fichier index.html (Command Center) existe dans le dossier,
        // on le sert en y injectant les infos réseau (adresses) connues par ce serveur.
        // Sinon, on retombe sur la liste brute des outils.
        const indexPath = path.join(ROOT_DIR, 'index.html');
        if (fs.existsSync(indexPath)) {
            const ips = getLocalIPs();
            const data = JSON.stringify({
                port: PORT,
                local: 'http://localhost:' + PORT + '/',
                network: ips.map(ip => 'http://' + ip + ':' + PORT + '/')
            });
            fs.readFile(indexPath, (err, buf) => {
                if (err) { res.writeHead(500); res.end('500 - Erreur de lecture de la page d\'accueil'); return; }
                let html = buf.toString('utf8');
                // Remplace TOUTES les occurrences du placeholder par les infos réseau,
                // sinon la déclaration `var __OPENPRESENTER_DATA__ = ...` reste invalide.
                html = html.split('__OPENPRESENTER_DATA__').join(data);
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(html);
            });
            return;
        }
        const files = listHtmlFiles();
        const items = files.map(f => `<li style="margin:8px 0;"><a href="/${f}" style="color:#8b5cf6;font-weight:600;" target="_blank">${f}</a> — <a href="/${f}?obs=true" style="color:#64748b;">version OBS (?obs=true)</a></li>`).join('');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Serveur relais OBS</title>
        <style>body{font-family:sans-serif;background:#0f172a;color:#f8fafc;padding:40px;max-width:700px;margin:0 auto;} a{text-decoration:none;} code{background:#1e293b;padding:2px 6px;border-radius:4px;}</style>
        </head><body>
        <h1>🟢 Serveur relais OBS actif</h1>
        <p>Port d'écoute : <code>${PORT}</code></p>
        <p>Outils disponibles :</p>
        <ul>${items || '<li>Aucun fichier .html trouvé dans ce dossier.</li>'}</ul>
        <p style="color:#94a3b8;font-size:14px;margin-top:30px;">Ajoutez le lien "version OBS" comme Source Navigateur dans OBS, et ouvrez le lien normal dans un navigateur classique (sur ce PC ou un autre PC du même réseau) pour piloter.</p>
        </body></html>`);
        return;
    }

    // Routes de stockage des données (axe "vos données vous suivent") :
    //   GET /data/<namespace>[/<sous-dossier>]/<cle>.json   -> lit le fichier
    //   PUT/POST /data/.../<cle>.json                      -> écrit
    //   DELETE /data/.../<cle>.json                        -> supprime
    // La clé peut contenir des sous-dossiers (ex: media/item/<id>.json) ;
    // on interdit formellement '..' pour éviter toute remontée hors de DATA_DIR.
    const dataMatch = urlPath.match(/^\/data\/([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*)\.json$/);
    if (dataMatch) {
        const fullKey = dataMatch[1];
        if (/(^|[/\\])\.\.([/\\]|$)/.test(fullKey)) {
            res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('400 - Chemin invalide');
            return;
        }
        const storePath = path.join(DATA_DIR, fullKey + '.json');
        // Sécurité anti-traversal sur le chemin résolu
        const resolvedStore = path.resolve(storePath);
        const resolvedRoot = path.resolve(DATA_DIR);
        if (!resolvedStore.startsWith(resolvedRoot + path.sep) && resolvedStore !== resolvedRoot) {
            res.writeHead(400); res.end('400 - Chemin invalide'); return;
        }
        if (req.method === 'GET') {
            fs.readFile(storePath, (err, data) => {
                if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('404 - Aucune donnée'); return; }
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(data);
            });
            return;
        }
        if (req.method === 'PUT' || req.method === 'POST') {
            let body = '';
            req.on('data', c => { body += c; if (body.length > 1024 * 1024 * 1024) req.destroy(); });
            req.on('end', () => {
                try {
                    fs.mkdirSync(path.dirname(storePath), { recursive: true });
                    fs.writeFileSync(storePath, body);
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end('{"ok":true}');
                } catch (e) {
                    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                    res.end('500 - Erreur d\'écriture');
                }
            });
            return;
        }
        if (req.method === 'DELETE') {
            try { fs.unlinkSync(storePath); } catch (e) { /* fichier absent : sans erreur */ }
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end('{"ok":true}');
            return;
        }
        res.writeHead(405); res.end('405'); return;
    }

    // API remote : reçoit des commandes (couper, relancer, broadcast) envoyées
    // par un contrôleur (télécommande, Stream Deck, …).
    if (urlPath === '/api/remote' && req.method === 'POST') {
        let body = '';
        req.on('data', c => { body += c; if (body.length > 65536) req.destroy(); });
        req.on('end', () => {
            try {
                const payload = JSON.parse(body || '{}');
                const cmd = payload.cmd;
                const ALLOWED = new Set(['obs_bible_channel', 'obs_lyrics_channel', 'obs_media_channel',
                                        'obs_lt_channel', 'timer_channel', 'pasteur_channel', 'api_remote_channel']);
                if (cmd === 'cut') {
                    // Ordre « cacher tout » : masque Bible, Paroles, Médias.
                    broadcast('obs_bible_channel', null, JSON.stringify({ action: 'hide' }));
                    broadcast('obs_lyrics_channel', null, JSON.stringify({ action: 'hide' }));
                    broadcast('obs_media_channel', null, JSON.stringify({ action: 'hide' }));
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end('{"ok":true,"cmd":"cut"}');
                    return;
                }
                if (cmd === 'relaunch') {
                    // Redemande l'affichage courant (après reconnexion OBS).
                    broadcast('api_remote_channel', null, JSON.stringify({ cmd: 'relaunch' }));
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end('{"ok":true,"cmd":"relaunch"}');
                    return;
                }
                // Broadcast générique : { channel, data }
                const ch = payload.channel;
                if (ch && ALLOWED.has(ch) && payload.data !== undefined) {
                    broadcast(ch, null, JSON.stringify(payload.data));
                    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end('{"ok":true}');
                    return;
                }
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end('{"ok":false,"error":"bad_request"}');
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end('{"ok":false,"error":"invalid_json"}');
            }
        });
        return;
    }


    // Informations sur ce serveur (adresses réseau) — utilisé par le Command Center
    // et par la découverte réseau.
    if (urlPath === '/api/info') {
        const ips = getLocalIPs();
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ name: 'OpenPresenter', port: PORT, local: 'http://localhost:' + PORT + '/', network: ips.map(ip => 'http://' + ip + ':' + PORT + '/') }));
        return;
    }

    // Export global des données centralisées (axe H) : renvoie un objet
    // { "<namespace>/<cle>": <contenu JSON> } de tout le dossier data/.
    if (urlPath === '/api/export') {
        const out = {};
        try {
            const walk = (dir, prefix) => {
                for (const f of fs.readdirSync(dir)) {
                    const full = path.join(dir, f);
                    const st = fs.statSync(full);
                    if (st.isDirectory()) walk(full, prefix + f + '/');
                    else if (f.endsWith('.json')) {
                        try { out[(prefix + f).replace(/\.json$/, '')] = JSON.parse(fs.readFileSync(full, 'utf8')); }
                        catch (e) { /* ignore un fichier illisible */ }
                    }
                }
            };
            if (fs.existsSync(DATA_DIR)) walk(DATA_DIR, '');
        } catch (e) { /* silencieux */ }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data: out }));
        return;
    }

    // Import global (axe H) : reçoit le corps JSON du /api/export (champ data)
    // et réécrit les fichiers correspondants dans data/.
    if (urlPath === '/api/import' && (req.method === 'POST' || req.method === 'PUT')) {
        let body = '';
        req.on('data', c => { body += c; if (body.length > 200 * 1024 * 1024) req.destroy(); });
        req.on('end', () => {
            try {
                const parsed = JSON.parse(body);
                const data = (parsed && parsed.data) || parsed || {};
                let count = 0;
                for (const key of Object.keys(data)) {
                    // key = "<ns>/<cle>"
                    const parts = key.split('/');
                    if (parts.length < 2) continue;
                    const ns = parts[0], ck = parts.slice(1).join('/');
                    const storePath = path.join(DATA_DIR, ns, ck + '.json');
                    fs.mkdirSync(path.dirname(storePath), { recursive: true });
                    fs.writeFileSync(storePath, JSON.stringify(data[key]));
                    count++;
                }
                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ ok: true, imported: count }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('400 - Fichier de sauvegarde invalide : ' + (e.message || e));
            }
        });
        return;
    }

    // Sécurité basique anti path-traversal
    const safeRelative = path.normalize(urlPath).replace(/^([.]{2}[/\\])+/, '');
    const filePath = path.join(ROOT_DIR, safeRelative);
    if (!filePath.startsWith(ROOT_DIR)) {
        res.writeHead(403);
        res.end('403 - Interdit');
        return;
    }
    sendFile(res, filePath, req);
});

// ============================================================
// 2) SERVEUR WEBSOCKET (relais des messages par canal)
// ============================================================
// Implémentation minimale du protocole WebSocket (RFC 6455), sans dépendance
// externe, pour rester simple à installer. Ne gère que ce dont nos outils ont
// besoin : messages texte, éventuellement volumineux (fonds vidéo encodés en
// base64), ping/pong, et fermeture propre.

const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

// channel (string) -> Set de sockets
const channels = new Map();

function subscribe(channel, socket) {
    if (!channels.has(channel)) channels.set(channel, new Set());
    channels.get(channel).add(socket);
}

function unsubscribe(channel, socket) {
    const set = channels.get(channel);
    if (!set) return;
    set.delete(socket);
    if (set.size === 0) channels.delete(channel);
}

function broadcast(channel, senderSocket, rawMessage) {
    const set = channels.get(channel);
    if (!set) return;
    for (const client of set) {
        if (client !== senderSocket && client.writable) {
            writeTextFrame(client, rawMessage);
        }
    }
}

function encodeFrameHeader(payloadLength, opcode) {
    let header;
    if (payloadLength < 126) {
        header = Buffer.alloc(2);
        header[0] = 0x80 | opcode;
        header[1] = payloadLength;
    } else if (payloadLength < 65536) {
        header = Buffer.alloc(4);
        header[0] = 0x80 | opcode;
        header[1] = 126;
        header.writeUInt16BE(payloadLength, 2);
    } else {
        header = Buffer.alloc(10);
        header[0] = 0x80 | opcode;
        header[1] = 127;
        header.writeBigUInt64BE(BigInt(payloadLength), 2);
    }
    return header;
}

function writeTextFrame(socket, text) {
    try {
        const payload = Buffer.from(text, 'utf8');
        const header = encodeFrameHeader(payload.length, 0x1); // 0x1 = text frame
        socket.write(Buffer.concat([header, payload]));
    } catch (e) { /* socket probablement fermé, on ignore */ }
}

function writeCloseFrame(socket) {
    try { socket.write(encodeFrameHeader(0, 0x8)); } catch (e) { /* ignoré */ }
}

function writePong(socket, payload) {
    try {
        const header = encodeFrameHeader(payload.length, 0xA); // pong
        socket.write(Buffer.concat([header, payload]));
    } catch (e) { /* ignoré */ }
}

// Gère la réassemblage des frames WS entrantes (fragmentation + masking) par connexion
function createFrameParser(onMessage, onClose) {
    let buffer = Buffer.alloc(0);
    let fragments = [];
    let fragmentedOpcode = null;

    function feed(chunk) {
        buffer = Buffer.concat([buffer, chunk]);
        let progress = true;
        while (progress) {
            progress = parseOnce();
        }
    }

    function parseOnce() {
        if (buffer.length < 2) return false;
        const first = buffer[0];
        const second = buffer[1];
        const fin = (first & 0x80) !== 0;
        const opcode = first & 0x0f;
        const masked = (second & 0x80) !== 0;
        let payloadLen = second & 0x7f;
        let offset = 2;

        if (payloadLen === 126) {
            if (buffer.length < offset + 2) return false;
            payloadLen = buffer.readUInt16BE(offset);
            offset += 2;
        } else if (payloadLen === 127) {
            if (buffer.length < offset + 8) return false;
            payloadLen = Number(buffer.readBigUInt64BE(offset));
            offset += 8;
        }

        let maskKey = null;
        if (masked) {
            if (buffer.length < offset + 4) return false;
            maskKey = buffer.slice(offset, offset + 4);
            offset += 4;
        }

        if (buffer.length < offset + payloadLen) return false; // pas encore tout reçu

        let payload = buffer.slice(offset, offset + payloadLen);
        if (masked && maskKey) {
            const unmasked = Buffer.alloc(payload.length);
            for (let i = 0; i < payload.length; i++) unmasked[i] = payload[i] ^ maskKey[i % 4];
            payload = unmasked;
        }

        buffer = buffer.slice(offset + payloadLen);

        if (opcode === 0x8) { // close
            onClose();
            return false;
        }
        if (opcode === 0x9) { // ping -> pong
            writePong(currentSocketRef.socket, payload);
            return true;
        }
        if (opcode === 0xA) { // pong
            return true;
        }

        if (opcode === 0x0) {
            // frame de continuation
            fragments.push(payload);
            if (fin) {
                const full = Buffer.concat(fragments);
                fragments = [];
                deliver(fragmentedOpcode, full);
                fragmentedOpcode = null;
            }
        } else {
            if (!fin) {
                fragmentedOpcode = opcode;
                fragments = [payload];
            } else {
                deliver(opcode, payload);
            }
        }
        return true;
    }

    function deliver(opcode, payload) {
        if (opcode === 0x1) onMessage(payload.toString('utf8'));
        // (0x2 binaire non utilisé par nos outils — tout passe en JSON texte / base64)
    }

    const currentSocketRef = { socket: null };
    return { feed, setSocket: (s) => { currentSocketRef.socket = s; } };
}

server.on('upgrade', (req, socket) => {
    if (!req.headers['upgrade'] || req.headers['upgrade'].toLowerCase() !== 'websocket') {
        socket.destroy();
        return;
    }
    const key = req.headers['sec-websocket-key'];
    if (!key) { socket.destroy(); return; }

    const acceptKey = crypto.createHash('sha1').update(key + WS_MAGIC).digest('base64');
    const responseHeaders = [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${acceptKey}`,
        '', ''
    ].join('\r\n');
    socket.write(responseHeaders);

    const urlObj = new URL(req.url, 'http://localhost');
    const channel = urlObj.searchParams.get('channel') || 'default';
    subscribe(channel, socket);

    let closed = false;
    const doClose = () => {
        if (closed) return;
        closed = true;
        unsubscribe(channel, socket);
        try { socket.end(); } catch (e) { /* ignoré */ }
    };

    const parser = createFrameParser(
        (text) => broadcast(channel, socket, text),
        doClose
    );
    parser.setSocket(socket);

    socket.on('data', (chunk) => {
        try { parser.feed(chunk); } catch (e) { doClose(); }
    });
    socket.on('close', doClose);
    socket.on('error', doClose);
    socket.writable = true;
});

// ============================================================
// 3) BEACON UDP (découverte réseau) — Axe D
// ============================================================
// Le serveur diffuse périodiquement un message de présence sur le réseau local
// (broadcast UDP). Chaque serveur OpenPresenter présent sur le même réseau reçoit
// les beacons des autres et les affiche dans le terminal : on repère ainsi les
// autres PC/machines qui servent OpenPresenter, sans avoir à connaître leur IP.
// Le navigateur ne pouvant pas écouter l'UDP brut, la "découverte" visuelle reste
// faite par le Command Center (adresses + QR code) ; ce beacon sert aux machines
// et à d'éventuels outils système. Reste 100% local.
const dgram = require('dgram');
const BEACON_PORT = 8788; // port UDP distinct du HTTP pour la découverte
const beaconSocket = dgram.createSocket('udp4');
const discoveredServers = new Map(); // "<ip>:<port>" -> { ip, port, lastSeen }

function startUdpBeacon() {
    try {
        beaconSocket.bind(() => {
            beaconSocket.setBroadcast(true);
            // Envoi périodique de présence
            setInterval(() => {
                const msg = Buffer.from(JSON.stringify({ type: 'openpresenter', port: PORT, host: getLocalIPs()[0] || 'localhost' }));
                beaconSocket.send(msg, 0, msg.length, BEACON_PORT, '255.255.255.255');
            }, 3000);
            console.log(`  Beacon UDP de découverte actif (port ${BEACON_PORT})`);
        });
        // Écoute des beacons des autres serveurs
        beaconSocket.on('message', (msg, rinfo) => {
            try {
                const data = JSON.parse(msg.toString('utf8'));
                if (data && data.type === 'openpresenter') {
                    const key = rinfo.address + ':' + data.port;
                    discoveredServers.set(key, { ip: rinfo.address, port: data.port, lastSeen: Date.now() });
                }
            } catch (e) { /* silencieux */ }
        });
        // Purge des serveurs non vus depuis 15s (affichage du terminal uniquement)
        setInterval(() => {
            const now = Date.now();
            for (const [k, v] of discoveredServers.entries()) {
                if (now - v.lastSeen > 15000) discoveredServers.delete(k);
            }
        }, 5000);
    } catch (e) {
        console.log('  (Beacon UDP indisponible sur ce réseau)');
    }
}

// ============================================================
// DÉMARRAGE
// ============================================================
function getLocalIPs() {
    const nets = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) ips.push(net.address);
        }
    }
    return ips;
}

server.listen(PORT, () => {
    startUdpBeacon();
    const ips = getLocalIPs();
    const files = listHtmlFiles();
    console.log('');
    console.log('========================================================');
    console.log('  Serveur relais OBS démarré ✅');
    console.log('========================================================');
    console.log(`  Sur ce PC        : http://localhost:${PORT}/`);
    ips.forEach(ip => console.log(`  Depuis le réseau  : http://${ip}:${PORT}/`));
    console.log('');
    if (files.length) {
        console.log('  Fichiers détectés :');
        files.forEach(f => console.log(`   - ${f}`));
    } else {
        console.log('  ⚠️  Aucun fichier .html trouvé dans ce dossier.');
        console.log('      Placez bible_control_display_pro.html, lyrics_control_display_pro.html');
        console.log('      et obs_lower_third_ultimate_studio.html à côté de ce script.');
    }
    console.log('');
    console.log('  Dans OBS (Source Navigateur), utilisez l\'adresse ci-dessus');
    console.log('  suivie de "?obs=true" (ou "?obs=1" pour Lower Third).');
    console.log('  Laissez cette fenêtre ouverte tant que vous diffusez.');
    console.log('========================================================');
    console.log('');

    // Ouverture automatique du navigateur quand OPEN=1 (lanceurs .bat/.command).
    if (process.env.OPEN === '1') {
        const url = `http://localhost:${PORT}/`;
        const opener = process.platform === 'darwin' ? 'open'
                     : process.platform === 'win32'  ? 'cmd'
                     : 'xdg-open';
        const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
        setTimeout(() => {
            try { require('child_process').spawn(opener, args, { detached: true, stdio: 'ignore' }).unref(); }
            catch (e) { /* silencieux */ }
        }, 900);
    }

    // Affichage périodique des serveurs OpenPresenter découverts sur le réseau
    setInterval(() => {
        const list = Array.from(discoveredServers.values());
        if (list.length) {
            console.log(`  [Découverte réseau] ${list.length} autre(s) serveur(s) OpenPresenter :`);
            list.forEach(s => console.log(`   - http://${s.ip}:${s.port}/`));
        }
    }, 6000);
});

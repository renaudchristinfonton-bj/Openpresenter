// Relais temps réel (ch. 02 § 2.4) — WebSocket écrit à la main, zéro dépendance.
// - handshake RFC 6455
// - trames fragmentées, ping/pong, fermeture
// - canaux `op_out_*`, `op_stage`, `op_remote`, `op_project`
// - dernier état conservé par canal de sortie pour la resynchronisation (EF-04.9)

import crypto from 'node:crypto';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_FRAME = 64 * 1024 * 1024;
const CHANNEL_RE = /^[\w.-]{1,100}$/;

export class Relay {
  constructor({ verifyOrigin = () => true, onLog = () => {} } = {}) {
    this.clients = new Set();
    this.lastState = new Map(); // canal → dernier message `show`/`clear`
    this.verifyOrigin = verifyOrigin;
    this.onLog = onLog;
  }

  handleUpgrade(req, socket, head, url) {
    if (!this.verifyOrigin(req)) {
      this.onLog('warn', 'ws.origin_rejected', 'origine refusée', { origin: req.headers.origin });
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }
    const key = req.headers['sec-websocket-key'];
    if (!key) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }
    const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
    socket.write([
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`,
      '\r\n'
    ].join('\r\n'));

    const channel = url.searchParams.get('channel') || 'op_project';
    if (!CHANNEL_RE.test(channel)) {
      socket.destroy();
      return;
    }

    const client = {
      socket,
      channel,
      alive: true,
      buffer: Buffer.alloc(0),
      fragments: [],
      fragmentOpcode: 0
    };
    this.clients.add(client);

    if (head && head.length) client.buffer = Buffer.concat([client.buffer, head]);
    this._drain(client);

    socket.on('data', (chunk) => {
      client.buffer = Buffer.concat([client.buffer, chunk]);
      this._drain(client);
    });
    socket.on('close', () => this.clients.delete(client));
    socket.on('error', () => this.clients.delete(client));
    socket.setTimeout(0);
  }

  _drain(client) {
    for (;;) {
      const buf = client.buffer;
      if (buf.length < 2) return;
      const fin = (buf[0] & 0x80) !== 0;
      const opcode = buf[0] & 0x0f;
      const masked = (buf[1] & 0x80) !== 0;
      let len = buf[1] & 0x7f;
      let offset = 2;

      if (len === 126) {
        if (buf.length < 4) return;
        len = buf.readUInt16BE(2);
        offset = 4;
      } else if (len === 127) {
        if (buf.length < 10) return;
        const big = buf.readBigUInt64BE(2);
        if (big > BigInt(MAX_FRAME)) { this._close(client, 1009); return; }
        len = Number(big);
        offset = 10;
      }
      if (len > MAX_FRAME) { this._close(client, 1009); return; }
      const maskLen = masked ? 4 : 0;
      if (buf.length < offset + maskLen + len) return;

      const mask = masked ? buf.subarray(offset, offset + 4) : null;
      let payload = Buffer.from(buf.subarray(offset + maskLen, offset + maskLen + len));
      if (mask) for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      client.buffer = buf.subarray(offset + maskLen + len);

      if (opcode === 0x8) { this._close(client, 1000); return; }
      if (opcode === 0x9) { this._send(client, payload, 0xa); continue; }
      if (opcode === 0xa) { client.alive = true; continue; }

      if (opcode === 0x0) {
        client.fragments.push(payload);
      } else {
        client.fragments = [payload];
        client.fragmentOpcode = opcode;
      }
      if (!fin) continue;

      const data = Buffer.concat(client.fragments);
      client.fragments = [];
      if (client.fragmentOpcode === 0x1) this._onMessage(client, data.toString('utf8'));
    }
  }

  _onMessage(client, text) {
    let msg;
    try {
      msg = JSON.parse(text);
    } catch {
      this._sendJSON(client, { t: 'error', code: 'BAD_MESSAGE', message: 'Message JSON invalide.' });
      return;
    }
    if (msg.t === 'hello') {
      const state = this.lastState.get(client.channel);
      if (state) this._sendJSON(client, state);
      this._sendJSON(client, { t: 'hello:ack', channel: client.channel, ts: Date.now() });
      return;
    }
    if (msg.t === 'ping') {
      this._sendJSON(client, { t: 'pong', ts: Date.now() });
      return;
    }
    // Diffusion : jamais renvoyée à son émetteur (EF-04.6).
    this.broadcast(client.channel, msg, { except: client });
    if (msg.t === 'show' || msg.t === 'clear' || msg.t === 'timer' || msg.t === 'plan') {
      this.lastState.set(client.channel, msg);
      // Les sorties filtrées par type partagent l'état de leur sortie parente.
      const parent = client.channel.replace(/_([a-z]+)$/, '');
      if (parent !== client.channel) this.lastState.set(parent, msg);
    }
  }

  broadcast(channel, message, { except = null } = {}) {
    for (const client of this.clients) {
      if (client.channel !== channel) continue;
      if (except && client === except) continue;
      this._sendJSON(client, message);
    }
  }

  broadcastAll(message, except = null) {
    for (const client of this.clients) {
      if (except && client === except) continue;
      this._sendJSON(client, message);
    }
  }

  /** Envoi serveur → sorties, avec mémorisation de l'état. */
  publish(channel, message) {
    if (message.t === 'show' || message.t === 'clear') this.lastState.set(channel, message);
    this.broadcast(channel, message);
  }

  stats() {
    const byChannel = {};
    for (const c of this.clients) byChannel[c.channel] = (byChannel[c.channel] || 0) + 1;
    return { clients: this.clients.size, channels: byChannel };
  }

  _sendJSON(client, obj) {
    this._send(client, Buffer.from(JSON.stringify(obj), 'utf8'), 0x1);
  }

  _send(client, payload, opcode = 0x1) {
    const { socket } = client;
    if (!socket.writable) return;
    const len = payload.length;
    let header;
    if (len < 126) {
      header = Buffer.from([0x80 | opcode, len]);
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | opcode;
      header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | opcode;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }
    try {
      socket.write(Buffer.concat([header, payload]));
    } catch {
      this.clients.delete(client);
    }
  }

  _close(client, code) {
    const payload = Buffer.alloc(2);
    payload.writeUInt16BE(code, 0);
    this._send(client, payload, 0x8);
    client.socket.end();
    this.clients.delete(client);
  }

  closeAll() {
    for (const c of this.clients) {
      try { this._close(c, 1001); } catch { /* ignore */ }
    }
    this.clients.clear();
  }
}

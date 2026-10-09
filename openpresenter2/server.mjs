#!/usr/bin/env node
// Offline-first static server with a tiny same-LAN WebSocket relay for OBS and
// the phone remote. No cloud account or external service is involved.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = HERE;
const APP_PREFIX = '/openpresenter2';
const PORT = Math.max(1, Number(process.env.PORT) || 8788);
const MAX_FRAME_BYTES = 64 * 1024 * 1024;
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MIME = {
  '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain; charset=utf-8',
};
const peersByChannel = new Map();
const baseHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
};

function closeSocket(socket, code = 1000, reason = '') {
  if (socket.destroyed) return;
  const text = Buffer.from(String(reason).slice(0, 80));
  const payload = Buffer.alloc(2 + text.length);
  payload.writeUInt16BE(code, 0); text.copy(payload, 2);
  socket.write(encodeFrame(8, payload));
  socket.end();
}
function encodeFrame(opcode, payload) {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  let header;
  if (body.length < 126) {
    header = Buffer.from([0x80 | opcode, body.length]);
  } else if (body.length <= 0xffff) {
    header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 126; header.writeUInt16BE(body.length, 2);
  } else {
    header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 127; header.writeBigUInt64BE(BigInt(body.length), 2);
  }
  return Buffer.concat([header, body]);
}
function parseFrame(client) {
  const buffer = client.buffer;
  if (buffer.length < 2) return null;
  const first = buffer[0]; const second = buffer[1];
  if (first & 0x70) throw new Error('WebSocket extensions are not negotiated.');
  const fin = !!(first & 0x80); const opcode = first & 0x0f; const masked = !!(second & 0x80);
  let length = second & 0x7f; let offset = 2;
  if (length === 126) { if (buffer.length < 4) return null; length = buffer.readUInt16BE(2); offset = 4; }
  else if (length === 127) {
    if (buffer.length < 10) return null;
    const wideLength = buffer.readBigUInt64BE(2);
    if (wideLength > BigInt(MAX_FRAME_BYTES)) throw new Error('WebSocket frame too large.');
    length = Number(wideLength); offset = 10;
  }
  if (!masked) throw new Error('Client WebSocket frames must be masked.');
  if (length > MAX_FRAME_BYTES) throw new Error('WebSocket frame too large.');
  if (buffer.length < offset + 4 + length) return null;
  const mask = buffer.subarray(offset, offset + 4); offset += 4;
  const payload = Buffer.from(buffer.subarray(offset, offset + length));
  for (let index = 0; index < payload.length; index += 1) payload[index] ^= mask[index & 3];
  client.buffer = buffer.subarray(offset + length);
  return { fin, opcode, payload };
}
function removePeer(client) {
  if (client.closed) return;
  client.closed = true;
  const group = peersByChannel.get(client.channel);
  if (group) { group.delete(client); if (!group.size) peersByChannel.delete(client.channel); }
}
function relayMessage(client, payload) {
  let packet;
  try { packet = JSON.parse(payload.toString('utf8')); }
  catch { closeSocket(client.socket, 1007, 'Invalid JSON'); return; }
  if (!packet || packet.channel !== client.channel || !Object.hasOwn(packet, 'payload')) return;
  const frame = encodeFrame(1, JSON.stringify(packet));
  for (const peer of peersByChannel.get(client.channel) || []) {
    if (peer !== client && !peer.socket.destroyed) peer.socket.write(frame);
  }
}
function processFrames(client) {
  while (true) {
    const frame = parseFrame(client);
    if (!frame) return;
    const { fin, opcode, payload } = frame;
    if (opcode === 8) { closeSocket(client.socket, 1000); return; }
    if (opcode === 9) { client.socket.write(encodeFrame(10, payload)); continue; }
    if (opcode === 10) continue;
    if (opcode === 1 || opcode === 2) {
      if (client.fragmentOpcode) { closeSocket(client.socket, 1002, 'Unexpected new message'); return; }
      if (fin) { if (opcode === 1) relayMessage(client, payload); }
      else { client.fragmentOpcode = opcode; client.fragments = [payload]; }
      continue;
    }
    if (opcode === 0) {
      if (!client.fragmentOpcode) { closeSocket(client.socket, 1002, 'Unexpected continuation'); return; }
      client.fragments.push(payload);
      if (client.fragments.reduce((size, part) => size + part.length, 0) > MAX_FRAME_BYTES) { closeSocket(client.socket, 1009, 'Message too large'); return; }
      if (fin) {
        const complete = Buffer.concat(client.fragments);
        if (client.fragmentOpcode === 1) relayMessage(client, complete);
        client.fragmentOpcode = 0; client.fragments = [];
      }
      continue;
    }
    closeSocket(client.socket, 1002, 'Unsupported opcode'); return;
  }
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  if (requestUrl.pathname === '/health') {
    response.writeHead(200, { ...baseHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify({ name: 'OpenPresenter 2', relay: true })); return;
  }
  if (requestUrl.pathname === '/') {
    response.writeHead(302, { ...baseHeaders, Location: `${APP_PREFIX}/` }); response.end(); return;
  }
  if (requestUrl.pathname === APP_PREFIX) {
    response.writeHead(308, { ...baseHeaders, Location: `${APP_PREFIX}/` }); response.end(); return;
  }
  let decoded;
  try { decoded = decodeURIComponent(requestUrl.pathname); }
  catch { response.writeHead(400, baseHeaders); response.end('Bad path'); return; }
  if (!decoded.startsWith(`${APP_PREFIX}/`)) {
    response.writeHead(404, { ...baseHeaders, 'Content-Type': 'text/plain; charset=utf-8' }); response.end('404 — Fichier introuvable'); return;
  }
  const relativePath = decoded.slice(APP_PREFIX.length + 1);
  if (decoded.includes('\0') || decoded.split('/').some((part) => part === '..' || part === '.git' || part === 'node_modules')) {
    response.writeHead(403, baseHeaders); response.end('Forbidden'); return;
  }
  let target = path.resolve(ROOT, relativePath || '.');
  if (target !== ROOT && !target.startsWith(`${ROOT}${path.sep}`)) { response.writeHead(403, baseHeaders); response.end('Forbidden'); return; }
  try {
    const realTarget = await fs.realpath(target);
    if (realTarget !== ROOT && !realTarget.startsWith(`${ROOT}${path.sep}`)) throw new Error('Outside root');
    const stat = await fs.stat(realTarget);
    if (stat.isDirectory()) { target = path.join(realTarget, 'index.html'); }
    else target = realTarget;
    const file = await fs.readFile(target);
    const contentType = MIME[path.extname(target).toLowerCase()] || 'application/octet-stream';
    response.writeHead(200, { ...baseHeaders, 'Content-Type': contentType, 'Content-Length': file.length, 'Cache-Control': 'no-cache' });
    response.end(file);
  } catch {
    response.writeHead(404, { ...baseHeaders, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end('404 — Fichier introuvable');
  }
});

server.on('upgrade', (request, socket, head) => {
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
  const channel = requestUrl.searchParams.get('channel') || '';
  const key = request.headers['sec-websocket-key'];
  const origin = request.headers.origin;
  const originHost = origin ? (() => { try { return new URL(origin).host; } catch { return ''; } })() : request.headers.host;
  if (requestUrl.pathname !== '/ws' || !/^[\w.-]{1,100}$/.test(channel) || !key || originHost !== request.headers.host) {
    socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); socket.destroy(); return;
  }
  const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  socket.write([
    'HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${accept}`, '\r\n',
  ].join('\r\n'));
  const client = { socket, channel, buffer: Buffer.alloc(0), fragments: [], fragmentOpcode: 0, closed: false };
  if (!peersByChannel.has(channel)) peersByChannel.set(channel, new Set());
  peersByChannel.get(channel).add(client);
  socket.on('data', (chunk) => {
    client.buffer = Buffer.concat([client.buffer, chunk]);
    if (client.buffer.length > MAX_FRAME_BYTES + 14) { closeSocket(socket, 1009, 'Message too large'); return; }
    try { processFrames(client); } catch { closeSocket(socket, 1002, 'Malformed frame'); }
  });
  socket.on('close', () => removePeer(client));
  socket.on('error', () => removePeer(client));
  if (head?.length) { client.buffer = Buffer.concat([client.buffer, head]); try { processFrames(client); } catch { closeSocket(socket, 1002, 'Malformed frame'); } }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`OpenPresenter 2 prêt sur http://0.0.0.0:${PORT}/openpresenter2/`);
  console.log('Relais WebSocket local actif sur /ws — ouvrez ce port uniquement sur un réseau de confiance.');
});

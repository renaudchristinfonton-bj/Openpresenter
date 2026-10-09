import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

async function unusedPort() {
  const socket = net.createServer();
  await new Promise((resolve, reject) => socket.once('error', reject).listen(0, '127.0.0.1', resolve));
  const { port } = socket.address();
  await new Promise((resolve) => socket.close(resolve));
  return port;
}
function waitForOpen(socket) {
  return new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
}

test('offline server serves the V2 app and relays only within a WebSocket channel', async (t) => {
  const port = await unusedPort();
  const serverPath = fileURLToPath(new URL('../server.mjs', import.meta.url));
  const child = spawn(process.execPath, [serverPath], { env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  child.stdout.on('data', (chunk) => { log += chunk.toString(); });
  child.stderr.on('data', (chunk) => { log += chunk.toString(); });
  const ready = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Server did not start: ${log}`)), 5000);
    const check = () => { if (log.includes('prêt sur')) { clearTimeout(timeout); resolve(); } };
    child.stdout.on('data', check); child.stderr.on('data', check);
    child.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Server exited (${code}): ${log}`)); });
  });
  const sockets = [];
  t.after(async () => {
    for (const socket of sockets) { try { socket.close(); } catch { /* closed */ } }
    child.kill('SIGTERM');
    await new Promise((resolve) => child.once('exit', resolve));
  });
  await ready;

  const health = await fetch(`http://127.0.0.1:${port}/health`).then((response) => response.json());
  assert.equal(health.relay, true);
  const page = await fetch(`http://127.0.0.1:${port}/openpresenter2/index.html`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /OpenPresenter Studio/);
  const legacy = await fetch(`http://127.0.0.1:${port}/servergestionobs/vue_pasteur.html`);
  assert.equal(legacy.status, 404, 'the V2 server must not expose the legacy application tree');

  const one = new WebSocket(`ws://127.0.0.1:${port}/ws?channel=smoke`);
  const two = new WebSocket(`ws://127.0.0.1:${port}/ws?channel=smoke`);
  const isolated = new WebSocket(`ws://127.0.0.1:${port}/ws?channel=other`);
  sockets.push(one, two, isolated);
  await Promise.all([waitForOpen(one), waitForOpen(two), waitForOpen(isolated)]);
  const received = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Relay did not deliver a same-channel message')), 1500);
    two.addEventListener('message', (event) => { clearTimeout(timeout); resolve(JSON.parse(event.data)); }, { once: true });
  });
  one.send(JSON.stringify({ channel: 'smoke', payload: { action: 'show', text: 'Jean 3:16' } }));
  assert.deepEqual(await received, { channel: 'smoke', payload: { action: 'show', text: 'Jean 3:16' } });
  assert.equal(isolated.readyState, WebSocket.OPEN, 'a different channel remains connected but isolated');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('../js/remote-channel.js', import.meta.url)), 'utf8');

test('remote channel deduplicates one command delivered over BroadcastChannel and WebSocket', async () => {
  const buses = new Map();
  const sockets = [];
  class FakeBroadcastChannel {
    constructor(name) {
      this.name = name;
      this.onmessage = null;
      if (!buses.has(name)) buses.set(name, new Set());
      buses.get(name).add(this);
    }
    postMessage(data) {
      for (const peer of buses.get(this.name) || []) {
        if (peer !== this) peer.onmessage?.({ data: structuredClone(data) });
      }
    }
    close() { this.closed = true; buses.get(this.name)?.delete(this); }
  }
  class FakeWebSocket {
    constructor(url) { this.url = url; this.sent = []; this.closed = false; sockets.push(this); }
    send(data) { this.sent.push(data); }
    close() { this.closed = true; this.onclose?.(); }
  }
  let id = 0;
  const context = {
    window: null,
    document: { getElementById: () => null },
    location: { protocol: 'http:', host: 'openpresenter.local:8788' },
    BroadcastChannel: FakeBroadcastChannel,
    WebSocket: FakeWebSocket,
    crypto: { randomUUID: () => `packet-${++id}` },
    setTimeout,
    clearTimeout,
    structuredClone,
    Blob,
    Math,
    Date,
  };
  context.window = context;
  runInNewContext(source, context);

  const sender = new context.RemoteChannel('op_channel_main');
  const receiver = new context.RemoteChannel('op_channel_main');
  const received = [];
  receiver.onmessage = (event) => received.push(event.data);
  const senderSocket = sockets[0];
  const receiverSocket = sockets[1];
  senderSocket.onopen(); receiverSocket.onopen();

  const command = { action: 'remoteCommand', command: 'next', scene: 'main' };
  sender.postMessage(command);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(received.length, 1, 'the local BroadcastChannel copy is delivered once');
  receiverSocket.onmessage({ data: senderSocket.sent[0] });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(received.length, 1, 'the matching WebSocket copy is discarded');
  assert.equal(received[0].command, 'next');

  sender.postMessage(command);
  await new Promise((resolve) => setTimeout(resolve, 0));
  receiverSocket.onmessage({ data: senderSocket.sent[1] });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(received.length, 2, 'a second intentional press has its own ID and is not discarded');
  sender.close();
  assert.equal(sender._closed, true);
  assert.equal(sender._bc.closed, true);
  assert.equal(senderSocket.closed, true);
  senderSocket.onclose?.();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(sockets.length, 2, 'a closed output channel never reconnects');
  receiver.close();
});

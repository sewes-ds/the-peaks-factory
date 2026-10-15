import { randomBytes } from 'node:crypto';
import { connect } from 'node:net';

function encodeFrame(text, opcode = 1) {
  const payload = Buffer.from(text);
  const mask = randomBytes(4);
  const header = payload.length < 126
    ? Buffer.alloc(2)
    : payload.length <= 0xffff
      ? Buffer.alloc(4)
      : Buffer.alloc(10);
  header[0] = 0x80 | opcode;
  if (payload.length < 126) header[1] = 0x80 | payload.length;
  else if (payload.length <= 0xffff) {
    header[1] = 0x80 | 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  const masked = Buffer.alloc(payload.length);
  for (let index = 0; index < payload.length; index += 1) {
    masked[index] = payload[index] ^ mask[index % 4];
  }
  return Buffer.concat([header, mask, masked]);
}

export async function connectCdp(webSocketUrl) {
  const parsed = new URL(webSocketUrl);
  const socket = connect(Number(parsed.port), parsed.hostname);
  await new Promise((resolveConnect, rejectConnect) => {
    socket.once('connect', resolveConnect);
    socket.once('error', rejectConnect);
  });
  const key = randomBytes(16).toString('base64');
  socket.write([
    `GET ${parsed.pathname}${parsed.search} HTTP/1.1`,
    `Host: ${parsed.host}`,
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Key: ${key}`,
    'Sec-WebSocket-Version: 13',
    '\r\n',
  ].join('\r\n'));
  let buffer = Buffer.alloc(0);
  await new Promise((resolveHandshake, rejectHandshake) => {
    const onData = (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      const boundary = buffer.indexOf('\r\n\r\n');
      if (boundary < 0) return;
      socket.off('data', onData);
      const response = buffer.subarray(0, boundary).toString();
      buffer = buffer.subarray(boundary + 4);
      if (response.startsWith('HTTP/1.1 101')) resolveHandshake();
      else rejectHandshake(new Error(response));
    };
    socket.on('data', onData);
    socket.once('error', rejectHandshake);
  });

  let nextId = 1;
  const pending = new Map();
  const listeners = [];
  const eventWaiters = [];
  let fragmented = Buffer.alloc(0);
  let fragmentedOpcode = 0;
  function dispatch(message) {
    if (message.id !== undefined) {
      const waiter = pending.get(message.id);
      if (waiter) {
        pending.delete(message.id);
        if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
        else waiter.resolve(message.result);
      }
      return;
    }
    for (const listener of listeners) listener(message);
    const index = eventWaiters.findIndex((waiter) => waiter.method === message.method);
    if (index >= 0) eventWaiters.splice(index, 1)[0].resolve(message.params);
  }
  function frames(chunk = Buffer.alloc(0)) {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 2) {
      const final = (buffer[0] & 0x80) !== 0;
      const opcode = buffer[0] & 0x0f;
      const masked = (buffer[1] & 0x80) !== 0;
      let length = buffer[1] & 0x7f;
      let offset = 2;
      if (length === 126) {
        if (buffer.length < 4) return;
        length = buffer.readUInt16BE(2);
        offset = 4;
      } else if (length === 127) {
        if (buffer.length < 10) return;
        length = Number(buffer.readBigUInt64BE(2));
        offset = 10;
      }
      const maskBytes = masked ? 4 : 0;
      if (buffer.length < offset + maskBytes + length) return;
      const mask = masked ? buffer.subarray(offset, offset + 4) : null;
      offset += maskBytes;
      const payload = Buffer.from(buffer.subarray(offset, offset + length));
      buffer = buffer.subarray(offset + length);
      if (mask) {
        for (let index = 0; index < payload.length; index += 1) payload[index] ^= mask[index % 4];
      }
      if (opcode === 8) return;
      if (opcode === 9) {
        socket.write(encodeFrame(payload.toString(), 10));
        continue;
      }
      if (opcode === 1 && final) {
        dispatch(JSON.parse(payload.toString()));
        continue;
      }
      if (opcode === 1) {
        fragmentedOpcode = opcode;
        fragmented = payload;
        continue;
      }
      if (opcode === 0) {
        fragmented = Buffer.concat([fragmented, payload]);
        if (final && fragmentedOpcode === 1) dispatch(JSON.parse(fragmented.toString()));
        if (final) {
          fragmented = Buffer.alloc(0);
          fragmentedOpcode = 0;
        }
      }
    }
  }
  socket.on('data', frames);
  if (buffer.length) frames();

  return {
    command(method, params = {}) {
      const id = nextId++;
      return new Promise((resolveCommand, rejectCommand) => {
        const timeout = setTimeout(() => {
          pending.delete(id);
          rejectCommand(new Error(`CDP timeout: ${method}`));
        }, 15_000);
        pending.set(id, {
          resolve: (value) => {
            clearTimeout(timeout);
            resolveCommand(value);
          },
          reject: (error) => {
            clearTimeout(timeout);
            rejectCommand(error);
          },
        });
        socket.write(encodeFrame(JSON.stringify({ id, method, params })));
      });
    },
    wait(method) {
      return new Promise((resolveEvent, rejectEvent) => {
        const timeout = setTimeout(() => rejectEvent(new Error(`CDP event timeout: ${method}`)), 15_000);
        eventWaiters.push({
          method,
          resolve: (value) => {
            clearTimeout(timeout);
            resolveEvent(value);
          },
        });
      });
    },
    on(listener) {
      listeners.push(listener);
    },
    close() {
      socket.end(encodeFrame('', 8));
    },
  };
}

export async function waitHttp(url) {
  for (let count = 0; count < 200; count += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {}
    await new Promise((done) => setTimeout(done, 50));
  }
  throw new Error(`Timed out: ${url}`);
}

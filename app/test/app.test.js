import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Duplex } from 'node:stream';
import { createApp } from '../src/app.js';

const notes = [];
let nextId = 1;
let failing = false;
const pool = {
  async query(sql, params = []) {
    if (failing) throw new Error('secret database detail');
    if (sql === 'SELECT 1') return { rows: [{ '?column?': 1 }] };
    if (sql.startsWith('SELECT * FROM notes ORDER')) return { rows: [...notes] };
    if (sql.startsWith('INSERT')) {
      const note = { id: nextId++, title: params[0], content: params[1], created_at: 'now', updated_at: 'now' };
      notes.push(note);
      return { rows: [note] };
    }
    if (sql.startsWith('SELECT * FROM notes WHERE')) return { rows: notes.filter((n) => n.id === params[0]) };
    if (sql.startsWith('UPDATE')) {
      const note = notes.find((n) => n.id === params[2]);
      if (!note) return { rows: [] };
      Object.assign(note, { title: params[0], content: params[1], updated_at: 'later' });
      return { rows: [note] };
    }
    if (sql.startsWith('DELETE')) {
      const index = notes.findIndex((n) => n.id === params[0]);
      if (index < 0) return { rowCount: 0 };
      notes.splice(index, 1);
      return { rowCount: 1 };
    }
    throw new Error(`Unexpected query: ${sql}`);
  },
};

const app = createApp(pool);

test('serves the Folio page and assets over HTTP', async () => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  try {
    for (const [path, contentType] of [
      ['/', /^text\/html(?:;|$)/],
      ['/styles.css', /^text\/css(?:;|$)/],
      ['/app.js', /^(?:text|application)\/javascript(?:;|$)/],
    ]) {
      const response = await fetch(`http://127.0.0.1:${port}${path}`);
      assert.equal(response.status, 200, path);
      assert.match(response.headers.get('content-type') || '', contentType, path);
      assert.ok((await response.text()).length > 0, path);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

async function request(path, { method = 'GET', headers = {}, body } = {}) {
  const socket = new Duplex({ read() {}, write(_chunk, _encoding, callback) { callback(); } });
  const req = new IncomingMessage(socket);
  req.method = method;
  req.url = path;
  req.headers = Object.fromEntries(new Headers(headers));
  if (body !== undefined) {
    const buffer = Buffer.from(body);
    req.headers['content-length'] = String(buffer.length);
    req.push(buffer);
  }
  req.push(null);

  const res = new ServerResponse(req);
  let responseBody = '';
  return new Promise((resolve) => {
    const finish = () => resolve(new Response(responseBody || null, { status: res.statusCode, headers: res.getHeaders() }));
    res.end = (chunk) => {
      if (chunk) responseBody += chunk.toString();
      finish();
      return res;
    };
    app.handle(req, res, finish);
  });
}

test('health checks database connectivity and reports unavailable cleanly', async () => {
  assert.equal((await request('/health')).status, 200);
  failing = true;
  const response = await request('/health');
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: 'error', database: 'unavailable' });
  failing = false;
});

test('notes CRUD works and invalid input and database errors are safe', async () => {
  const created = await request('/notes', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: ' First ', content: 'content' }),
  });
  assert.equal(created.status, 201);
  const note = await created.json();
  assert.equal(note.title, 'First');
  assert.equal((await (await request('/notes')).json()).length, 1);
  assert.equal((await request(`/notes/${note.id}`)).status, 200);
  assert.equal((await request('/notes/nope')).status, 400);

  const bad = await request('/notes', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: ' ', content: 'x' }),
  });
  assert.equal(bad.status, 400);

  const updated = await request(`/notes/${note.id}`, {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'Updated', content: 'new' }),
  });
  assert.equal((await updated.json()).title, 'Updated');
  assert.equal((await request('/notes/99')).status, 404);
  assert.equal((await request(`/notes/${note.id}`, { method: 'DELETE' })).status, 204);
  assert.equal((await request(`/notes/${note.id}`)).status, 404);
  assert.equal((await request('/notes/99', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'x', content: 'x' }) })).status, 404);
  assert.equal((await request('/notes/99', { method: 'DELETE' })).status, 404);

  failing = true;
  const error = await request('/notes');
  assert.equal(error.status, 500);
  assert.deepEqual(await error.json(), { error: 'internal server error' });
  failing = false;
});

test('malformed JSON is rejected', async () => {
  const response = await request('/notes', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{',
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: 'invalid JSON body' });
});

test('oversized JSON is rejected', async () => {
  const response = await request('/notes', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'x', content: 'x'.repeat(33 * 1024) }),
  });
  assert.equal(response.status, 413);
});

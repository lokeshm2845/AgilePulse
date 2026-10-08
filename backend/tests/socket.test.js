/**
 * Real-time sync (FR-20 / NFR-01): when a Developer moves a card, every
 * connected client must receive a 'taskUpdated' event within 1.5 s.
 */
const http = require('http');
const request = require('supertest');
const { io: ioClient } = require('socket.io-client');
const { app, connect, close, loginAs, auth } = require('./helpers');
const socketService = require('../services/socketService');
const Task = require('../models/Task');

let server;
let url;

beforeAll(async () => {
  await connect();
  server = http.createServer(app);
  socketService.init(server);
  await new Promise((resolve) => server.listen(0, resolve));
  url = `http://localhost:${server.address().port}`;
});

afterAll(async () => {
  socketService.getIO().close();
  await new Promise((resolve) => server.close(resolve));
  await close();
});

test('all connected clients receive taskUpdated within 1.5 s of a move', async () => {
  const dev = await loginAs('DEV');
  const task = await Task.create({ title: 'Realtime card' });

  // Two logged-in "team members" with the board open
  const opts = { transports: ['websocket'], auth: { token: dev.token } };
  const clients = [ioClient(url, opts), ioClient(url, opts)];
  await Promise.all(clients.map((c) => new Promise((resolve) => c.on('connect', resolve))));

  const received = clients.map(
    (c) =>
      new Promise((resolve) => {
        c.on('taskUpdated', (payload) => resolve({ payload, at: Date.now() }));
      })
  );

  const sentAt = Date.now();
  const res = await request(server).put(`/api/tasks/${task._id}`).set(auth(dev.token)).send({ status: 'In Progress' });
  expect(res.status).toBe(200);

  const results = await Promise.all(received);
  results.forEach(({ payload, at }) => {
    expect(payload._id).toBe(String(task._id));
    expect(payload.status).toBe('In Progress');
    expect(at - sentAt).toBeLessThan(1500);
  });

  clients.forEach((c) => c.close());
});

test('a socket without a valid JWT is rejected', async () => {
  const anon = ioClient(url, { transports: ['websocket'], reconnection: false });
  const err = await new Promise((resolve) => anon.on('connect_error', resolve));
  expect(err.message).toBe('Unauthorized');
  anon.close();
});

test('a socket can authenticate with the login cookie', async () => {
  const dev = await loginAs('DEV');
  const client = ioClient(url, { transports: ['websocket'], extraHeaders: { cookie: `token=${dev.token}` } });
  await new Promise((resolve, reject) => {
    client.on('connect', resolve);
    client.on('connect_error', reject);
  });
  expect(client.connected).toBe(true);
  client.close();
});

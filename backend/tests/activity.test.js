/**
 * Activity log viewer (FR-24 / FR-25) and live presence.
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

test('GET /api/activity returns newest-first log entries with the user name', async () => {
  const dev = await loginAs('DEV');
  const task = await Task.create({ title: 'Logged card' });
  await request(app).put(`/api/tasks/${task._id}`).set(auth(dev.token)).send({ status: 'In Progress' });

  const res = await request(app).get('/api/activity?limit=5').set(auth(dev.token));
  expect(res.status).toBe(200);
  expect(res.body[0]).toMatchObject({ action: 'TASK_MOVED', userId: { name: dev.user.name } });
  expect(res.body[0].timestamp).toBeDefined();
});

test('GET /api/activity requires a token', async () => {
  expect((await request(app).get('/api/activity')).status).toBe(401);
});

test('connected clients receive live activity and presence events', async () => {
  const dev = await loginAs('DEV');
  const client = ioClient(url, { transports: ['websocket'], auth: { token: dev.token } });

  const presence = new Promise((resolve) => {
    client.on('presence', (users) => {
      if (users.some((u) => u.name === dev.user.name)) resolve(users);
    });
  });
  await new Promise((resolve) => client.on('connect', resolve));
  const users = await presence;
  expect(users.find((u) => u.name === dev.user.name).role).toBe('DEV');

  // presence:get returns the current list on demand
  const again = new Promise((resolve) => client.once('presence', resolve));
  client.emit('presence:get');
  expect((await again).length).toBeGreaterThan(0);

  const activity = new Promise((resolve) => client.on('activity', resolve));
  const task = await Task.create({ title: 'Live feed card' });
  await request(server).put(`/api/tasks/${task._id}`).set(auth(dev.token)).send({ status: 'In Progress' });

  const entry = await activity;
  expect(entry.action).toBe('TASK_MOVED');
  expect(entry.userId.name).toBe(dev.user.name);
  expect(entry.details).toMatch(/Live feed card/);

  client.close();
});

const request = require('supertest');
const { app, connect, clear, close, loginAs, auth } = require('./helpers');
const { validateTransition } = require('../utils/workflow');
const Task = require('../models/Task');

// ---------- Unit tests: pure workflow function ----------
describe('validateTransition() - unit', () => {
  test.each([
    ['To-Do', 'In Progress'],
    ['In Progress', 'Review'],
    ['Review', 'Done'],
  ])('%s → %s is VALID', (from, to) => {
    expect(validateTransition(from, to)).toBe(true);
  });

  test.each([
    ['To-Do', 'Done'], // skipping stages
    ['To-Do', 'Review'],
    ['In Progress', 'Done'],
    ['In Progress', 'To-Do'], // backwards
    ['Review', 'In Progress'],
    ['Review', 'To-Do'],
    ['Done', 'Review'],
    ['Done', 'To-Do'],
    ['To-Do', 'To-Do'], // same column
    ['Unknown', 'Done'], // bad input
    ['To-Do', 'Archived'],
  ])('%s → %s is INVALID', (from, to) => {
    expect(validateTransition(from, to)).toBe(false);
  });
});

// ---------- Integration tests: PUT /api/tasks/:id ----------
describe('Workflow enforcement via PUT /api/tasks/:id', () => {
  let dev;
  let task;

  beforeAll(connect);
  afterAll(close);

  beforeEach(async () => {
    await clear();
    dev = await loginAs('DEV');
    task = await Task.create({ title: 'Build login page', storyPoints: 3 });
  });

  const move = (id, status, token = dev.token) => request(app).put(`/api/tasks/${id}`).set(auth(token)).send({ status });

  test('valid transition To-Do → In Progress returns 200', async () => {
    const res = await move(task._id, 'In Progress');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('In Progress');
    expect((await Task.findById(task._id)).status).toBe('In Progress'); // FR-19 persisted
  });

  test('invalid transition To-Do → Done returns 400', async () => {
    const res = await move(task._id, 'Done');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid workflow transition');
    expect((await Task.findById(task._id)).status).toBe('To-Do'); // unchanged
  });

  test('invalid backward transition In Progress → To-Do returns 400', async () => {
    await move(task._id, 'In Progress');
    const res = await move(task._id, 'To-Do');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Invalid workflow transition');
  });

  test('a card can travel the full path To-Do → In Progress → Review → Done', async () => {
    for (const status of ['In Progress', 'Review', 'Done']) {
      // eslint-disable-next-line no-await-in-loop
      const res = await move(task._id, status);
      expect(res.status).toBe(200);
    }
    expect((await Task.findById(task._id)).status).toBe('Done');
  });

  test('only Developers can move cards (PO gets 403)', async () => {
    const po = await loginAs('PO');
    const res = await move(task._id, 'In Progress', po.token);
    expect(res.status).toBe(403);
  });
});

const request = require('supertest');
const { app, connect, clear, close, loginAs, auth } = require('./helpers');
const Task = require('../models/Task');
const Sprint = require('../models/Sprint');

beforeAll(connect);
afterAll(close);

let sm;
let dev;
let po;

beforeEach(async () => {
  await clear();
  [sm, dev, po] = [await loginAs('SM'), await loginAs('DEV'), await loginAs('PO')];
});

describe('GET /api/tasks', () => {
  test('returns an array of tasks with assignee populated', async () => {
    await Task.create({ title: 'Task A', assignedTo: dev.user._id });
    await Task.create({ title: 'Task B' });

    const res = await request(app).get('/api/tasks').set(auth(dev.token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].assignedTo.name).toBe(dev.user.name);
  });

  test('filters by sprintId', async () => {
    const sprint = await Sprint.create({ name: 'S1', startDate: '2026-10-01', endDate: '2026-10-14', velocityCapacity: 20 });
    await Task.create({ title: 'In sprint', sprintId: sprint._id });
    await Task.create({ title: 'In backlog' });

    const res = await request(app).get(`/api/tasks?sprintId=${sprint._id}`).set(auth(dev.token));
    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('In sprint');
  });
});

describe('POST /api/tasks', () => {
  test('creates a task (201)', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set(auth(sm.token))
      .send({ title: 'Design Kanban UI', description: 'Four columns', storyPoints: 5, priority: 'High', assignedTo: dev.user._id });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: 'Design Kanban UI', status: 'To-Do', storyPoints: 5, priority: 'High' });
    expect(res.body.assignedTo.name).toBe(dev.user.name);
    expect(await Task.countDocuments()).toBe(1);
  });

  test('requires a title (400)', async () => {
    const res = await request(app).post('/api/tasks').set(auth(sm.token)).send({ storyPoints: 3 });
    expect(res.status).toBe(400);
  });

  test('rejects non-Fibonacci story points (400)', async () => {
    const res = await request(app).post('/api/tasks').set(auth(sm.token)).send({ title: 'X', storyPoints: 4 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/1, 2, 3, 5, 8, 13/);
  });

  test('developers cannot create tasks (403)', async () => {
    const res = await request(app).post('/api/tasks').set(auth(dev.token)).send({ title: 'X' });
    expect(res.status).toBe(403);
  });

  test('blocks a task that exceeds sprint capacity', async () => {
    const sprint = await Sprint.create({ name: 'S1', startDate: '2026-10-01', endDate: '2026-10-14', velocityCapacity: 5 });
    const ok = await request(app).post('/api/tasks').set(auth(sm.token)).send({ title: 'A', storyPoints: 3, sprintId: sprint._id });
    expect(ok.status).toBe(201);

    const res = await request(app).post('/api/tasks').set(auth(sm.token)).send({ title: 'B', storyPoints: 3, sprintId: sprint._id });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Sprint Capacity Exceeded/);
  });

  test('returns 404 for an unknown sprint', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .set(auth(sm.token))
      .send({ title: 'A', sprintId: '64b000000000000000000000' });
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/tasks/:id', () => {
  test('updates the status (drag-and-drop)', async () => {
    const task = await Task.create({ title: 'Move me' });
    const res = await request(app).put(`/api/tasks/${task._id}`).set(auth(dev.token)).send({ status: 'In Progress' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('In Progress');
  });

  test('PO/SM can edit task details', async () => {
    const task = await Task.create({ title: 'Old title' });
    const res = await request(app)
      .put(`/api/tasks/${task._id}`)
      .set(auth(po.token))
      .send({ title: 'New title', priority: 'Low', assignedTo: dev.user._id });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New title');
    expect(res.body.assignedTo.name).toBe(dev.user.name);
  });

  test('assignee can be cleared', async () => {
    const task = await Task.create({ title: 'T', assignedTo: dev.user._id });
    const res = await request(app).put(`/api/tasks/${task._id}`).set(auth(sm.token)).send({ assignedTo: '' });
    expect(res.body.assignedTo).toBeNull();
  });

  test('developers cannot edit task details (403)', async () => {
    const task = await Task.create({ title: 'T' });
    const res = await request(app).put(`/api/tasks/${task._id}`).set(auth(dev.token)).send({ title: 'Hacked' });
    expect(res.status).toBe(403);
  });

  test('re-checks capacity when story points grow', async () => {
    const sprint = await Sprint.create({ name: 'S1', startDate: '2026-10-01', endDate: '2026-10-14', velocityCapacity: 5 });
    const task = await Task.create({ title: 'T', storyPoints: 3, sprintId: sprint._id });
    const res = await request(app).put(`/api/tasks/${task._id}`).set(auth(sm.token)).send({ storyPoints: 8 });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Sprint Capacity Exceeded/);
  });

  test('returns 404 for a missing task', async () => {
    const res = await request(app).put('/api/tasks/64b000000000000000000000').set(auth(dev.token)).send({ status: 'Review' });
    expect(res.status).toBe(404);
  });

  test('returns 400 for a malformed id', async () => {
    const res = await request(app).put('/api/tasks/not-an-id').set(auth(dev.token)).send({ status: 'Review' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/tasks/:id', () => {
  test('removes the task', async () => {
    const task = await Task.create({ title: 'Delete me' });
    const res = await request(app).delete(`/api/tasks/${task._id}`).set(auth(sm.token));
    expect(res.status).toBe(200);
    expect(await Task.findById(task._id)).toBeNull();
  });

  test('returns 404 for a missing task', async () => {
    const res = await request(app).delete('/api/tasks/64b000000000000000000000').set(auth(sm.token));
    expect(res.status).toBe(404);
  });

  test('developers cannot delete tasks (403)', async () => {
    const task = await Task.create({ title: 'Keep me' });
    const res = await request(app).delete(`/api/tasks/${task._id}`).set(auth(dev.token));
    expect(res.status).toBe(403);
  });
});

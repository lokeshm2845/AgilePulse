const request = require('supertest');
const { app, connect, clear, close, loginAs, auth } = require('./helpers');
const Sprint = require('../models/Sprint');
const Task = require('../models/Task');

beforeAll(connect);
afterAll(close);

let sm;
let dev;

beforeEach(async () => {
  await clear();
  sm = await loginAs('SM');
  dev = await loginAs('DEV');
});

const sprintBody = { name: 'Sprint 1', startDate: '2026-10-01', endDate: '2026-10-14', velocityCapacity: 10 };
const newSprint = (overrides = {}) => Sprint.create({ ...sprintBody, ...overrides });

describe('Sprint CRUD', () => {
  test('SM creates a sprint (201) with status Planned', async () => {
    const res = await request(app).post('/api/sprints').set(auth(sm.token)).send(sprintBody);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Sprint 1', velocityCapacity: 10, status: 'Planned' });
  });

  test('only SM can create sprints (DEV gets 403)', async () => {
    const res = await request(app).post('/api/sprints').set(auth(dev.token)).send(sprintBody);
    expect(res.status).toBe(403);
  });

  test('missing fields return 400', async () => {
    const res = await request(app).post('/api/sprints').set(auth(sm.token)).send({ name: 'X' });
    expect(res.status).toBe(400);
  });

  test('end date before start date returns 400', async () => {
    const res = await request(app)
      .post('/api/sprints')
      .set(auth(sm.token))
      .send({ ...sprintBody, startDate: '2026-10-14', endDate: '2026-10-01' });
    expect(res.status).toBe(400);
  });

  test('GET lists sprints with committed points', async () => {
    const sprint = await newSprint();
    await Task.create({ title: 'A', storyPoints: 3, sprintId: sprint._id });
    await Task.create({ title: 'B', storyPoints: 5, sprintId: sprint._id });

    const res = await request(app).get('/api/sprints').set(auth(dev.token));
    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ committedPoints: 8, taskCount: 2 });
  });

  test('SM updates and closes a sprint (FR-15)', async () => {
    const sprint = await newSprint();
    const res = await request(app).put(`/api/sprints/${sprint._id}`).set(auth(sm.token)).send({ status: 'Completed' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Completed');
  });

  test('only one sprint can be Active (409)', async () => {
    await newSprint({ name: 'Running', status: 'Active' });
    const other = await newSprint({ name: 'Next' });
    const res = await request(app).put(`/api/sprints/${other._id}`).set(auth(sm.token)).send({ status: 'Active' });
    expect(res.status).toBe(409);
  });

  test('capacity cannot drop below committed points', async () => {
    const sprint = await newSprint();
    await Task.create({ title: 'A', storyPoints: 8, sprintId: sprint._id });
    const res = await request(app).put(`/api/sprints/${sprint._id}`).set(auth(sm.token)).send({ velocityCapacity: 5 });
    expect(res.status).toBe(400);
  });

  test('update / delete of a missing sprint returns 404', async () => {
    const id = '64b000000000000000000000';
    expect((await request(app).put(`/api/sprints/${id}`).set(auth(sm.token)).send({ name: 'x' })).status).toBe(404);
    expect((await request(app).delete(`/api/sprints/${id}`).set(auth(sm.token))).status).toBe(404);
  });

  test('deleting a sprint returns its stories to the backlog', async () => {
    const sprint = await newSprint();
    const task = await Task.create({ title: 'A', sprintId: sprint._id, status: 'Review' });

    const res = await request(app).delete(`/api/sprints/${sprint._id}`).set(auth(sm.token));
    expect(res.status).toBe(200);

    const after = await Task.findById(task._id);
    expect(after.sprintId).toBeNull();
    expect(after.status).toBe('To-Do');
  });
});

describe('Sprint planning & velocity cap (FR-13, FR-14)', () => {
  test('SM moves a backlog story into a sprint', async () => {
    const sprint = await newSprint();
    const story = await Task.create({ title: 'Story', storyPoints: 5 });

    const res = await request(app).post(`/api/sprints/${sprint._id}/tasks`).set(auth(sm.token)).send({ taskId: story._id });
    expect(res.status).toBe(200);
    expect(String(res.body.sprintId)).toBe(String(sprint._id));
  });

  test('adding a story that exceeds velocity capacity is BLOCKED', async () => {
    const sprint = await newSprint({ velocityCapacity: 10 });
    await Task.create({ title: 'Big', storyPoints: 8, sprintId: sprint._id });
    const story = await Task.create({ title: 'Too much', storyPoints: 3 });

    const res = await request(app).post(`/api/sprints/${sprint._id}/tasks`).set(auth(sm.token)).send({ taskId: story._id });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Sprint Capacity Exceeded/);
    expect((await Task.findById(story._id)).sprintId).toBeNull();
  });

  test('a story that exactly fills the capacity is allowed', async () => {
    const sprint = await newSprint({ velocityCapacity: 10 });
    await Task.create({ title: 'A', storyPoints: 5, sprintId: sprint._id });
    const story = await Task.create({ title: 'B', storyPoints: 5 });

    const res = await request(app).post(`/api/sprints/${sprint._id}/tasks`).set(auth(sm.token)).send({ taskId: story._id });
    expect(res.status).toBe(200);
  });

  test('cannot add to a completed sprint', async () => {
    const sprint = await newSprint({ status: 'Completed' });
    const story = await Task.create({ title: 'B' });
    const res = await request(app).post(`/api/sprints/${sprint._id}/tasks`).set(auth(sm.token)).send({ taskId: story._id });
    expect(res.status).toBe(400);
  });

  test('cannot add a story that is already in a sprint', async () => {
    const s1 = await newSprint();
    const s2 = await newSprint({ name: 'Sprint 2' });
    const story = await Task.create({ title: 'B', sprintId: s1._id });
    const res = await request(app).post(`/api/sprints/${s2._id}/tasks`).set(auth(sm.token)).send({ taskId: story._id });
    expect(res.status).toBe(400);
  });

  test('missing sprint or story returns 404', async () => {
    const sprint = await newSprint();
    const story = await Task.create({ title: 'B' });
    const missing = '64b000000000000000000000';
    expect((await request(app).post(`/api/sprints/${missing}/tasks`).set(auth(sm.token)).send({ taskId: story._id })).status).toBe(404);
    expect((await request(app).post(`/api/sprints/${sprint._id}/tasks`).set(auth(sm.token)).send({ taskId: missing })).status).toBe(404);
  });

  test('SM returns a story to the backlog', async () => {
    const sprint = await newSprint();
    const story = await Task.create({ title: 'B', sprintId: sprint._id, status: 'In Progress' });

    const res = await request(app).delete(`/api/sprints/${sprint._id}/tasks/${story._id}`).set(auth(sm.token));
    expect(res.status).toBe(200);
    expect((await Task.findById(story._id)).sprintId).toBeNull();

    const again = await request(app).delete(`/api/sprints/${sprint._id}/tasks/${story._id}`).set(auth(sm.token));
    expect(again.status).toBe(404);
  });
});

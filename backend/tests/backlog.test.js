const request = require('supertest');
const { app, connect, clear, close, loginAs, auth } = require('./helpers');
const Task = require('../models/Task');
const Sprint = require('../models/Sprint');

beforeAll(connect);
afterAll(close);

let po;
let dev;

beforeEach(async () => {
  await clear();
  po = await loginAs('PO');
  dev = await loginAs('DEV');
});

describe('Product Backlog', () => {
  test('PO adds a user story with Fibonacci points (201)', async () => {
    const res = await request(app)
      .post('/api/backlog')
      .set(auth(po.token))
      .send({ title: 'As a user I can log in', storyPoints: 8, priority: 'High' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ storyPoints: 8, priority: 'High', sprintId: null });
  });

  test('only PO can add stories (DEV gets 403)', async () => {
    const res = await request(app).post('/api/backlog').set(auth(dev.token)).send({ title: 'X' });
    expect(res.status).toBe(403);
  });

  test('title is required (400)', async () => {
    const res = await request(app).post('/api/backlog').set(auth(po.token)).send({ storyPoints: 3 });
    expect(res.status).toBe(400);
  });

  test('GET returns only backlog stories, sorted High > Medium > Low', async () => {
    const sprint = await Sprint.create({ name: 'S', startDate: '2026-10-01', endDate: '2026-10-14', velocityCapacity: 20 });
    await Task.create({ title: 'low', priority: 'Low' });
    await Task.create({ title: 'high', priority: 'High' });
    await Task.create({ title: 'medium', priority: 'Medium' });
    await Task.create({ title: 'planned', priority: 'High', sprintId: sprint._id });

    const res = await request(app).get('/api/backlog').set(auth(dev.token));
    expect(res.status).toBe(200);
    expect(res.body.map((s) => s.title)).toEqual(['high', 'medium', 'low']);
  });

  test('PO edits a story', async () => {
    const story = await Task.create({ title: 'Old', storyPoints: 2 });
    const res = await request(app).put(`/api/backlog/${story._id}`).set(auth(po.token)).send({ title: 'New', storyPoints: 13 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: 'New', storyPoints: 13 });
  });

  test('editing points of a planned story respects sprint capacity', async () => {
    const sprint = await Sprint.create({ name: 'S', startDate: '2026-10-01', endDate: '2026-10-14', velocityCapacity: 5 });
    const story = await Task.create({ title: 'A', storyPoints: 3, sprintId: sprint._id });

    const res = await request(app).put(`/api/backlog/${story._id}`).set(auth(po.token)).send({ storyPoints: 8 });
    expect(res.status).toBe(400);

    const ok = await request(app).put(`/api/backlog/${story._id}`).set(auth(po.token)).send({ storyPoints: 5 });
    expect(ok.status).toBe(200);
  });

  test('PO deletes a story', async () => {
    const story = await Task.create({ title: 'Bye' });
    const res = await request(app).delete(`/api/backlog/${story._id}`).set(auth(po.token));
    expect(res.status).toBe(200);
    expect(await Task.findById(story._id)).toBeNull();
  });

  test('deleting a planned story also works', async () => {
    const sprint = await Sprint.create({ name: 'S', startDate: '2026-10-01', endDate: '2026-10-14', velocityCapacity: 5 });
    const story = await Task.create({ title: 'Planned', sprintId: sprint._id });
    const res = await request(app).delete(`/api/backlog/${story._id}`).set(auth(po.token));
    expect(res.status).toBe(200);
  });

  test('edit / delete of a missing story returns 404', async () => {
    const id = '64b000000000000000000000';
    expect((await request(app).put(`/api/backlog/${id}`).set(auth(po.token)).send({ title: 'x' })).status).toBe(404);
    expect((await request(app).delete(`/api/backlog/${id}`).set(auth(po.token))).status).toBe(404);
  });
});

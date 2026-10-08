const request = require('supertest');
const jwt = require('jsonwebtoken');
const { app, connect, clear, close, loginAs, auth } = require('./helpers');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');

beforeAll(connect);
afterEach(clear);
afterAll(close);

const validUser = { name: 'Lokesh Magare', email: 'lokesh@agilepulse.test', password: 'secret123', role: 'PO' };

describe('POST /api/auth/register', () => {
  test('registers a user with valid data (201) and hashes the password', async () => {
    const res = await request(app).post('/api/auth/register').send(validUser);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: 'Lokesh Magare', email: 'lokesh@agilepulse.test', role: 'PO' });
    expect(res.body.user.passwordHash).toBeUndefined();

    const saved = await User.findOne({ email: validUser.email });
    expect(saved.passwordHash).not.toBe(validUser.password);
    expect(saved.passwordHash).toMatch(/^\$2[aby]\$10\$/); // bcrypt, 10 salt rounds
  });

  test('rejects an email that is already registered (409)', async () => {
    await request(app).post('/api/auth/register').send(validUser);
    const res = await request(app).post('/api/auth/register').send(validUser);

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already registered/i);
  });

  test('rejects missing fields (400)', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'x@y.com' });
    expect(res.status).toBe(400);
  });

  test('rejects a short password (400)', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...validUser, password: '123' });
    expect(res.status).toBe(400);
  });

  test('rejects an unknown role (400)', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...validUser, role: 'CEO' });
    expect(res.status).toBe(400);
  });

  test('defaults role to DEV', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...validUser, role: undefined });
    expect(res.body.user.role).toBe('DEV');
  });

  test('rejects an invalid email format (400)', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...validUser, email: 'not-an-email' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app).post('/api/auth/register').send(validUser);
  });

  test('logs in with correct credentials, returns JWT and sets HttpOnly cookie', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: validUser.email, password: validUser.password });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(jwt.verify(res.body.token, process.env.JWT_SECRET).role).toBe('PO');

    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/^token=/);
    expect(cookie).toMatch(/HttpOnly/i);

    const log = await ActivityLog.findOne({ action: 'LOGIN' });
    expect(log).not.toBeNull();
  });

  test('rejects a wrong password (401)', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: validUser.email, password: 'wrongpass' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  test('rejects a non-existent email (401)', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@agilepulse.test', password: 'whatever' });
    expect(res.status).toBe(401);
  });

  test('rejects missing credentials (400)', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
  });

  test('locks the account after 3 consecutive failed attempts (FR-06)', async () => {
    const bad = { email: validUser.email, password: 'wrong' };
    expect((await request(app).post('/api/auth/login').send(bad)).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send(bad)).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send(bad)).status).toBe(423);

    // Even the correct password is refused while locked
    const res = await request(app).post('/api/auth/login').send({ email: validUser.email, password: validUser.password });
    expect(res.status).toBe(423);
    expect(res.body.message).toMatch(/locked/i);
  });
});

describe('Auth middleware & session', () => {
  test('GET /api/auth/me works with the login cookie', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(validUser);
    await agent.post('/api/auth/login').send({ email: validUser.email, password: validUser.password });

    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(validUser.email);
  });

  test('missing token returns 401', async () => {
    const res = await request(app).get('/api/tasks');
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/no token/i);
  });

  test('invalid token returns 401', async () => {
    const res = await request(app).get('/api/tasks').set(auth('garbage.token.value'));
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid token/i);
  });

  test('expired token returns 401', async () => {
    const { user } = await loginAs('DEV');
    const expired = jwt.sign({ id: user._id, role: 'DEV' }, process.env.JWT_SECRET, { expiresIn: -10 });
    const res = await request(app).get('/api/tasks').set(auth(expired));
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/expired/i);
  });

  test('token for a deleted user returns 401', async () => {
    const { token, user } = await loginAs('DEV');
    await User.findByIdAndDelete(user._id);
    const res = await request(app).get('/api/tasks').set(auth(token));
    expect(res.status).toBe(401);
  });

  test('logout clears the cookie', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(validUser);
    await agent.post('/api/auth/login').send({ email: validUser.email, password: validUser.password });

    const res = await agent.post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie'][0]).toMatch(/token=;/);

    expect((await agent.get('/api/auth/me')).status).toBe(401);
    expect(await ActivityLog.findOne({ action: 'LOGOUT' })).not.toBeNull();
  });

  test('GET /api/auth/users lists users without password hashes', async () => {
    const { token } = await loginAs('SM');
    await loginAs('DEV');
    const res = await request(app).get('/api/auth/users').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body[0].passwordHash).toBeUndefined();
  });
});

describe('General', () => {
  test('health check is public', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });

  test('unknown route returns 404', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
  });
});

/**
 * Shared test helpers: an in-memory MongoDB (no Atlas needed) and quick
 * user/token creation for each role.
 */
const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
process.env.NODE_ENV = 'test';

const app = require('../app');

let mongod;

async function connect() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}

async function clear() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

async function close() {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

let counter = 0;

/** Register + login a user with the given role, returns { token, user } */
async function loginAs(role) {
  counter += 1;
  const email = `${role.toLowerCase()}${counter}@agilepulse.test`;
  const password = 'password123';
  await request(app).post('/api/auth/register').send({ name: `${role} User ${counter}`, email, password, role });
  const res = await request(app).post('/api/auth/login').send({ email, password });
  return { token: res.body.token, user: res.body.user };
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

module.exports = { app, connect, clear, close, loginAs, auth };

/**
 * Demo mode - runs the full API against a temporary in-memory MongoDB
 * pre-loaded with demo data. No Atlas account needed; data is lost on exit.
 *
 *   npm run demo        (API only - use with "npm run dev" in frontend/)
 *   npm run demo:prod   (production mode - also serves the built React app on :5000)
 */
require('dotenv').config();
if (process.argv.includes('--production')) process.env.NODE_ENV = 'production';
const { MongoMemoryServer } = require('mongodb-memory-server');

(async () => {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri('agilepulse');
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'demo_secret';
  console.log('Demo mode: using in-memory MongoDB (data is NOT saved)');

  require('./server'); // connects using the in-memory URI and starts listening

  // Seed once the connection is open
  const mongoose = require('mongoose');
  mongoose.connection.once('open', async () => {
    const { seed } = require('./seed');
    await seed();
  });

  const shutdown = async () => {
    await mongod.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
})();

/**
 * AgilePulse - server entry point
 * Loads env vars, connects to MongoDB, attaches Socket.IO and starts listening.
 */
require('dotenv').config();
const http = require('http');

const app = require('./app');
const connectDB = require('./config/db');
const socketService = require('./services/socketService');

const PORT = process.env.PORT || 5000;

/** Fail fast with a clear message instead of a cryptic driver error */
function checkEnv() {
  const problems = [];
  const uri = process.env.MONGO_URI || '';
  if (!uri) problems.push('MONGO_URI is missing');
  else if (uri.includes('<username>') || uri.includes('<password>') || uri.includes('xxxxx')) {
    problems.push('MONGO_URI still contains the placeholder - paste your real MongoDB Atlas connection string');
  }

  const secret = process.env.JWT_SECRET || '';
  if (!secret) problems.push('JWT_SECRET is missing');
  else if (process.env.NODE_ENV === 'production' && (secret.length < 32 || secret === 'super_secret_key_here')) {
    problems.push('JWT_SECRET is too weak for production - use at least 32 random characters');
  }

  if (problems.length) {
    console.error('\nConfiguration error(s) in .env:\n  - ' + problems.join('\n  - '));
    console.error('\nTip: run "npm run demo" to try the app without MongoDB Atlas.\n');
    process.exit(1);
  }
}

async function start() {
  checkEnv();
  await connectDB();

  const server = http.createServer(app);
  socketService.init(server);

  server.listen(PORT, () => {
    console.log(`AgilePulse running on http://localhost:${PORT} (${process.env.NODE_ENV || 'development'})`);
  });

  // Graceful shutdown (hosting platforms send SIGTERM on redeploy)
  const shutdown = () => {
    console.log('Shutting down...');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});

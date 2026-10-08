/**
 * SocketService - real-time board synchronisation (FR-20, NFR-01).
 * Controllers call socketService.emit(...) after a DB change; every connected
 * dashboard receives the event and updates its board.
 *
 * Only logged-in users may connect: the JWT is read from the same HttpOnly
 * cookie the REST API uses (or from `auth.token` for non-browser clients).
 */
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { allowedOrigins } = require('../config/origins');

let io = null;

// Keep test output clean
const log = (...args) => {
  if (process.env.NODE_ENV !== 'test') console.log(...args);
};

function tokenFromCookieHeader(header = '') {
  const match = header.split(';').map((c) => c.trim()).find((c) => c.startsWith('token='));
  return match ? decodeURIComponent(match.slice('token='.length)) : null;
}

function init(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: allowedOrigins(), credentials: true },
  });

  // Authenticate the socket handshake
  io.use((socket, next) => {
    const token = tokenFromCookieHeader(socket.handshake.headers.cookie) || socket.handshake.auth?.token;
    if (!token) return next(new Error('Unauthorized'));
    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      return next();
    } catch (err) {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    log(`Socket connected: ${socket.id} (user ${socket.user.id})`);
    // Pages that mount later can ask for the current list
    socket.on('presence:get', () => socket.emit('presence', [...online.values()].map((e) => e.user)));
    await userJoined(socket);

    socket.on('disconnect', (reason) => {
      log(`Socket disconnected: ${socket.id} (${reason})`);
      userLeft(socket);
    });
  });

  return io;
}

// ---- Presence: who is online right now (a user may have several tabs open) ----
const online = new Map(); // userId -> { user: {_id,name,role}, sockets: number }

function broadcastPresence() {
  emit('presence', [...online.values()].map((entry) => entry.user));
}

async function userJoined(socket) {
  const id = String(socket.user.id);
  if (!online.has(id)) {
    try {
      // Lazy require avoids a circular import at start-up
      const User = require('../models/User');
      const user = await User.findById(id).select('name role');
      online.set(id, { user: user ? { _id: id, name: user.name, role: user.role } : { _id: id, name: 'Unknown', role: '' }, sockets: 0 });
    } catch (err) {
      online.set(id, { user: { _id: id, name: 'Unknown', role: '' }, sockets: 0 });
    }
  }
  online.get(id).sockets += 1;
  broadcastPresence();
}

function userLeft(socket) {
  const id = String(socket.user.id);
  const entry = online.get(id);
  if (!entry) return;
  entry.sockets -= 1;
  if (entry.sockets <= 0) online.delete(id);
  broadcastPresence();
}

/**
 * Broadcast an event to all connected clients.
 * Safe to call when Socket.IO is not initialised (e.g. during tests).
 */
function emit(event, payload) {
  if (io) io.emit(event, payload);
}

function getIO() {
  return io;
}

module.exports = { init, emit, getIO };

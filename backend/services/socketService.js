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

  io.on('connection', (socket) => {
    log(`Socket connected: ${socket.id} (user ${socket.user.id})`);
    // Register every handler synchronously, before any await, so an early
    // disconnect can never be missed.
    socket.on('presence:get', () => socket.emit('presence', presenceList()));
    socket.on('disconnect', (reason) => {
      log(`Socket disconnected: ${socket.id} (${reason})`);
      userLeft(socket);
    });
    userJoined(socket);
  });

  return io;
}

// ---- Presence: who is online right now (a user may have several tabs open) ----
const online = new Map(); // userId -> { user: {_id,name,role}, sockets: number, ready: boolean }

const presenceList = () => [...online.values()].filter((e) => e.ready).map((e) => e.user);

function broadcastPresence() {
  emit('presence', presenceList());
}

function userJoined(socket) {
  const id = String(socket.user.id);
  let entry = online.get(id);
  if (entry) {
    // already known (another tab) - just count the extra connection
    entry.sockets += 1;
    if (entry.ready) broadcastPresence();
    return;
  }

  // Count the connection immediately (synchronously) so a quick disconnect
  // during the name lookup below cannot leave a "ghost" user online.
  entry = { user: { _id: id, name: '', role: socket.user.role }, sockets: 1, ready: false };
  online.set(id, entry);

  // Lazy require avoids a circular import at start-up
  const User = require('../models/User');
  User.findById(id)
    .select('name role')
    .then((user) => {
      entry.user = { _id: id, name: user ? user.name : 'Unknown', role: user ? user.role : '' };
    })
    .catch(() => {
      entry.user.name = 'Unknown';
    })
    .finally(() => {
      entry.ready = true;
      // only announce if the user is still connected
      if (online.get(id) === entry) broadcastPresence();
    });
}

function userLeft(socket) {
  const id = String(socket.user.id);
  const entry = online.get(id);
  if (!entry) return;
  entry.sockets -= 1;
  if (entry.sockets <= 0) {
    online.delete(id);
    if (entry.ready) broadcastPresence();
  }
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

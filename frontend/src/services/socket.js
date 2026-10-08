/**
 * Socket.IO client - receives real-time board updates (FR-20).
 * One shared connection for the whole app; components subscribe with
 * `subscribe(event, handler)` and get an unsubscribe function back.
 */
import { io } from 'socket.io-client';

// Dev: connect to the API on port 5000. Production: same domain as the page (undefined = current origin).
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (import.meta.env.DEV ? 'http://localhost:5000' : undefined);

const socket = io(SOCKET_URL, {
  autoConnect: false,
  withCredentials: true,
  reconnection: true, // NFR-11: automatic reconnect with back-off
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
});

export function connectSocket() {
  if (!socket.connected) socket.connect();
}

export function disconnectSocket() {
  if (socket.connected) socket.disconnect();
}

export function subscribe(event, handler) {
  socket.on(event, handler);
  return () => socket.off(event, handler);
}

export default socket;

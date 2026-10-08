/**
 * RealtimeContext - everything live that is shared across pages:
 *  - connection status (Live / Reconnecting)
 *  - who is online right now (presence)
 *  - the recent activity feed, with a toast when a teammate acts
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import socket, { subscribe } from '../services/socket';
import { activityApi } from '../services/api';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const RealtimeContext = createContext(null);

const MAX_FEED = 30;

export function RealtimeProvider({ children }) {
  const { user } = useAuth();
  const toast = useToast();
  const [connected, setConnected] = useState(socket.connected);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    if (!user) {
      setOnlineUsers([]);
      setActivity([]);
      return undefined;
    }

    const loadFeed = () => activityApi.list(MAX_FEED).then(setActivity).catch(() => {});
    loadFeed();

    const offs = [
      subscribe('connect', () => {
        setConnected(true);
        socket.emit('presence:get');
        loadFeed(); // catch up on anything missed while offline
      }),
      subscribe('disconnect', () => setConnected(false)),
      subscribe('presence', setOnlineUsers),
      subscribe('activity', (entry) => {
        setActivity((list) => [entry, ...list.filter((e) => e._id !== entry._id)].slice(0, MAX_FEED));
        const actor = entry.userId;
        if (actor && actor._id !== user._id && entry.action !== 'LOGIN' && entry.action !== 'LOGOUT') {
          toast.info(entry.details, { title: actor.name, actor: actor.name });
        }
      }),
    ];
    if (socket.connected) {
      setConnected(true);
      socket.emit('presence:get');
    }
    return () => offs.forEach((off) => off());
  }, [user, toast]);

  const value = useMemo(() => ({ connected, onlineUsers, activity }), [connected, onlineUsers, activity]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime must be used inside <RealtimeProvider>');
  return ctx;
}

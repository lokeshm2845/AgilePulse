/**
 * AuthContext - holds the logged-in user and exposes login / register / logout.
 * Also exports <ProtectedRoute> which redirects to /login when not signed in
 * and (optionally) restricts a page to certain roles.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { authApi, setUnauthorizedHandler } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true while we check the cookie on first load

  // Restore the session from the HttpOnly cookie on page refresh
  useEffect(() => {
    authApi
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // Open the real-time connection only while someone is logged in
  useEffect(() => {
    if (user) connectSocket();
    else disconnectSocket();
  }, [user]);

  // Any 401 from the API (e.g. token expired) logs the user out locally
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
  }, []);

  const login = useCallback(async (email, password, role) => {
    const data = await authApi.login(email, password, role);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback((data) => authApi.register(data), []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Wrap a route element: <ProtectedRoute roles={['SM']}><SprintManager/></ProtectedRoute> */
export function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-slate-500">Loading…</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/board" replace />;
  }
  return children;
}

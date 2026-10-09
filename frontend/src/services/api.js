/**
 * API service layer - every HTTP call to the AgilePulse backend lives here.
 *
 * The JWT is stored in an HttpOnly cookie set by the server, so JavaScript never
 * touches the token (protects against XSS token theft). `withCredentials: true`
 * makes the browser attach that cookie to every request.
 */
import axios from 'axios';

// Dev: Vite (5173) talks to the API on 5000.
// Production: the API serves this app, so a relative '/api' (same domain) is used.
// Set VITE_API_URL only if the frontend is hosted separately from the API.
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : '/api');

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  timeout: 10000,
});

// ---- Interceptors ----
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn;
};

api.interceptors.request.use((config) => {
  // Cookie carries the JWT; make sure it is always sent
  config.withCredentials = true;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Session expired / invalid token -> send the user back to login
    const url = error.config?.url || '';
    if (error.response?.status === 401 && !url.includes('/auth/')) onUnauthorized();
    return Promise.reject(error);
  }
);

/** Turn any axios error into a human-readable message (NFR-14) */
export function errorMessage(error) {
  if (error.response?.data) {
    const { message, detail } = error.response.data;
    return detail ? `${message}: ${detail}` : message || 'Request failed';
  }
  if (error.request) return 'Cannot reach the server. Is the backend running on port 5000?';
  return error.message;
}

/** NFR-11: retry a request up to 3 times, but only on network failures (no response) */
async function withRetry(fn, retries = 3) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      if (err.response || attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, 300 * 2 ** attempt));
    }
  }
}

// ---- Auth ----
export const authApi = {
  register: (data) => api.post('/auth/register', data).then((r) => r.data),
  login: (email, password, role) => api.post('/auth/login', { email, password, role }).then((r) => r.data),
  logout: () => api.post('/auth/logout').then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data.user),
  users: () => api.get('/auth/users').then((r) => r.data),
};

// ---- Tasks (Kanban) ----
export const taskApi = {
  list: (sprintId) => api.get('/tasks', { params: sprintId ? { sprintId } : {} }).then((r) => r.data),
  create: (data) => api.post('/tasks', data).then((r) => r.data),
  update: (id, data) => api.put(`/tasks/${id}`, data).then((r) => r.data),
  move: (id, status) => withRetry(() => api.put(`/tasks/${id}`, { status })).then((r) => r.data),
  remove: (id) => api.delete(`/tasks/${id}`).then((r) => r.data),
};

// ---- Sprints ----
export const sprintApi = {
  list: () => api.get('/sprints').then((r) => r.data),
  create: (data) => api.post('/sprints', data).then((r) => r.data),
  update: (id, data) => api.put(`/sprints/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/sprints/${id}`).then((r) => r.data),
  addTask: (sprintId, taskId) => api.post(`/sprints/${sprintId}/tasks`, { taskId }).then((r) => r.data),
  removeTask: (sprintId, taskId) => api.delete(`/sprints/${sprintId}/tasks/${taskId}`).then((r) => r.data),
};

// ---- Product Backlog ----
export const backlogApi = {
  list: () => api.get('/backlog').then((r) => r.data),
  create: (data) => api.post('/backlog', data).then((r) => r.data),
  update: (id, data) => api.put(`/backlog/${id}`, data).then((r) => r.data),
  remove: (id) => api.delete(`/backlog/${id}`).then((r) => r.data),
};

// ---- Activity log ----
export const activityApi = {
  list: (limit = 20) => api.get('/activity', { params: { limit } }).then((r) => r.data),
};

export default api;

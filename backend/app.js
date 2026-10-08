/**
 * Express application (kept separate from server.js so tests can import it
 * without opening a port or connecting to Atlas).
 */
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const sprintRoutes = require('./routes/sprintRoutes');
const backlogRoutes = require('./routes/backlogRoutes');
const activityRoutes = require('./routes/activityRoutes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const { allowedOrigins } = require('./config/origins');

const app = express();

// Behind Render / Railway / Heroku proxies: needed for correct client IPs and secure cookies
app.set('trust proxy', 1);

app.use(helmet()); // security headers
app.use(
  cors({
    origin: allowedOrigins(),
    credentials: true, // allow the JWT cookie
  })
);
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

// Brute-force protection on login / register (in addition to the 3-strike account lock)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { message: 'Too many attempts from this network - please try again in 15 minutes' },
});

// Health check (public) - used by the hosting platform
app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'AgilePulse API' }));

// API routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/sprints', sprintRoutes);
app.use('/api/backlog', backlogRoutes);
app.use('/api/activity', activityRoutes);

// In production the same server also serves the built React app (frontend/dist),
// so the whole system runs on ONE domain: no cross-site cookie or CORS problems.
const distDir = path.join(__dirname, '..', 'frontend', 'dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(distDir)) {
  app.use(express.static(distDir, { maxAge: '1h', index: false }));
  // Any non-API GET returns index.html so React Router can handle /board, /backlog, ...
  app.get(/^\/(?!api\/|socket\.io\/).*/, (req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

// 404 + central error handler
app.use(notFound);
app.use(errorHandler);

module.exports = app;

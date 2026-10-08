/**
 * Allowed browser origins for CORS and Socket.IO.
 * CLIENT_URL may hold one URL or a comma-separated list, e.g.
 *   CLIENT_URL=http://localhost:5173,https://agilepulse.vercel.app
 */
function allowedOrigins() {
  return (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((url) => url.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

module.exports = { allowedOrigins };

/**
 * AuthMiddleware (FR-04, NFR-07)
 *  - protect:   verifies the JWT and attaches the user to req.user
 *  - authorize: restricts a route to the given roles (RBAC)
 */
const jwt = require('jsonwebtoken');
const User = require('../models/User');

function extractToken(req) {
  // 1. HttpOnly cookie set at login (used by the React app)
  if (req.cookies && req.cookies.token) return req.cookies.token;
  // 2. Authorization: Bearer <token> (handy for Postman / API clients)
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

async function protect(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ message: 'Not authorized - no token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'Not authorized - user no longer exists' });
    }
    req.user = user;
    return next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Not authorized - token expired' : 'Not authorized - invalid token';
    return res.status(401).json({ message });
  }
}

/** Usage: router.post('/', protect, authorize('SM'), handler) */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied - requires role: ${roles.join(' or ')}`,
      });
    }
    return next();
  };
}

module.exports = { protect, authorize };

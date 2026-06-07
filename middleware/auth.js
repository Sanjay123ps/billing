const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'ayini_billing_secret_2025';

function authenticateToken(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function adminOnly(req, res, next) {
  // Allow if role is 'admin' OR username is 'admin' (fallback for tokens
  // minted before the role field was correctly seeded in the database)
  if (req.user?.role === 'admin' || req.user?.username === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Admin access required' });
}

module.exports = { authenticateToken, adminOnly };
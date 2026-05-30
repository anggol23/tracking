import jwt from 'jsonwebtoken';
import { get } from '../database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_cyber_security_key_2026';

export const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required. Token missing.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    // Verify user exists in database
    const user = await get('SELECT id, username, email, role FROM users WHERE id = ?', [decoded.id]);
    if (!user) {
      return res.status(401).json({ message: 'User no longer exists.' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('JWT Authentication error:', error.message);
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

export const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
};

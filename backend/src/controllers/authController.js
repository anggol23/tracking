import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { run, get } from '../database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_cyber_security_key_2026';

export const register = async (req, res) => {
  const { username, password, email, role } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  const assignedRole = role === 'admin' ? 'admin' : 'user';

  try {
    // Check if user already exists
    const existingUser = await get('SELECT id FROM users WHERE username = ?', [username]);
    if (existingUser) {
      return res.status(409).json({ message: 'Username is already taken.' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Save user
    const result = await run(
      'INSERT INTO users (username, password_hash, email, role) VALUES (?, ?, ?, ?)',
      [username, passwordHash, email || null, assignedRole]
    );

    // Generate JWT
    const token = jwt.sign({ id: result.id, username, role: assignedRole }, JWT_SECRET, {
      expiresIn: '7d',
    });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: result.id,
        username,
        email,
        role: assignedRole,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Internal server error during registration.' });
  }
};

export const login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required.' });
  }

  try {
    // Find user
    const user = await get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    // Match password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    // Generate JWT
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, {
      expiresIn: '7d',
    });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error during login.' });
  }
};

export const getMe = async (req, res) => {
  res.json({ user: req.user });
};

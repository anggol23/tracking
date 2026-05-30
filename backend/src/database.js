import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../tracking.db');
const db = new sqlite3.Database(dbPath);

// Promise-based database execution utilities
export const run = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
};

export const get = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const all = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Database Schema Initialization
export const initDatabase = async () => {
  try {
    // Enable foreign keys
    await run('PRAGMA foreign_keys = ON;');

    // 1. Users Table
    await run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        email TEXT,
        role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Devices Table
    await run(`
      CREATE TABLE IF NOT EXISTS devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL DEFAULT 'offline' CHECK(status IN ('online', 'offline')),
        divisi TEXT DEFAULT 'General',
        location_group TEXT DEFAULT 'Headquarters',
        speed REAL DEFAULT 0.0,
        latitude REAL,
        longitude REAL,
        last_update TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Geofences Table
    await run(`
      CREATE TABLE IF NOT EXISTS geofences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('circle', 'polygon')),
        coordinates TEXT NOT NULL, -- JSON string containing bounds/center/radius
        deviceId INTEGER,
        active INTEGER DEFAULT 1,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (deviceId) REFERENCES devices(id) ON DELETE CASCADE
      )
    `);

    // 4. Location History Table
    await run(`
      CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deviceId INTEGER NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        speed REAL DEFAULT 0,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (deviceId) REFERENCES devices(id) ON DELETE CASCADE
      )
    `);

    // 5. Alerts Table
    await run(`
      CREATE TABLE IF NOT EXISTS alerts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deviceId INTEGER NOT NULL,
        type TEXT NOT NULL,
        message TEXT NOT NULL,
        resolved INTEGER DEFAULT 0,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (deviceId) REFERENCES devices(id) ON DELETE CASCADE
      )
    `);

    // Seed default admin user if not exists
    const adminUser = await get('SELECT id FROM users WHERE username = ?', ['admin']);
    if (!adminUser) {
      const defaultPassword = 'admin123';
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(defaultPassword, salt);
      await run(
        'INSERT INTO users (username, password_hash, email, role) VALUES (?, ?, ?, ?)',
        ['admin', hashedPassword, 'admin@tracking.com', 'admin']
      );
      console.log('Seeded default admin user: admin / admin123');
    }

    console.log('SQLite Database Initialized Successfully.');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

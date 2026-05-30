import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import * as functions from 'firebase-functions';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env only for local emulation
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ----- Express app -----
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// ---- Import your existing routes / controllers ----
// Example (adjust to your actual file structure):
// import deviceRouter from '../../backend/src/routes/device.js';
// app.use('/api/devices', deviceRouter);

// Simple health endpoint
app.get('/api/ping', (req, res) => res.json({ ok: true }));

// ----- Socket.io setup -----
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

io.on('connection', (socket) => {
  console.log('🔌 client connected', socket.id);

  socket.on('device:auth', ({ token }) => {
    // TODO: validate token (e.g., JWT)
    socket.emit('device:auth_success');
  });

  socket.on('device:ping', (data) => {
    // Forward to any admin listeners
    io.emit('device:update', data);
  });
});

// ----- Export as Firebase Cloud Function -----
export const api = functions
  .runWith({ maxInstances: 10, timeoutSeconds: 60 })
  .https.onRequest((req, res) => app(req, res));

// Optional export for local dev
export const socketServer = server;

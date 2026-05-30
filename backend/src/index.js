import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase, run, get, all } from './database.js';

// Route imports
import authRoutes from './routes/auth.js';
import deviceRoutes from './routes/devices.js';
import geofenceRoutes from './routes/geofences.js';
import historyRoutes from './routes/history.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: [
      'https://tracking-one-ochre.vercel.app',

      'http://localhost:5173'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  },
});

const PORT = process.env.PORT;

// Middleware
app.use(cors());
app.use(express.json());

// API HTTP Routes
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/geofences', geofenceRoutes);
app.use('/api/history', historyRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Geofence helper math functions
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // returns distance in meters
}

function isPointInPolygon(point, vs) {
  // ray-casting algorithm based on: https://wrf.ecse.rpi.edu/Research/Short_Notes/pnpoly.html
  const x = point[0];
  const y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0];
    const yi = vs[i][1];
    const xj = vs[j][0];
    const yj = vs[j][1];

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// Check device position against its geofences
async function checkGeofences(device, latitude, longitude) {
  try {
    // Fetch active geofences associated with this device or global (deviceId IS NULL)
    const geofences = await all(
      'SELECT * FROM geofences WHERE active = 1 AND (deviceId = ? OR deviceId IS NULL)',
      [device.id]
    );

    for (const gf of geofences) {
      const coords = JSON.parse(gf.coordinates);
      let isInside = false;

      if (gf.type === 'circle') {
        const dist = haversineDistance(latitude, longitude, coords.lat, coords.lng);
        isInside = dist <= coords.radius;
      } else if (gf.type === 'polygon') {
        isInside = isPointInPolygon([latitude, longitude], coords.points);
      }

      // We alert if a device enters or leaves. By default in fleet management,
      // a breach alert is triggered when a device leaves its allowed zone.
      // Let's implement boundary exit monitoring.
      if (!isInside) {
        const timestamp = new Date().toISOString();
        const alertMessage = `Device "${device.name}" left geofence area: "${gf.name}"!`;

        // Check if there is already an unresolved breach alert for this device in the last 2 minutes
        // to avoid duplicate notification spamming
        const timeLimit = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        const recentAlert = await get(
          'SELECT id FROM alerts WHERE deviceId = ? AND type = ? AND timestamp > ? AND resolved = 0',
          [device.id, 'geofence_breach', timeLimit]
        );

        if (!recentAlert) {
          // Log alert to DB
          const result = await run(
            'INSERT INTO alerts (deviceId, type, message, resolved, timestamp) VALUES (?, ?, ?, 0, ?)',
            [device.id, 'geofence_breach', alertMessage, timestamp]
          );

          // Broadcast alert to dashboards
          io.to('dashboards').emit('alert:new', {
            id: result.id,
            deviceId: device.id,
            deviceName: device.name,
            type: 'geofence_breach',
            message: alertMessage,
            resolved: false,
            timestamp,
          });
        }
      }
    }
  } catch (error) {
    console.error('Error during geofence check:', error);
  }
}

// In-memory tracker for device sockets to handle timeouts on disconnect
const activeDeviceSockets = new Map(); // deviceId -> socketId
const disconnectTimeouts = new Map(); // deviceId -> setTimeout handle

// WebSockets logic
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // 1. Join Dashboard room (viewers)
  socket.on('dashboard:join', () => {
    socket.join('dashboards');
    console.log(`Socket ${socket.id} joined dashboards room`);
  });

  // 2. Device Auth & Telemetry Check-in
  socket.on('device:auth', async ({ token }) => {
    try {
      if (!token) {
        socket.emit('device:auth_error', { message: 'Token is required' });
        return;
      }

      const device = await get('SELECT * FROM devices WHERE token = ?', [token]);
      if (!device) {
        socket.emit('device:auth_error', { message: 'Invalid device token' });
        return;
      }

      // Cancel any pending offline timeout
      if (disconnectTimeouts.has(device.id)) {
        clearTimeout(disconnectTimeouts.get(device.id));
        disconnectTimeouts.delete(device.id);
      }

      socket.deviceId = device.id;
      socket.deviceName = device.name;
      activeDeviceSockets.set(device.id, socket.id);

      // Update status to online in database
      await run('UPDATE devices SET status = "online" WHERE id = ?', [device.id]);

      socket.emit('device:auth_success', { deviceId: device.id, name: device.name });

      // Notify dashboards
      io.to('dashboards').emit('device:status_change', {
        id: device.id,
        name: device.name,
        status: 'online',
      });

      console.log(`Device authenticated: ${device.name} (ID: ${device.id})`);
    } catch (error) {
      console.error('Error in device auth socket:', error);
    }
  });

  // 3. Receive Live Coordinates from Device
  socket.on('device:ping', async (data) => {
    // data: { latitude, longitude, speed }
    if (!socket.deviceId) {
      socket.emit('device:error', { message: 'Device not authenticated.' });
      return;
    }

    const { latitude, longitude, speed } = data;
    if (latitude == null || longitude == null) return;

    const currentSpeed = speed || 0.0;
    const timestamp = new Date().toISOString();

    try {
      // 1. Update database device fields
      await run(
        'UPDATE devices SET latitude = ?, longitude = ?, speed = ?, status = "online", last_update = ? WHERE id = ?',
        [latitude, longitude, currentSpeed, timestamp, socket.deviceId]
      );

      // 2. Insert into history tracking logs
      await run(
        'INSERT INTO history (deviceId, latitude, longitude, speed, timestamp) VALUES (?, ?, ?, ?, ?)',
        [socket.deviceId, latitude, longitude, currentSpeed, timestamp]
      );

      // Fetch complete updated device
      const updatedDevice = await get('SELECT * FROM devices WHERE id = ?', [socket.deviceId]);

      // 3. Broadcast updated device state to dashboards
      io.to('dashboards').emit('device:update', updatedDevice);

      // 4. Run Geofence checking
      await checkGeofences(updatedDevice, latitude, longitude);
    } catch (error) {
      console.error(`Error saving telemetry for device ${socket.deviceName}:`, error);
    }
  });

  // 4. WebRTC Video Signaling Channel (forwarding helper)
  socket.on('webrtc:signal', (payload) => {
    // payload: { targetSocketId, signal, senderSocketId, roomId }
    const { targetSocketId, signal } = payload;
    io.to(targetSocketId).emit('webrtc:signal', {
      senderSocketId: socket.id,
      signal,
    });
  });

  socket.on('webrtc:join_room', (roomId) => {
    socket.join(roomId);
    socket.to(roomId).emit('webrtc:user_joined', { socketId: socket.id });
  });

  // 5. Connection Disconnect Handler
  socket.on('disconnect', async () => {
    console.log(`Socket disconnected: ${socket.id}`);

    if (socket.deviceId) {
      const devId = socket.deviceId;
      const devName = socket.deviceName;

      // Check if this socket was the active controller
      if (activeDeviceSockets.get(devId) === socket.id) {
        activeDeviceSockets.delete(devId);

        // Schedule timeout to declare device offline (provides buffer for quick reconnections)
        const timeoutHandle = setTimeout(async () => {
          try {
            await run('UPDATE devices SET status = "offline" WHERE id = ?', [devId]);
            const timestamp = new Date().toISOString();

            // Create disconnection alert
            const alertMessage = `Device "${devName}" went offline unexpectedly.`;
            const result = await run(
              'INSERT INTO alerts (deviceId, type, message, resolved, timestamp) VALUES (?, ?, ?, 0, ?)',
              [devId, 'device_offline', alertMessage, timestamp]
            );

            // Broadcast status change and alert
            io.to('dashboards').emit('device:status_change', {
              id: devId,
              name: devName,
              status: 'offline',
            });

            io.to('dashboards').emit('alert:new', {
              id: result.id,
              deviceId: devId,
              deviceName: devName,
              type: 'device_offline',
              message: alertMessage,
              resolved: false,
              timestamp,
            });

            disconnectTimeouts.delete(devId);
            console.log(`Device declared offline: ${devName}`);
          } catch (error) {
            console.error('Error handling device offline timeout:', error);
          }
        }, 15000); // 15 seconds grace period

        disconnectTimeouts.set(devId, timeoutHandle);
      }
    }
  });
});

// Initialize database schema and start listening
initDatabase()
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`Server is running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Fatal database startup failure:', err);
    process.exit(1);
  });

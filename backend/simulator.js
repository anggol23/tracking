import { io } from 'socket.io-client';

const token = process.argv[2];

if (!token) {
  console.log('\n======================================================');
  console.log('AEGIS FLEET TELEMETRY SIMULATOR - CLI INTERFACE');
  console.log('======================================================');
  console.log('Error: Device token is missing.');
  console.log('\nUsage:');
  console.log('  node simulator.js <device_token>\n');
  console.log('Steps:');
  console.log('  1. Open Aegis Dashboard (http://localhost:5173)');
  console.log('  2. Go to "Devices" tab and click "Add New Device"');
  console.log('  3. Copy the generated Device Token ID');
  console.log('  4. Run this script in a separate terminal:');
  console.log('     node simulator.js dev_xxxxxxxxxxxxxxxxxxxxx\n');
  process.exit(1);
}

const SERVER_URL = 'http://localhost:5000';
console.log(`Connecting simulator to server ${SERVER_URL}...`);

const socket = io(SERVER_URL, {
  transports: ['websocket'],
});

let step = 0;
let simInterval = null;

// Base coordinates: Central Jakarta Area
const baseLat = -6.2088;
const baseLng = 106.8456;

socket.on('connect', () => {
  console.log('Connected to server. Initiating device authentication...');
  socket.emit('device:auth', { token });
});

socket.on('device:auth_success', ({ deviceId, name }) => {
  console.log(`\n>>> Device authenticated successfully!`);
  console.log(`>>> Name: ${name} (ID: ${deviceId})`);
  console.log(`>>> Sending live telemetry updates every 3 seconds. Press Ctrl+C to terminate.\n`);

  // Start sending simulated location telemetry
  simInterval = setInterval(() => {
    step++;

    // Math models representing physical vehicle circuit:
    const theta = step * 0.04;
    const offsetLat = Math.sin(theta) * 0.012;
    const offsetLng = Math.cos(theta * 1.5) * 0.012;

    const latitude = baseLat + offsetLat;
    const longitude = baseLng + offsetLng;
    
    // Simulate typical urban traffic speed (25 - 65 km/h)
    const speed = 45 + Math.sin(step * 0.15) * 20;

    console.log(`[Ping #${step}] Coordinates: ${latitude.toFixed(5)}, ${longitude.toFixed(5)} | Speed: ${speed.toFixed(1)} km/h`);

    socket.emit('device:ping', {
      latitude,
      longitude,
      speed,
    });
  }, 3000);
});

socket.on('device:auth_error', ({ message }) => {
  console.error(`\n>>> Authentication Failed: ${message}`);
  console.error('>>> Please verify the token ID inside the admin panel.\n');
  socket.disconnect();
  process.exit(1);
});

socket.on('disconnect', () => {
  console.log('Disconnected from server. Retrying...');
  if (simInterval) {
    clearInterval(simInterval);
    simInterval = null;
  }
});

// Graceful shut down
process.on('SIGINT', () => {
  console.log('\nTerminating simulated vehicle telemetry feed. Goodbye.');
  if (simInterval) clearInterval(simInterval);
  socket.disconnect();
  process.exit(0);
});

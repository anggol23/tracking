# Aegis Fleet Location Tracking & CCTV Monitoring Suite

Sebuah platform web app modern, responsif, dan futuristik berbasis real-time untuk pemantauan posisi GPS kendaraan (fleet tracking), geofencing alerts, dan CCTV/camera monitoring dashboard. Proyek ini menggunakan arsitektur modular yang memisahkan frontend (React + Vite + TailwindCSS) dan backend (Node.js + Express + Socket.io + SQLite).

---

## Fitur Utama

1. **Dashboard Overview:**
   - Visualisasi KPI stats (Unit Online, Unit Offline, Alarm Keamanan Aktif).
   - Live Telemetry Map (Leaflet) ringkas.
   - Panel monitoring alarm/breach terbaru secara langsung.

2. **Live GPS Tracking (Real-time Map):**
   - Fullscreen map dengan custom tileset bertema gelap (*CartoDB Dark Matter*).
   - Sinkronisasi pergerakan marker secara mulus menggunakan WebSockets.
   - Lock camera / follow unit tracking.
   - Geofence overlays (Boundary Circle radius).

3. **Geofencing & Alarm System:**
   - Pembuatan area Geofence langsung dengan klik koordinat map.
   - Evaluasi containment instan menggunakan rumus matematika *Haversine*.
   - Alert instan dikirim ke dashboard via WebSockets jika device keluar batas.
   - Sound alarm dan browser Push Notifications jika diizinkan.

4. **Camera Monitoring Suite:**
   - Pemilihan tata letak grid CCTV: 1x1, 2x2, dan 3x3.
   - Simulasi feed CCTV termal / night-vision di rendered canvas, lengkap dengan watermark koordinat dan timestamp.
   - Integrasi kamera WebRTC browser asli (webcam user) di slot CAM-01.
   - Snapshot stream (Download frame JPEG) dan perekam video terintegrasi (*MediaRecorder API*).

5. **Device Registry & Grouping:**
   - Administrasi pendaftaran device baru, divisi, dan area logistik.
   - Canvas-based QR Code generator untuk proses *pairing* device seluler.
   - Siklus regenerasi token autentikasi device.

6. **History Teleplay Replay:**
   - Kueri log riwayat GPS berdasarkan tanggal dan rentang waktu.
   - Gambar visual lintasan rute lengkap.
   - Playback control panel: Play, Pause, Reset, dan Slider Speed (1x hingga 20x).
   - Replay tracking marker dan instant telemetry HUD (kecepatan & koordinat aktual).

---

## Struktur Proyek

```text
trecking-lokasi/
├── backend/
│   ├── src/
│   │   ├── controllers/     # Logika rute (Auth, Devices, Geofences, History)
│   │   ├── middleware/      # Verifikasi token JWT & proteksi otorisasi peran
│   │   ├── routes/          # Definisi router Express
│   │   ├── database.js      # Konfigurasi & Inisialisasi DDL SQLite (tracking.db)
│   │   └── index.js         # Entry server Express + Socket.io server
│   ├── simulator.js         # Standalone CLI device simulator
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # UI Sidebar dan Navbar layout
│   │   ├── context/         # AuthContext & RealtimeDataContext (Sockets sync)
│   │   ├── pages/           # Layar Login, Dashboard, Map, Camera, Devices, History, Settings
│   │   ├── App.jsx          # Route controller utama
│   │   └── index.css        # CSS global + Cyberpunk design tokens
│   └── index.html           # Font loader
└── README.md
```

---

## Persyaratan Awal

- **Node.js** v18 atau versi terbaru.
- **npm** v9 atau versi terbaru.

---

## Langkah Instalasi & Menjalankan Aplikasi

### 1. Inisialisasi Backend Server

Masuk ke direktori backend, buat berkas konfigurasi `.env`, dan jalankan server:

```bash
cd backend
npm install
npm run dev
```

Server backend akan berjalan di **`http://localhost:5000`**.  
Database SQLite (`tracking.db`) akan diinisialisasi otomatis pada startup pertama dan membuat pengguna administrator default.

### 2. Inisialisasi Frontend Client

Buka terminal baru di direktori root, masuk ke direktori frontend, dan jalankan server dev:

```bash
cd frontend
npm install
npm run dev
```

Aplikasi web client akan berjalan di **`http://localhost:5173`** (atau port lain yang disediakan Vite).

---

## Kredensial Akses Demo

Saat masuk ke halaman utama Login, gunakan akun administrator bawaan berikut:
- **Username:** `admin`
- **Password:** `admin123`

*(Anda juga dapat mendaftarkan akun operator/admin baru melalui tombol daftar di bawah form login).*

---

## Panduan Simulasi Telemetry Real-time

Untuk menguji fitur peta bergerak dan geofence alarm secara langsung tanpa perangkat GPS fisik, Anda memiliki 2 opsi:

### Opsi A: In-Browser GPS Simulator (Direkomendasikan)
1. Masuk ke halaman **Settings** di menu sidebar dashboard.
2. Temukan panel **Fleet Telemetry Simulator**.
3. Pastikan Anda sudah mendaftarkan setidaknya satu device di tab **Devices**.
4. Klik tombol **Initialize Sim** (berwarna hijau).
5. Simulator akan otomatis menyambungkan WebSocket tiruan dan memperbarui posisi GPS di peta secara real-time setiap 3 detik. Anda dapat membuka menu **Live Map** atau **Dashboard** untuk memantau pergerakan marker.

### Opsi B: Standalone CLI GPS Simulator
1. Daftarkan device baru di menu **Devices** pada dashboard.
2. Salin nilai **Device Token ID** yang dihasilkan (misal: `dev_54a3f...`).
3. Buka terminal baru dan jalankan script simulator di folder backend:
   ```bash
   cd backend
   node simulator.js <DEVICE_TOKEN_ID_ANDA>
   ```
4. Simulator konsol akan mulai memancarkan pergerakan koordinat real-time ke server.

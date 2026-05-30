import React, { createContext, useContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { useAuth, API_BASE } from './AuthContext.jsx';

const RealtimeDataContext = createContext();

const SOCKET_SERVER = import.meta.env.VITE_API_URL;

export const RealtimeDataProvider = ({ children }) => {
  const { token, authenticatedFetch } = useAuth();
  const [devices, setDevices] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState(null);

  // Fetch initial telemetry state, geofences, and alerts
  const fetchData = async () => {
    if (!token) return;
    try {
      // 1. Fetch devices
      const devRes = await authenticatedFetch(`${API_BASE}/devices`);
      if (devRes.ok) {
        const devData = await devRes.json();
        setDevices(devData);
      }

      // 2. Fetch geofences
      const geoRes = await authenticatedFetch(`${API_BASE}/geofences`);
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        setGeofences(geoData);
      }

      // 3. Fetch recent alerts
      const alertRes = await authenticatedFetch(`${API_BASE}/history/alerts/recent`);
      if (alertRes.ok) {
        const alertData = await alertRes.json();
        setAlerts(alertData);
      }
    } catch (err) {
      console.error('Error fetching dashboard records:', err);
    }
  };

  useEffect(() => {
    if (!token) {
      // Clean up socket when logged out
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      setIsConnected(false);
      return;
    }

    // Load static and existing data
    fetchData();

    // Setup Socket connection
    const newSocket = io(SOCKET_SERVER, {
      transports: ['websocket'],
      reconnectionAttempts: 5,
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('Dashboard connected to realtime WebSocket server.');
      // Register this socket as a viewer/dashboard panel
      newSocket.emit('dashboard:join');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Realtime WebSocket connection lost.');
    });

    // Handle telemetry update from device
    newSocket.on('device:update', (updatedDevice) => {
      setDevices((prevDevices) => {
        const idx = prevDevices.findIndex((d) => d.id === updatedDevice.id);
        if (idx !== -1) {
          const list = [...prevDevices];
          list[idx] = updatedDevice;
          return list;
        }
        return [...prevDevices, updatedDevice];
      });
    });

    // Handle device status changes (e.g. online/offline transition notifications)
    newSocket.on('device:status_change', ({ id, name, status }) => {
      setDevices((prevDevices) =>
        prevDevices.map((d) => (d.id === id ? { ...d, status, speed: status === 'offline' ? 0 : d.speed } : d))
      );
    });

    // Handle new security alert broadcast
    newSocket.on('alert:new', (newAlert) => {
      setAlerts((prevAlerts) => [newAlert, ...prevAlerts]);
      
      // In-app visual notification using window banner or Sound effect
      try {
        const notificationAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/951/951-84.wav');
        notificationAudio.volume = 0.4;
        notificationAudio.play();
      } catch (e) {
        // Audio playback might be blocked by browser media policies
      }

      // Browser push notification if allowed
      if (Notification.permission === 'granted') {
        new Notification('SECURITY ALERT: ' + newAlert.deviceName, {
          body: newAlert.message,
          icon: '/favicon.ico',
        });
      }
    });

    return () => {
      newSocket.disconnect();
      setIsConnected(false);
    };
  }, [token]);

  // Request notification permissions
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const refreshGeofences = async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE}/geofences`);
      if (res.ok) {
        const geoData = await res.json();
        setGeofences(geoData);
      }
    } catch (err) {
      console.error('Error reloading geofences:', err);
    }
  };

  const refreshDevices = async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE}/devices`);
      if (res.ok) {
        const devData = await res.json();
        setDevices(devData);
      }
    } catch (err) {
      console.error('Error reloading devices:', err);
    }
  };

  const dismissAllAlerts = () => {
    setAlerts([]);
  };

  return (
    <RealtimeDataContext.Provider
      value={{
        devices,
        geofences,
        alerts,
        isConnected,
        socket,
        refreshGeofences,
        refreshDevices,
        dismissAllAlerts,
        refetchAll: fetchData
      }}
    >
      {children}
    </RealtimeDataContext.Provider>
  );
};

export const useRealtimeData = () => useContext(RealtimeDataContext);

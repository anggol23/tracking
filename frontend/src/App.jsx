import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { RealtimeDataProvider } from './context/RealtimeDataContext.jsx';
import Sidebar from './components/Sidebar.jsx';
import Navbar from './components/Navbar.jsx';

// Pages
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import LiveMap from './pages/LiveMap.jsx';
import CameraMonitor from './pages/Camera.jsx';
import Devices from './pages/Devices.jsx';
import HistoryReplay from './pages/HistoryReplay.jsx';
import SettingsPage from './pages/Settings.jsx';
import TargetClient from './pages/TargetClient.jsx';

function MainAppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Check if opening as a target tracker share link
  const urlParams = new URLSearchParams(window.location.search);
  const shareToken = urlParams.get('share');

  if (shareToken) {
    return <TargetClient token={shareToken} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#040712] flex items-center justify-center font-mono text-sky-400">
        <div className="flex flex-col items-center gap-3">
          <span className="w-8 h-8 border-4 border-sky-400 border-t-transparent rounded-full animate-spin"></span>
          <span>CALIBRATING SATELLITE LINKS...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  // Map route names for display in navbar header
  const getPageName = () => {
    switch (currentPage) {
      case 'dashboard':
        return 'System Overview';
      case 'map':
        return 'Live GPS Tracking';
      case 'camera':
        return 'CCTV Monitoring Suite';
      case 'devices':
        return 'Node Registry';
      case 'history':
        return 'Telemetry Playback';
      case 'settings':
        return 'System Configuration';
      default:
        return 'Aegis Control';
    }
  };

  return (
    <div className="min-h-screen bg-[#040712] cyber-bg text-slate-100 flex">
      {/* Sidebar Navigation */}
      <Sidebar
        currentPage={currentPage}
        setCurrentPage={(page) => {
          setCurrentPage(page);
          if (page !== 'map') setSelectedDeviceId(null); // Reset focus
        }}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      {/* Main Panel Content Container */}
      <div
        className={`flex-1 flex flex-col min-w-0 min-h-screen transition-all duration-300 ${
          sidebarOpen ? 'md:pl-64' : 'md:pl-20'
        }`}
      >
        <Navbar
          currentPageName={getPageName()}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
        />

        {/* Content Viewport */}
        <main className="flex-1 p-6 overflow-y-auto">
          {currentPage === 'dashboard' && (
            <Dashboard setCurrentPage={setCurrentPage} setSelectedDeviceId={setSelectedDeviceId} />
          )}
          {currentPage === 'map' && (
            <LiveMap selectedDeviceId={selectedDeviceId} setSelectedDeviceId={setSelectedDeviceId} />
          )}
          {currentPage === 'camera' && <CameraMonitor />}
          {currentPage === 'devices' && <Devices />}
          {currentPage === 'history' && <HistoryReplay />}
          {currentPage === 'settings' && <SettingsPage />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <RealtimeDataProvider>
        <MainAppContent />
      </RealtimeDataProvider>
    </AuthProvider>
  );
}

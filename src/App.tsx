import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import ScanSubmission from './pages/ScanSubmission'
import DeviceOverview from './pages/DeviceOverview'
import DeviceScan from './pages/DeviceScan'
import FileScanner from './pages/FileScanner'
import AppScanner from './pages/AppScanner'
import DeviceHealthScan from './pages/DeviceHealthScan'
import ScanHistory from './pages/ScanHistory'
import ThreatIntel from './pages/ThreatIntel'
import ScanResult from './pages/ScanResult'
import Settings from './pages/Settings'
import AdminLogin from './pages/AdminLogin'
import AdminPanel from './pages/AdminPanel'
import AdminRoute from './components/AdminRoute'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/scan-submission" element={<ScanSubmission />} />
        <Route path="/file-scanner" element={<FileScanner />} />
        <Route path="/app-scanner" element={<AppScanner />} />
        <Route path="/device-overview" element={<DeviceOverview />} />
        <Route path="/device-scan" element={<DeviceScan />} />
        <Route path="/device-health" element={<DeviceHealthScan />} />
        <Route path="/scan-history" element={<ScanHistory />} />
        <Route path="/threat-intel" element={<ThreatIntel />} />
        <Route path="/scan-result" element={<ScanResult />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}

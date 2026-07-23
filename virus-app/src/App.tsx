import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import ScanSubmission from './pages/ScanSubmission'
import DeviceOverview from './pages/DeviceOverview'
import ScanHistory from './pages/ScanHistory'
import ThreatIntel from './pages/ThreatIntel'
import ScanResult from './pages/ScanResult'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/scan-submission" element={<ScanSubmission />} />
        <Route path="/device-overview" element={<DeviceOverview />} />
        <Route path="/scan-history" element={<ScanHistory />} />
        <Route path="/threat-intel" element={<ThreatIntel />} />
        <Route path="/scan-result" element={<ScanResult />} />
      </Route>
    </Routes>
  )
}

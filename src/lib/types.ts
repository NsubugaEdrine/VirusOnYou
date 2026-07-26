export interface Scan {
  id: string
  file_name: string
  package_name: string
  version: string
  sha256: string
  status: 'Queued' | 'In Progress' | 'Complete' | 'Failed'
  threat_level: 'Critical' | 'High' | 'Medium' | 'Low' | 'None'
  risk_category: string
  malware_name: string | null
  risk_score: number
  uploaded_at: string
  completed_at: string | null
  scan_types: string[]
  user_id: string | null
}

export interface Device {
  id: string
  name: string
  os_version: string
  risk_level: 'Critical' | 'High' | 'Medium' | 'Low'
  last_scan: string
  status: 'Active' | 'Inactive'
  installed_apps: string[]
}

export interface ThreatIntel {
  id: string
  package_name: string
  malware_family: string
  severity: 'Critical' | 'High' | 'Medium' | 'Low'
  first_seen: string
  last_seen: string
  iocs: IOC[]
  description: string
}

export interface IOC {
  type: 'SHA256' | 'Domain' | 'IP' | 'URL' | 'Package'
  value: string
}

export interface Permission {
  id: string
  scan_id: string
  name: string
  risk_level: 'Critical' | 'High' | 'Medium' | 'Low'
  description: string
}

export interface NetworkIndicator {
  id: string
  scan_id: string
  domain: string
  ip_address: string
  indicator_type: string
}

export interface Component {
  id: string
  scan_id: string
  component_type: 'Activity' | 'Service' | 'Receiver' | 'Provider'
  name: string
  risk_level: 'Critical' | 'High' | 'Medium' | 'Low'
}

export interface DeviceScanFile {
  name: string
  path: string
  size: number
  type: string
  sha256: string
  status: 'pending' | 'scanning' | 'clean' | 'threat' | 'corrupted' | 'error'
  threatLevel: 'Critical' | 'High' | 'Medium' | 'Low' | 'None'
  threatName: string | null
  riskScore: number
  details: string
}

export interface DeviceScanSession {
  id: string
  deviceName: string
  sourceType: 'folder' | 'files' | 'drive'
  startedAt: string
  completedAt: string | null
  totalFiles: number
  scannedFiles: number
  cleanFiles: number
  threatFiles: number
  corruptedFiles: number
  errorFiles: number
  files: DeviceScanFile[]
  status: 'idle' | 'selecting' | 'scanning' | 'complete'
}

export interface QuarantinedFile {
  id: string
  originalName: string
  originalPath: string
  sha256: string
  threatLevel: 'Critical' | 'High' | 'Medium' | 'Low'
  malwareName: string
  detectedAt: string
  size: number
}

export interface ProtectionEvent {
  id: string
  type: 'threat_blocked' | 'scan_complete' | 'device_detected' | 'device_removed' | 'quarantine' | 'update' | 'realtime_block'
  title: string
  description: string
  severity: 'critical' | 'warning' | 'info' | 'success'
  timestamp: string
}

export interface ThreatSignature {
  sha256: string
  malwareName: string
  family: string
  severity: 'Critical' | 'High' | 'Medium' | 'Low'

}

export interface UserProfile {
  id: string
  email: string | null
  role: 'admin' | 'user'
  created_at: string
}

export interface InstalledApp {
  packageName: string
  apkPath: string | null
  size: number | null
  status: 'pending' | 'scanning' | 'clean' | 'threat' | 'error'
  sha256: string | null
  riskScore: number
  threatLevel: 'Critical' | 'High' | 'Medium' | 'Low' | 'None'
  threatName: string | null
  details: string
}

export interface FileScanResult {
  id: string
  name: string
  path: string
  size: number
  category: string
  sha256: string
  status: 'pending' | 'scanning' | 'clean' | 'threat' | 'corrupted' | 'error'
  threatLevel: 'Critical' | 'High' | 'Medium' | 'Low' | 'None'
  threatName: string | null
  riskScore: number
  details: string
  scannedAt: string | null
}

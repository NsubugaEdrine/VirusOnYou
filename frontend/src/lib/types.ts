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

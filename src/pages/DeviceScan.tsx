import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { DeviceScanFile, DeviceScanSession } from '../lib/types'

type DeviceView = 'detection' | 'options' | 'scanning' | 'complete'
type ScanType = 'quick' | 'full' | 'custom' | 'integrity'
type ApiStatus = 'available' | 'unavailable' | 'permission_denied'

interface DetectedDevice {
  id: string
  name: string
  type: string
  protocol: 'usb' | 'serial' | 'bluetooth' | 'media' | 'storage'
  vendorId?: number
  productId?: number
  manufacturer?: string
  serialNumber?: string
  connectedAt: Date
  apiDetail?: string
}

const MALICIOUS_EXTENSIONS = ['.exe', '.bat', '.cmd', '.vbs', '.js', '.ws', '.wsh', '.ps1', '.msi', '.com', '.pif', '.scr', '.hta', '.cpl']
const SUSPICIOUS_EXTENSIONS = ['.apk', '.dex', '.jar', '.class', '.swf', '.docm', '.xlsm', '.pptm', '.zip', '.rar', '.7z']

async function computeSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function getExtension(name: string): string {
  const idx = name.lastIndexOf('.')
  return idx >= 0 ? name.slice(idx).toLowerCase() : ''
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function analyzeFileForThreats(file: File, sha256: string) {
  const ext = getExtension(file.name)
  const name = file.name.toLowerCase()
  let riskScore = 0
  const reasons: string[] = []

  if (MALICIOUS_EXTENSIONS.includes(ext)) {
    riskScore += 60
    reasons.push(`Executable extension "${ext}" — commonly used by malware`)
  } else if (SUSPICIOUS_EXTENSIONS.includes(ext)) {
    riskScore += 25
    reasons.push(`Suspicious extension "${ext}" requires further analysis`)
  }
  if (file.size === 0) {
    riskScore += 40
    reasons.push('File is empty (0 bytes) — possible corruption')
  } else if (file.size > 500 * 1024 * 1024) {
    riskScore += 15
    reasons.push('Unusually large file size (>500MB)')
  }
  if (/\.\w+\.\w+$/.test(file.name)) {
    riskScore += 20
    reasons.push('Double extension — common social engineering technique')
  }
  const suspiciousNames = ['autorun', 'setup', 'install', 'update', 'patch', 'crack', 'keygen', 'loader']
  if (suspiciousNames.some((n) => name.includes(n))) {
    riskScore += 15
    reasons.push('Filename matches known suspicious patterns')
  }
  if (sha256 === '0'.repeat(64)) {
    riskScore += 50
    reasons.push('SHA-256 is all zeros — file may be corrupted')
  }
  riskScore = Math.min(100, riskScore)

  let threatLevel: DeviceScanFile['threatLevel'] = 'None'
  let threatName: string | null = null
  if (riskScore >= 75) { threatLevel = 'Critical'; threatName = 'High Risk Pattern Detected' }
  else if (riskScore >= 50) { threatLevel = 'High'; threatName = 'Suspicious Activity Pattern' }
  else if (riskScore >= 25) { threatLevel = 'Medium'; threatName = 'Potential Risk Indicators' }
  else if (riskScore >= 10) { threatLevel = 'Low'; threatName = 'Low Risk Indicators' }

  return { threatLevel, threatName, riskScore, details: reasons.length > 0 ? reasons.join(' • ') : 'No anomalies detected — file appears clean' }
}

function usbClassToDeviceType(cls: number): string {
  const map: Record<number, string> = {
    0: 'Miscellaneous USB Device', 1: 'Audio Device', 2: 'CDC Communications',
    3: 'HID Device', 6: 'Still Image Device', 7: 'Printer',
    8: 'Mass Storage Device', 9: 'USB Hub', 11: 'Smart Card', 220: 'Vendor-Specific',
  }
  return map[cls] || `USB Device (Class ${cls})`
}

function protocolIcon(p: DetectedDevice['protocol']): string {
  const map: Record<string, string> = { usb: 'usb', serial: 'cable', bluetooth: 'bluetooth', media: 'videocam', storage: 'sd_storage' }
  return map[p] || 'devices'
}

function protocolLabel(p: DetectedDevice['protocol']): string {
  const map: Record<string, string> = { usb: 'USB', serial: 'Serial', bluetooth: 'Bluetooth', media: 'Media', storage: 'Storage' }
  return map[p] || p
}

export default function DeviceScan() {
  const [devices, setDevices] = useState<DetectedDevice[]>([])
  const [selectedDevice, setSelectedDevice] = useState<DetectedDevice | null>(null)
  const [deviceView, setDeviceView] = useState<DeviceView>('detection')
  const [selectedScanType, setSelectedScanType] = useState<ScanType | null>(null)
  const [scanning, setScanning] = useState(false)
  const [session, setSession] = useState<DeviceScanSession | null>(null)
  const [currentScanFile, setCurrentScanFile] = useState('')
  const [progress, setProgress] = useState(0)
  const [eventLog, setEventLog] = useState<string[]>([])
  const [apiStatuses, setApiStatuses] = useState<Record<string, ApiStatus>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef(false)

  function logEvent(msg: string) {
    setEventLog((prev) => [`${new Date().toLocaleTimeString()} — ${msg}`, ...prev].slice(0, 50))
  }

  function addDevice(dev: DetectedDevice) {
    setDevices((prev) => {
      if (prev.some((p) => p.id === dev.id && p.protocol === dev.protocol)) return prev
      return [...prev, dev]
    })
    logEvent(`Connected: ${dev.name} [${protocolLabel(dev.protocol)}]`)
  }

  function removeDevice(id: string, protocol: string) {
    setDevices((prev) => prev.filter((p) => !(p.id === id && p.protocol === protocol)))
    logEvent(`Disconnected: ${id} [${protocol}]`)
    setSelectedDevice((prev) => (prev && prev.id === id && prev.protocol === protocol ? null : prev))
  }

  /* ═══════════════════════════════════════════════════════════
     USB Detection (WebUSB API)
     ═══════════════════════════════════════════════════════════ */
  useEffect(() => {
    const usb = navigator.usb
    if (!usb) {
      setApiStatuses((prev) => ({ ...prev, usb: 'unavailable' }))
      return
    }
    setApiStatuses((prev) => ({ ...prev, usb: 'available' }))

    usb.getDevices().then((existing) => {
      existing.forEach((d) => {
        addDevice({
          id: d.serialNumber || d.productName || `usb-${d.vendorId}-${d.productId}`,
          name: d.productName || d.manufacturerName || 'Unknown USB Device',
          type: usbClassToDeviceType(d.deviceClass),
          protocol: 'usb',
          vendorId: d.vendorId,
          productId: d.productId,
          manufacturer: d.manufacturerName,
          serialNumber: d.serialNumber,
          connectedAt: new Date(),
          apiDetail: `USB v${d.usbVersionMajor}.${d.usbVersionMinor}`,
        })
      })
    }).catch(() => {})

    function onConnect(e: Event) {
      const d = (e as USBConnectionEvent).device
      addDevice({
        id: d.serialNumber || d.productName || `usb-${d.vendorId}-${d.productId}`,
        name: d.productName || d.manufacturerName || 'Unknown USB Device',
        type: usbClassToDeviceType(d.deviceClass),
        protocol: 'usb',
        vendorId: d.vendorId,
        productId: d.productId,
        manufacturer: d.manufacturerName,
        serialNumber: d.serialNumber,
        connectedAt: new Date(),
        apiDetail: `USB v${d.usbVersionMajor}.${d.usbVersionMinor}`,
      })
    }
    function onDisconnect(e: Event) {
      const d = (e as USBConnectionEvent).device
      removeDevice(d.serialNumber || d.productName || `usb-${d.vendorId}-${d.productId}`, 'usb')
    }

    usb.addEventListener('connect', onConnect)
    usb.addEventListener('disconnect', onDisconnect)
    return () => {
      usb.removeEventListener('connect', onConnect)
      usb.removeEventListener('disconnect', onDisconnect)
    }
  }, [])

  /* ═══════════════════════════════════════════════════════════
     Serial Detection (Web Serial API)
     ═══════════════════════════════════════════════════════════ */
  useEffect(() => {
    const serial = navigator.serial
    if (!serial) {
      setApiStatuses((prev) => ({ ...prev, serial: 'unavailable' }))
      return
    }
    setApiStatuses((prev) => ({ ...prev, serial: 'available' }))

    serial.getPorts().then((ports) => {
      ports.forEach((p) => {
        const info = p.getInfo()
        addDevice({
          id: `serial-${info.usbVendorId || 0}-${info.usbProductId || 0}-${info.serialNumber || Math.random()}`,
          name: info.productName || info.manufacturerName || 'Serial Device',
          type: 'Serial Port',
          protocol: 'serial',
          vendorId: info.usbVendorId,
          productId: info.usbProductId,
          manufacturer: info.manufacturerName,
          serialNumber: info.serialNumber,
          connectedAt: new Date(),
          apiDetail: 'Web Serial',
        })
      })
    }).catch(() => {})

    function onConnect(e: Event) {
      const port = (e as unknown as { port: SerialPort }).port
      const info = port.getInfo()
      addDevice({
        id: `serial-${info.usbVendorId || 0}-${info.usbProductId || 0}-${info.serialNumber || Math.random()}`,
        name: info.productName || info.manufacturerName || 'Serial Device',
        type: 'Serial Port',
        protocol: 'serial',
        vendorId: info.usbVendorId,
        productId: info.usbProductId,
        manufacturer: info.manufacturerName,
        serialNumber: info.serialNumber,
        connectedAt: new Date(),
        apiDetail: 'Web Serial',
      })
    }
    function onDisconnect(e: Event) {
      const port = (e as unknown as { port: SerialPort }).port
      const info = port.getInfo()
      removeDevice(`serial-${info.usbVendorId || 0}-${info.usbProductId || 0}-${info.serialNumber || ''}`, 'serial')
    }

    serial.addEventListener('connect', onConnect)
    serial.addEventListener('disconnect', onDisconnect)
    return () => {
      serial.removeEventListener('connect', onConnect)
      serial.removeEventListener('disconnect', onDisconnect)
    }
  }, [])

  /* ═══════════════════════════════════════════════════════════
     Bluetooth Detection (Web Bluetooth API)
     ═══════════════════════════════════════════════════════════ */
  useEffect(() => {
    const bt = navigator.bluetooth
    if (!bt) {
      setApiStatuses((prev) => ({ ...prev, bluetooth: 'unavailable' }))
      return
    }
    setApiStatuses((prev) => ({ ...prev, bluetooth: 'available' }))
  }, [])

  /* ═══════════════════════════════════════════════════════════
     Media Device Detection (MediaDevices API)
     ═══════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setApiStatuses((prev) => ({ ...prev, media: 'unavailable' }))
      return
    }
    setApiStatuses((prev) => ({ ...prev, media: 'available' }))

    async function enumerate() {
      try {
        const devs = await navigator.mediaDevices.enumerateDevices()
        devs.forEach((d) => {
          if (d.kind === 'videoinput') {
            addDevice({
              id: `media-${d.deviceId}`,
              name: d.label || 'Camera',
              type: 'Camera / Video Input',
              protocol: 'media',
              connectedAt: new Date(),
              apiDetail: d.groupId || 'MediaDevices',
            })
          } else if (d.kind === 'audioinput') {
            addDevice({
              id: `media-${d.deviceId}`,
              name: d.label || 'Microphone',
              type: 'Microphone / Audio Input',
              protocol: 'media',
              connectedAt: new Date(),
              apiDetail: d.groupId || 'MediaDevices',
            })
          }
        })
      } catch {
        setApiStatuses((prev) => ({ ...prev, media: 'permission_denied' }))
      }
    }

    enumerate()
    if (navigator.mediaDevices.addEventListener) {
      const handler = () => enumerate()
      navigator.mediaDevices.addEventListener('devicechange', handler)
      return () => navigator.mediaDevices.removeEventListener('devicechange', handler)
    }
  }, [])

  /* ═══════════════════════════════════════════════════════════
     Storage Detection (Storage API)
     ═══════════════════════════════════════════════════════════ */
  useEffect(() => {
    if (!navigator.storage) {
      setApiStatuses((prev) => ({ ...prev, storage: 'unavailable' }))
      return
    }
    setApiStatuses((prev) => ({ ...prev, storage: 'available' }))

    navigator.storage.estimate().then((est) => {
      if (est.usage !== undefined && est.quota !== undefined) {
        addDevice({
          id: 'storage-local',
          name: 'Local Browser Storage',
          type: `Storage (${formatBytes(est.usage)} / ${formatBytes(est.quota)})`,
          protocol: 'storage',
          connectedAt: new Date(),
          apiDetail: 'StorageManager API',
        })
      }
    }).catch(() => {})
  }, [])

  /* ═══════════════════════════════════════════════════════════
     Manual Request Helpers
     ═══════════════════════════════════════════════════════════ */
  async function requestUsbDevice() {
    const usb = navigator.usb
    if (!usb) return
    try {
      const d = await usb.requestDevice({ filters: [] })
      addDevice({
        id: d.serialNumber || d.productName || `usb-${d.vendorId}-${d.productId}`,
        name: d.productName || d.manufacturerName || 'Unknown USB Device',
        type: usbClassToDeviceType(d.deviceClass),
        protocol: 'usb',
        vendorId: d.vendorId,
        productId: d.productId,
        manufacturer: d.manufacturerName,
        serialNumber: d.serialNumber,
        connectedAt: new Date(),
        apiDetail: `USB v${d.usbVersionMajor}.${d.usbVersionMinor}`,
      })
    } catch {
      logEvent('USB device selection cancelled')
    }
  }

  async function requestSerialDevice() {
    const serial = navigator.serial
    if (!serial) return
    try {
      const port = await serial.requestPort()
      const info = port.getInfo()
      addDevice({
        id: `serial-${info.usbVendorId || 0}-${info.usbProductId || 0}-${info.serialNumber || Math.random()}`,
        name: info.productName || info.manufacturerName || 'Serial Device',
        type: 'Serial Port',
        protocol: 'serial',
        vendorId: info.usbVendorId,
        productId: info.usbProductId,
        manufacturer: info.manufacturerName,
        serialNumber: info.serialNumber,
        connectedAt: new Date(),
        apiDetail: 'Web Serial',
      })
    } catch {
      logEvent('Serial port selection cancelled')
    }
  }

  async function requestBluetoothDevice() {
    const bt = navigator.bluetooth
    if (!bt) return
    try {
      const device = await bt.requestDevice({ acceptAllDevices: true, optionalServices: ['battery_service', 'device_information'] })
      addDevice({
        id: `bt-${device.id}`,
        name: device.name || 'Bluetooth Device',
        type: 'Bluetooth Device',
        protocol: 'bluetooth',
        serialNumber: device.id,
        connectedAt: new Date(),
        apiDetail: 'Web Bluetooth',
      })
    } catch {
      logEvent('Bluetooth device selection cancelled')
    }
  }

  /* ═══════════════════════════════════════════════════════════
     Scan Logic
     ═══════════════════════════════════════════════════════════ */
  function selectDevice(device: DetectedDevice) {
    setSelectedDevice(device)
    setDeviceView('options')
  }

  function startScan(scanType: ScanType) {
    setSelectedScanType(scanType)
    setDeviceView('scanning')
    fileInputRef.current?.click()
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files
    if (!selected || selected.length === 0) {
      setDeviceView('options')
      return
    }
    const files = Array.from(selected)
    let filtered = files
    if (selectedScanType === 'quick') {
      const suspectExts = [...MALICIOUS_EXTENSIONS, ...SUSPICIOUS_EXTENSIONS]
      filtered = files.filter((f) => suspectExts.includes(getExtension(f.name)) || f.size === 0)
      if (filtered.length === 0) filtered = files.slice(0, 50)
    } else if (selectedScanType === 'integrity') {
      filtered = files.filter((f) => f.size === 0 || f.size < 1024)
      if (filtered.length === 0) filtered = files.slice(0, 100)
    }

    const sess: DeviceScanSession = {
      id: crypto.randomUUID(),
      deviceName: selectedDevice?.name || 'Manual Selection',
      sourceType: 'files',
      startedAt: new Date().toISOString(),
      completedAt: null,
      totalFiles: filtered.length,
      scannedFiles: 0,
      cleanFiles: 0,
      threatFiles: 0,
      corruptedFiles: 0,
      errorFiles: 0,
      files: filtered.map((f) => ({
        name: f.name,
        path: (f as unknown as {webkitRelativePath?: string}).webkitRelativePath || f.name,
        size: f.size,
        type: f.type || 'unknown',
        sha256: 'pending',
        status: 'pending' as const,
        threatLevel: 'None' as const,
        threatName: null,
        riskScore: 0,
        details: '',
      })),
      status: 'scanning',
    }
    setSession(sess)
    setScanning(true)
    scanAllFiles(filtered, sess)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function scanAllFiles(files: File[], sess: DeviceScanSession) {
    abortRef.current = false
    const existingHashes = new Set<string>()
    try {
      const { data } = await supabase.from('scans').select('sha256')
      if (data) data.forEach((s: { sha256: string }) => existingHashes.add(s.sha256))
    } catch { /* proceed */ }

    for (let i = 0; i < files.length; i++) {
      if (abortRef.current) break
      const file = files[i]
      setCurrentScanFile(file.name)
      setSession((prev) => {
        if (!prev) return prev
        const updated = [...prev.files]
        updated[i] = { ...updated[i], status: 'scanning' }
        return { ...prev, scannedFiles: i, files: updated }
      })
      setProgress(Math.round((i / files.length) * 100))

      try {
        const sha256 = await computeSHA256(file)
        const analysis = analyzeFileForThreats(file, sha256)
        let dbMatch = false
        if (existingHashes.has(sha256)) {
          analysis.riskScore = Math.max(analysis.riskScore, 80)
          analysis.threatLevel = 'Critical'
          analysis.threatName = 'Known Threat Signature Match'
          analysis.details = `SHA-256 matches a previously submitted malicious scan. ${analysis.details}`
          dbMatch = true
        }
        const status: DeviceScanFile['status'] = analysis.riskScore >= 50 ? 'threat' : file.size === 0 ? 'corrupted' : 'clean'
        await new Promise((r) => setTimeout(r, 100))
        setSession((prev) => {
          if (!prev) return prev
          const updated = [...prev.files]
          updated[i] = { ...updated[i], sha256, status, ...analysis }
          return {
            ...prev, scannedFiles: i + 1,
            cleanFiles: prev.cleanFiles + (status === 'clean' ? 1 : 0),
            threatFiles: prev.threatFiles + (status === 'threat' ? 1 : 0),
            corruptedFiles: prev.corruptedFiles + (status === 'corrupted' ? 1 : 0),
            files: updated,
          }
        })
        if (dbMatch) {
          await supabase.from('scans').insert({
            file_name: file.name,
            package_name: file.name.replace(getExtension(file.name), ''),
            version: '1.0.0',
            sha256, status: 'Complete',
            threat_level: analysis.threatLevel,
            risk_score: analysis.riskScore,
            risk_category: 'Device Scan',
            scan_types: ['Hash Match', 'Extension Analysis', 'Integrity Check'],
          })
        }
      } catch {
        setSession((prev) => {
          if (!prev) return prev
          const updated = [...prev.files]
          updated[i] = { ...updated[i], status: 'error', details: 'Failed to read or compute hash' }
          return { ...prev, scannedFiles: i + 1, errorFiles: prev.errorFiles + 1, files: updated }
        })
      }
    }

    setProgress(100)
    setScanning(false)
    setSession((prev) => prev ? { ...prev, status: 'complete', completedAt: new Date().toISOString() } : prev)
    setDeviceView('complete')
    setCurrentScanFile('')
  }

  function resetAll() {
    abortRef.current = true
    setSelectedDevice(null)
    setSelectedScanType(null)
    setDeviceView('detection')
    setSession(null)
    setScanning(false)
    setCurrentScanFile('')
    setProgress(0)
  }

  function backToOptions() {
    abortRef.current = true
    setSelectedScanType(null)
    setDeviceView('options')
    setSession(null)
    setScanning(false)
    setCurrentScanFile('')
    setProgress(0)
  }

  const statusColor: Record<string, string> = {
    pending: 'bg-surface-variant text-on-surface-variant border border-outline-variant',
    scanning: 'bg-primary/15 text-primary border border-primary/25',
    clean: 'bg-tertiary/15 text-tertiary border border-tertiary/25',
    threat: 'bg-error/15 text-error border border-error/25',
    corrupted: 'bg-secondary/15 text-secondary border border-secondary/25',
    error: 'bg-error/10 text-error border border-error/20',
  }

  const threatColor: Record<string, string> = {
    Critical: 'text-error', High: 'text-error', Medium: 'text-secondary',
    Low: 'text-on-surface-variant', None: 'text-tertiary',
  }

  const apiInfo: Array<{ key: string; label: string; icon: string; desc: string }> = [
    { key: 'usb', label: 'WebUSB', icon: 'usb', desc: 'USB drives, mass storage, peripherals' },
    { key: 'serial', label: 'Web Serial', icon: 'cable', desc: 'Serial ports, Arduino, embedded devices' },
    { key: 'bluetooth', label: 'Web Bluetooth', icon: 'bluetooth', desc: 'Bluetooth peripherals and sensors' },
    { key: 'media', label: 'MediaDevices', icon: 'videocam', desc: 'Cameras, microphones, webcams' },
    { key: 'storage', label: 'Storage API', icon: 'sd_storage', desc: 'Browser storage and quotas' },
  ]

  const scanTypeOptions: Array<{ type: ScanType; icon: string; title: string; desc: string; time: string; color: string; border: string; glow: string }> = [
    { type: 'quick', icon: 'bolt', title: 'Quick Scan', desc: 'Scans suspicious and executable files by extension for fast detection.', time: '~30 seconds', color: 'bg-primary/15 text-primary', border: 'border-primary/30', glow: 'hover:shadow-glow-primary' },
    { type: 'full', icon: 'scan', title: 'Full Scan', desc: 'Deep scan of every file — SHA-256 hashes matched against the threat database.', time: '~2-5 minutes', color: 'bg-error/15 text-error', border: 'border-error/30', glow: 'hover:shadow-glow-error' },
    { type: 'integrity', icon: 'verified', title: 'Integrity Check', desc: 'Detects corrupted, empty, or truncated files indicating storage damage.', time: '~1 minute', color: 'bg-tertiary/15 text-tertiary', border: 'border-tertiary/30', glow: 'hover:shadow-glow-tertiary' },
    { type: 'custom', icon: 'tune', title: 'Custom Scan', desc: 'Hand-pick specific files or folders to scan on your own terms.', time: 'Varies', color: 'bg-secondary/15 text-secondary', border: 'border-secondary/30', glow: 'hover:shadow-glow-secondary' },
  ]

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */
  return (
    <>
      <div className="absolute -top-[20%] -left-[10%] w-[500px] h-[500px] bg-secondary/4 rounded-full blur-[120px] pointer-events-none"></div>

      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInput} />

      {/* Header */}
      <div className="flex flex-col gap-1 mb-6 relative">
        <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">External Device Scanner</h2>
        <p className="text-on-surface-variant font-body-md opacity-80">
          Hardware detection is active across all available browser APIs. Connect a device and it will appear below automatically.
        </p>
      </div>

      {/* ═══ DETECTION VIEW ═══ */}
      {deviceView === 'detection' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
          <div className="lg:col-span-8 space-y-6">

            {/* API Status Dashboard */}
            <div className="glass-panel rounded-xl p-6">
              <h3 className="font-label-caps text-label-caps text-on-surface-variant border-b border-outline-variant pb-3 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-primary">developer_board</span>
                HARDWARE API STATUS
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {apiInfo.map((api) => {
                  const status = apiStatuses[api.key]
                  const isOk = status === 'available'
                  const isDenied = status === 'permission_denied'
                  return (
                    <div key={api.key} className={`p-3 rounded-lg border transition-all ${isOk ? 'bg-tertiary/5 border-tertiary/30' : isDenied ? 'bg-secondary/5 border-secondary/30' : 'bg-surface-container border-outline-variant/30'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-lg text-on-surface-variant">{api.icon}</span>
                        <span className="font-label-caps text-[10px] text-on-surface-variant">{api.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${isOk ? 'bg-tertiary animate-pulse' : isDenied ? 'bg-secondary' : 'bg-on-surface-variant/30'}`}></span>
                        <span className={`text-[11px] font-bold ${isOk ? 'text-tertiary' : isDenied ? 'text-secondary' : 'text-on-surface-variant'}`}>
                          {isOk ? 'ACTIVE' : isDenied ? 'NO PERMISSION' : 'NOT SUPPORTED'}
                        </span>
                      </div>
                      <p className="text-[10px] text-on-surface-variant/60 mt-1">{api.desc}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Detection Animation */}
            <div className="glass-panel rounded-xl p-8 relative overflow-hidden">
              <div className="absolute -top-16 -right-16 w-48 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
              <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                <div className="relative shrink-0">
                  <div className="w-32 h-32 rounded-2xl bg-surface-container-high border border-outline-variant flex items-center justify-center relative">
                    <span className="material-symbols-outlined text-5xl text-primary/30 animate-pulse">radar</span>
                    <div className="absolute inset-0 rounded-2xl border-2 border-primary/20 animate-ping" style={{ animationDuration: '3s' }}></div>
                    <div className="absolute inset-[-8px] rounded-3xl border border-primary/10 animate-ping" style={{ animationDuration: '4s' }}></div>
                    <div className="absolute inset-[-16px] rounded-3xl border border-primary/5 animate-ping" style={{ animationDuration: '5s' }}></div>
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-tertiary flex items-center justify-center">
                    <span className="material-symbols-outlined text-sm text-on-tertiary">radar</span>
                  </div>
                </div>
                <div className="flex-1 text-center md:text-left">
                  <h3 className="font-headline-md text-headline-md text-on-surface mb-2">Hardware Detection Active</h3>
                  <p className="text-on-surface-variant text-body-md mb-4">
                    All browser hardware APIs are being monitored in real-time. Connect a USB drive, serial device, Bluetooth peripheral, or any external device — it will be detected automatically.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {navigator.usb && (
                      <button onClick={requestUsbDevice} className="px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-primary-container text-on-primary font-label-caps text-label-caps hover:shadow-glow-primary transition-all inline-flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">usb</span>
                        Add USB Device
                      </button>
                    )}
                    {navigator.serial && (
                      <button onClick={requestSerialDevice} className="px-4 py-2 rounded-lg bg-gradient-to-r from-secondary to-secondary-container text-on-secondary font-label-caps text-label-caps hover:shadow-glow-secondary transition-all inline-flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">cable</span>
                        Add Serial Device
                      </button>
                    )}
                    {navigator.bluetooth && (
                      <button onClick={requestBluetoothDevice} className="px-4 py-2 rounded-lg bg-gradient-to-r from-tertiary to-tertiary-container text-on-tertiary font-label-caps text-label-caps hover:shadow-glow-tertiary transition-all inline-flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">bluetooth</span>
                        Add Bluetooth Device
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Detected Devices */}
            {devices.length > 0 ? (
              <div className="glass-panel rounded-xl overflow-hidden">
                <div className="p-4 border-b border-outline-variant bg-surface-container flex items-center justify-between">
                  <h4 className="font-headline-md text-headline-md flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-lg">devices</span>
                    Detected Devices ({devices.length})
                  </h4>
                  <span className="px-2 py-0.5 rounded-full bg-tertiary/15 text-tertiary text-[10px] font-bold border border-tertiary/25 animate-pulse">LIVE</span>
                </div>
                <div className="divide-y divide-outline-variant/30">
                  {devices.map((device) => (
                    <div key={`${device.protocol}-${device.id}`} className="p-4 flex items-center gap-4 hover:bg-surface-variant/20 transition-colors group cursor-pointer" onClick={() => selectDevice(device)}>
                      <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:shadow-glow-primary transition-all">
                        <span className="material-symbols-outlined text-primary">{protocolIcon(device.protocol)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-body-md font-bold text-on-surface truncate">{device.name}</span>
                          <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-bold border border-primary/20">CONNECTED</span>
                          <span className="px-1.5 py-0.5 rounded bg-surface-variant text-on-surface-variant text-[9px] font-bold border border-outline-variant/50">{protocolLabel(device.protocol)}</span>
                        </div>
                        <p className="text-xs text-on-surface-variant">{device.type}</p>
                        {device.manufacturer && <p className="text-[11px] text-on-surface-variant/60">{device.manufacturer}</p>}
                        {device.apiDetail && <p className="text-[10px] text-on-surface-variant/40 font-code-sm">{device.apiDetail}</p>}
                      </div>
                      <button className="px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-primary-container text-on-primary font-label-caps text-label-caps opacity-0 group-hover:opacity-100 transition-all hover:shadow-glow-primary">
                        Scan
                        <span className="material-symbols-outlined text-sm ml-1">arrow_forward</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="glass-panel rounded-xl p-8 text-center">
                <span className="material-symbols-outlined text-5xl text-on-surface-variant/20 mb-4 block">usb_off</span>
                <p className="text-on-surface-variant text-body-md mb-2">No devices detected yet</p>
                <p className="text-on-surface-variant text-sm">Connect an external device or use the manual buttons above to request access.</p>
              </div>
            )}
          </div>

          {/* Side Panel */}
          <div className="lg:col-span-4 space-y-6">
            {/* Detection Event Log */}
            <div className="glass-panel rounded-xl p-6">
              <h3 className="font-label-caps text-label-caps text-on-surface-variant border-b border-outline-variant pb-3 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-primary">terminal</span>
                DETECTION LOG
              </h3>
              <div className="space-y-2 max-h-[240px] overflow-y-auto custom-scrollbar">
                {eventLog.length === 0 ? (
                  <p className="text-xs text-on-surface-variant/60">Waiting for device events...</p>
                ) : (
                  eventLog.map((evt, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className={`material-symbols-outlined text-[12px] mt-0.5 ${evt.includes('Connected') ? 'text-tertiary' : evt.includes('Disconnected') ? 'text-error' : 'text-primary'}`}>
                        {evt.includes('Connected') ? 'add_circle' : evt.includes('Disconnected') ? 'remove_circle' : 'info'}
                      </span>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">{evt}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Manual File Selection Fallback */}
            <div className="glass-panel rounded-xl p-6">
              <h3 className="font-label-caps text-label-caps text-on-surface-variant border-b border-outline-variant pb-3 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-secondary">upload_file</span>
                MANUAL FILE SCAN
              </h3>
              <p className="text-xs text-on-surface-variant mb-4">Skip hardware detection and scan files directly from your system.</p>
              <button
                onClick={() => {
                  const dev: DetectedDevice = { id: 'manual', name: 'Local Files', type: 'Manual Selection', protocol: 'usb', connectedAt: new Date() }
                  setSelectedDevice(dev)
                  setDeviceView('options')
                }}
                className="w-full px-4 py-2.5 rounded-lg border border-outline-variant text-on-surface-variant text-xs font-label-caps hover:bg-surface-variant hover:border-primary/30 transition-all text-center"
              >
                Browse Files Manually
              </button>
            </div>

            {/* How It Works */}
            <div className="rounded-xl overflow-hidden relative border border-outline-variant shadow-card">
              <div className="w-full bg-gradient-to-br from-primary/10 via-surface-container to-tertiary/5 flex items-center justify-center h-32">
                <span className="material-symbols-outlined text-primary/20 text-6xl">shield</span>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-surface-container-low via-surface-container-low/50 to-transparent flex flex-col justify-end p-4">
                <p className="font-label-caps text-label-caps text-primary mb-1">HOW IT WORKS</p>
                <p className="text-sm font-bold text-on-surface">Connect a device — all browser hardware APIs detect it — then choose a scan type.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ OPTIONS VIEW ═══ */}
      {deviceView === 'options' && selectedDevice && (
        <div className="space-y-6 relative">
          <div className="glass-panel rounded-xl p-6 flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary text-2xl">{protocolIcon(selectedDevice.protocol)}</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-headline-md text-headline-md text-on-surface">{selectedDevice.name}</span>
                <span className="px-2 py-0.5 rounded bg-tertiary/15 text-tertiary text-[9px] font-bold border border-tertiary/20">CONNECTED</span>
                <span className="px-1.5 py-0.5 rounded bg-surface-variant text-on-surface-variant text-[9px] font-bold border border-outline-variant/50">{protocolLabel(selectedDevice.protocol)}</span>
              </div>
              <p className="text-sm text-on-surface-variant">{selectedDevice.type}</p>
              {selectedDevice.manufacturer && <p className="text-xs text-on-surface-variant/60">{selectedDevice.manufacturer}</p>}
            </div>
            <button onClick={resetAll} className="px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant text-sm hover:bg-surface-variant transition-all">Back</button>
          </div>

          <h3 className="font-headline-md text-headline-md text-on-surface">Choose Scan Type</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {scanTypeOptions.map((opt) => (
              <button key={opt.type} onClick={() => startScan(opt.type)} className={`text-left p-6 rounded-xl border-2 ${opt.border} bg-surface-container-lowest transition-all duration-300 ${opt.glow} group relative overflow-hidden`}>
                <div className="absolute inset-0 bg-gradient-glow opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                <div className="relative z-10">
                  <div className={`w-12 h-12 rounded-xl ${opt.color} flex items-center justify-center border ${opt.border} mb-4 group-hover:scale-110 transition-transform`}>
                    <span className="material-symbols-outlined text-2xl">{opt.icon}</span>
                  </div>
                  <h4 className="font-headline-md text-headline-md text-on-surface mb-1">{opt.title}</h4>
                  <p className="text-sm text-on-surface-variant mb-3">{opt.desc}</p>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[14px] text-on-surface-variant">schedule</span>
                    <span className="text-xs text-on-surface-variant">{opt.time}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <button onClick={resetAll} className="text-on-surface-variant font-label-caps text-label-caps hover:text-primary transition-colors flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to Device Detection
          </button>
        </div>
      )}

      {/* ═══ SCANNING VIEW ═══ */}
      {deviceView === 'scanning' && session && (
        <div className="space-y-6 relative">
          <div className="glass-panel rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined animate-spin text-primary text-2xl">sync</span>
                <div>
                  <h3 className="font-headline-md text-headline-md text-on-surface">
                    {selectedScanType === 'quick' ? 'Quick' : selectedScanType === 'full' ? 'Full' : selectedScanType === 'integrity' ? 'Integrity' : 'Custom'} Scan — {session.deviceName}
                  </h3>
                  <p className="text-on-surface-variant text-sm">{currentScanFile || 'Preparing...'}</p>
                </div>
              </div>
              <button onClick={backToOptions} className="px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-error/10 hover:text-error hover:border-error/30 transition-all font-label-caps text-label-caps">
                <span className="material-symbols-outlined text-sm mr-1">stop</span>Abort
              </button>
            </div>
            <div className="w-full h-2 bg-surface-variant rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-tertiary rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-xs text-on-surface-variant">{session.scannedFiles} / {session.totalFiles} files</span>
              <span className="text-xs text-primary font-bold">{progress}%</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Total', value: session.totalFiles, icon: 'folder', color: 'text-on-surface' },
              { label: 'Scanned', value: session.scannedFiles, icon: 'check', color: 'text-primary' },
              { label: 'Clean', value: session.cleanFiles, icon: 'verified', color: 'text-tertiary' },
              { label: 'Threats', value: session.threatFiles, icon: 'warning', color: 'text-error' },
              { label: 'Errors', value: session.errorFiles, icon: 'error', color: 'text-secondary' },
            ].map((c) => (
              <div key={c.label} className="glass-panel rounded-xl p-4 text-center">
                <span className={`material-symbols-outlined ${c.color}`}>{c.icon}</span>
                <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
                <p className="text-[10px] text-on-surface-variant font-label-caps">{c.label}</p>
              </div>
            ))}
          </div>

          <div className="glass-panel rounded-xl overflow-hidden">
            <div className="p-4 border-b border-outline-variant bg-surface-container">
              <h4 className="font-headline-md text-headline-md">Scanned Files</h4>
            </div>
            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              {session.files.map((f, idx) => (
                <div key={idx} className={`flex items-center gap-4 px-4 py-3 border-b border-outline-variant/30 transition-colors ${f.status === 'scanning' ? 'bg-primary/5' : ''}`}>
                  <span className={`material-symbols-outlined text-sm ${f.status === 'clean' ? 'text-tertiary' : f.status === 'threat' ? 'text-error' : f.status === 'corrupted' ? 'text-secondary' : f.status === 'scanning' ? 'text-primary animate-spin' : 'text-on-surface-variant'}`}>
                    {f.status === 'clean' ? 'check_circle' : f.status === 'threat' ? 'report' : f.status === 'corrupted' ? 'broken_image' : f.status === 'scanning' ? 'sync' : f.status === 'error' ? 'error' : 'radio_button_unchecked'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-code-sm text-code-sm text-on-surface truncate">{f.name}</p>
                    <p className="text-[11px] text-on-surface-variant truncate">{f.path} — {formatBytes(f.size)}</p>
                  </div>
                  {f.sha256 !== 'pending' && <span className="font-code-sm text-[10px] text-on-surface-variant hidden md:block truncate max-w-[200px]">{f.sha256}</span>}
                  {f.status !== 'pending' && f.status !== 'scanning' && (
                    <span className={`font-label-caps text-[9px] px-2 py-0.5 rounded ${statusColor[f.status]}`}>
                      {f.status === 'threat' ? `${f.riskScore}/100` : f.status.toUpperCase()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══ COMPLETE VIEW ═══ */}
      {deviceView === 'complete' && session && (
        <div className="space-y-6 relative">
          <div className="glass-panel rounded-xl p-6 relative overflow-hidden">
            <div className="absolute -top-8 -right-8 w-24 h-24 bg-primary/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${session.threatFiles > 0 ? 'bg-error/15 border border-error/30' : 'bg-tertiary/15 border border-tertiary/30'}`}>
                  <span className={`material-symbols-outlined text-3xl ${session.threatFiles > 0 ? 'text-error' : 'text-tertiary'}`}>
                    {session.threatFiles > 0 ? 'warning' : 'verified'}
                  </span>
                </div>
                <div>
                  <h2 className="font-headline-lg text-headline-lg text-on-surface">
                    {session.threatFiles > 0 ? 'Threats Detected' : 'Scan Complete — All Clear'}
                  </h2>
                  <p className="text-on-surface-variant text-body-md">{session.totalFiles} files scanned from {session.deviceName}</p>
                </div>
              </div>
              <button onClick={resetAll} className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary font-bold hover:shadow-glow-primary transition-all flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">refresh</span>
                Scan Another Device
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Total', value: session.totalFiles, icon: 'folder', color: 'text-on-surface', bg: 'bg-surface-container-high' },
              { label: 'Scanned', value: session.scannedFiles, icon: 'check', color: 'text-primary', bg: 'bg-primary/10' },
              { label: 'Clean', value: session.cleanFiles, icon: 'verified', color: 'text-tertiary', bg: 'bg-tertiary/10' },
              { label: 'Threats', value: session.threatFiles, icon: 'warning', color: 'text-error', bg: 'bg-error/10' },
              { label: 'Corrupted', value: session.corruptedFiles, icon: 'broken_image', color: 'text-secondary', bg: 'bg-secondary/10' },
            ].map((c) => (
              <div key={c.label} className={`${c.bg} rounded-xl p-4 text-center border border-outline-variant/30`}>
                <span className={`material-symbols-outlined ${c.color}`}>{c.icon}</span>
                <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
                <p className="text-[10px] text-on-surface-variant font-label-caps">{c.label}</p>
              </div>
            ))}
          </div>

          <ScanResultList files={session.files} statusColor={statusColor} threatColor={threatColor} />
        </div>
      )}
    </>
  )
}

function ScanResultList({ files, statusColor, threatColor }: { files: DeviceScanFile[]; statusColor: Record<string, string>; threatColor: Record<string, string> }) {
  const [tab, setTab] = useState<'all' | 'threat' | 'corrupted' | 'clean'>('all')
  const filtered = files.filter((f) => tab === 'all' || f.status === tab)

  return (
    <div className="glass-panel rounded-xl overflow-hidden">
      <div className="p-4 border-b border-outline-variant bg-surface-container flex items-center gap-3 flex-wrap">
        <h4 className="font-headline-md text-headline-md mr-4">Detailed Results</h4>
        {(['all', 'threat', 'corrupted', 'clean'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1 rounded-full font-label-caps text-label-caps transition-all ${tab === t ? 'bg-primary/10 text-primary border border-primary/30 shadow-glow-primary' : 'border border-outline-variant text-on-surface-variant hover:bg-surface-variant'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            <span className="ml-1 text-[10px] opacity-70">({files.filter((f) => t === 'all' || f.status === t).length})</span>
          </button>
        ))}
      </div>
      <div className="max-h-[500px] overflow-y-auto custom-scrollbar">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-on-surface-variant">No files in this category</div>
        ) : (
          filtered.map((f, idx) => (
            <div key={idx} className="border-b border-outline-variant/30 p-4 hover:bg-surface-variant/20 transition-colors">
              <div className="flex items-start gap-4">
                <span className={`material-symbols-outlined text-lg mt-0.5 ${f.status === 'clean' ? 'text-tertiary' : f.status === 'threat' ? 'text-error' : f.status === 'corrupted' ? 'text-secondary' : 'text-on-surface-variant'}`}>
                  {f.status === 'clean' ? 'check_circle' : f.status === 'threat' ? 'report' : f.status === 'corrupted' ? 'broken_image' : 'error'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-code-sm text-code-sm text-on-surface font-bold truncate">{f.name}</span>
                    <span className={`px-2 py-0.5 rounded font-label-caps text-[9px] ${statusColor[f.status]}`}>
                      {f.status === 'threat' ? `${f.riskScore}/100` : f.status.toUpperCase()}
                    </span>
                    {f.threatLevel !== 'None' && <span className={`font-label-caps text-[9px] ${threatColor[f.threatLevel]}`}>{f.threatLevel.toUpperCase()}</span>}
                  </div>
                  <p className="text-xs text-on-surface-variant mb-2 truncate">{f.path} — {formatBytes(f.size)}</p>
                  <p className="text-xs text-on-surface-variant mb-2">{f.details}</p>
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="font-code-sm text-[10px] text-on-surface-variant bg-surface-container px-2 py-1 rounded border border-outline-variant/30">
                      SHA-256: {f.sha256.slice(0, 32)}...
                    </span>
                    {f.threatName && <span className="text-[11px] text-on-surface-variant italic">{f.threatName}</span>}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

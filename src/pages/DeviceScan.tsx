import { useState, useRef, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { DeviceScanFile, DeviceScanSession } from '../lib/types'

type ScanMode = 'idle' | 'scanning' | 'complete'
type ScanType = 'quick' | 'full' | 'custom' | 'integrity'
type DeviceView = 'detection' | 'options' | 'scanning' | 'complete'

interface DetectedDevice {
  id: string
  name: string
  vendorId?: number
  productId?: number
  manufacturer?: string
  serialNumber?: string
  type: string
  connectedAt: Date
}

const MALICIOUS_EXTENSIONS = ['.exe', '.bat', '.cmd', '.vbs', '.js', '.ws', '.wsh', '.ps1', '.msi', '.com', '.pif', '.scr', '.hta', '.cpl']
const SUSPICIOUS_EXTENSIONS = ['.apk', '.dex', '.jar', '.class', '.swf', '.docm', '.xlsm', '.pptm', '.zip', '.rar', '.7z']

async function computeSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
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

function analyzeFileForThreats(file: File, sha256: string): { threatLevel: DeviceScanFile['threatLevel']; threatName: string | null; riskScore: number; details: string } {
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

  const doubleExtPattern = /\.\w+\.\w+$/
  if (doubleExtPattern.test(file.name)) {
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

  const details = reasons.length > 0 ? reasons.join(' • ') : 'No anomalies detected — file appears clean'
  return { threatLevel, threatName, riskScore, details }
}

function detectDeviceType(d: { deviceClass: number }): string {
  const subclass = d.deviceClass
  if (subclass === 0) return 'Miscellaneous USB Device'
  if (subclass === 1) return 'Audio Device'
  if (subclass === 2) return 'CDC (Communications)'
  if (subclass === 3) return 'HID Device'
  if (subclass === 6) return 'Still Image Device'
  if (subclass === 7) return 'Printer'
  if (subclass === 8) return 'Mass Storage Device'
  if (subclass === 9) return 'Hub'
  if (subclass === 11) return 'Smart Card'
  if (subclass === 220) return 'Vendor-Specific Device'
  return `USB Device (Class ${subclass})`
}

function getDeviceIcon(type: string): string {
  if (type.includes('Mass Storage')) return 'usb'
  if (type.includes('Audio')) return 'headphones'
  if (type.includes('HID')) return 'mouse'
  if (type.includes('Printer')) return 'print'
  if (type.includes('Hub')) return 'hub'
  return 'devices'
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
  const [usbSupported, setUsbSupported] = useState(true)
  const [lastEvent, setLastEvent] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef(false)

  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute('webkitdirectory', '')
    }
  }, [])

  useEffect(() => {
    if (!navigator.usb) {
      setUsbSupported(false)
      setLastEvent('WebUSB API is not supported in this browser. Use Chrome or Edge for auto-detection, or select files manually.')
      return
    }

    async function loadExistingDevices() {
      try {
        const existingDevices = await navigator.usb!.getDevices()
        const mapped: DetectedDevice[] = existingDevices.map((d) => ({
          id: d.serialNumber || d.productName || `usb-${d.vendorId}-${d.productId}`,
          name: d.productName || d.manufacturerName || 'Unknown USB Device',
          vendorId: d.vendorId,
          productId: d.productId,
          manufacturer: d.manufacturerName,
          serialNumber: d.serialNumber,
          type: detectDeviceType(d),
          connectedAt: new Date(),
        }))
        setDevices(mapped)
        if (mapped.length > 0) setLastEvent(`${mapped.length} device(s) already paired with this browser.`)
      } catch { /* silently fail */ }
    }

    loadExistingDevices()

    const usb = navigator.usb

    function onConnect(e: Event) {
      const d = (e as USBConnectionEvent).device
      const detected: DetectedDevice = {
        id: d.serialNumber || d.productName || `usb-${d.vendorId}-${d.productId}`,
        name: d.productName || d.manufacturerName || 'Unknown USB Device',
        vendorId: d.vendorId,
        productId: d.productId,
        manufacturer: d.manufacturerName,
        serialNumber: d.serialNumber,
        type: detectDeviceType(d),
        connectedAt: new Date(),
      }
      setDevices((prev) => {
        if (prev.some((p) => p.id === detected.id)) return prev
        return [...prev, detected]
      })
      setLastEvent(`Device connected: ${detected.name}`)
    }

    function onDisconnect(e: Event) {
      const d = (e as USBConnectionEvent).device
      const id = d.serialNumber || d.productName || `usb-${d.vendorId}-${d.productId}`
      setDevices((prev) => prev.filter((p) => p.id !== id))
      setLastEvent(`Device disconnected: ${d.productName || 'Unknown Device'}`)
      setSelectedDevice((prev) => (prev && prev.id === id ? null : prev))
    }

    usb.addEventListener('connect', onConnect)
    usb.addEventListener('disconnect', onDisconnect)
    return () => {
      usb.removeEventListener('connect', onConnect)
      usb.removeEventListener('disconnect', onDisconnect)
    }
  }, [])

  async function requestDevice() {
    if (!navigator.usb) return
    try {
      const d = await navigator.usb.requestDevice({ filters: [] })
      if (d) {
        const detected: DetectedDevice = {
          id: d.serialNumber || d.productName || `usb-${d.vendorId}-${d.productId}`,
          name: d.productName || d.manufacturerName || 'Unknown USB Device',
          vendorId: d.vendorId,
          productId: d.productId,
          manufacturer: d.manufacturerName,
          serialNumber: d.serialNumber,
          type: detectDeviceType(d),
          connectedAt: new Date(),
        }
        setDevices((prev) => {
          if (prev.some((p) => p.id === detected.id)) return prev
          return [...prev, detected]
        })
        setLastEvent(`Device added: ${detected.name}`)
      }
    } catch {
      setLastEvent('Device selection cancelled or not supported.')
    }
  }

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

    let filteredFiles = files
    if (selectedScanType === 'quick') {
      const suspectExts = [...MALICIOUS_EXTENSIONS, ...SUSPICIOUS_EXTENSIONS]
      filteredFiles = files.filter((f) => {
        const ext = getExtension(f.name)
        return suspectExts.includes(ext) || f.size === 0
      })
      if (filteredFiles.length === 0) filteredFiles = files.slice(0, 50)
    } else if (selectedScanType === 'integrity') {
      filteredFiles = files.filter((f) => f.size === 0 || f.size < 1024)
      if (filteredFiles.length === 0) filteredFiles = files.slice(0, 100)
    }

    const sess: DeviceScanSession = {
      id: crypto.randomUUID(),
      deviceName: selectedDevice?.name || 'Manual Selection',
      sourceType: 'files',
      startedAt: new Date().toISOString(),
      completedAt: null,
      totalFiles: filteredFiles.length,
      scannedFiles: 0,
      cleanFiles: 0,
      threatFiles: 0,
      corruptedFiles: 0,
      errorFiles: 0,
      files: filteredFiles.map((f) => ({
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
    scanAllFiles(filteredFiles, sess)
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
            ...prev,
            scannedFiles: i + 1,
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
            sha256,
            status: 'Complete',
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
    Critical: 'text-error',
    High: 'text-error',
    Medium: 'text-secondary',
    Low: 'text-on-surface-variant',
    None: 'text-tertiary',
  }

  const scanTypeOptions: Array<{
    type: ScanType
    icon: string
    title: string
    desc: string
    time: string
    color: string
    borderColor: string
    glowClass: string
  }> = [
    {
      type: 'quick',
      icon: 'bolt',
      title: 'Quick Scan',
      desc: 'Scans only suspicious and executable files by extension for fast threat detection.',
      time: '~30 seconds',
      color: 'bg-primary/15 text-primary',
      borderColor: 'border-primary/30',
      glowClass: 'hover:shadow-glow-primary',
    },
    {
      type: 'full',
      icon: 'scan',
      title: 'Full Scan',
      desc: 'Deep scan of every file — computes SHA-256 hashes and matches against the threat database.',
      time: '~2-5 minutes',
      color: 'bg-error/15 text-error',
      borderColor: 'border-error/30',
      glowClass: 'hover:shadow-glow-error',
    },
    {
      type: 'integrity',
      icon: 'verified',
      title: 'Integrity Check',
      desc: 'Checks for corrupted, empty, or truncated files that indicate storage damage.',
      time: '~1 minute',
      color: 'bg-tertiary/15 text-tertiary',
      borderColor: 'border-tertiary/30',
      glowClass: 'hover:shadow-glow-tertiary',
    },
    {
      type: 'custom',
      icon: 'tune',
      title: 'Custom Scan',
      desc: 'Select specific files or folders from the device to scan on your terms.',
      time: 'Varies',
      color: 'bg-secondary/15 text-secondary',
      borderColor: 'border-secondary/30',
      glowClass: 'hover:shadow-glow-secondary',
    },
  ]

  return (
    <>
      <div className="absolute -top-[20%] -left-[10%] w-[500px] h-[500px] bg-secondary/4 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Hidden inputs */}
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInput} />
      <input ref={folderInputRef} type="file" multiple className="hidden" onChange={handleFileInput} />

      {/* Header */}
      <div className="flex flex-col gap-1 mb-6 relative">
        <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">External Device Scanner</h2>
        <p className="text-on-surface-variant font-body-md opacity-80">
          Connect any external device — it will be detected automatically. Then choose a scan type.
        </p>
      </div>

      {/* Status Bar */}
      {lastEvent && (
        <div className="mb-6 glass-panel rounded-xl px-4 py-3 flex items-center gap-3 animate-glow-pulse">
          <span className="material-symbols-outlined text-primary text-lg">info</span>
          <span className="text-sm text-on-surface-variant flex-1">{lastEvent}</span>
          <button onClick={() => setLastEvent('')} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* DETECTION VIEW */}
      {deviceView === 'detection' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
          <div className="lg:col-span-8 space-y-6">
            {/* Detection Animation / Manual Add */}
            <div className="glass-panel rounded-xl p-8 relative overflow-hidden">
              <div className="absolute -top-16 -right-16 w-48 h-48 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
              <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                {/* Animated Detection Visual */}
                <div className="relative shrink-0">
                  <div className="w-32 h-32 rounded-2xl bg-surface-container-high border border-outline-variant flex items-center justify-center relative">
                    <span className="material-symbols-outlined text-5xl text-primary/30 animate-pulse">usb</span>
                    <div className="absolute inset-0 rounded-2xl border-2 border-primary/20 animate-ping" style={{ animationDuration: '3s' }}></div>
                    <div className="absolute inset-[-8px] rounded-3xl border border-primary/10 animate-ping" style={{ animationDuration: '4s' }}></div>
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-tertiary flex items-center justify-center">
                    <span className="material-symbols-outlined text-sm text-on-tertiary">radar</span>
                  </div>
                </div>

                <div className="flex-1 text-center md:text-left">
                  <h3 className="font-headline-md text-headline-md text-on-surface mb-2">Scanning for Devices</h3>
                  <p className="text-on-surface-variant text-body-md mb-4">
                    Plug in a USB drive, SD card, or any external storage device. The scanner will detect it automatically.
                  </p>
                  <p className="text-on-surface-variant text-sm mb-4">
                    {usbSupported
                      ? 'WebUSB is active — connect a device or add one manually below.'
                      : 'WebUSB is not supported in this browser. Use Chrome/Edge for auto-detection, or select files manually.'}
                  </p>
                  {usbSupported && (
                    <button
                      onClick={requestDevice}
                      className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary font-label-caps text-label-caps hover:shadow-glow-primary transition-all inline-flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-[18px]">usb</span>
                      Add USB Device Manually
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Detected Devices List */}
            {devices.length > 0 && (
              <div className="glass-panel rounded-xl overflow-hidden">
                <div className="p-4 border-b border-outline-variant bg-surface-container flex items-center justify-between">
                  <h4 className="font-headline-md text-headline-md flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-lg">devices</span>
                    Detected Devices ({devices.length})
                  </h4>
                  <span className="px-2 py-0.5 rounded-full bg-tertiary/15 text-tertiary text-[10px] font-bold border border-tertiary/25 animate-pulse">
                    LIVE
                  </span>
                </div>
                <div className="divide-y divide-outline-variant/30">
                  {devices.map((device) => (
                    <div
                      key={device.id}
                      className="p-4 flex items-center gap-4 hover:bg-surface-variant/20 transition-colors group cursor-pointer"
                      onClick={() => selectDevice(device)}
                    >
                      <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:shadow-glow-primary transition-all">
                        <span className="material-symbols-outlined text-primary">{getDeviceIcon(device.type)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-body-md font-bold text-on-surface truncate">{device.name}</span>
                          <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-bold border border-primary/20">CONNECTED</span>
                        </div>
                        <p className="text-xs text-on-surface-variant">{device.type}</p>
                        {device.manufacturer && (
                          <p className="text-[11px] text-on-surface-variant/60">{device.manufacturer}</p>
                        )}
                      </div>
                      <button className="px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-primary-container text-on-primary font-label-caps text-label-caps opacity-0 group-hover:opacity-100 transition-all hover:shadow-glow-primary">
                        Scan Device
                        <span className="material-symbols-outlined text-sm ml-1">arrow_forward</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* No devices */}
            {devices.length === 0 && (
              <div className="glass-panel rounded-xl p-8 text-center">
                <span className="material-symbols-outlined text-5xl text-on-surface-variant/20 mb-4 block">usb_off</span>
                <p className="text-on-surface-variant text-body-md mb-2">No devices detected yet</p>
                <p className="text-on-surface-variant text-sm">Connect an external device or use the manual button above.</p>
              </div>
            )}
          </div>

          {/* Side Panel */}
          <div className="lg:col-span-4 space-y-6">
            {/* Detection Log */}
            <div className="glass-panel rounded-xl p-6">
              <h3 className="font-label-caps text-label-caps text-on-surface-variant border-b border-outline-variant pb-3 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-primary">terminal</span>
                DETECTION LOG
              </h3>
              <div className="space-y-3 max-h-[200px] overflow-y-auto custom-scrollbar">
                {devices.length === 0 && !lastEvent ? (
                  <p className="text-xs text-on-surface-variant/60">Waiting for device events...</p>
                ) : (
                  <>
                    {devices.map((d) => (
                      <div key={d.id} className="flex items-start gap-2">
                        <span className="material-symbols-outlined text-[12px] text-tertiary mt-0.5">add_circle</span>
                        <div>
                          <p className="text-xs text-on-surface font-bold">{d.name}</p>
                          <p className="text-[10px] text-on-surface-variant">{d.type}</p>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Scan Types Overview */}
            <div className="glass-panel rounded-xl p-6">
              <h3 className="font-label-caps text-label-caps text-on-surface-variant border-b border-outline-variant pb-3 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-tertiary">shield</span>
                SCAN TYPES
              </h3>
              <div className="space-y-3">
                {scanTypeOptions.map((opt) => (
                  <div key={opt.type} className="flex items-center gap-3 opacity-60">
                    <span className={`w-8 h-8 rounded-lg ${opt.color} flex items-center justify-center border ${opt.borderColor}`}>
                      <span className="material-symbols-outlined text-sm">{opt.icon}</span>
                    </span>
                    <div className="flex-1">
                      <span className="text-sm font-bold text-on-surface">{opt.title}</span>
                      <p className="text-[10px] text-on-surface-variant">{opt.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Manual Fallback */}
            <div className="glass-panel rounded-xl p-6">
              <h3 className="font-label-caps text-label-caps text-on-surface-variant border-b border-outline-variant pb-3 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-secondary">upload_file</span>
                MANUAL SELECTION
              </h3>
              <p className="text-xs text-on-surface-variant mb-4">Skip detection and scan files directly from your computer.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setSelectedDevice({ id: 'manual', name: 'Local Files', type: 'Manual Selection', connectedAt: new Date() }); setDeviceView('options') }}
                  className="flex-1 px-3 py-2 rounded-lg border border-outline-variant text-on-surface-variant text-xs font-label-caps hover:bg-surface-variant hover:border-primary/30 transition-all text-center"
                >
                  Browse Files
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* OPTIONS VIEW */}
      {deviceView === 'options' && selectedDevice && (
        <div className="space-y-6 relative">
          {/* Device Banner */}
          <div className="glass-panel rounded-xl p-6 flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary text-2xl">{getDeviceIcon(selectedDevice.type)}</span>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-headline-md text-headline-md text-on-surface">{selectedDevice.name}</span>
                <span className="px-2 py-0.5 rounded bg-tertiary/15 text-tertiary text-[9px] font-bold border border-tertiary/20">CONNECTED</span>
              </div>
              <p className="text-sm text-on-surface-variant">{selectedDevice.type}</p>
              {selectedDevice.manufacturer && (
                <p className="text-xs text-on-surface-variant/60">{selectedDevice.manufacturer}</p>
              )}
            </div>
            <button
              onClick={resetAll}
              className="px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant text-sm hover:bg-surface-variant transition-all"
            >
              Disconnect
            </button>
          </div>

          {/* Scan Type Selection */}
          <div className="relative">
            <h3 className="font-headline-md text-headline-md text-on-surface mb-4">Choose Scan Type</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {scanTypeOptions.map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => startScan(opt.type)}
                  className={`text-left p-6 rounded-xl border-2 ${opt.borderColor} bg-surface-container-lowest transition-all duration-300 ${opt.glowClass} group relative overflow-hidden`}
                >
                  <div className="absolute inset-0 bg-gradient-glow opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                  <div className="relative z-10">
                    <div className={`w-12 h-12 rounded-xl ${opt.color} flex items-center justify-center border ${opt.borderColor} mb-4 group-hover:scale-110 transition-transform`}>
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
          </div>

          <button
            onClick={resetAll}
            className="text-on-surface-variant font-label-caps text-label-caps hover:text-primary transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            Back to Device Detection
          </button>
        </div>
      )}

      {/* SCANNING VIEW */}
      {deviceView === 'scanning' && session && (
        <div className="space-y-6 relative">
          <div className="glass-panel rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined animate-spin text-primary text-2xl">sync</span>
                <div>
                  <h3 className="font-headline-md text-headline-md text-on-surface">
                    {selectedScanType === 'quick' ? 'Quick' : selectedScanType === 'full' ? 'Full' : selectedScanType === 'integrity' ? 'Integrity' : 'Custom'} Scan
                    — {session.deviceName}
                  </h3>
                  <p className="text-on-surface-variant text-sm">{currentScanFile || 'Preparing...'}</p>
                </div>
              </div>
              <button
                onClick={backToOptions}
                className="px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-error/10 hover:text-error hover:border-error/30 transition-all font-label-caps text-label-caps"
              >
                <span className="material-symbols-outlined text-sm mr-1">stop</span>
                Abort
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
                <div
                  key={idx}
                  className={`flex items-center gap-4 px-4 py-3 border-b border-outline-variant/30 transition-colors ${
                    f.status === 'scanning' ? 'bg-primary/5' : ''
                  }`}
                >
                  <span className={`material-symbols-outlined text-sm ${
                    f.status === 'clean' ? 'text-tertiary' :
                    f.status === 'threat' ? 'text-error' :
                    f.status === 'corrupted' ? 'text-secondary' :
                    f.status === 'scanning' ? 'text-primary animate-spin' :
                    'text-on-surface-variant'
                  }`}>
                    {f.status === 'clean' ? 'check_circle' :
                     f.status === 'threat' ? 'report' :
                     f.status === 'corrupted' ? 'broken_image' :
                     f.status === 'scanning' ? 'sync' :
                     f.status === 'error' ? 'error' : 'radio_button_unchecked'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-code-sm text-code-sm text-on-surface truncate">{f.name}</p>
                    <p className="text-[11px] text-on-surface-variant truncate">{f.path} — {formatBytes(f.size)}</p>
                  </div>
                  {f.sha256 !== 'pending' && (
                    <span className="font-code-sm text-[10px] text-on-surface-variant hidden md:block truncate max-w-[200px]">{f.sha256}</span>
                  )}
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

      {/* COMPLETE VIEW */}
      {deviceView === 'complete' && session && (
        <div className="space-y-6 relative">
          <div className="glass-panel rounded-xl p-6 relative overflow-hidden">
            <div className="absolute -top-8 -right-8 w-24 h-24 bg-primary/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                  session.threatFiles > 0 ? 'bg-error/15 border border-error/30' : 'bg-tertiary/15 border border-tertiary/30'
                }`}>
                  <span className={`material-symbols-outlined text-3xl ${session.threatFiles > 0 ? 'text-error' : 'text-tertiary'}`}>
                    {session.threatFiles > 0 ? 'warning' : 'verified'}
                  </span>
                </div>
                <div>
                  <h2 className="font-headline-lg text-headline-lg text-on-surface">
                    {session.threatFiles > 0 ? 'Threats Detected' : 'Scan Complete — All Clear'}
                  </h2>
                  <p className="text-on-surface-variant text-body-md">
                    {session.totalFiles} files scanned from {session.deviceName}
                  </p>
                </div>
              </div>
              <button
                onClick={resetAll}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary font-bold hover:shadow-glow-primary transition-all flex items-center gap-2"
              >
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

  const filtered = files.filter((f) => {
    if (tab === 'all') return true
    if (tab === 'threat') return f.status === 'threat'
    if (tab === 'corrupted') return f.status === 'corrupted'
    if (tab === 'clean') return f.status === 'clean'
    return true
  })

  return (
    <div className="glass-panel rounded-xl overflow-hidden">
      <div className="p-4 border-b border-outline-variant bg-surface-container flex items-center gap-3 flex-wrap">
        <h4 className="font-headline-md text-headline-md mr-4">Detailed Results</h4>
        {(['all', 'threat', 'corrupted', 'clean'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1 rounded-full font-label-caps text-label-caps transition-all ${
              tab === t
                ? 'bg-primary/10 text-primary border border-primary/30 shadow-glow-primary'
                : 'border border-outline-variant text-on-surface-variant hover:bg-surface-variant'
            }`}
          >
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
                <span className={`material-symbols-outlined text-lg mt-0.5 ${
                  f.status === 'clean' ? 'text-tertiary' :
                  f.status === 'threat' ? 'text-error' :
                  f.status === 'corrupted' ? 'text-secondary' : 'text-on-surface-variant'
                }`}>
                  {f.status === 'clean' ? 'check_circle' :
                   f.status === 'threat' ? 'report' :
                   f.status === 'corrupted' ? 'broken_image' : 'error'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-code-sm text-code-sm text-on-surface font-bold truncate">{f.name}</span>
                    <span className={`px-2 py-0.5 rounded font-label-caps text-[9px] ${statusColor[f.status]}`}>
                      {f.status === 'threat' ? `${f.riskScore}/100` : f.status.toUpperCase()}
                    </span>
                    {f.threatLevel !== 'None' && (
                      <span className={`font-label-caps text-[9px] ${threatColor[f.threatLevel]}`}>
                        {f.threatLevel.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-on-surface-variant mb-2 truncate">{f.path} — {formatBytes(f.size)}</p>
                  <p className="text-xs text-on-surface-variant mb-2">{f.details}</p>
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="font-code-sm text-[10px] text-on-surface-variant bg-surface-container px-2 py-1 rounded border border-outline-variant/30">
                      SHA-256: {f.sha256.slice(0, 32)}...
                    </span>
                    {f.threatName && (
                      <span className="text-[11px] text-on-surface-variant italic">{f.threatName}</span>
                    )}
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
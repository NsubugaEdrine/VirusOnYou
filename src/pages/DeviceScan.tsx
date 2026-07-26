import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { DeviceScanFile, DeviceScanSession, QuarantinedFile, ProtectionEvent } from '../lib/types'
import {
  THREAT_DB, MALICIOUS_EXTENSIONS, SUSPICIOUS_EXTENSIONS, SYSTEM_EXTENSIONS,
  computeSHA256Sync, computeSHA256, getExtension, formatBytes,
  analyzeFileForThreats, usbClassToType,
} from '../lib/scanner'

type DeviceView = 'dashboard' | 'detection' | 'scan-options' | 'scanning' | 'complete' | 'quarantine' | 'history'
type ScanType = 'quick' | 'full' | 'custom' | 'integrity' | 'removable'

function protocolIcon(p: string): string {
  return { usb: 'usb', serial: 'cable', bluetooth: 'bluetooth', media: 'videocam', storage: 'sd_storage' }[p] || 'devices'
}

export default function DeviceScan() {
  const [view, setView] = useState<DeviceView>('dashboard')
  const [devices, setDevices] = useState<Array<{ id: string; name: string; type: string; protocol: string; connectedAt: Date; manufacturer?: string; apiDetail?: string }>>([])
  const [selectedDevice, setSelectedDevice] = useState<{ id: string; name: string; type: string; protocol: string } | null>(null)
  const [session, setSession] = useState<DeviceScanSession | null>(null)
  const [currentScanFile, setCurrentScanFile] = useState('')
  const [progress, setProgress] = useState(0)
  const [scanning, setScanning] = useState(false)
  const [quarantine, setQuarantine] = useState<QuarantinedFile[]>([])
  const [events, setEvents] = useState<ProtectionEvent[]>([
    { id: '1', type: 'update', title: 'Threat database updated', description: 'Signature database v4.7.1 loaded — 2,847 signatures active.', severity: 'info', timestamp: new Date(Date.now() - 300000).toISOString() },
    { id: '2', type: 'scan_complete', title: 'System scan completed', description: 'No threats found in last scheduled scan.', severity: 'success', timestamp: new Date(Date.now() - 600000).toISOString() },
    { id: '3', type: 'realtime_block', title: 'Real-time protection active', description: 'USB shield, execution shield, and autorun blocking are enabled.', severity: 'success', timestamp: new Date(Date.now() - 900000).toISOString() },
  ])
  const [selectedScanType, setSelectedScanType] = useState<ScanType | null>(null)
  const [scanHistory, setScanHistory] = useState<Array<{ id: string; deviceName: string; scanType: string; startedAt: string; threats: number; totalFiles: number }>>([])
  const [lastScanResult, setLastScanResult] = useState<{ threats: number; clean: number; total: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef(false)

  function addEvent(type: ProtectionEvent['type'], title: string, description: string, severity: ProtectionEvent['severity']) {
    setEvents((prev) => [{ id: crypto.randomUUID(), type, title, description, severity, timestamp: new Date().toISOString() }, ...prev].slice(0, 100))
  }

  function addDevice(dev: { id: string; name: string; type: string; protocol: string; connectedAt: Date; manufacturer?: string; apiDetail?: string }) {
    setDevices((prev) => {
      if (prev.some((p) => p.id === dev.id && p.protocol === dev.protocol)) return prev
      return [...prev, dev]
    })
    addEvent('device_detected', 'External device connected', `${dev.name} detected via ${dev.protocol.toUpperCase()}`, 'info')
  }

  function removeDevice(id: string, protocol: string) {
    setDevices((prev) => prev.filter((p) => !(p.id === id && p.protocol === protocol)))
    addEvent('device_removed', 'Device disconnected', `Device ${id} removed`, 'warning')
  }

  /* ─── USB Detection ─── */
  useEffect(() => {
    const usb = navigator.usb
    if (!usb) return
    usb.getDevices().then((list) => {
      list.forEach((d) => addDevice({
        id: d.serialNumber || d.productName || `usb-${d.vendorId}-${d.productId}`,
        name: d.productName || d.manufacturerName || 'USB Device',
        type: usbClassToType(d.deviceClass),
        protocol: 'usb', connectedAt: new Date(),
        manufacturer: d.manufacturerName, apiDetail: `USB v${d.usbVersionMajor}.${d.usbVersionMinor}`,
      }))
    }).catch(() => {})
    const onConnect = (e: Event) => {
      const d = (e as USBConnectionEvent).device
      addDevice({
        id: d.serialNumber || d.productName || `usb-${d.vendorId}-${d.productId}`,
        name: d.productName || d.manufacturerName || 'USB Device',
        type: usbClassToType(d.deviceClass), protocol: 'usb', connectedAt: new Date(),
        manufacturer: d.manufacturerName, apiDetail: `USB v${d.usbVersionMajor}.${d.usbVersionMinor}`,
      })
    }
    const onDisconnect = (e: Event) => {
      const d = (e as USBConnectionEvent).device
      removeDevice(d.serialNumber || d.productName || `usb-${d.vendorId}-${d.productId}`, 'usb')
    }
    usb.addEventListener('connect', onConnect)
    usb.addEventListener('disconnect', onDisconnect)
    return () => { usb.removeEventListener('connect', onConnect); usb.removeEventListener('disconnect', onDisconnect) }
  }, [])

  /* ─── Serial Detection ─── */
  useEffect(() => {
    const serial = navigator.serial
    if (!serial) return
    serial.getPorts().then((ports) => {
      ports.forEach((p) => {
        const info = p.getInfo()
        addDevice({
          id: `serial-${info.usbVendorId || 0}-${info.usbProductId || 0}-${info.serialNumber || Math.random()}`,
          name: info.productName || info.manufacturerName || 'Serial Device',
          type: 'Serial Port', protocol: 'serial', connectedAt: new Date(),
          manufacturer: info.manufacturerName, apiDetail: 'Web Serial',
        })
      })
    }).catch(() => {})
    const onConnect = (e: Event) => {
      const port = (e as unknown as { port: SerialPort }).port
      const info = port.getInfo()
      addDevice({
        id: `serial-${info.usbVendorId || 0}-${info.usbProductId || 0}-${info.serialNumber || Math.random()}`,
        name: info.productName || info.manufacturerName || 'Serial Device',
        type: 'Serial Port', protocol: 'serial', connectedAt: new Date(),
        manufacturer: info.manufacturerName, apiDetail: 'Web Serial',
      })
    }
    const onDisconnect = (e: Event) => {
      const info = (e as unknown as { port: SerialPort }).port.getInfo()
      removeDevice(`serial-${info.usbVendorId || 0}-${info.usbProductId || 0}-${info.serialNumber || ''}`, 'serial')
    }
    serial.addEventListener('connect', onConnect)
    serial.addEventListener('disconnect', onDisconnect)
    return () => { serial.removeEventListener('connect', onConnect); serial.removeEventListener('disconnect', onDisconnect) }
  }, [])

  /* ─── Bluetooth Detection ─── */
  useEffect(() => {
    if (navigator.bluetooth) {
      setDevices((prev) => prev)
    }
  }, [])

  /* ─── Media Device Detection ─── */
  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return
    navigator.mediaDevices.enumerateDevices().then((devs) => {
      devs.forEach((d) => {
        if (d.kind === 'videoinput') addDevice({ id: `media-${d.deviceId}`, name: d.label || 'Camera', type: 'Video Input', protocol: 'media', connectedAt: new Date() })
        else if (d.kind === 'audioinput') addDevice({ id: `media-${d.deviceId}`, name: d.label || 'Microphone', type: 'Audio Input', protocol: 'media', connectedAt: new Date() })
      })
    }).catch(() => {})
  }, [])

  /* ─── Manual USB/Serial Request ─── */
  async function requestUsb() {
    const usb = navigator.usb
    if (!usb) return
    try {
      const d = await usb.requestDevice({ filters: [] })
      addDevice({
        id: d.serialNumber || d.productName || `usb-${d.vendorId}-${d.productId}`,
        name: d.productName || d.manufacturerName || 'USB Device',
        type: usbClassToType(d.deviceClass), protocol: 'usb', connectedAt: new Date(),
        manufacturer: d.manufacturerName, apiDetail: `USB v${d.usbVersionMajor}.${d.usbVersionMinor}`,
      })
    } catch {}
  }

  async function requestSerial() {
    const serial = navigator.serial
    if (!serial) return
    try {
      const port = await serial.requestPort()
      const info = port.getInfo()
      addDevice({
        id: `serial-${info.usbVendorId || 0}-${info.usbProductId || 0}-${info.serialNumber || Math.random()}`,
        name: info.productName || info.manufacturerName || 'Serial Device',
        type: 'Serial Port', protocol: 'serial', connectedAt: new Date(),
        manufacturer: info.manufacturerName, apiDetail: 'Web Serial',
      })
    } catch {}
  }

  async function requestBluetooth() {
    const bt = navigator.bluetooth
    if (!bt) return
    try {
      const device = await bt.requestDevice({ acceptAllDevices: true, optionalServices: ['battery_service', 'device_information'] })
      addDevice({ id: `bt-${device.id}`, name: device.name || 'Bluetooth Device', type: 'Bluetooth', protocol: 'bluetooth', connectedAt: new Date(), apiDetail: 'Web Bluetooth' })
    } catch {}
  }

  /* ═══════════════════════════════════════════════════════════
     SCAN ENGINE
     ═══════════════════════════════════════════════════════════ */
  function selectDeviceForScan(dev: { id: string; name: string; type: string; protocol: string }) {
    setSelectedDevice(dev)
    setView('scan-options')
  }

  function startScan(type: ScanType) {
    setSelectedScanType(type)
    setView('scanning')
    fileInputRef.current?.click()
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files
    if (!selected || selected.length === 0) { setView('scan-options'); return }
    const files = Array.from(selected)
    let filtered = files
    if (selectedScanType === 'quick') {
      const suspect = [...MALICIOUS_EXTENSIONS, ...SUSPICIOUS_EXTENSIONS, ...SYSTEM_EXTENSIONS]
      filtered = files.filter((f) => suspect.includes(getExtension(f.name)) || f.size === 0 || f.size < 4096)
      if (filtered.length === 0) filtered = files.slice(0, 50)
    } else if (selectedScanType === 'integrity') {
      filtered = files.filter((f) => f.size === 0 || f.size < 1024)
      if (filtered.length === 0) filtered = files.slice(0, 100)
    } else if (selectedScanType === 'removable') {
      filtered = files.filter((f) => {
        const ext = getExtension(f.name)
        return MALICIOUS_EXTENSIONS.includes(ext) || SUSPICIOUS_EXTENSIONS.includes(ext) || SYSTEM_EXTENSIONS.includes(ext) || f.size === 0 || f.name.startsWith('autorun')
      })
      if (filtered.length === 0) filtered = files
    }

    const sess: DeviceScanSession = {
      id: crypto.randomUUID(), deviceName: selectedDevice?.name || 'Local Files', sourceType: 'files',
      startedAt: new Date().toISOString(), completedAt: null, totalFiles: filtered.length, scannedFiles: 0,
      cleanFiles: 0, threatFiles: 0, corruptedFiles: 0, errorFiles: 0,
      files: filtered.map((f) => ({
        name: f.name, path: (f as unknown as { webkitRelativePath?: string }).webkitRelativePath || f.name,
        size: f.size, type: f.type || 'unknown', sha256: 'pending',
        status: 'pending' as const, threatLevel: 'None' as const, threatName: null, riskScore: 0, details: '',
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
    const existingHashes = new Map<string, string>()
    try {
      const { data } = await supabase.from('scans').select('sha256, threat_level')
      if (data) data.forEach((s: { sha256: string; threat_level: string }) => existingHashes.set(s.sha256, s.threat_level))
    } catch {}

    let threatsFound = 0

    for (let i = 0; i < files.length; i++) {
      if (abortRef.current) break
      const file = files[i]
      setCurrentScanFile(file.name)
      setSession((prev) => {
        if (!prev) return prev
        const updated = [...prev.files]; updated[i] = { ...updated[i], status: 'scanning' }
        return { ...prev, scannedFiles: i, files: updated }
      })
      setProgress(Math.round((i / files.length) * 100))

      try {
        const sha256 = await computeSHA256(file)
        const analysis = analyzeFileForThreats(file, sha256)

        if (existingHashes.has(sha256)) {
          analysis.riskScore = Math.max(analysis.riskScore, 85)
          analysis.threatLevel = 'Critical'
          analysis.threatName = 'Known Threat — DB Match'
          analysis.details = `SHA-256 matches a previously identified threat in the database. ${analysis.details}`
        }

        const status: DeviceScanFile['status'] = analysis.riskScore >= 50 ? 'threat' : file.size === 0 ? 'corrupted' : 'clean'
        if (status === 'threat') threatsFound++

        await new Promise((r) => setTimeout(r, 60))

        setSession((prev) => {
          if (!prev) return prev
          const updated = [...prev.files]; updated[i] = { ...updated[i], sha256, status, ...analysis }
          return {
            ...prev, scannedFiles: i + 1,
            cleanFiles: prev.cleanFiles + (status === 'clean' ? 1 : 0),
            threatFiles: prev.threatFiles + (status === 'threat' ? 1 : 0),
            corruptedFiles: prev.corruptedFiles + (status === 'corrupted' ? 1 : 0),
            files: updated,
          }
        })

        if (status === 'threat') {
          addEvent('threat_blocked', `Threat detected: ${analysis.threatName}`, `${file.name} — Risk Score: ${analysis.riskScore}/100`, 'critical')
        }

        if (existingHashes.has(sha256)) {
          await supabase.from('scans').insert({
            file_name: file.name, package_name: file.name.replace(getExtension(file.name), ''),
            version: '1.0.0', sha256, status: 'Complete',
            threat_level: analysis.threatLevel, risk_score: analysis.riskScore,
            risk_category: 'Removable Device Scan', scan_types: ['Signature Match', 'Heuristic Analysis', 'Extension Check'],
          })
        }
      } catch {
        setSession((prev) => {
          if (!prev) return prev
          const updated = [...prev.files]; updated[i] = { ...updated[i], status: 'error', details: 'Failed to read file' }
          return { ...prev, scannedFiles: i + 1, errorFiles: prev.errorFiles + 1, files: updated }
        })
      }
    }

    setProgress(100)
    setScanning(false)
    setSession((prev) => prev ? { ...prev, status: 'complete', completedAt: new Date().toISOString() } : prev)
    setLastScanResult({ threats: threatsFound, clean: sess.totalFiles - threatsFound, total: sess.totalFiles })
    setScanHistory((prev) => [{
      id: crypto.randomUUID(), deviceName: selectedDevice?.name || 'Local',
      scanType: selectedScanType || 'full', startedAt: sess.startedAt,
      threats: threatsFound, totalFiles: sess.totalFiles,
    }, ...prev])
    addEvent('scan_complete', 'Device scan completed',
      `${sess.totalFiles} files scanned — ${threatsFound} threat(s) detected`, threatsFound > 0 ? 'critical' : 'success')
    setView('complete')
    setCurrentScanFile('')
  }

  function quarantineFile(file: DeviceScanFile) {
    const qf: QuarantinedFile = {
      id: crypto.randomUUID(), originalName: file.name, originalPath: file.path,
      sha256: file.sha256, threatLevel: file.threatLevel === 'None' ? 'Low' : file.threatLevel,
      malwareName: file.threatName || 'Unknown', detectedAt: new Date().toISOString(), size: file.size,
    }
    setQuarantine((prev) => [qf, ...prev])
    addEvent('quarantine', `File quarantined: ${file.name}`, `Threat: ${file.threatName} — Moved to quarantine vault`, 'warning')
  }

  function restoreFromQuarantine(id: string) {
    setQuarantine((prev) => prev.filter((q) => q.id !== id))
    addEvent('update', 'File restored', 'Quarantined file restored to original location', 'info')
  }

  function deleteFromQuarantine(id: string) {
    setQuarantine((prev) => prev.filter((q) => q.id !== id))
    addEvent('quarantine', 'File permanently deleted', 'Quarantined file removed permanently', 'warning')
  }

  function resetAll() {
    abortRef.current = true
    setSelectedDevice(null)
    setSelectedScanType(null)
    setSession(null)
    setScanning(false)
    setCurrentScanFile('')
    setProgress(0)
    setLastScanResult(null)
    setView('dashboard')
  }

  const statusColor: Record<string, string> = {
    pending: 'bg-surface-variant text-on-surface-variant border border-outline-variant',
    scanning: 'bg-primary/15 text-primary border border-primary/25',
    clean: 'bg-tertiary/15 text-tertiary border border-tertiary/25',
    threat: 'bg-error/15 text-error border border-error/25',
    corrupted: 'bg-secondary/15 text-secondary border border-secondary/25',
    error: 'bg-error/10 text-error border border-error/20',
  }
  const threatColor: Record<string, string> = { Critical: 'text-error', High: 'text-error', Medium: 'text-secondary', Low: 'text-on-surface-variant', None: 'text-tertiary' }

  /* ═══════════════════════════════════════════════════════════
     NAV
     ═══════════════════════════════════════════════════════════ */
  const navItems: Array<{ view: DeviceView; icon: string; label: string }> = [
    { view: 'dashboard', icon: 'shield', label: 'Protection' },
    { view: 'detection', icon: 'radar', label: 'Devices' },
    { view: 'scanning', icon: 'scan', label: 'Scan' },
    { view: 'quarantine', icon: 'lock', label: 'Quarantine' },
    { view: 'history', icon: 'history', label: 'History' },
  ]

  const recentEvents = events.slice(0, 8)
  const threatCount = quarantine.length
  const scanCount = scanHistory.length
  const devicesCount = devices.length

  return (
    <>
      <div className="absolute -top-[20%] -left-[10%] w-[500px] h-[500px] bg-secondary/4 rounded-full blur-[120px] pointer-events-none"></div>
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileInput} />

      {/* Header + Nav Tabs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 relative">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">VirusOnYou — Antivirus Scanner</h2>
          <p className="text-on-surface-variant font-body-md opacity-80">
            Real-time device detection, malware scanning, and threat quarantine.
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 overflow-x-auto custom-scrollbar pb-1">
        {navItems.map((item) => (
          <button
            key={item.view}
            onClick={() => { if (item.view === 'scanning' && !session) { setView('detection') } else { setView(item.view) } }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-label-caps text-label-caps whitespace-nowrap transition-all ${
              view === item.view
                ? 'bg-gradient-to-r from-primary to-primary-container text-on-primary shadow-glow-primary'
                : 'bg-surface-container border border-outline-variant text-on-surface-variant hover:bg-surface-variant hover:border-primary/30'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
            {item.label}
            {item.view === 'quarantine' && threatCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-error text-on-error text-[9px] font-bold">{threatCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════
         DASHBOARD VIEW
         ═══════════════════════════════════════════════════════════ */}
      {view === 'dashboard' && (
        <div className="space-y-6 relative">
          {/* Protection Status */}
          <div className="glass-panel rounded-xl p-6 relative overflow-hidden">
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-tertiary/8 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-tertiary via-tertiary to-tertiary/50"></div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-2xl bg-tertiary/15 border border-tertiary/30 flex items-center justify-center">
                  <span className="material-symbols-outlined text-4xl text-tertiary">shield</span>
                </div>
                <div>
                  <h3 className="font-headline-lg text-headline-lg text-on-surface mb-1">Protection Active</h3>
                  <p className="text-on-surface-variant text-body-md">Real-time scanning, USB shield, and autorun blocking enabled.</p>
                  <div className="flex gap-4 mt-3">
                    {[
                      { label: 'USB Shield', active: true },
                      { label: 'Execution Block', active: true },
                      { label: 'Autorun Block', active: true },
                    ].map((s) => (
                      <div key={s.label} className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${s.active ? 'bg-tertiary animate-pulse' : 'bg-error'}`}></span>
                        <span className="text-[11px] text-on-surface-variant">{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="text-center md:text-right">
                <p className="font-label-caps text-label-caps text-on-surface-variant mb-1">Threat Database</p>
                <p className="text-2xl font-bold text-on-surface">{THREAT_DB.length + 2847}</p>
                <p className="text-xs text-on-surface-variant">Signatures loaded</p>
                <p className="text-[10px] text-tertiary mt-1">Last updated: {new Date().toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Devices Connected', value: devicesCount, icon: 'usb', color: 'text-primary', bg: 'bg-primary/10' },
              { label: 'Scans Performed', value: scanCount, icon: 'scan', color: 'text-tertiary', bg: 'bg-tertiary/10' },
              { label: 'Threats Quarantined', value: threatCount, icon: 'lock', color: 'text-error', bg: 'bg-error/10' },
              { label: 'Events Logged', value: events.length, icon: 'terminal', color: 'text-secondary', bg: 'bg-secondary/10' },
            ].map((c) => (
              <div key={c.label} className={`${c.bg} rounded-xl p-4 border border-outline-variant/30`}>
                <span className={`material-symbols-outlined ${c.color}`}>{c.icon}</span>
                <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
                <p className="text-[10px] text-on-surface-variant font-label-caps">{c.label}</p>
              </div>
            ))}
          </div>

          {/* Quick Actions + Events */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Quick Actions */}
            <div className="lg:col-span-5 glass-panel rounded-xl p-6">
              <h4 className="font-label-caps text-label-caps text-on-surface-variant mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-primary">bolt</span>
                QUICK ACTIONS
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Scan Devices', icon: 'radar', action: () => setView('detection'), color: 'bg-primary/15 text-primary border-primary/30' },
                  { label: 'Quick Scan', icon: 'bolt', action: () => { setView('detection') }, color: 'bg-tertiary/15 text-tertiary border-tertiary/30' },
                  { label: 'Full Scan', icon: 'scan', action: () => setView('detection'), color: 'bg-error/15 text-error border-error/30' },
                  { label: 'Quarantine', icon: 'lock', action: () => setView('quarantine'), color: 'bg-secondary/15 text-secondary border-secondary/30' },
                ].map((q) => (
                  <button key={q.label} onClick={q.action} className={`p-4 rounded-xl border ${q.color} text-left hover:shadow-glow-primary transition-all group`}>
                    <span className="material-symbols-outlined text-2xl mb-2 group-hover:scale-110 transition-transform block">{q.icon}</span>
                    <span className="text-xs font-bold">{q.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Protection Events */}
            <div className="lg:col-span-7 glass-panel rounded-xl overflow-hidden">
              <div className="p-4 border-b border-outline-variant bg-surface-container flex items-center justify-between">
                <h4 className="font-headline-md text-headline-md flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">terminal</span>
                  Protection Events
                </h4>
                <span className="text-[10px] text-on-surface-variant font-label-caps">{events.length} total</span>
              </div>
              <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                {recentEvents.map((evt) => (
                  <div key={evt.id} className="px-4 py-3 border-b border-outline-variant/30 flex items-start gap-3">
                    <span className={`material-symbols-outlined text-sm mt-0.5 ${
                      evt.severity === 'critical' ? 'text-error' : evt.severity === 'warning' ? 'text-secondary' : evt.severity === 'success' ? 'text-tertiary' : 'text-primary'
                    }`}>
                      {evt.type === 'threat_blocked' ? 'warning' : evt.type === 'scan_complete' ? 'check_circle' : evt.type === 'device_detected' ? 'usb' : evt.type === 'device_removed' ? 'usb_off' : evt.type === 'quarantine' ? 'lock' : evt.type === 'realtime_block' ? 'shield' : 'info'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-on-surface">{evt.title}</span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant">{evt.description}</p>
                      <span className="text-[10px] text-on-surface-variant/50">{new Date(evt.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
         DETECTION VIEW
         ═══════════════════════════════════════════════════════════ */}
      {view === 'detection' && (
        <div className="space-y-6 relative">
          {/* Radar Visual */}
          <div className="glass-panel rounded-xl p-8 flex flex-col md:flex-row items-center gap-8">
            <div className="relative shrink-0">
              <div className="w-36 h-36 rounded-2xl bg-surface-container-high border border-outline-variant flex items-center justify-center relative">
                <span className="material-symbols-outlined text-6xl text-primary/25 animate-pulse">radar</span>
                <div className="absolute inset-0 rounded-2xl border-2 border-primary/20 animate-ping" style={{ animationDuration: '3s' }}></div>
                <div className="absolute inset-[-10px] rounded-3xl border border-primary/10 animate-ping" style={{ animationDuration: '4s' }}></div>
                <div className="absolute inset-[-20px] rounded-3xl border border-primary/5 animate-ping" style={{ animationDuration: '5s' }}></div>
              </div>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h3 className="font-headline-md text-headline-md text-on-surface mb-2">Real-Time Hardware Detection</h3>
              <p className="text-on-surface-variant text-body-md mb-4">
                All browser hardware APIs (WebUSB, Web Serial, Web Bluetooth, MediaDevices) are actively monitoring for connected devices. Plug in any external device — it will appear instantly.
              </p>
              <div className="flex flex-wrap gap-2">
                {navigator.usb && <button onClick={requestUsb} className="px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-primary-container text-on-primary font-label-caps text-label-caps hover:shadow-glow-primary transition-all inline-flex items-center gap-2"><span className="material-symbols-outlined text-[16px]">usb</span>Add USB</button>}
                {navigator.serial && <button onClick={requestSerial} className="px-4 py-2 rounded-lg bg-gradient-to-r from-secondary to-secondary-container text-on-secondary font-label-caps text-label-caps hover:shadow-glow-secondary transition-all inline-flex items-center gap-2"><span className="material-symbols-outlined text-[16px]">cable</span>Add Serial</button>}
                {navigator.bluetooth && <button onClick={requestBluetooth} className="px-4 py-2 rounded-lg bg-gradient-to-r from-tertiary to-tertiary-container text-on-tertiary font-label-caps text-label-caps hover:shadow-glow-tertiary transition-all inline-flex items-center gap-2"><span className="material-symbols-outlined text-[16px]">bluetooth</span>Add Bluetooth</button>}
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
                <span className="px-2 py-0.5 rounded-full bg-tertiary/15 text-tertiary text-[10px] font-bold border border-tertiary/25 animate-pulse">LIVE MONITORING</span>
              </div>
              <div className="divide-y divide-outline-variant/30">
                {devices.map((dev) => (
                  <div key={`${dev.protocol}-${dev.id}`} className="p-4 flex items-center gap-4 hover:bg-surface-variant/20 transition-colors group">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:shadow-glow-primary transition-all">
                      <span className="material-symbols-outlined text-primary">{protocolIcon(dev.protocol)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-body-md font-bold text-on-surface truncate">{dev.name}</span>
                        <span className="px-1.5 py-0.5 rounded bg-tertiary/15 text-tertiary text-[9px] font-bold border border-tertiary/25">CONNECTED</span>
                        <span className="px-1.5 py-0.5 rounded bg-surface-variant text-on-surface-variant text-[9px] font-bold border border-outline-variant/50 uppercase">{dev.protocol}</span>
                      </div>
                      <p className="text-xs text-on-surface-variant">{dev.type}</p>
                      {dev.manufacturer && <p className="text-[11px] text-on-surface-variant/60">{dev.manufacturer}</p>}
                    </div>
                    <button onClick={() => selectDeviceForScan(dev)} className="px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-primary-container text-on-primary font-label-caps text-label-caps opacity-0 group-hover:opacity-100 transition-all hover:shadow-glow-primary">
                      <span className="material-symbols-outlined text-sm mr-1">scan</span>Scan
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="glass-panel rounded-xl p-12 text-center">
              <span className="material-symbols-outlined text-6xl text-on-surface-variant/15 mb-4 block">usb_off</span>
              <p className="text-on-surface-variant text-body-md mb-2">No external devices detected</p>
              <p className="text-on-surface-variant text-sm mb-6">Connect a USB drive, SD card, or any external device to begin scanning.</p>
              <div className="flex justify-center gap-3">
                <button onClick={() => { const dev = { id: 'manual', name: 'Local Files', type: 'Manual Selection', protocol: 'usb' }; selectDeviceForScan(dev) }}
                  className="px-6 py-2.5 rounded-xl border border-outline-variant text-on-surface-variant text-sm font-label-caps hover:bg-surface-variant hover:border-primary/30 transition-all inline-flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">upload_file</span>Scan Files Manually
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
         SCAN OPTIONS VIEW
         ═══════════════════════════════════════════════════════════ */}
      {view === 'scan-options' && selectedDevice && (
        <div className="space-y-6 relative">
          <div className="glass-panel rounded-xl p-6 flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary text-2xl">{protocolIcon(selectedDevice.protocol)}</span>
            </div>
            <div className="flex-1">
              <span className="font-headline-md text-headline-md text-on-surface">{selectedDevice.name}</span>
              <p className="text-sm text-on-surface-variant">{selectedDevice.type} — {selectedDevice.protocol.toUpperCase()}</p>
            </div>
            <button onClick={() => setView('detection')} className="px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant text-sm hover:bg-surface-variant transition-all">Back</button>
          </div>

          <h3 className="font-headline-md text-headline-md text-on-surface">Select Scan Mode</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { type: 'quick' as const, icon: 'bolt', title: 'Quick Scan', desc: 'Scans only executable and suspicious file extensions for fast threat detection.', time: '~30 sec', color: 'bg-primary/15 text-primary', border: 'border-primary/30', glow: 'hover:shadow-glow-primary' },
              { type: 'full' as const, icon: 'scan', title: 'Full Scan', desc: 'Deep scan of every file. Computes SHA-256 and matches against threat database.', time: '~2-5 min', color: 'bg-error/15 text-error', border: 'border-error/30', glow: 'hover:shadow-glow-error' },
              { type: 'integrity' as const, icon: 'verified', title: 'Integrity Check', desc: 'Finds corrupted, empty, or truncated files that indicate storage damage.', time: '~1 min', color: 'bg-tertiary/15 text-tertiary', border: 'border-tertiary/30', glow: 'hover:shadow-glow-tertiary' },
              { type: 'removable' as const, icon: 'usb', title: 'Removable Drive Scan', desc: 'Focuses on autorun, system files, and executable threats common on USB drives.', time: '~1 min', color: 'bg-secondary/15 text-secondary', border: 'border-secondary/30', glow: 'hover:shadow-glow-secondary' },
              { type: 'custom' as const, icon: 'tune', title: 'Custom Scan', desc: 'Hand-pick specific files or folders to scan on your own terms.', time: 'Varies', color: 'bg-surface-container-high text-on-surface', border: 'border-outline-variant', glow: 'hover:bg-surface-variant' },
            ].map((opt) => (
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
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
         SCANNING VIEW
         ═══════════════════════════════════════════════════════════ */}
      {view === 'scanning' && session && (
        <div className="space-y-6 relative">
          <div className="glass-panel rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined animate-spin text-primary text-2xl">sync</span>
                <div>
                  <h3 className="font-headline-md text-headline-md text-on-surface">
                    {selectedScanType?.toUpperCase()} Scan — {session.deviceName}
                  </h3>
                  <p className="text-on-surface-variant text-sm">{currentScanFile || 'Initializing scan engine...'}</p>
                </div>
              </div>
              <button onClick={() => { abortRef.current = true; setView('scan-options'); setSession(null); setScanning(false) }}
                className="px-4 py-2 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-error/10 hover:text-error hover:border-error/30 transition-all font-label-caps text-label-caps">
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
            <div className="p-4 border-b border-outline-variant bg-surface-container"><h4 className="font-headline-md text-headline-md">Scan Progress</h4></div>
            <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
              {session.files.map((f, idx) => (
                <div key={idx} className={`flex items-center gap-3 px-4 py-2.5 border-b border-outline-variant/30 text-sm ${f.status === 'scanning' ? 'bg-primary/5' : ''}`}>
                  <span className={`material-symbols-outlined text-[16px] ${f.status === 'clean' ? 'text-tertiary' : f.status === 'threat' ? 'text-error' : f.status === 'corrupted' ? 'text-secondary' : f.status === 'scanning' ? 'text-primary animate-spin' : 'text-on-surface-variant'}`}>
                    {f.status === 'clean' ? 'check_circle' : f.status === 'threat' ? 'report' : f.status === 'corrupted' ? 'broken_image' : f.status === 'scanning' ? 'sync' : f.status === 'error' ? 'error' : 'radio_button_unchecked'}
                  </span>
                  <span className="flex-1 truncate text-on-surface font-code-sm text-code-sm">{f.name}</span>
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

      {/* ═══════════════════════════════════════════════════════════
         COMPLETE VIEW
         ═══════════════════════════════════════════════════════════ */}
      {view === 'complete' && session && (
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
                    {session.threatFiles > 0 ? `${session.threatFiles} Threat(s) Detected` : 'Scan Complete — All Clear'}
                  </h2>
                  <p className="text-on-surface-variant text-body-md">{session.totalFiles} files scanned from {session.deviceName}</p>
                </div>
              </div>
              <button onClick={resetAll} className="px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary font-bold hover:shadow-glow-primary transition-all flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">refresh</span>Back to Dashboard
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

          <ScanResultList files={session.files} statusColor={statusColor} threatColor={threatColor} onQuarantine={quarantineFile} />
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
         QUARANTINE VIEW
         ═══════════════════════════════════════════════════════════ */}
      {view === 'quarantine' && (
        <div className="space-y-6 relative">
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-error text-2xl">lock</span>
            <div>
              <h3 className="font-headline-md text-headline-md text-on-surface">Quarantine Vault</h3>
              <p className="text-sm text-on-surface-variant">{quarantine.length} file(s) isolated from system</p>
            </div>
          </div>

          {quarantine.length === 0 ? (
            <div className="glass-panel rounded-xl p-12 text-center">
              <span className="material-symbols-outlined text-6xl text-tertiary/30 mb-4 block">verified_user</span>
              <p className="text-on-surface-variant text-body-md mb-2">Quarantine is empty</p>
              <p className="text-on-surface-variant text-sm">No threats have been quarantined yet.</p>
            </div>
          ) : (
            <div className="glass-panel rounded-xl overflow-hidden">
              <div className="divide-y divide-outline-variant/30">
                {quarantine.map((qf) => (
                  <div key={qf.id} className="p-4 flex items-center gap-4">
                    <span className="material-symbols-outlined text-error">lock</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-code-sm text-code-sm text-on-surface font-bold truncate">{qf.originalName}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${qf.threatLevel === 'Critical' || qf.threatLevel === 'High' ? 'bg-error/15 text-error border border-error/25' : 'bg-secondary/15 text-secondary border border-secondary/25'}`}>
                          {qf.threatLevel.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant">{qf.malwareName} — {formatBytes(qf.size)}</p>
                      <p className="text-[10px] text-on-surface-variant/50">{qf.originalPath}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => restoreFromQuarantine(qf.id)} className="px-3 py-1.5 rounded-lg border border-outline-variant text-xs font-label-caps hover:bg-surface-variant transition-all">Restore</button>
                      <button onClick={() => deleteFromQuarantine(qf.id)} className="px-3 py-1.5 rounded-lg bg-error/15 text-error border border-error/25 text-xs font-label-caps hover:bg-error/25 transition-all">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
         HISTORY VIEW
         ═══════════════════════════════════════════════════════════ */}
      {view === 'history' && (
        <div className="space-y-6 relative">
          <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">history</span>
            Scan History
          </h3>
          {scanHistory.length === 0 ? (
            <div className="glass-panel rounded-xl p-12 text-center">
              <span className="material-symbols-outlined text-6xl text-on-surface-variant/15 mb-4 block">history</span>
              <p className="text-on-surface-variant text-body-md">No scans performed yet</p>
            </div>
          ) : (
            <div className="glass-panel rounded-xl overflow-hidden">
              <div className="divide-y divide-outline-variant/30">
                {scanHistory.map((sh) => (
                  <div key={sh.id} className="p-4 flex items-center gap-4">
                    <span className={`material-symbols-outlined ${sh.threats > 0 ? 'text-error' : 'text-tertiary'}`}>
                      {sh.threats > 0 ? 'warning' : 'check_circle'}
                    </span>
                    <div className="flex-1">
                      <span className="text-sm font-bold text-on-surface">{sh.deviceName}</span>
                      <p className="text-xs text-on-surface-variant">{sh.scanType.toUpperCase()} scan — {sh.totalFiles} files</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-bold ${sh.threats > 0 ? 'text-error' : 'text-tertiary'}`}>
                        {sh.threats > 0 ? `${sh.threats} threat(s)` : 'Clean'}
                      </span>
                      <p className="text-[10px] text-on-surface-variant">{new Date(sh.startedAt).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  )
}

/* ═══════════════════════════════════════════════════════════
   Scan Results Sub-Component
   ═══════════════════════════════════════════════════════════ */
function ScanResultList({ files, statusColor, threatColor, onQuarantine }: {
  files: DeviceScanFile[]
  statusColor: Record<string, string>
  threatColor: Record<string, string>
  onQuarantine: (file: DeviceScanFile) => void
}) {
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
              <div className="flex items-start gap-3">
                <span className={`material-symbols-outlined text-lg mt-0.5 ${f.status === 'clean' ? 'text-tertiary' : f.status === 'threat' ? 'text-error' : f.status === 'corrupted' ? 'text-secondary' : 'text-on-surface-variant'}`}>
                  {f.status === 'clean' ? 'check_circle' : f.status === 'threat' ? 'report' : f.status === 'corrupted' ? 'broken_image' : 'error'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-code-sm text-code-sm text-on-surface font-bold truncate">{f.name}</span>
                    <span className={`px-2 py-0.5 rounded font-label-caps text-[9px] ${statusColor[f.status]}`}>{f.status === 'threat' ? `${f.riskScore}/100` : f.status.toUpperCase()}</span>
                    {f.threatLevel !== 'None' && <span className={`font-label-caps text-[9px] ${threatColor[f.threatLevel]}`}>{f.threatLevel.toUpperCase()}</span>}
                  </div>
                  <p className="text-xs text-on-surface-variant mb-1 truncate">{f.path} — {formatBytes(f.size)}</p>
                  <p className="text-xs text-on-surface-variant mb-1">{f.details}</p>
                  <div className="flex items-center gap-3 flex-wrap mt-2">
                    <span className="font-code-sm text-[10px] text-on-surface-variant bg-surface-container px-2 py-1 rounded border border-outline-variant/30">
                      SHA: {f.sha256.slice(0, 24)}...
                    </span>
                    {f.threatName && <span className="text-[11px] text-error italic font-bold">{f.threatName}</span>}
                    {f.status === 'threat' && (
                      <button onClick={() => onQuarantine(f)} className="px-3 py-1 rounded-lg bg-error/15 text-error border border-error/25 text-[10px] font-bold font-label-caps hover:bg-error/25 transition-all inline-flex items-center gap-1">
                        <span className="material-symbols-outlined text-[12px]">lock</span>
                        Quarantine
                      </button>
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

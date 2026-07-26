import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useUser } from '../lib/userContext'
import { computeSHA256, analyzeFileForThreats } from '../lib/scanner'
import { isWebUSBSupported, requestAdbDevice, connectAdbDevice, listInstalledApps, pullApkFromDevice, disconnectAdbDevice, type AdbDevice, type InstalledApp as AdbApp } from '../lib/adb'
import { InstalledApp } from '../lib/types'

type ViewState = 'connect' | 'loading' | 'list' | 'scanning' | 'results'

export default function AppScanner() {
  const { userId } = useUser()
  const [viewState, setViewState] = useState<ViewState>('connect')
  const [adbDevice, setAdbDevice] = useState<AdbDevice | null>(null)
  const [apps, setApps] = useState<InstalledApp[]>([])
  const [selectedApps, setSelectedApps] = useState<Set<number>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState('')
  const [scanningProgress, setScanningProgress] = useState({ current: 0, total: 0, name: '' })
  const [stats, setStats] = useState({ total: 0, clean: 0, threats: 0 })
  const webUSBSupported = isWebUSBSupported()

  async function connectDevice() {
    setError('')
    try {
      const device = await requestAdbDevice()
      if (!device) {
        setError('No device selected. Connect an Android device with USB Debugging enabled.')
        return
      }
      setViewState('loading')
      const adb = await connectAdbDevice(device)
      setAdbDevice(adb)
      setViewState('loading')

      const installedApps = await listInstalledApps(adb)
      const mapped: InstalledApp[] = installedApps.map((app) => ({
        packageName: app.packageName,
        apkPath: app.apkPath,
        size: app.size,
        status: 'pending' as const,
        sha256: null,
        riskScore: 0,
        threatLevel: 'None' as const,
        threatName: null,
        details: '',
      }))
      setApps(mapped)
      setViewState('list')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to device')
      setViewState('connect')
    }
  }

  function toggleApp(index: number) {
    setSelectedApps((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  function toggleSelectAll() {
    const filtered = getFilteredApps()
    const filteredIndices = filtered.map((app) => apps.indexOf(app))
    if (selectedApps.size === filteredIndices.length) {
      setSelectedApps(new Set())
    } else {
      setSelectedApps(new Set(filteredIndices))
    }
  }

  function getFilteredApps() {
    if (!searchQuery) return apps
    return apps.filter((app) => app.packageName.toLowerCase().includes(searchQuery.toLowerCase()))
  }

  async function scanSelected() {
    if (selectedApps.size === 0 || !adbDevice) return
    setViewState('scanning')
    const toScan = Array.from(selectedApps).map((i) => apps[i]).filter((a) => a.apkPath)
    setScanningProgress({ current: 0, total: toScan.length, name: '' })

    let threatsFound = 0
    let cleanFound = 0

    for (let i = 0; i < toScan.length; i++) {
      const app = toScan[i]
      setScanningProgress({ current: i + 1, total: toScan.length, name: app.packageName })

      setApps((prev) => prev.map((a) => a.packageName === app.packageName ? { ...a, status: 'scanning' } : a))

      try {
        const apkFile = await pullApkFromDevice(adbDevice, app.apkPath!)
        const sha256 = await computeSHA256(apkFile)
        const analysis = analyzeFileForThreats(apkFile, sha256)

        setApps((prev) => prev.map((a) => a.packageName === app.packageName ? {
          ...a, status: analysis.riskScore >= 25 ? 'threat' : 'clean',
          sha256, riskScore: analysis.riskScore, threatLevel: analysis.threatLevel,
          threatName: analysis.threatName, details: analysis.details,
        } : a))

        if (analysis.riskScore >= 25) threatsFound++
        else cleanFound++

        // Save to Supabase
        await supabase.from('scans').insert({
          file_name: `${app.packageName}.apk`,
          package_name: app.packageName,
          version: '1.0.0',
          sha256, status: 'Complete',
          threat_level: analysis.threatLevel, risk_score: analysis.riskScore,
          risk_category: analysis.threatName || '', malware_name: analysis.threatName,
          scan_types: ['USB App Scan', 'Heuristic Analysis', 'Signature Matching'],
          user_id: userId,
        })
      } catch {
        setApps((prev) => prev.map((a) => a.packageName === app.packageName ? { ...a, status: 'error', details: 'Failed to pull or analyze APK' } : a))
      }

      await new Promise((r) => setTimeout(r, 50))
    }

    setStats({ total: toScan.length, clean: cleanFound, threats: threatsFound })
    setViewState('results')
  }

  async function disconnectDevice() {
    if (adbDevice) {
      await disconnectAdbDevice(adbDevice)
      setAdbDevice(null)
    }
    setApps([])
    setSelectedApps(new Set())
    setViewState('connect')
  }

  const threatBadge = (level: string) => {
    const map: Record<string, string> = {
      Critical: 'bg-error/15 text-error border-error/25',
      High: 'bg-error/10 text-error border-error/20',
      Medium: 'bg-secondary/15 text-secondary border-secondary/25',
      Low: 'bg-tertiary/15 text-tertiary border-tertiary/25',
      None: 'bg-surface-variant text-on-surface-variant border-outline-variant/50',
    }
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-label-caps text-[10px] border ${map[level] || map.None}`}>{level.toUpperCase()}</span>
  }

  const filteredApps = getFilteredApps()

  return (
    <>
      <div className="absolute -top-[20%] -right-[10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>

      <header className="mb-8 relative">
        <div className="flex items-center gap-3 mb-2">
          <span className="material-symbols-outlined text-primary">phone_android</span>
          <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">App Scanner</h2>
        </div>
        <p className="text-on-surface-variant text-body-md">
          Connect an Android device via USB to scan installed applications for threats.
        </p>
      </header>

      {/* Connection State */}
      {viewState === 'connect' && (
        <div className="max-w-lg mx-auto">
          <div className="bg-surface-container-high rounded-2xl border border-outline-variant p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center mx-auto mb-6">
              <span className="material-symbols-outlined text-primary text-4xl">usb</span>
            </div>
            <h3 className="font-headline-md text-headline-md text-on-surface mb-2">Connect Android Device</h3>
            <p className="text-on-surface-variant text-sm mb-6">
              Connect your Android phone via USB and enable USB Debugging in Developer Options.
            </p>
            {!webUSBSupported ? (
              <div className="p-4 bg-error/10 border border-error/30 rounded-xl">
                <p className="text-error text-sm">WebUSB is not supported in this browser. Use Chrome, Edge, or Opera.</p>
              </div>
            ) : (
              <button
                onClick={connectDevice}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-primary to-primary-container text-on-primary font-label-caps text-label-caps hover:shadow-glow-primary active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">usb</span>
                Request Device Access
              </button>
            )}
            {error && (
              <div className="mt-4 p-4 bg-error/10 border border-error/30 rounded-xl">
                <p className="text-error text-sm">{error}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading */}
      {viewState === 'loading' && (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3 text-on-surface-variant text-body-md">
            <span className="material-symbols-outlined animate-spin">sync</span>
            Connecting to device and listing installed apps...
          </div>
        </div>
      )}

      {/* App List */}
      {viewState === 'list' && (
        <div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-high border border-outline-variant">
                <span className="material-symbols-outlined text-sm">search</span>
                <input
                  type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search packages..." className="bg-transparent border-none focus:ring-0 text-sm w-48"
                />
              </div>
              <span className="text-on-surface-variant text-sm">{filteredApps.length} apps</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={toggleSelectAll} className="px-4 py-2 rounded-lg bg-surface-container border border-outline-variant text-on-surface-variant text-sm hover:bg-surface-variant transition-all">
                {selectedApps.size === filteredApps.length ? 'Deselect All' : 'Select All'}
              </button>
              <button
                onClick={scanSelected} disabled={selectedApps.size === 0}
                className={`px-6 py-2 rounded-lg font-label-caps text-label-caps transition-all flex items-center gap-2 ${
                  selectedApps.size > 0
                    ? 'bg-gradient-to-r from-primary to-primary-container text-on-primary hover:shadow-glow-primary'
                    : 'bg-outline-variant/30 text-on-surface-variant cursor-not-allowed'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">shield</span>
                Scan Selected ({selectedApps.size})
              </button>
              <button onClick={disconnectDevice} className="px-4 py-2 rounded-lg bg-error/15 text-error border border-error/30 text-sm hover:bg-error/25 transition-all">
                Disconnect
              </button>
            </div>
          </div>

          <div className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden">
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-surface-container-high border-b border-outline-variant">
                    <th className="p-3 w-10">
                      <input type="checkbox" checked={selectedApps.size === filteredApps.length && filteredApps.length > 0} onChange={toggleSelectAll} className="rounded border-outline-variant bg-surface-container text-primary" />
                    </th>
                    <th className="p-3 font-label-caps text-label-caps text-on-surface-variant uppercase">Package Name</th>
                    <th className="p-3 font-label-caps text-label-caps text-on-surface-variant uppercase text-center">Status</th>
                    <th className="p-3 font-label-caps text-label-caps text-on-surface-variant uppercase text-center">Threat</th>
                    <th className="p-3 font-label-caps text-label-caps text-on-surface-variant uppercase text-right">Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {filteredApps.map((app, i) => {
                    const idx = apps.indexOf(app)
                    return (
                      <tr key={app.packageName} className={`hover:bg-surface-variant/20 transition-colors ${selectedApps.has(idx) ? 'bg-primary/5' : ''}`}>
                        <td className="p-3">
                          <input type="checkbox" checked={selectedApps.has(idx)} onChange={() => toggleApp(idx)} className="rounded border-outline-variant bg-surface-container text-primary" />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-[16px]">android</span>
                            <span className="font-code-sm text-sm text-on-surface">{app.packageName}</span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          {app.status === 'pending' && <span className="text-on-surface-variant text-xs">Pending</span>}
                          {app.status === 'scanning' && <span className="text-primary text-xs animate-pulse">Scanning...</span>}
                          {app.status === 'clean' && <span className="text-tertiary text-xs">Clean</span>}
                          {app.status === 'threat' && <span className="text-error text-xs font-bold">Threat</span>}
                          {app.status === 'error' && <span className="text-on-surface-variant text-xs">Error</span>}
                        </td>
                        <td className="p-3 text-center">{threatBadge(app.threatLevel)}</td>
                        <td className="p-3 text-right font-bold text-sm text-on-surface">{app.riskScore}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Scanning Progress */}
      {viewState === 'scanning' && (
        <div className="max-w-lg mx-auto">
          <div className="bg-surface-container-high rounded-2xl border border-outline-variant p-8 text-center">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <svg className="w-full h-full animate-spin text-primary" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" fill="none" r="10" stroke="currentColor" strokeWidth="2" />
                <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary-container">shield</span>
              </div>
            </div>
            <p className="font-label-caps text-label-caps text-primary animate-pulse mb-2">SCANNING APPS...</p>
            <p className="text-on-surface-variant text-sm mb-4">{scanningProgress.name}</p>
            <div className="w-full bg-surface-variant h-2 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-primary-container rounded-full transition-all" style={{ width: `${scanningProgress.total > 0 ? (scanningProgress.current / scanningProgress.total) * 100 : 0}%` }}></div>
            </div>
            <p className="text-on-surface-variant text-xs mt-2">{scanningProgress.current} / {scanningProgress.total}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {viewState === 'results' && (
        <div>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-surface-container-high p-5 rounded-xl border border-outline-variant text-center">
              <p className="font-label-caps text-label-caps text-on-surface-variant mb-1">SCANNED</p>
              <p className="font-headline-lg text-headline-lg text-on-surface">{stats.total}</p>
            </div>
            <div className="bg-surface-container-high p-5 rounded-xl border border-tertiary/30 text-center">
              <p className="font-label-caps text-label-caps text-on-surface-variant mb-1">CLEAN</p>
              <p className="font-headline-lg text-headline-lg text-tertiary">{stats.clean}</p>
            </div>
            <div className="bg-surface-container-high p-5 rounded-xl border border-error/30 text-center">
              <p className="font-label-caps text-label-caps text-on-surface-variant mb-1">THREATS</p>
              <p className="font-headline-lg text-headline-lg text-error">{stats.threats}</p>
            </div>
          </div>

          <div className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden">
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-surface-container-high border-b border-outline-variant">
                    <th className="p-3 font-label-caps text-label-caps text-on-surface-variant uppercase">Package</th>
                    <th className="p-3 font-label-caps text-label-caps text-on-surface-variant uppercase text-center">Status</th>
                    <th className="p-3 font-label-caps text-label-caps text-on-surface-variant uppercase text-center">Threat</th>
                    <th className="p-3 font-label-caps text-label-caps text-on-surface-variant uppercase">Details</th>
                    <th className="p-3 font-label-caps text-label-caps text-on-surface-variant uppercase text-right">Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {apps.filter((a) => a.status !== 'pending').map((app) => (
                    <tr key={app.packageName} className="hover:bg-surface-variant/20 transition-colors">
                      <td className="p-3 font-code-sm text-sm text-primary">{app.packageName}</td>
                      <td className="p-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-label-caps text-[10px] ${
                          app.status === 'clean' ? 'bg-tertiary/15 text-tertiary border border-tertiary/25' :
                          app.status === 'threat' ? 'bg-error/15 text-error border border-error/25' :
                          'bg-surface-variant text-on-surface-variant border border-outline-variant/50'
                        }`}>
                          {app.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-3 text-center">{threatBadge(app.threatLevel)}</td>
                      <td className="p-3 text-xs text-on-surface-variant max-w-xs truncate">{app.threatName || 'Clean'}</td>
                      <td className="p-3 text-right font-bold text-sm">{app.riskScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={() => { setViewState('list'); setSelectedApps(new Set()) }} className="px-6 py-3 rounded-xl bg-surface-container border border-outline-variant text-on-surface-variant hover:bg-surface-variant transition-all flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back to Apps
            </button>
            <button onClick={disconnectDevice} className="px-6 py-3 rounded-xl bg-error/15 text-error border border-error/30 hover:bg-error/25 transition-all flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">usb_off</span>
              Disconnect
            </button>
          </div>
        </div>
      )}
    </>
  )
}

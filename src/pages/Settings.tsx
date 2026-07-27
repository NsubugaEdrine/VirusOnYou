import { useState } from 'react'
import { useTheme } from '../lib/ThemeContext'
import { supabase } from '../lib/supabase'
import { useUser } from '../lib/userContext'
import { adminLogin, adminLogout } from '../lib/user'

export default function Settings() {
  const { theme, setTheme } = useTheme()
  const { userId, userIdShort, admin, refreshAdmin } = useUser()
  const [scanTarget, setScanTarget] = useState<string>('all')
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<string | null>(null)
  const [adminPin, setAdminPin] = useState('')
  const [adminError, setAdminError] = useState(false)

  async function handleFullScan() {
    setScanning(true)
    setScanResult(null)

    try {
      const { data: devices } = await supabase.from('devices').select('id, name, risk_level')

      if (!devices || devices.length === 0) {
        setScanResult('No devices found in fleet to scan.')
        setScanning(false)
        return
      }

      const targets = scanTarget === 'all'
        ? devices
        : devices.filter(d => (d.risk_level as string).toLowerCase() === scanTarget)

      if (targets.length === 0) {
        setScanResult(`No devices match risk level "${scanTarget}".`)
        setScanning(false)
        return
      }

      const results = await Promise.allSettled(
        targets.map(device =>
          supabase.from('scans').insert({
            file_name: `full-scan-${device.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.apk`,
            package_name: `fleet-scan.${device.id}`,
            version: '1.0.0',
            sha256: 'pending',
            status: 'Queued',
            threat_level: 'None',
            risk_score: 0,
            risk_category: '',
            scan_types: ['Manifest Analysis', 'Permission Analysis', 'Code Analysis', 'Network Analysis'],
            user_id: userId,
          })
        )
      )

      const succeeded = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length

      setScanResult(
        `Full fleet scan initiated for ${succeeded} device(s).` +
        (failed > 0 ? ` ${failed} device(s) failed to queue.` : '')
      )
    } catch {
      setScanResult('An error occurred while initiating the fleet scan.')
    }

    setScanning(false)
  }

  return (
    <div className="relative w-full">
      <div className="absolute -top-[20%] -right-[10%] w-[300px] h-[300px] md:w-[500px] md:h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none z-0"></div>

      <header className="mb-8 relative z-10">
        <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Settings</h2>
        <p className="text-on-surface-variant text-body-md mt-1">
          Configure application preferences and fleet operations.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10 max-w-full lg:max-w-4xl">

        {/* Appearance */}
        <section className="lg:col-span-6 glass-panel rounded-xl p-6">
          <h3 className="font-headline-md text-headline-md text-on-surface mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">palette</span>
            Appearance
          </h3>

          <p className="font-label-caps text-label-caps text-on-surface-variant mb-4">THEME</p>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setTheme('dark')}
              className={`relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                theme === 'dark'
                  ? 'border-primary bg-primary/10 shadow-glow-primary'
                  : 'border-outline-variant hover:border-outline'
              }`}
            >
              <div className="w-full h-20 rounded-lg bg-[#0a0d14] border border-[#3a3f4a] flex items-center justify-center overflow-hidden">
                <div className="w-12 h-2 bg-[#252830] rounded-full mb-1"></div>
                <div className="w-16 h-3 bg-[#7cb3ff] rounded-sm"></div>
              </div>
              <span className="font-label-caps text-label-caps text-on-surface">Dark</span>
              {theme === 'dark' && (
                <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-on-primary text-[14px]">check</span>
                </span>
              )}
            </button>

            <button
              onClick={() => setTheme('light')}
              className={`relative flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                theme === 'light'
                  ? 'border-primary bg-primary/10 shadow-glow-primary'
                  : 'border-outline-variant hover:border-outline'
              }`}
            >
              <div className="w-full h-20 rounded-lg bg-[#f5f7fc] border border-[#c8ccd8] flex items-center justify-center overflow-hidden">
                <div className="w-12 h-2 bg-[#e4e6ed] rounded-full mb-1"></div>
                <div className="w-16 h-3 bg-[#1a6dff] rounded-sm"></div>
              </div>
              <span className="font-label-caps text-label-caps text-on-surface">Light</span>
              {theme === 'light' && (
                <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <span className="material-symbols-outlined text-on-primary text-[14px]">check</span>
                </span>
              )}
            </button>
          </div>

          <div className="mt-6 p-4 bg-surface-container rounded-lg border border-outline-variant/50">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-secondary text-[20px] mt-0.5">info</span>
              <div>
                <p className="text-body-md text-on-surface font-medium">Theme Preference</p>
                <p className="text-sm text-on-surface-variant mt-1">
                  Your theme choice is saved locally and persists across sessions. The dark theme is optimized for extended monitoring use.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Fleet Operations */}
        <section className="lg:col-span-6 glass-panel rounded-xl p-6">
          <h3 className="font-headline-md text-headline-md text-on-surface mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-error">security</span>
            Fleet Full Scan
          </h3>

          <p className="text-body-md text-on-surface-variant mb-6">
            Initiate a comprehensive scan across all enrolled devices. Each device will be queued for manifest, permission, code, and network analysis.
          </p>

          <div className="mb-6">
            <label className="font-label-caps text-label-caps text-on-surface-variant block mb-2">SCAN TARGET</label>
            <select
              value={scanTarget}
              onChange={(e) => setScanTarget(e.target.value)}
              className="w-full bg-surface-container border border-outline-variant rounded-lg px-4 py-3 text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all appearance-none cursor-pointer"
            >
              <option value="all">All Devices</option>
              <option value="critical">Critical Risk Devices Only</option>
              <option value="high">High Risk Devices Only</option>
              <option value="medium">Medium Risk Devices Only</option>
              <option value="low">Low Risk Devices Only</option>
            </select>
          </div>

          <div className="flex items-center gap-4 mb-6 p-4 bg-surface-container rounded-lg border border-outline-variant/50">
            <span className="material-symbols-outlined text-secondary">warning</span>
            <div className="text-sm text-on-surface-variant">
              <p className="font-medium text-on-surface">Full fleet scans may take several hours.</p>
              <p className="mt-1">All devices will be placed in sandbox isolation during analysis. Network access will be simulated.</p>
            </div>
          </div>

          <button
            onClick={handleFullScan}
            disabled={scanning}
            className={`w-full py-3 rounded-xl font-headline-md text-headline-md transition-all duration-300 flex items-center justify-center gap-3 ${
              scanning
                ? 'bg-outline-variant/30 text-on-surface-variant cursor-not-allowed'
                : 'bg-gradient-to-r from-error to-error-container text-on-error hover:shadow-glow-error active:scale-[0.98]'
            }`}
          >
            {scanning ? (
              <>
                <span className="animate-spin material-symbols-outlined">sync</span>
                Initiating Fleet Scan...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">radar</span>
                Start Full Fleet Scan
              </>
            )}
          </button>

          {scanResult && (
            <div className={`mt-4 p-4 rounded-lg border ${
              scanResult.includes('error') || scanResult.includes('fail')
                ? 'bg-error/10 border-error/30 text-error'
                : 'bg-tertiary/10 border-tertiary/30 text-tertiary'
            }`}>
              <div className="flex items-start gap-2">
                <span className="material-symbols-outlined text-[18px] mt-0.5">
                  {scanResult.includes('error') || scanResult.includes('fail') ? 'error' : 'check_circle'}
                </span>
                <p className="text-body-md">{scanResult}</p>
              </div>
            </div>
          )}
        </section>

        {/* Account */}
        <section className="lg:col-span-6 glass-panel rounded-xl p-6">
          <h3 className="font-headline-md text-headline-md text-on-surface mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">person</span>
            Account
          </h3>

          <div className="space-y-4">
            <div className="p-4 bg-surface-container rounded-lg border border-outline-variant/50">
              <p className="font-label-caps text-label-caps text-on-surface-variant mb-1">USER ID</p>
              <p className="text-body-md text-on-surface font-code-sm break-all">{userId}</p>
              <p className="text-[11px] text-on-surface-variant mt-1">This ID is stored locally in your browser and used to isolate your data.</p>
            </div>

            <div className="p-4 bg-surface-container rounded-lg border border-outline-variant/50">
              <p className="font-label-caps text-label-caps text-on-surface-variant mb-1">STATUS</p>
              <div className="flex items-center gap-2">
                {admin ? (
                  <>
                    <span className="material-symbols-outlined text-error text-[18px]">admin_panel_settings</span>
                    <p className="text-body-md text-error font-bold">Admin Mode Active</p>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-tertiary text-[18px]">person</span>
                    <p className="text-body-md text-on-surface">Regular User</p>
                  </>
                )}
              </div>
            </div>

            {admin ? (
              <button
                onClick={() => { adminLogout(); refreshAdmin() }}
                className="w-full py-3 rounded-xl bg-error/15 text-error border border-error/30 font-label-caps text-label-caps hover:bg-error/25 transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                Exit Admin Mode
              </button>
            ) : (
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="Admin PIN"
                  value={adminPin}
                  onChange={(e) => { setAdminPin(e.target.value); setAdminError(false) }}
                  className={`flex-1 bg-surface-container-lowest border rounded-lg px-3 py-2 text-sm focus:ring-1 outline-none transition-all ${
                    adminError ? 'border-error focus:border-error focus:ring-error' : 'border-outline-variant focus:border-primary focus:ring-primary'
                  }`}
                />
                <button
                  onClick={() => {
                    if (adminLogin(adminPin)) {
                      refreshAdmin()
                      setAdminPin('')
                    } else {
                      setAdminError(true)
                    }
                  }}
                  disabled={adminPin.length < 4}
                  className="px-4 py-2 rounded-lg bg-primary/15 text-primary border border-primary/30 font-label-caps text-label-caps hover:bg-primary/25 transition-all disabled:opacity-50"
                >
                  Login
                </button>
              </div>
            )}
          </div>
        </section>

        {/* About */}
        <section className="lg:col-span-12 etched-border rounded-xl p-6">
          <h3 className="font-headline-md text-headline-md text-on-surface mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">info</span>
            About
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="font-label-caps text-label-caps text-on-surface-variant mb-1">VERSION</p>
              <p className="text-body-md text-on-surface font-medium font-code-sm">v0.1.0-alpha</p>
            </div>
            <div>
              <p className="font-label-caps text-label-caps text-on-surface-variant mb-1">ENGINE</p>
              <p className="text-body-md text-on-surface font-medium font-code-sm">VirusOnYou Static Analyzer</p>
            </div>
            <div>
              <p className="font-label-caps text-label-caps text-on-surface-variant mb-1">THREAT DB</p>
              <p className="text-body-md text-on-surface font-medium font-code-sm">v4.5.12 (142 signatures)</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

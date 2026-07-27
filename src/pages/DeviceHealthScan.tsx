import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useUser } from '../lib/userContext'
import { runFullHealthScan, ScanProgress, ScanPhase } from '../lib/hostScanner'
import { HealthScanReport, HealthFinding } from '../lib/types'

type ViewState = 'start' | 'scanning' | 'results'
type FindingFilter = 'all' | 'critical' | 'warning' | 'info' | 'good'

function ScoreRing({ score, size = 160, stroke = 10 }: { score: number; size?: number; stroke?: number }) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = score >= 80 ? 'var(--color-tertiary)' : score >= 60 ? 'var(--color-secondary)' : score >= 40 ? 'var(--color-secondary)' : 'var(--color-error)'

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-surface-variant)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-display-small text-on-surface">{score}</span>
        <span className="text-xs text-on-surface-variant uppercase tracking-wider">/ 100</span>
      </div>
    </div>
  )
}

function CategoryBar({ name, score, icon, color }: { name: string; score: number; icon: string; color: string }) {
  const barColor = color === 'tertiary' ? 'bg-tertiary' : color === 'secondary' ? 'bg-secondary' : color === 'error' ? 'bg-error' : 'bg-primary'
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="material-symbols-outlined text-on-surface-variant">{icon}</span>
      <span className="text-sm text-on-surface-variant w-28 flex-shrink-0">{name}</span>
      <div className="flex-1 h-2 bg-surface-variant rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-sm font-medium text-on-surface w-10 text-right">{score}</span>
    </div>
  )
}

function SeverityIcon({ severity }: { severity: HealthFinding['severity'] }) {
  const map = {
    critical: { icon: 'error', color: 'text-error' },
    warning: { icon: 'warning', color: 'text-secondary' },
    info: { icon: 'info', color: 'text-primary' },
    good: { icon: 'check_circle', color: 'text-tertiary' },
  }
  const s = map[severity]
  return <span className={`material-symbols-outlined ${s.color}`}>{s.icon}</span>
}

const phaseIcons: Record<ScanPhase, string> = {
  system: 'computer',
  security: 'shield',
  network: 'wifi',
  storage: 'sd_storage',
  attack: 'bug_report',
  privacy: 'visibility_off',
  complete: 'check_circle',
}

export default function DeviceHealthScan() {
  const { userId } = useUser()
  const [viewState, setViewState] = useState<ViewState>('start')
  const [progress, setProgress] = useState<ScanProgress>({ phase: 'system', phaseName: '', percent: 0 })
  const [report, setReport] = useState<HealthScanReport | null>(null)
  const [filter, setFilter] = useState<FindingFilter>('all')
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<HealthScanReport[]>([])

  useEffect(() => {
    loadHistory()
  }, [userId])

  async function loadHistory() {
    const { data } = await supabase
      .from('scans')
      .select('*')
      .eq('user_id', userId)
      .eq('scanner_type', 'health_scan')
      .order('created_at', { ascending: false })
      .limit(10)
    if (data) {
      const reports = data.map((row) => row.result_data as unknown as HealthScanReport).filter(Boolean)
      setHistory(reports)
    }
  }

  async function startScan() {
    setViewState('scanning')
    setError(null)
    try {
      const result = await runFullHealthScan(setProgress, userId)
      setReport(result)
      setViewState('results')
      await saveReport(result)
      await loadHistory()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed unexpectedly')
      setViewState('start')
    }
  }

  async function saveReport(result: HealthScanReport) {
    try {
      await supabase.from('scans').insert({
        user_id: userId,
        file_name: 'Device Health Scan',
        file_size: 0,
        file_type: 'system',
        sha256: result.id,
        status: result.overallScore >= 70 ? 'clean' : 'flagged',
        threats_found: result.findings.filter((f) => f.severity === 'critical' || f.severity === 'warning').length,
        threat_level: result.overallRating,
        risk_score: result.overallScore,
        scanner_type: 'health_scan',
        result_data: result as unknown as Record<string, unknown>,
      })
    } catch {}
  }

  const filteredFindings = report?.findings.filter((f) => filter === 'all' || f.severity === filter) || []
  const findingCounts = report ? {
    all: report.findings.length,
    critical: report.findings.filter((f) => f.severity === 'critical').length,
    warning: report.findings.filter((f) => f.severity === 'warning').length,
    info: report.findings.filter((f) => f.severity === 'info').length,
    good: report.findings.filter((f) => f.severity === 'good').length,
  } : { all: 0, critical: 0, warning: 0, info: 0, good: 0 }

  /* ─── START SCREEN ─── */
  if (viewState === 'start') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center space-y-3">
          <span className="material-symbols-outlined text-6xl text-primary">health_and_safety</span>
          <h1 className="text-3xl font-display-large text-on-surface">Device Health Scan</h1>
          <p className="text-on-surface-variant max-w-md mx-auto">
            Comprehensive security and privacy audit of this device. Analyzes browser security, network posture, storage health, attack surface, and privacy fingerprint.
          </p>
        </div>

        {error && (
          <div className="p-4 bg-error-container rounded-xl text-on-error-container flex items-center gap-3">
            <span className="material-symbols-outlined">error</span>
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: 'shield', label: 'Security Posture', desc: 'HTTPS, cookies, crypto APIs' },
            { icon: 'wifi', label: 'Network Security', desc: 'Connection, WebRTC, protocols' },
            { icon: 'sd_storage', label: 'Storage Health', desc: 'Quota, caches, persistence' },
            { icon: 'bug_report', label: 'Attack Surface', desc: 'USB, Bluetooth, Geolocation' },
            { icon: 'visibility_off', label: 'Privacy Fingerprint', desc: 'Fingerprinting vectors' },
            { icon: 'computer', label: 'System Info', desc: 'OS, browser, hardware' },
          ].map((item) => (
            <div key={item.label} className="p-4 bg-surface-container rounded-xl border border-outline-variant">
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-primary text-lg">{item.icon}</span>
                <span className="text-sm font-medium text-on-surface">{item.label}</span>
              </div>
              <span className="text-xs text-on-surface-variant">{item.desc}</span>
            </div>
          ))}
        </div>

        <button
          onClick={startScan}
          className="w-full py-4 bg-primary text-on-primary rounded-xl font-label-caps text-label-caps hover:bg-primary/90 transition-all shadow-md hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined">play_arrow</span>
          BEGIN HEALTH SCAN
        </button>

        {history.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-label-caps text-on-surface-variant">Previous Scans</h2>
            <div className="space-y-2">
              {history.slice(0, 5).map((h) => (
                <button
                  key={h.id}
                  onClick={() => { setReport(h); setViewState('results') }}
                  className="w-full p-3 bg-surface-container rounded-xl border border-outline-variant hover:bg-surface-variant transition-all text-left flex items-center gap-3"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                    h.overallScore >= 80 ? 'bg-tertiary-container text-on-tertiary-container' :
                    h.overallScore >= 60 ? 'bg-secondary-container text-on-secondary-container' :
                    'bg-error-container text-on-error-container'
                  }`}>
                    {h.overallScore}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-on-surface truncate">{h.overallRating} — {h.findings.length} findings</div>
                    <div className="text-xs text-on-surface-variant">{new Date(h.scannedAt).toLocaleString()}</div>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  /* ─── SCANNING SCREEN ─── */
  if (viewState === 'scanning') {
    const allPhases: ScanPhase[] = ['system', 'security', 'network', 'storage', 'attack', 'privacy']
    const currentIdx = allPhases.indexOf(progress.phase)
    const overallPercent = Math.round(((currentIdx * 100 + progress.percent) / (allPhases.length * 100)) * 100)

    return (
      <div className="max-w-2xl mx-auto px-4 py-16 space-y-8 flex flex-col items-center">
        <div className="w-24 h-24 rounded-full bg-primary-container flex items-center justify-center animate-pulse">
          <span className="material-symbols-outlined text-5xl text-primary">health_and_safety</span>
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-xl font-title-large text-on-surface">{progress.phaseName || 'Initializing...'}</h2>
          <p className="text-sm text-on-surface-variant">Analyzing {progress.phase}...</p>
        </div>

        <div className="w-full max-w-sm space-y-2">
          <div className="h-3 bg-surface-variant rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${overallPercent}%` }}
            />
          </div>
          <div className="text-center text-sm text-on-surface-variant">{overallPercent}%</div>
        </div>

        <div className="grid grid-cols-3 gap-4 w-full max-w-md">
          {allPhases.map((phase, i) => {
            const isDone = i < currentIdx
            const isCurrent = i === currentIdx
            return (
              <div
                key={phase}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${
                  isDone ? 'bg-tertiary-container/30' : isCurrent ? 'bg-primary-container/30 ring-1 ring-primary' : 'bg-surface-container opacity-40'
                }`}
              >
                <span className={`material-symbols-outlined ${isDone ? 'text-tertiary' : isCurrent ? 'text-primary animate-pulse' : 'text-on-surface-variant'}`}>
                  {isDone ? 'check_circle' : phaseIcons[phase]}
                </span>
                <span className="text-[10px] text-on-surface-variant capitalize">{phase}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  /* ─── RESULTS SCREEN ─── */
  if (!report) return null

  const severityFilters: Array<{ key: FindingFilter; label: string; count: number; color: string }> = [
    { key: 'all', label: 'ALL', count: findingCounts.all, color: 'bg-surface-variant text-on-surface' },
    { key: 'critical', label: 'CRITICAL', count: findingCounts.critical, color: 'bg-error-container text-on-error-container' },
    { key: 'warning', label: 'WARNINGS', count: findingCounts.warning, color: 'bg-secondary-container text-on-secondary-container' },
    { key: 'info', label: 'INFO', count: findingCounts.info, color: 'bg-primary-container text-on-primary-container' },
    { key: 'good', label: 'GOOD', count: findingCounts.good, color: 'bg-tertiary-container text-on-tertiary-container' },
  ]

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => { setViewState('start'); setReport(null) }} className="p-2 hover:bg-surface-variant rounded-full transition-all">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="text-2xl font-headline-large text-on-surface">Health Scan Results</h1>
      </div>

      {/* Score Card */}
      <div className="bg-surface-container rounded-2xl p-6 border border-outline-variant shadow-sm">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <ScoreRing score={report.overallScore} />
          <div className="flex-1 space-y-3">
            <div>
              <h2 className={`text-2xl font-display-medium ${
                report.overallScore >= 80 ? 'text-tertiary' :
                report.overallScore >= 60 ? 'text-secondary' :
                'text-error'
              }`}>
                {report.overallRating}
              </h2>
              <p className="text-sm text-on-surface-variant">
                {report.findings.filter((f) => f.severity === 'critical').length} critical issues · {report.findings.filter((f) => f.severity === 'warning').length} warnings · {report.findings.filter((f) => f.severity === 'good').length} passed checks
              </p>
            </div>
            <div className="space-y-1">
              {report.categories.map((cat) => (
                <CategoryBar key={cat.name} {...cat} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="bg-surface-container rounded-2xl p-5 border border-outline-variant">
        <div className="flex items-center gap-2 mb-3">
          <span className="material-symbols-outlined text-primary">computer</span>
          <h3 className="text-sm font-label-caps text-on-surface-variant">System Information</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
          {Object.entries(report.systemInfo).map(([key, value]) => (
            <div key={key} className="flex justify-between py-1.5 border-b border-outline-variant/30">
              <span className="text-sm text-on-surface-variant">{key}</span>
              <span className="text-sm text-on-surface font-medium">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Findings */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">find_in_page</span>
          <h3 className="text-sm font-label-caps text-on-surface-variant">Detailed Findings</h3>
        </div>

        <div className="flex flex-wrap gap-2">
          {severityFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-label-caps transition-all ${
                filter === f.key ? f.color + ' ring-2 ring-primary/30' : 'bg-surface-container text-on-surface-variant hover:bg-surface-variant'
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {filteredFindings.map((finding) => (
            <div
              key={finding.id}
              className={`p-4 rounded-xl border transition-all ${
                finding.severity === 'critical' ? 'bg-error-container/10 border-error/20' :
                finding.severity === 'warning' ? 'bg-secondary-container/10 border-secondary/20' :
                finding.severity === 'good' ? 'bg-tertiary-container/10 border-tertiary/20' :
                'bg-surface-container border-outline-variant'
              }`}
            >
              <div className="flex items-start gap-3">
                <SeverityIcon severity={finding.severity} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-on-surface">{finding.title}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-variant text-on-surface-variant uppercase">{finding.category}</span>
                  </div>
                  <p className="text-sm text-on-surface-variant mt-1">{finding.description}</p>
                  {finding.recommendation && (
                    <div className="flex items-center gap-2 mt-2 p-2 bg-surface/50 rounded-lg">
                      <span className="material-symbols-outlined text-primary text-sm">lightbulb</span>
                      <span className="text-xs text-primary">{finding.recommendation}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pb-8">
        <button
          onClick={startScan}
          className="flex-1 py-3 bg-primary text-on-primary rounded-xl font-label-caps text-label-caps hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined">refresh</span>
          RE-SCAN
        </button>
        <button
          onClick={() => { setViewState('start'); setReport(null) }}
          className="py-3 px-6 bg-surface-container text-on-surface rounded-xl font-label-caps text-label-caps hover:bg-surface-variant transition-all border border-outline-variant"
        >
          BACK
        </button>
      </div>
    </div>
  )
}

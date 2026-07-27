import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Scan } from '../lib/types'
import { useUser } from '../lib/userContext'

export default function Dashboard() {
  const navigate = useNavigate()
  const { userId, userIdShort, admin } = useUser()
  const [scans, setScans] = useState<Scan[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, clean: 0, threats: 0, critical: 0 })
  const [greeting, setGreeting] = useState('')

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting(admin ? 'Good Morning, Admin' : `Good Morning, User ${userIdShort}`)
    else if (hour < 18) setGreeting(admin ? 'Good Afternoon, Admin' : `Good Afternoon, User ${userIdShort}`)
    else setGreeting(admin ? 'Night Watch: Admin Active' : `Night Watch: User ${userIdShort}`)
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      let query = supabase.from('scans').select('*').order('uploaded_at', { ascending: false })
      if (!admin) query = query.eq('user_id', userId)
      const { data: allScans } = await query

      if (allScans) {
        setScans(allScans)
        const completed = allScans.filter(s => s.status === 'Complete')
        const clean = completed.filter(s => s.threat_level === 'None').length
        const threats = completed.filter(s => s.threat_level !== 'None').length
        const critical = allScans.filter(s => s.threat_level === 'Critical').length
        setStats({ total: allScans.length, clean, threats, critical })
      }
    } catch {
      // UI stays with default empty stats
    }
    setLoading(false)
  }

  const recentScans = scans.slice(0, 8)

  const statusConfig: Record<string, { bg: string; text: string; dot: string; pulse?: boolean }> = {
    Complete: { bg: 'bg-tertiary/15', text: 'text-tertiary', dot: 'bg-tertiary', pulse: true },
    'In Progress': { bg: 'bg-primary/15', text: 'text-primary', dot: 'bg-primary', pulse: true },
    Queued: { bg: 'bg-surface-variant', text: 'text-on-surface-variant', dot: '' },
    Failed: { bg: 'bg-error/15', text: 'text-error', dot: '' },
  }

  const threatConfig: Record<string, { bg: string; text: string }> = {
    Critical: { bg: 'bg-error/15', text: 'text-error' },
    High: { bg: 'bg-error/10', text: 'text-error' },
    Medium: { bg: 'bg-secondary/15', text: 'text-secondary' },
    Low: { bg: 'bg-tertiary/15', text: 'text-tertiary' },
    None: { bg: 'bg-surface-variant', text: 'text-on-surface-variant' },
  }

  function getScoreColor(scan: Scan): string {
    if (scan.status === 'Queued' || scan.status === 'In Progress') return 'text-on-surface-variant'
    if (scan.risk_score >= 75) return 'text-error'
    if (scan.risk_score >= 50) return 'text-secondary'
    return 'text-tertiary'
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHr = Math.floor(diffMin / 60)
    if (diffHr < 24) return `${diffHr}h ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-on-surface-variant text-body-md">
          <span className="material-symbols-outlined animate-spin">sync</span>
          Loading dashboard...
        </div>
      </div>
    )
  }

  const statCards = [
    {
      label: 'TOTAL SCANS',
      value: stats.total,
      icon: 'search',
      iconBg: 'bg-primary/15',
      iconText: 'text-primary',
      valueClass: 'text-on-surface',
    },
    {
      label: 'CLEAN',
      value: stats.clean,
      icon: 'verified',
      iconBg: 'bg-tertiary/15',
      iconText: 'text-tertiary',
      valueClass: 'text-tertiary',
    },
    {
      label: 'THREATS',
      value: stats.threats,
      icon: 'warning',
      iconBg: 'bg-secondary/15',
      iconText: 'text-secondary',
      valueClass: 'text-secondary',
    },
    {
      label: 'CRITICAL',
      value: stats.critical,
      icon: 'report',
      iconBg: 'bg-error/15',
      iconText: 'text-error',
      valueClass: 'text-error',
    },
  ]

  return (
    <>
      <div className="absolute -top-[20%] -right-[10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Header */}
      <header className="mb-8 relative">
        <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">{greeting}</h2>
        <p className="text-on-surface-variant text-body-md mt-1">
          Real-time telemetry and threat detection metrics.
        </p>
      </header>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 relative">
        {statCards.map((card) => (
          <div key={card.label} className="bg-surface-container-high p-5 rounded-xl border border-outline-variant card-glow transition-all">
            <div className="flex items-center gap-2 mb-4">
              <span className={`p-2 rounded-lg ${card.iconBg} ${card.iconText} material-symbols-outlined text-[20px]`}>{card.icon}</span>
              <span className="font-label-caps text-label-caps text-on-surface-variant">{card.label}</span>
            </div>
            <h3 className={`font-headline-lg text-headline-lg ${card.valueClass}`}>{card.value}</h3>
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">

        {/* Recent Scans — 8 columns */}
        <div className="lg:col-span-8 bg-surface-container rounded-xl border border-outline-variant flex flex-col overflow-hidden">
          <div className="px-5 py-4 border-b border-outline-variant flex items-center justify-between">
            <h4 className="font-headline-md text-headline-md text-on-surface">Recent Scans</h4>
            <button
              onClick={() => navigate('/scan-history')}
              className="text-primary font-label-caps text-label-caps hover:text-primary-container transition-colors"
            >
              VIEW ALL
            </button>
          </div>

          {recentScans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-on-surface-variant">
              <span className="material-symbols-outlined text-4xl mb-3 text-outline-variant">folder_open</span>
              <p className="text-body-md">No scans yet</p>
              <p className="text-xs text-outline mt-1">Submit your first scan to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse" aria-label="Recent scans">
                <thead>
                  <tr className="bg-surface-container-high">
                    <th className="px-5 py-3 font-label-caps text-label-caps text-on-surface-variant">FILE NAME</th>
                    <th className="px-5 py-3 font-label-caps text-label-caps text-on-surface-variant text-center">STATUS</th>
                    <th className="px-5 py-3 font-label-caps text-label-caps text-on-surface-variant text-center">THREAT</th>
                    <th className="px-5 py-3 font-label-caps text-label-caps text-on-surface-variant text-right">SCORE</th>
                    <th className="px-5 py-3 font-label-caps text-label-caps text-on-surface-variant text-right">TIME</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/50">
                  {recentScans.map((scan) => {
                    const sc = statusConfig[scan.status] || statusConfig.Queued
                    const tc = threatConfig[scan.threat_level] || threatConfig.None
                    return (
                      <tr key={scan.id} className="hover:bg-surface-variant/20 transition-colors cursor-pointer" onClick={() => navigate(`/scan-result?id=${scan.id}`)}>
                        <td className="px-5 py-3">
                          <span className="font-code-sm text-code-sm text-primary truncate block max-w-[200px]">{scan.file_name}</span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${sc.bg} ${sc.text}`}>
                            {sc.dot && <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}${sc.pulse ? ' animate-pulse' : ''}`}></span>}
                            {scan.status === 'In Progress' ? 'SCANNING' : scan.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${tc.bg} ${tc.text}`}>
                            {scan.threat_level.toUpperCase()}
                          </span>
                        </td>
                        <td className={`px-5 py-3 text-right font-code-sm text-code-sm font-bold ${getScoreColor(scan)}`}>
                          {scan.status === 'Queued' || scan.status === 'In Progress' ? '--' : `${scan.risk_score}/100`}
                        </td>
                        <td className="px-5 py-3 text-right text-xs text-on-surface-variant">
                          {formatDate(scan.uploaded_at)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Actions — 4 columns */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Quick Actions */}
          <div className="bg-surface-container rounded-xl border border-outline-variant p-5">
            <h4 className="font-headline-md text-headline-md text-on-surface mb-4">Quick Actions</h4>
            <div className="space-y-3">
              {[
                { icon: 'upload_file', label: 'New Scan', desc: 'Submit a file for analysis', to: '/scan-submission', iconBg: 'bg-primary/15', iconText: 'text-primary' },
                { icon: 'folder_open', label: 'File Scanner', desc: 'Batch scan local files', to: '/file-scanner', iconBg: 'bg-secondary/15', iconText: 'text-secondary' },
                { icon: 'phone_android', label: 'App Scanner', desc: 'Scan installed apps via ADB', to: '/app-scanner', iconBg: 'bg-tertiary/15', iconText: 'text-tertiary' },
                { icon: 'health_and_safety', label: 'Health Scan', desc: 'Device security audit', to: '/device-health', iconBg: 'bg-error/15', iconText: 'text-error' },
              ].map((action) => (
                <button
                  key={action.to}
                  onClick={() => navigate(action.to)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-surface-container-high border border-outline-variant hover:border-primary/30 hover:bg-primary/5 transition-all text-left group"
                >
                  <span className={`p-2 rounded-lg ${action.iconBg} ${action.iconText} material-symbols-outlined text-[20px] group-hover:scale-110 transition-transform`}>{action.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-on-surface group-hover:text-primary transition-colors">{action.label}</p>
                    <p className="text-xs text-on-surface-variant truncate">{action.desc}</p>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant ml-auto text-[18px] group-hover:text-primary group-hover:translate-x-0.5 transition-all">arrow_forward</span>
                </button>
              ))}
            </div>
          </div>

          {/* System Status */}
          <div className="bg-surface-container rounded-xl border border-outline-variant p-5">
            <h4 className="font-headline-md text-headline-md text-on-surface mb-4">System Status</h4>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
                  <span className="text-sm text-on-surface">Database</span>
                </div>
                <span className="text-xs font-bold text-tertiary">Online</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                  <span className="text-sm text-on-surface">Scan Engine</span>
                </div>
                <span className="text-xs font-bold text-primary">Ready</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${stats.critical > 0 ? 'bg-error animate-pulse' : 'bg-tertiary'}`}></span>
                  <span className="text-sm text-on-surface">Threat Level</span>
                </div>
                <span className={`text-xs font-bold ${stats.critical > 0 ? 'text-error' : 'text-tertiary'}`}>
                  {stats.critical > 0 ? `${stats.critical} Critical` : 'All Clear'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-surface-variant"></span>
                  <span className="text-sm text-on-surface">Pending Scans</span>
                </div>
                <span className="text-xs font-bold text-on-surface-variant">
                  {scans.filter(s => s.status === 'In Progress' || s.status === 'Queued').length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

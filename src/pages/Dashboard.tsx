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
  const [stats, setStats] = useState({ total: 0, critical: 0, pending: 0 })
  const [greeting, setGreeting] = useState('SOC Dashboard Overview')

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting(admin ? 'Good Morning, Analyst' : `Good Morning, User ${userIdShort}`)
    else if (hour < 18) setGreeting(admin ? 'Good Afternoon, Analyst' : `Good Afternoon, User ${userIdShort}`)
    else setGreeting(admin ? 'Night Watch: Dashboard Active' : `Night Watch: User ${userIdShort}`)
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
        const critical = allScans.filter(s => s.threat_level === 'Critical').length
        const pending = allScans.filter(s => s.status === 'In Progress' || s.status === 'Queued').length
        setStats({ total: allScans.length, critical, pending })
      }
    } catch {
      // UI stays with default empty stats
    }
    setLoading(false)
  }

  const recentScans = scans.slice(0, 5)

  const statusConfig: Record<string, { bg: string; text: string; border: string; dot: string; pulse?: boolean; label: string }> = {
    Complete: { bg: 'bg-tertiary-container/10', text: 'text-tertiary', border: 'border-tertiary/20', dot: 'bg-tertiary', pulse: true, label: 'COMPLETE' },
    'In Progress': { bg: 'bg-error-container/10', text: 'text-error', border: 'border-error/20', dot: 'bg-error', pulse: true, label: 'ANALYZING' },
    Queued: { bg: 'bg-surface-variant', text: 'text-on-surface-variant', border: 'border-outline-variant', dot: '', label: 'QUEUED' },
    Failed: { bg: 'bg-secondary-container/10', text: 'text-secondary', border: 'border-secondary/20', dot: '', label: 'FAILED' },
  }

  function getScoreClass(scan: Scan): string {
    if (scan.status === 'Queued' || scan.status === 'In Progress') return 'text-on-surface-variant'
    if (scan.risk_score >= 75) return 'text-error'
    if (scan.risk_score >= 50) return 'text-error'
    return 'text-on-surface'
  }

  function getScoreDisplay(scan: Scan): string {
    if (scan.status === 'Queued' || scan.status === 'In Progress') return '--'
    if (scan.status === 'Failed') return 'ERR'
    return `${String(scan.risk_score).padStart(2, '0')}/100`
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

  return (
    <>
      {/* Welcome Header */}
      <header className="mb-8">
        <h2 className="font-headline-lg text-headline-lg text-on-surface">{greeting}</h2>
        <p className="text-on-surface-variant text-body-md mt-1">Real-time telemetry and threat detection metrics.</p>
      </header>

      {/* Overview Bento Grid — 3 columns matching wireframe */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Total Scans */}
        <div className="bg-surface-container-high p-6 rounded-xl border border-outline-variant card-glow transition-all">
          <div className="flex justify-between items-start mb-4">
            <span className="p-2 rounded-lg bg-surface-variant text-primary material-symbols-outlined">search</span>
          </div>
          <p className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest mb-1">Total Scans</p>
          <h3 className="font-headline-lg text-[32px] text-on-surface">{stats.total}</h3>
          <div className="w-full bg-surface-variant h-1 mt-4 rounded-full overflow-hidden">
            <div className="bg-primary h-full rounded-full transition-all duration-700" style={{ width: stats.total > 0 ? `${Math.min((stats.total / Math.max(stats.total, 1)) * 100, 100)}%` : '0%' }}></div>
          </div>
        </div>

        {/* Critical Findings */}
        <div className="bg-surface-container-high p-6 rounded-xl border border-error/30 card-glow transition-all relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-error/5 rounded-full -mr-8 -mt-8 blur-2xl"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <span className="p-2 rounded-lg bg-error-container/20 text-error material-symbols-outlined">report</span>
            {stats.critical > 0 && (
              <span className="text-error font-label-caps text-label-caps">URGENT</span>
            )}
          </div>
          <p className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest mb-1 relative z-10">Critical Findings</p>
          <h3 className="font-headline-lg text-[32px] text-error relative z-10">{stats.critical}</h3>
          <p className="text-on-surface-variant text-[12px] mt-4 relative z-10">Requires immediate analyst intervention</p>
        </div>

        {/* Pending Analysis */}
        <div className="bg-surface-container-high p-6 rounded-xl border border-outline-variant card-glow transition-all">
          <div className="flex justify-between items-start mb-4">
            <span className="p-2 rounded-lg bg-surface-variant text-tertiary material-symbols-outlined">hourglass_empty</span>
          </div>
          <p className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest mb-1">Pending Analysis</p>
          <h3 className="font-headline-lg text-[32px] text-on-surface">{stats.pending}</h3>
          <p className="text-on-surface-variant text-[12px] mt-4">Static/Dynamic sandbox queue active</p>
        </div>
      </div>

      {/* Content Area: Recent Scans & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Recent Scans Table */}
        <div className="lg:col-span-8 bg-surface-container-low rounded-xl border border-outline-variant flex flex-col overflow-hidden">
          <div className="p-5 border-b border-outline-variant flex justify-between items-center bg-surface-container">
            <h4 className="font-headline-md text-headline-md text-on-surface">Recent Scans</h4>
            <button
              onClick={() => navigate('/scan-history')}
              className="text-primary font-label-caps text-label-caps hover:underline"
            >
              VIEW ALL
            </button>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-high">
                  <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase">APK Name</th>
                  <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase text-center">Status</th>
                  <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase text-right">Risk Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {recentScans.length === 0 ? (
                  <tr><td colSpan={3} className="text-center text-on-surface-variant py-8">No scans yet</td></tr>
                ) : (
                  recentScans.map((scan) => {
                    const sc = statusConfig[scan.status] || statusConfig.Queued
                    return (
                      <tr key={scan.id} className="hover:bg-surface-variant/50 transition-colors cursor-pointer" onClick={() => navigate(`/scan-result?id=${scan.id}`)}>
                        <td className="px-6 py-4 font-code-sm text-code-sm text-primary">{scan.file_name}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${sc.bg} ${sc.text} text-[11px] font-bold border ${sc.border}`}>
                            {sc.dot && <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}${sc.pulse ? ' animate-pulse' : ''}`}></span>}
                            {sc.label}
                          </span>
                        </td>
                        <td className={`px-6 py-4 text-right font-bold ${getScoreClass(scan)}`}>{getScoreDisplay(scan)}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="lg:col-span-4 bg-surface-container-low rounded-xl border border-outline-variant overflow-hidden flex flex-col">
          <div className="p-5 border-b border-outline-variant bg-surface-container">
            <h4 className="font-headline-md text-headline-md text-on-surface">Recent Activity</h4>
          </div>
          <div className="flex-1 p-6 space-y-6 overflow-y-auto custom-scrollbar">
            {[
              { icon: 'warning', bg: 'bg-error-container/20', text: 'text-error', title: 'New malicious APK detected', desc: 'Device-902 flagged suspicious activity during run-time.', time: '2 MINS AGO', hasLine: true },
              { icon: 'check_circle', bg: 'bg-tertiary-container/20', text: 'text-tertiary', title: 'Scheduled scan completed', desc: 'All fleet devices (14/14) reported as secure.', time: '1 HOUR AGO', hasLine: true },
              { icon: 'sync', bg: 'bg-primary-container/20', text: 'text-primary', title: 'Threat database updated', desc: 'Version 4.5.12 applied with 142 new signatures.', time: '4 HOURS AGO', hasLine: true },
              { icon: 'person', bg: 'bg-surface-variant', text: 'text-on-surface-variant', title: 'New login detected', desc: 'Analyst Level 1 (ID: 04) logged in from 192.168.1.104', time: '6 HOURS AGO', hasLine: false },
            ].map((item, i) => (
              <div key={i} className="flex gap-4 relative">
                {item.hasLine && <div className="absolute left-4 top-10 bottom-0 w-[1px] bg-outline-variant/30"></div>}
                <div className={`w-8 h-8 rounded-full ${item.bg} ${item.text} flex items-center justify-center shrink-0`}>
                  <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                </div>
                <div>
                  <p className="text-body-md font-bold text-on-surface">{item.title}</p>
                  <p className="text-[12px] text-on-surface-variant mt-1">{item.desc}</p>
                  <span className="text-[10px] text-outline font-label-caps mt-2 block">{item.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Threat Trajectory Chart */}
      <div className="mt-8 bg-surface-container p-6 rounded-xl border border-outline-variant relative h-64 overflow-hidden">
        <div className="flex justify-between items-center mb-6">
          <h4 className="font-headline-md text-headline-md text-on-surface">Threat Trajectory</h4>
          <div className="flex gap-2 items-center">
            <span className="w-3 h-3 rounded-full bg-primary"></span>
            <span className="font-label-caps text-[10px] text-on-surface-variant uppercase">Normal</span>
            <span className="w-3 h-3 rounded-full bg-error ml-4"></span>
            <span className="font-label-caps text-[10px] text-on-surface-variant uppercase">Threats</span>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 w-full h-32 px-6">
          <div className="flex items-end justify-between h-full gap-2" role="img" aria-label="Threat trajectory bar chart">
            {[
              { h: '20%', c: 'bg-surface-variant' },
              { h: '35%', c: 'bg-surface-variant' },
              { h: '50%', c: 'bg-primary' },
              { h: '45%', c: 'bg-surface-variant' },
              { h: '60%', c: 'bg-primary' },
              { h: '30%', c: 'bg-surface-variant' },
              { h: '85%', c: 'bg-error', spike: true },
              { h: '40%', c: 'bg-surface-variant' },
              { h: '25%', c: 'bg-surface-variant' },
              { h: '55%', c: 'bg-primary' },
              { h: '45%', c: 'bg-surface-variant' },
              { h: '70%', c: 'bg-primary' },
            ].map((bar, i) => (
              <div key={i} className={`w-full ${bar.c} rounded-t-sm transition-all cursor-pointer hover:opacity-80 relative group`} style={{ height: bar.h }}>
                {bar.spike && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-error text-on-error font-code-sm text-[10px] px-2 py-0.5 rounded whitespace-nowrap shadow-glow-error">
                    SPIKE
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

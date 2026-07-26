import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Scan } from '../lib/types'
import { useUser } from '../lib/userContext'
import { isAdmin } from '../lib/user'

export default function Dashboard() {
  const navigate = useNavigate()
  const { userId, userIdShort, admin } = useUser()
  const [scans, setScans] = useState<Scan[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, critical: 0, pending: 0 })
  const [greeting, setGreeting] = useState('SOC Dashboard Overview')

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

  const statusConfig: Record<string, { bg: string; text: string; border: string; dot: string; pulse?: boolean }> = {
    Complete: { bg: 'bg-tertiary/15', text: 'text-tertiary', border: 'border-tertiary/30', dot: 'bg-tertiary', pulse: true },
    'In Progress': { bg: 'bg-primary/15', text: 'text-primary', border: 'border-primary/30', dot: 'bg-primary', pulse: true },
    Queued: { bg: 'bg-surface-variant', text: 'text-on-surface-variant', border: 'border-outline-variant', dot: '' },
    Failed: { bg: 'bg-error/15', text: 'text-error', border: 'border-error/30', dot: '' },
  }

  function getScoreDisplay(scan: Scan): string {
    if (scan.status === 'Queued' || scan.status === 'In Progress') return '--'
    return `${String(scan.risk_score).padStart(2, '0')}/100`
  }

  function getScoreClass(scan: Scan): string {
    if (scan.status === 'Queued' || scan.status === 'In Progress') return 'text-on-surface-variant'
    if (scan.risk_score >= 75) return 'text-error'
    if (scan.risk_score >= 50) return 'text-error'
    return 'text-on-surface'
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
      {/* Ambient glow */}
      <div className="absolute -top-[20%] -right-[10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Welcome Header */}
      <header className="mb-8 relative">
        <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">{greeting}</h2>
        <p className="text-on-surface-variant text-body-md mt-1">
          Real-time telemetry and threat detection metrics.
        </p>
      </header>

      {/* Overview Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Total Scans */}
        <div className="bg-surface-container-high p-6 rounded-xl border border-outline-variant card-glow transition-all relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-24 h-24 bg-primary/10 rounded-full blur-2xl"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <span className="p-2.5 rounded-xl bg-primary/15 text-primary material-symbols-outlined">search</span>
            <span className="text-tertiary font-label-caps text-label-caps flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">trending_up</span>
              +12%
            </span>
          </div>
          <p className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest mb-1 relative z-10">
            Total Scans
          </p>
          <h3 className="font-headline-lg text-[32px] text-on-surface relative z-10">{stats.total}</h3>
          <div className="w-full bg-surface-variant h-1 mt-4 rounded-full overflow-hidden relative z-10">
            <div className="bg-gradient-to-r from-primary to-primary-container h-full w-[70%] rounded-full"></div>
          </div>
        </div>

        {/* Critical Findings */}
        <div className="bg-surface-container-high p-6 rounded-xl border border-error/30 card-glow transition-all relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-32 h-32 bg-error/8 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-error/50 via-error to-error/50"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <span className="p-2.5 rounded-xl bg-error/15 text-error material-symbols-outlined">report</span>
            <span className="text-error font-label-caps text-label-caps bg-error/10 px-2 py-0.5 rounded-full">URGENT</span>
          </div>
          <p className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest mb-1 relative z-10">
            Critical Findings
          </p>
          <h3 className="font-headline-lg text-[32px] text-error relative z-10">{stats.critical}</h3>
          <p className="text-on-surface-variant text-[12px] mt-4 relative z-10">
            Requires immediate analyst intervention
          </p>
        </div>

        {/* Pending Analysis */}
        <div className="bg-surface-container-high p-6 rounded-xl border border-outline-variant card-glow transition-all relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-24 h-24 bg-secondary/8 rounded-full blur-2xl"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <span className="p-2.5 rounded-xl bg-secondary/15 text-secondary material-symbols-outlined">hourglass_empty</span>
          </div>
          <p className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-widest mb-1 relative z-10">
            Pending Analysis
          </p>
          <h3 className="font-headline-lg text-[32px] text-on-surface relative z-10">{stats.pending}</h3>
          <p className="text-on-surface-variant text-[12px] mt-4 relative z-10">Static/Dynamic sandbox queue active</p>
        </div>
      </div>

      {/* Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Recent Scans Table */}
        <div className="lg:col-span-8 bg-surface-container-low rounded-xl border border-outline-variant flex flex-col overflow-hidden shadow-card">
          <div className="p-5 border-b border-outline-variant flex justify-between items-center bg-surface-container">
            <h4 className="font-headline-md text-headline-md text-on-surface">Recent Scans</h4>
            <button
              onClick={() => navigate('/scan-history')}
              className="text-primary font-label-caps text-label-caps hover:text-primary-container transition-colors"
            >
              VIEW ALL
            </button>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse" aria-label="Recent scans">
              <thead>
                <tr className="bg-surface-container-high">
                  <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase">APK Name</th>
                  <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase text-center">Status</th>
                  <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant uppercase text-right">Risk Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/50">
                {recentScans.length === 0 ? (
                  <tr><td colSpan={3} className="text-center text-on-surface-variant py-8">No data found</td></tr>
                ) : (
                  recentScans.map((scan) => {
                    const sc = statusConfig[scan.status] || statusConfig.Queued
                    return (
                      <tr key={scan.id} className="hover:bg-surface-variant/30 transition-colors cursor-pointer" onClick={() => navigate(`/scan-result?id=${scan.id}`)}>
                        <td className="px-6 py-4 font-code-sm text-code-sm text-primary">{scan.file_name}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${sc.bg} ${sc.text} text-[11px] font-bold border ${sc.border}`}>
                            {sc.dot && <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}${sc.pulse ? ' animate-pulse' : ''}`}></span>}
                            {scan.status.toUpperCase()}
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

        {/* Activity Feed */}
        <div className="lg:col-span-4 bg-surface-container-low rounded-xl border border-outline-variant overflow-hidden flex flex-col shadow-card">
          <div className="p-5 border-b border-outline-variant bg-surface-container">
            <h4 className="font-headline-md text-headline-md text-on-surface">Recent Activity</h4>
          </div>
          <div className="flex-1 p-6 space-y-6 overflow-y-auto custom-scrollbar">
            {[
              { icon: 'warning', bg: 'bg-error/15', text: 'text-error', title: 'New malicious APK detected', desc: 'Device-902 flagged suspicious activity during run-time.', time: '2 MINS AGO' },
              { icon: 'check_circle', bg: 'bg-tertiary/15', text: 'text-tertiary', title: 'Scheduled scan completed', desc: 'All fleet devices (14/14) reported as secure.', time: '1 HOUR AGO' },
              { icon: 'sync', bg: 'bg-primary/15', text: 'text-primary', title: 'Threat database updated', desc: 'Version 4.5.12 applied with 142 new signatures.', time: '4 HOURS AGO' },
              { icon: 'person', bg: 'bg-secondary/15', text: 'text-secondary', title: 'New login detected', desc: 'Analyst Level 1 (ID: 04) logged in from 192.168.1.104', time: '6 HOURS AGO' },
            ].map((item, i) => (
              <div key={i} className="flex gap-4 relative">
                {i < 3 && <div className="absolute left-4 top-10 bottom-0 w-[1px] bg-outline-variant/30"></div>}
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
      <div className="mt-8 bg-surface-container p-6 rounded-xl border border-outline-variant relative h-64 overflow-hidden shadow-card">
        <div className="absolute -top-16 -right-16 w-40 h-40 bg-primary/5 rounded-full blur-3xl pointer-events-none"></div>
        <div className="flex justify-between items-center mb-6 relative z-10">
          <h4 className="font-headline-md text-headline-md text-on-surface">Threat Trajectory</h4>
          <div className="flex gap-3 items-center">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
              <span className="font-label-caps text-[10px] text-on-surface-variant uppercase">Normal</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-error"></span>
              <span className="font-label-caps text-[10px] text-on-surface-variant uppercase">Threats</span>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 w-full h-32 px-6">
          <div className="flex items-end justify-between h-full gap-1.5" role="img" aria-label="Threat trajectory bar chart">
            {[
              { h: '20%', c: 'bg-surface-variant hover:bg-surface-variant/80' },
              { h: '35%', c: 'bg-surface-variant hover:bg-surface-variant/80' },
              { h: '50%', c: 'bg-primary/60 hover:bg-primary/80' },
              { h: '45%', c: 'bg-surface-variant hover:bg-surface-variant/80' },
              { h: '60%', c: 'bg-primary/70 hover:bg-primary/90' },
              { h: '30%', c: 'bg-surface-variant hover:bg-surface-variant/80' },
              { h: '85%', c: 'bg-gradient-to-t from-error to-error/70', spike: true },
              { h: '40%', c: 'bg-surface-variant hover:bg-surface-variant/80' },
              { h: '25%', c: 'bg-surface-variant hover:bg-surface-variant/80' },
              { h: '55%', c: 'bg-primary/60 hover:bg-primary/80' },
              { h: '45%', c: 'bg-surface-variant hover:bg-surface-variant/80' },
              { h: '70%', c: 'bg-primary/70 hover:bg-primary/90' },
            ].map((bar, i) => (
              <div key={i} className={`w-full ${bar.c} rounded-t-sm transition-all cursor-pointer relative group`} style={{ height: bar.h }}>
                {bar.spike && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-error text-on-error font-code-sm text-[10px] px-2.5 py-0.5 rounded-full shadow-glow-error whitespace-nowrap">
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

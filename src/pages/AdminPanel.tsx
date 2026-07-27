import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { adminLogout } from '../lib/user'
import { useUser } from '../lib/userContext'
import { Scan } from '../lib/types'

interface UserSummary {
  userId: string
  totalScans: number
  threatsFound: number
  pendingScans: number
  criticalScans: number
  lastActivity: string | null
  scans: Scan[]
}

export default function AdminPanel() {
  const navigate = useNavigate()
  const { refreshAdmin } = useUser()
  const [users, setUsers] = useState<UserSummary[]>([])
  const [allScans, setAllScans] = useState<Scan[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [globalStats, setGlobalStats] = useState({ totalUsers: 0, totalScans: 0, totalThreats: 0, criticalThreats: 0 })

  useEffect(() => {
    fetchAllData()
  }, [])

  async function fetchAllData() {
    setLoading(true)
    try {
      const { data: scans } = await supabase
        .from('scans')
        .select('*')
        .order('uploaded_at', { ascending: false })

      if (scans) {
        setAllScans(scans)
        buildUserSummaries(scans)
      }
    } catch {
      // UI stays with empty data
    }
    setLoading(false)
  }

  function buildUserSummaries(scans: Scan[]) {
    const userMap = new Map<string, Scan[]>()
    scans.forEach((scan) => {
      const uid = scan.user_id || 'unknown'
      if (!userMap.has(uid)) userMap.set(uid, [])
      userMap.get(uid)!.push(scan)
    })

    const summaries: UserSummary[] = []
    userMap.forEach((userScans, userId) => {
      const threatsFound = userScans.filter((s) => s.threat_level !== 'None' && s.status === 'Complete').length
      const pendingScans = userScans.filter((s) => s.status === 'In Progress' || s.status === 'Queued').length
      const criticalScans = userScans.filter((s) => s.threat_level === 'Critical').length
      const lastActivity = userScans.length > 0 ? userScans[0].uploaded_at : null

      summaries.push({
        userId,
        totalScans: userScans.length,
        threatsFound,
        pendingScans,
        criticalScans,
        lastActivity,
        scans: userScans,
      })
    })

    summaries.sort((a, b) => {
      if (!a.lastActivity) return 1
      if (!b.lastActivity) return -1
      return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime()
    })

    setUsers(summaries)
    setGlobalStats({
      totalUsers: summaries.length,
      totalScans: scans.length,
      totalThreats: scans.filter((s) => s.threat_level !== 'None' && s.status === 'Complete').length,
      criticalThreats: scans.filter((s) => s.threat_level === 'Critical').length,
    })
  }

  const selectedUserData = selectedUser ? users.find((u) => u.userId === selectedUser) : null

  function truncateId(id: string) {
    if (id === 'unknown') return 'Unknown User'
    return `${id.slice(0, 8)}...${id.slice(-4)}`
  }

  function statusBadge(status: Scan['status']) {
    const map: Record<string, string> = {
      Complete: 'bg-tertiary/15 text-tertiary border border-tertiary/25',
      'In Progress': 'bg-primary/15 text-primary border border-primary/25',
      Queued: 'bg-surface-variant text-on-surface-variant border border-outline-variant/50',
      Failed: 'bg-error/15 text-error border border-error/25',
    }
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-label-caps text-[10px] ${map[status] || map.Queued}`}>
        {(status === 'In Progress' || status === 'Complete') && <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${status === 'In Progress' ? 'bg-primary' : 'bg-tertiary'}`}></span>}
        {status === 'In Progress' ? 'SCANNING' : status.toUpperCase()}
      </span>
    )
  }

  function threatBadge(level: string) {
    const map: Record<string, string> = {
      Critical: 'bg-error/15 text-error border border-error/25',
      High: 'bg-error/10 text-error border border-error/20',
      Medium: 'bg-secondary/15 text-secondary border border-secondary/25',
      Low: 'bg-tertiary/15 text-tertiary border border-tertiary/25',
      None: 'bg-surface-variant text-on-surface-variant border border-outline-variant/50',
    }
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-label-caps text-[10px] ${map[level] || map.None}`}>
        {level.toUpperCase()}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-on-surface-variant text-body-md">
          <span className="material-symbols-outlined animate-spin">sync</span>
          Loading admin data...
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full">
      <div className="absolute -top-[20%] -right-[10%] w-[300px] h-[300px] md:w-[500px] md:h-[500px] bg-error/5 rounded-full blur-[120px] pointer-events-none z-0"></div>

      {/* Header */}
      <header className="mb-8 relative z-10 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-error">admin_panel_settings</span>
            <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Admin Panel</h2>
            <span className="px-2 py-0.5 bg-error/15 text-error border border-error/25 rounded-full font-label-caps text-[10px]">ADMIN</span>
          </div>
          <p className="text-on-surface-variant text-body-md">
            System-wide overview of all users and their activity.
          </p>
        </div>
        <button
          onClick={() => {
            adminLogout()
            refreshAdmin()
          }}
          className="px-4 py-2 rounded-lg bg-error/15 text-error border border-error/30 font-label-caps text-label-caps hover:bg-error/25 transition-all flex items-center gap-2 whitespace-nowrap"
        >
          <span className="material-symbols-outlined text-[18px]">logout</span>
          Exit Admin
        </button>
      </header>

      {/* Global Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'TOTAL USERS', value: globalStats.totalUsers, icon: 'group', iconClass: 'text-primary', valueClass: 'text-primary' },
          { label: 'TOTAL SCANS', value: globalStats.totalScans, icon: 'search', iconClass: 'text-secondary', valueClass: 'text-secondary' },
          { label: 'THREATS FOUND', value: globalStats.totalThreats, icon: 'warning', iconClass: 'text-error', valueClass: 'text-error' },
          { label: 'CRITICAL', value: globalStats.criticalThreats, icon: 'report', iconClass: 'text-error', valueClass: 'text-error' },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface-container-high p-5 rounded-xl border border-outline-variant">
            <div className="flex items-center gap-2 mb-3">
              <span className={`material-symbols-outlined ${stat.iconClass}`}>{stat.icon}</span>
              <span className="font-label-caps text-label-caps text-on-surface-variant">{stat.label}</span>
            </div>
            <h3 className={`font-headline-lg text-headline-lg ${stat.valueClass}`}>{stat.value}</h3>
          </div>
        ))}
      </div>

      {/* User List / User Detail */}
      {selectedUserData ? (
        /* User Detail View */
        <div>
          <button
            onClick={() => setSelectedUser(null)}
            className="flex items-center gap-2 text-primary font-label-caps text-label-caps hover:text-primary-container transition-colors mb-6"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back to all users
          </button>

          <div className="bg-surface-container rounded-xl border border-outline-variant p-6 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary">person</span>
              </div>
              <div>
                <h3 className="font-headline-md text-headline-md text-on-surface">User {truncateId(selectedUserData.userId)}</h3>
                <p className="text-on-surface-variant text-sm font-code-sm">{selectedUserData.userId}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant/50">
                <p className="font-label-caps text-label-caps text-on-surface-variant">SCANS</p>
                <p className="text-headline-md text-on-surface font-bold">{selectedUserData.totalScans}</p>
              </div>
              <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant/50">
                <p className="font-label-caps text-label-caps text-on-surface-variant">THREATS</p>
                <p className="text-headline-md text-error font-bold">{selectedUserData.threatsFound}</p>
              </div>
              <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant/50">
                <p className="font-label-caps text-label-caps text-on-surface-variant">PENDING</p>
                <p className="text-headline-md text-secondary font-bold">{selectedUserData.pendingScans}</p>
              </div>
              <div className="bg-surface-container-low p-3 rounded-lg border border-outline-variant/50">
                <p className="font-label-caps text-label-caps text-on-surface-variant">LAST ACTIVE</p>
                <p className="text-sm text-on-surface font-bold">
                  {selectedUserData.lastActivity ? new Date(selectedUserData.lastActivity).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {/* User's Scans */}
          <div className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden shadow-card">
            <div className="p-4 border-b border-outline-variant bg-surface-container-high">
              <h4 className="font-headline-md text-headline-md text-on-surface">Scan History ({selectedUserData.scans.length})</h4>
            </div>
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-high border-b border-outline-variant">
                    <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">Timestamp</th>
                    <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">File Name</th>
                    <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase text-center">Status</th>
                    <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase text-center">Threat</th>
                    <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase text-right">Risk</th>
                    <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {selectedUserData.scans.map((scan) => (
                    <tr key={scan.id} className="hover:bg-surface-variant/20 transition-colors">
                      <td className="p-4 text-sm text-on-surface whitespace-nowrap">
                        {new Date(scan.uploaded_at).toLocaleDateString()}
                      </td>
                      <td className="p-4">
                        <span className="font-code-sm text-code-sm bg-surface-container-lowest px-2 py-1 rounded text-primary border border-outline-variant/30">
                          {scan.file_name}
                        </span>
                      </td>
                      <td className="p-4 text-center">{statusBadge(scan.status)}</td>
                      <td className="p-4 text-center">{threatBadge(scan.threat_level)}</td>
                      <td className="p-4 text-right font-bold text-on-surface">{scan.risk_score}/100</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => navigate(`/scan-result?id=${scan.id}`)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/15 text-primary hover:bg-primary/25 rounded-lg text-xs font-medium transition-all"
                        >
                          <span className="material-symbols-outlined text-[14px]">visibility</span>
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* User List View */
        <div className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden shadow-card">
          <div className="p-4 border-b border-outline-variant bg-surface-container-high flex justify-between items-center">
            <h4 className="font-headline-md text-headline-md text-on-surface">All Users ({users.length})</h4>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-high border-b border-outline-variant">
                  <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">User ID</th>
                  <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase text-center">Total Scans</th>
                  <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase text-center">Threats</th>
                  <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase text-center">Critical</th>
                  <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase text-center">Pending</th>
                  <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase">Last Activity</th>
                  <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/30">
                {users.length === 0 ? (
                  <tr><td colSpan={7} className="text-center text-on-surface-variant py-8">No users found</td></tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.userId} className="hover:bg-surface-variant/20 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-primary text-[16px]">person</span>
                          </div>
                          <div>
                            <p className="font-code-sm text-sm text-on-surface">{truncateId(user.userId)}</p>
                            <p className="text-[10px] text-on-surface-variant font-code-sm">{user.userId}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-center font-bold text-on-surface">{user.totalScans}</td>
                      <td className="p-4 text-center">
                        <span className={user.threatsFound > 0 ? 'text-error font-bold' : 'text-on-surface'}>
                          {user.threatsFound}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={user.criticalScans > 0 ? 'text-error font-bold' : 'text-on-surface'}>
                          {user.criticalScans}
                        </span>
                      </td>
                      <td className="p-4 text-center text-secondary font-bold">{user.pendingScans}</td>
                      <td className="p-4 text-sm text-on-surface-variant">
                        {user.lastActivity ? new Date(user.lastActivity).toLocaleString() : 'N/A'}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => setSelectedUser(user.userId)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/15 text-primary hover:bg-primary/25 rounded-lg text-xs font-medium transition-all"
                        >
                          <span className="material-symbols-outlined text-[14px]">visibility</span>
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

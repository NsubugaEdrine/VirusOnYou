import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Scan } from '../lib/types'
import { Shield, AlertTriangle, CheckCircle, Clock, Activity } from 'lucide-react'

export default function Dashboard() {
  const [scans, setScans] = useState<Scan[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, threats: 0, clean: 0, inProgress: 0 })
  const [distribution, setDistribution] = useState<Record<string, number>>({})
  const [pendingQueue, setPendingQueue] = useState(0)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)

    const { data: allScans } = await supabase
      .from('scans')
      .select('*')
      .order('uploaded_at', { ascending: false })

    if (allScans) {
      setScans(allScans)

      const threats = allScans.filter(s => s.threat_level !== 'None').length
      const clean = allScans.filter(s => s.threat_level === 'None').length
      const inProgress = allScans.filter(s => s.status === 'In Progress' || s.status === 'Queued').length

      setStats({
        total: allScans.length,
        threats,
        clean,
        inProgress,
      })

      const dist: Record<string, number> = {}
      allScans.forEach(s => {
        dist[s.threat_level] = (dist[s.threat_level] || 0) + 1
      })
      setDistribution(dist)

      const pending = allScans.filter(s => s.status === 'Queued').length
      setPendingQueue(pending)
    }

    setLoading(false)
  }

  const recentScans = scans.slice(0, 5)

  const maxDist = Math.max(...Object.values(distribution), 1)

  const threatColors: Record<string, string> = {
    Critical: '#ef4444',
    High: '#f97316',
    Medium: '#eab308',
    Low: '#22c55e',
    None: '#64748b',
  }

  const statusColors: Record<string, string> = {
    Complete: 'bg-green-500/20 text-green-400',
    'In Progress': 'bg-yellow-500/20 text-yellow-400',
    Queued: 'bg-slate-500/20 text-slate-400',
    Failed: 'bg-red-500/20 text-red-400',
  }

  const threatBadgeColors: Record<string, string> = {
    Critical: 'bg-red-500/20 text-red-400',
    High: 'bg-orange-500/20 text-orange-400',
    Medium: 'bg-yellow-500/20 text-yellow-400',
    Low: 'bg-green-500/20 text-green-400',
    None: 'bg-slate-500/20 text-slate-400',
  }

  if (loading) {
    return <div className="min-h-screen bg-slate-900 text-slate-400 flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Analyst Dashboard</h1>

      <div className="grid grid-cols-4 gap-6 mb-6">
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-500/20 rounded-lg">
              <Shield className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
              <p className="text-slate-400 text-sm">Total Scans</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-500/20 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.threats}</p>
              <p className="text-slate-400 text-sm">Threats Detected</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-500/20 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.clean}</p>
              <p className="text-slate-400 text-sm">Clean Files</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-yellow-500/20 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.inProgress}</p>
              <p className="text-slate-400 text-sm">In Progress</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-slate-800 rounded-xl p-6 border border-slate-700/50">
          <h2 className="text-lg font-semibold text-white mb-4">Recent Scans</h2>
          <table className="w-full">
            <thead>
              <tr className="bg-slate-700/50">
                <th className="text-left text-slate-300 text-sm font-medium px-4 py-3 rounded-l-lg">File Name</th>
                <th className="text-left text-slate-300 text-sm font-medium px-4 py-3">Type</th>
                <th className="text-left text-slate-300 text-sm font-medium px-4 py-3">Status</th>
                <th className="text-left text-slate-300 text-sm font-medium px-4 py-3">Threat Level</th>
                <th className="text-left text-slate-300 text-sm font-medium px-4 py-3 rounded-r-lg">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {recentScans.length === 0 ? (
                <tr><td colSpan={5} className="text-center text-slate-400 py-8">No data found</td></tr>
              ) : (
                recentScans.map(scan => (
                  <tr key={scan.id}>
                    <td className="px-4 py-3 text-white text-sm">{scan.file_name}</td>
                    <td className="px-4 py-3 text-slate-300 text-sm">{scan.package_name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[scan.status] || ''}`}>
                        {scan.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${threatBadgeColors[scan.threat_level] || ''}`}>
                        {scan.threat_level}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm">{new Date(scan.uploaded_at).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700/50">
            <h2 className="text-lg font-semibold text-white mb-4">Threat Distribution</h2>
            <div className="space-y-3">
              {Object.entries(distribution).map(([level, count]) => (
                <div key={level}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-300">{level}</span>
                    <span className="text-slate-400">{count}</span>
                  </div>
                  <div className="w-full bg-slate-700/50 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${(count / maxDist) * 100}%`,
                        backgroundColor: threatColors[level] || '#64748b',
                      }}
                    />
                  </div>
                </div>
              ))}
              {Object.keys(distribution).length === 0 && (
                <p className="text-slate-400 text-sm text-center py-4">No data found</p>
              )}
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700/50">
            <h2 className="text-lg font-semibold text-white mb-4">System Status</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-green-400" />
                  <span className="text-slate-300 text-sm">Analysis Engine</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-green-400 text-sm">Active</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-yellow-400" />
                  <span className="text-slate-300 text-sm">Queue</span>
                </div>
                <span className="text-slate-300 text-sm">{pendingQueue} Pending</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

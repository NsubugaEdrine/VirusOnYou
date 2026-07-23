import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Scan } from '../lib/types'
import { Filter, Eye } from 'lucide-react'

export default function ScanHistory() {
  const [scans, setScans] = useState<Scan[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('All')
  const [counts, setCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    fetchCounts()
  }, [])

  useEffect(() => {
    fetchScans()
  }, [filter])

  async function fetchCounts() {
    const { data } = await supabase.from('scans').select('threat_level')
    if (data) {
      const c: Record<string, number> = { All: data.length }
      data.forEach((s: { threat_level: string }) => {
        c[s.threat_level] = (c[s.threat_level] || 0) + 1
      })
      setCounts(c)
    }
  }

  async function fetchScans() {
    setLoading(true)
    let query = supabase.from('scans').select('*').order('uploaded_at', { ascending: false })
    if (filter !== 'All') {
      query = query.eq('threat_level', filter)
    }
    const { data } = await query
    if (data) setScans(data)
    setLoading(false)
  }

  const threatBadgeColors: Record<string, string> = {
    Critical: 'bg-red-500/20 text-red-400',
    High: 'bg-orange-500/20 text-orange-400',
    Medium: 'bg-yellow-500/20 text-yellow-400',
    Low: 'bg-green-500/20 text-green-400',
    None: 'bg-slate-500/20 text-slate-400',
  }

  const statusColors: Record<string, string> = {
    Complete: 'bg-green-500/20 text-green-400',
    'In Progress': 'bg-yellow-500/20 text-yellow-400',
    Queued: 'bg-slate-500/20 text-slate-400',
    Failed: 'bg-red-500/20 text-red-400',
  }

  const filterOptions = ['All', 'Critical', 'High', 'Medium', 'Low']

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Scan History</h1>

      <div className="flex gap-6">
        <div className="w-64 flex-shrink-0">
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700/50">
            <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Filter className="w-4 h-4 text-indigo-400" />
              Filter by Threat Level
            </h2>
            <div className="space-y-2">
              {filterOptions.map(opt => (
                <label key={opt} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="radio"
                    name="threat-filter"
                    checked={filter === opt}
                    onChange={() => setFilter(opt)}
                    className="w-4 h-4 border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0"
                  />
                  <span className="text-slate-300 text-sm group-hover:text-white transition-colors">{opt}</span>
                  {counts[opt] !== undefined && (
                    <span className="ml-auto text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded-full">
                      {counts[opt]}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1">
          <div className="bg-slate-800 rounded-xl border border-slate-700/50 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-700/50">
                  <th className="text-left text-slate-300 text-sm font-medium px-6 py-3">File Name</th>
                  <th className="text-left text-slate-300 text-sm font-medium px-6 py-3">Date</th>
                  <th className="text-left text-slate-300 text-sm font-medium px-6 py-3">Status</th>
                  <th className="text-left text-slate-300 text-sm font-medium px-6 py-3">Threat Level</th>
                  <th className="text-left text-slate-300 text-sm font-medium px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {loading ? (
                  <tr><td colSpan={5} className="text-center text-slate-400 py-8">Loading...</td></tr>
                ) : scans.length === 0 ? (
                  <tr><td colSpan={5} className="text-center text-slate-400 py-8">No data found</td></tr>
                ) : (
                  scans.map(scan => (
                    <tr key={scan.id} className="hover:bg-slate-700/20 transition-colors">
                      <td className="px-6 py-4 text-white text-sm">{scan.file_name}</td>
                      <td className="px-6 py-4 text-slate-400 text-sm">{new Date(scan.uploaded_at).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[scan.status] || ''}`}>
                          {scan.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${threatBadgeColors[scan.threat_level] || ''}`}>
                          {scan.threat_level}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          to={`/scan-result?id=${scan.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 rounded-lg text-xs font-medium transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          View
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

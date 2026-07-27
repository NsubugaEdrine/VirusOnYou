import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Scan } from '../lib/types'
import { useUser } from '../lib/userContext'

export default function ScanHistory() {
  const { userId, admin } = useUser()
  const [scans, setScans] = useState<Scan[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Scan['threat_level'] | 'All'>('All')
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => { fetchCounts() }, [])
  useEffect(() => { fetchScans() }, [filter])

  async function fetchCounts() {
    try {
      let query = supabase.from('scans').select('threat_level')
      if (!admin) query = query.eq('user_id', userId)
      const { data } = await query
      if (data) {
        const c: Record<string, number> = { All: data.length }
        data.forEach((s: { threat_level: string }) => { c[s.threat_level] = (c[s.threat_level] || 0) + 1 })
        setCounts(c)
      }
    } catch {
      // UI stays with empty counts
    }
  }

  async function fetchScans() {
    setLoading(true)
    try {
      let query = supabase.from('scans').select('*').order('uploaded_at', { ascending: false })
      if (!admin) query = query.eq('user_id', userId)
      if (filter !== 'All') query = query.eq('threat_level', filter)
      const { data } = await query
      if (data) setScans(data)
    } catch {
      // UI stays with previous scans data
    }
    setLoading(false)
  }

  const displayed = scans.filter(
    (s) =>
      s.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.package_name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === displayed.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(displayed.map((s) => s.id)))
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

  function riskScoreDisplay(scan: Scan) {
    if (scan.status === 'Queued' || scan.status === 'In Progress') return '--'
    return String(scan.risk_score).padStart(2, '0')
  }

  function riskBarColor(score: number) {
    if (score >= 75) return 'bg-gradient-to-r from-error to-error/70'
    if (score >= 50) return 'bg-error'
    if (score >= 25) return 'bg-primary'
    return 'bg-tertiary'
  }

  function riskTextColor(score: number) {
    if (score >= 50) return 'text-error'
    return 'text-on-surface'
  }

  const filterOptions: Array<Scan['threat_level'] | 'All'> = ['All', 'Critical', 'High', 'Medium', 'Low', 'None']

  return (
    <>
      <div className="absolute -top-[20%] -right-[10%] w-[500px] h-[500px] bg-primary/4 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 relative">
        <div>
          <h2 className="font-headline-lg text-headline-lg text-on-surface mb-2 tracking-tight">Scan History</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Review and manage recent file examinations across all monitored systems.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/scan-submission"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-primary to-primary-container text-on-primary font-label-caps text-label-caps hover:shadow-glow-primary transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Scan
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-surface-container rounded-xl border border-outline-variant p-4 mb-6 flex flex-wrap items-center gap-3 relative">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-container-high border border-outline-variant text-on-surface-variant glow-active">
          <span className="material-symbols-outlined text-sm">search</span>
          <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search packages..."
                aria-label="Search scan packages"
                className="bg-transparent border-none focus:ring-0 text-body-md placeholder:text-on-surface-variant/50 w-48"
              />
        </div>
        <div className="h-6 w-px bg-outline-variant mx-1"></div>
        {filterOptions.map((opt) => (
          <button
            key={opt}
            onClick={() => setFilter(opt)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-label-caps text-label-caps transition-all ${
              filter === opt
                ? 'border border-primary bg-primary/10 text-primary shadow-glow-primary'
                : 'border border-outline-variant text-on-surface-variant hover:bg-surface-variant hover:border-primary/30'
            }`}
          >
            {opt}
            {counts[opt] !== undefined && (
              <span className="text-[10px] opacity-70">({counts[opt]})</span>
            )}
          </button>
        ))}
        <div className="flex-1"></div>
        <button
          onClick={() => { setFilter('All'); setSearchQuery('') }}
          className="text-on-surface-variant font-label-caps text-label-caps hover:text-primary transition-colors flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-[16px]">filter_list</span>
          Clear Filters
        </button>
      </div>

      {/* Data Table */}
      <div className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden shadow-card">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse" aria-label="Scan history">
            <thead>
              <tr className="bg-surface-container-high border-b border-outline-variant">
                <th className="p-4 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === displayed.length && displayed.length > 0}
                    onChange={toggleSelectAll}
                    aria-label="Select all scans"
                    className="rounded border-outline-variant bg-surface-container text-primary focus:ring-primary"
                  />
                </th>
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">Timestamp</th>
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">Package Name</th>
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider text-center">Status</th>
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider text-center">Risk Score</th>
                <th className="p-4 font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {loading ? (
                <tr><td colSpan={6} className="text-center text-on-surface-variant py-8">
                  <div className="flex items-center justify-center gap-3">
                    <span className="material-symbols-outlined animate-spin text-primary">sync</span>
                    Loading...
                  </div>
                </td></tr>
              ) : displayed.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-on-surface-variant py-8">No data found</td></tr>
              ) : (
                displayed.map((scan) => (
                  <tr key={scan.id} className={`hover:bg-surface-variant/20 transition-colors group ${selectedIds.has(scan.id) ? 'bg-primary/5' : ''}`}>
                      <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(scan.id)}
                        onChange={() => toggleSelect(scan.id)}
                        aria-label={`Select ${scan.file_name}`}
                        className="rounded border-outline-variant bg-surface-container text-primary focus:ring-primary"
                      />
                    </td>
                    <td className="p-4 font-body-md text-on-surface whitespace-nowrap">
                      {new Date(scan.uploaded_at).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <span className="font-code-sm text-code-sm bg-surface-container-lowest px-2 py-1 rounded text-primary border border-outline-variant/30">
                        {scan.file_name}
                      </span>
                    </td>
                    <td className="p-4 text-center">{statusBadge(scan.status)}</td>
                    <td className="p-4 text-center">
                      <div className="flex flex-col items-center">
                        <span className={`font-headline-md text-headline-md ${riskTextColor(scan.risk_score)}`}>
                          {riskScoreDisplay(scan)}
                        </span>
                        <div className="w-12 h-1 bg-surface-variant rounded-full mt-1 overflow-hidden">
                          <div className={`h-full rounded-full ${riskBarColor(scan.risk_score)}`} style={{ width: `${scan.risk_score}%` }}></div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <Link
                        to={`/scan-result?id=${scan.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/15 text-primary hover:bg-primary/25 hover:shadow-glow-primary rounded-lg text-xs font-medium transition-all"
                      >
                        <span className="material-symbols-outlined text-[14px]">visibility</span>
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="p-4 bg-surface-container-high flex items-center justify-between border-t border-outline-variant">
          <p className="font-label-caps text-label-caps text-on-surface-variant">
            Showing {displayed.length} of {scans.length} scans
          </p>
          <div className="flex items-center gap-2">
            <button className="w-8 h-8 flex items-center justify-center rounded border border-outline-variant text-on-surface-variant hover:bg-surface-variant hover:border-primary/30 transition-all" disabled aria-label="Previous page">
              <span className="material-symbols-outlined text-sm">chevron_left</span>
            </button>
            <span className="font-label-caps text-label-caps px-2 text-primary">1</span>
            <button className="w-8 h-8 flex items-center justify-center rounded border border-outline-variant text-on-surface-variant hover:bg-surface-variant hover:border-primary/30 transition-all" aria-label="Next page">
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Actions FAB */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-24 md:bottom-8 right-8 z-50 flex flex-col items-end gap-3 transition-all duration-300">
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-error to-error/80 text-on-error font-bold shadow-glow-error hover:scale-105 active:scale-95 transition-all">
              <span className="material-symbols-outlined">save_as</span>
              Bulk Quarantine
            </button>
            <button className="flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-primary to-primary-container text-on-primary font-bold shadow-glow-primary hover:scale-105 active:scale-95 transition-all">
              <span className="material-symbols-outlined">download</span>
              Export Selected
            </button>
          </div>
          <div className="bg-surface-container-high px-4 py-2 rounded-lg border border-primary/30 shadow-glow-primary">
            <p className="font-label-caps text-label-caps text-primary">{selectedIds.size} Items Selected</p>
          </div>
        </div>
      )}
    </>
  )
}

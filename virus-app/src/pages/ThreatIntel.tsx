import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { ThreatIntel as ThreatIntelType } from '../lib/types'
import { Search, Shield, Calendar, Tag } from 'lucide-react'

export default function ThreatIntel() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ThreatIntelType[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  async function handleSearch() {
    if (!query.trim()) return

    setLoading(true)
    setSearched(true)

    const { data } = await supabase
      .from('threat_intel')
      .select('*')
      .or(`package_name.ilike.%${query}%,malware_family.ilike.%${query}%`)

    if (data) setResults(data)
    else setResults([])

    setLoading(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSearch()
  }

  const severityColors: Record<string, string> = {
    Critical: 'bg-red-500/20 text-red-400',
    High: 'bg-orange-500/20 text-orange-400',
    Medium: 'bg-yellow-500/20 text-yellow-400',
    Low: 'bg-green-500/20 text-green-400',
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Threat Intelligence Search</h1>

      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700/50 mb-6">
        <div className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search by package name or malware family..."
            className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium text-sm transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-12">Loading...</div>
      ) : searched && results.length === 0 ? (
        <div className="text-center text-slate-400 py-12">No data found</div>
      ) : (
        <div className="space-y-4">
          {results.map(item => (
            <div key={item.id} className="bg-slate-800 rounded-xl p-6 border border-slate-700/50">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                    <Shield className="w-5 h-5 text-indigo-400" />
                    {item.package_name}
                  </h3>
                  <p className="text-slate-400 text-sm mt-1">{item.malware_family}</p>
                </div>
                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${severityColors[item.severity] || ''}`}>
                  {item.severity}
                </span>
              </div>

              <div className="flex gap-6 mb-4 text-sm">
                <div className="flex items-center gap-2 text-slate-400">
                  <Calendar className="w-4 h-4" />
                  <span>First Seen: <span className="text-slate-300">{new Date(item.first_seen).toLocaleDateString()}</span></span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Calendar className="w-4 h-4" />
                  <span>Last Seen: <span className="text-slate-300">{new Date(item.last_seen).toLocaleDateString()}</span></span>
                </div>
              </div>

              {item.iocs && item.iocs.length > 0 && (
                <div className="mb-4">
                  <p className="text-slate-400 text-xs uppercase tracking-wide mb-2 flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    IOCs
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {item.iocs.map((ioc, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1.5 bg-slate-700/50 text-slate-300 px-2.5 py-1 rounded-lg text-xs">
                        <span className="text-indigo-400 font-medium">{ioc.type}:</span>
                        <span className="font-mono">{ioc.value}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-slate-300 text-sm leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { ThreatIntel as ThreatIntelType } from '../lib/types'

export default function ThreatIntel() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ThreatIntelType[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        document.getElementById('threat-intel-search')?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  async function handleSearch() {
    if (!query.trim()) return
    setLoading(true)
    setSearched(true)
    try {
      const { data } = await supabase
        .from('threat_intel')
        .select('*')
        .or(`package_name.ilike.%${query}%,malware_family.ilike.%${query}%`)
      if (data) setResults(data)
      else setResults([])
    } catch {
      setResults([])
    }
    setLoading(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSearch()
  }

  return (
    <>
      <div className="absolute -top-[20%] -left-[10%] w-[600px] h-[600px] bg-primary/4 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Search Hero */}
      <div className="mb-12 relative">
        <div className="max-w-3xl">
          <h2 className="font-headline-lg text-headline-lg mb-2 tracking-tight">Threat Intelligence Engine</h2>
          <p className="text-on-surface-variant mb-8">Search global reputation databases for Indicators of Compromise (IoCs).</p>
          <div className="relative group glow-active bg-surface-container-lowest border border-outline-variant rounded-xl p-1.5 transition-all duration-300">
            <div className="flex items-center px-4 py-3 gap-4">
              <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'wght' 700" }}>drive_file_rename</span>
              <input
                id="threat-intel-search"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Hash, IP, Domain, or Package Name"
                aria-label="Search for indicators of compromise"
                className="bg-transparent border-none focus:ring-0 text-headline-md font-body-md w-full placeholder:text-outline/50"
              />
              <kbd className="hidden md:block px-2 py-1 bg-surface-variant border border-outline-variant rounded text-[10px] text-outline font-code-sm">CTRL + K</kbd>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-[10px] text-outline uppercase font-bold tracking-widest mr-2 py-1">Popular:</span>
            {['4a8c91...7e12', 'evil-domain.ru', 'suspicious_payload.apk'].map((tag) => (
              <button
                key={tag}
                onClick={() => { setQuery(tag); handleSearch() }}
                className="px-3 py-1 rounded-lg bg-surface-variant border border-outline-variant text-[11px] font-code-sm hover:border-primary hover:bg-primary/5 transition-all"
              >
                {tag}
              </button>
            ))}
          </div>
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="mt-4 px-6 py-2.5 bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-lg font-label-caps text-label-caps hover:shadow-glow-primary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Searching...' : 'Search IoCs'}
          </button>
        </div>
      </div>

      {/* Results Grid */}
      {searched && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
          {/* Left: Results */}
          <div className="lg:col-span-7 space-y-6">
            {loading ? (
              <div className="flex items-center justify-center gap-3 py-12 text-on-surface-variant">
                <span className="material-symbols-outlined animate-spin">sync</span>
                Searching threat databases...
              </div>
            ) : results.length === 0 ? (
              <div className="text-center py-12 text-on-surface-variant">No results found for "{query}"</div>
            ) : (
              results.map((item) => (
                <div key={item.id} className="tactical-border rounded-xl p-6 bg-surface-container-low overflow-hidden relative">
                  <div className="absolute -top-8 -right-8 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none"></div>
                  <div className="absolute top-0 right-0 p-4">
                    <span className={`px-3 py-1 rounded-full font-label-caps text-label-caps ${
                      item.severity === 'Critical' ? 'bg-error/15 border border-error/30 text-error' :
                      item.severity === 'High' ? 'bg-secondary/15 border border-secondary/30 text-secondary' :
                      'bg-surface-variant border border-outline-variant text-on-surface-variant'
                    }`}>
                      {item.severity.toUpperCase()} THREAT
                    </span>
                  </div>
                  <div className="flex items-start gap-4 mb-6 relative z-10">
                    <div className={`p-3 rounded-lg ${
                      item.severity === 'Critical' ? 'bg-error/10 border border-error/25' : 'bg-primary/10 border border-primary/25'
                    }`}>
                      <span className={`material-symbols-outlined text-3xl ${
                        item.severity === 'Critical' ? 'text-error' : 'text-primary'
                      }`}>language</span>
                    </div>
                    <div>
                      <h3 className="font-headline-md text-headline-md font-bold">{item.package_name}</h3>
                      <p className="font-code-sm text-outline">{item.malware_family}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mb-8 relative z-10">
                    <div className="p-4 bg-surface-container-highest rounded-lg border border-outline-variant">
                      <p className="font-label-caps text-label-caps text-outline mb-1">SEVERITY</p>
                      <p className={`font-headline-lg text-headline-lg ${item.severity === 'Critical' ? 'text-error' : item.severity === 'High' ? 'text-secondary' : 'text-on-surface'}`}>
                        {item.severity}
                      </p>
                    </div>
                    <div className="p-4 bg-surface-container-highest rounded-lg border border-outline-variant">
                      <p className="font-label-caps text-label-caps text-outline mb-1">IOCS</p>
                      <p className="font-headline-lg text-headline-lg text-tertiary">{item.iocs.length}</p>
                    </div>
                    <div className="p-4 bg-surface-container-highest rounded-lg border border-outline-variant">
                      <p className="font-label-caps text-label-caps text-outline mb-1">FIRST SEEN</p>
                      <p className="text-[14px] font-bold text-on-surface mt-2">
                        {new Date(item.first_seen).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4 relative z-10">
                    <h4 className="font-label-caps text-label-caps text-outline border-b border-outline-variant pb-2">Analysis Summary</h4>
                    <p className="text-body-md text-on-surface-variant">{item.description}</p>
                    {item.iocs.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {item.iocs.map((ioc, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1.5 bg-surface-container-highest text-on-surface-variant px-2.5 py-1 rounded-lg text-xs border border-outline-variant hover:border-primary/30 transition-colors">
                            <span className="text-primary font-bold">{ioc.type}:</span>
                            <span className="font-code-sm">{ioc.value}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Right: Metadata */}
          <div className="lg:col-span-5 space-y-6">
            {results.length > 0 && (
              <>
                {/* Relationship Graph Visual */}
                <div className="tactical-border rounded-xl p-6 bg-surface-container-low h-[320px] flex flex-col overflow-hidden relative">
                  <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none"></div>
                  <h3 className="font-label-caps text-label-caps text-outline mb-4 relative z-10">Threat Relationship View</h3>
                  <div className="flex-1 border border-outline-variant rounded-lg bg-surface-container-highest relative overflow-hidden">
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, rgba(124,179,255,0.5) 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                    <div className="relative w-full h-full p-8 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-error/20 border border-error/40 flex items-center justify-center shadow-glow-error animate-pulse">
                        <span className="material-symbols-outlined text-error" style={{ fontVariationSettings: "'FILL' 1" }}>language</span>
                      </div>
                    </div>
                    <div className="absolute bottom-3 left-3 flex gap-2">
                      <span className="text-[9px] font-label-caps text-outline bg-surface-dim/80 px-2 py-0.5 border border-outline-variant rounded">
                        RELATIONS: {results[0]?.iocs.length || 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Attributes Card */}
                <div className="tactical-border rounded-xl p-6 bg-surface-container-low">
                  <h3 className="font-label-caps text-label-caps text-outline mb-4">Metadata & Attributes</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-outline-variant/30">
                      <span className="text-outline text-xs">Package</span>
                      <span className="font-code-sm text-xs text-on-surface">{results[0]?.package_name}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-outline-variant/30">
                      <span className="text-outline text-xs">Malware Family</span>
                      <span className="font-code-sm text-xs text-on-surface">{results[0]?.malware_family}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-outline-variant/30">
                      <span className="text-outline text-xs">Last Seen</span>
                      <span className="font-code-sm text-xs text-on-surface">
                        {results[0] ? new Date(results[0].last_seen).toLocaleDateString() : '--'}
                      </span>
                    </div>
                    <div className="pt-4">
                      <button className="w-full py-2 bg-gradient-to-r from-primary to-primary-container text-on-primary font-label-caps text-label-caps rounded-lg hover:shadow-glow-primary transition-all flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-sm">download</span>
                        DOWNLOAD REPORT
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

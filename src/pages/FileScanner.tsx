import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useUser } from '../lib/userContext'
import { computeSHA256, analyzeFileForThreats, getExtension, getFileCategory, formatBytes } from '../lib/scanner'
import { FileScanResult } from '../lib/types'

type ViewState = 'select' | 'scanning' | 'results'
type FilePickerMode = 'file' | 'directory'

export default function FileScanner() {
  const { userId } = useUser()
  const [viewState, setViewState] = useState<ViewState>('select')
  const [files, setFiles] = useState<File[]>([])
  const [results, setResults] = useState<FileScanResult[]>([])
  const [progress, setProgress] = useState({ current: 0, total: 0, name: '', percent: 0 })
  const [filter, setFilter] = useState<'all' | 'threat' | 'clean'>('all')
  const [stats, setStats] = useState({ total: 0, clean: 0, threats: 0, corrupted: 0 })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dirInputRef = useRef<HTMLInputElement>(null)

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files
    if (!selected || selected.length === 0) return
    const fileList = Array.from(selected)
    setFiles(fileList)
    await startScan(fileList)
  }

  async function handleDirectorySelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files
    if (!selected || selected.length === 0) return
    const fileList = Array.from(selected)
    setFiles(fileList)
    await startScan(fileList)
  }

  async function startScan(fileList: File[]) {
    setViewState('scanning')
    setResults([])
    setStats({ total: 0, clean: 0, threats: 0, corrupted: 0 })

    const scanResults: FileScanResult[] = []
    let threatsFound = 0
    let cleanFound = 0
    let corruptedFound = 0

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      setProgress({ current: i + 1, total: fileList.length, name: file.name, percent: Math.round(((i + 1) / fileList.length) * 100) })

      try {
        const sha256 = await computeSHA256(file)
        const analysis = analyzeFileForThreats(file, sha256)
        const ext = getExtension(file.name)
        const path = (file as unknown as { webkitRelativePath?: string }).webkitRelativePath || file.name

        const status: FileScanResult['status'] =
          analysis.riskScore >= 50 ? 'threat' :
          analysis.riskScore >= 25 ? 'threat' :
          file.size === 0 ? 'corrupted' :
          'clean'

        const result: FileScanResult = {
          id: crypto.randomUUID(),
          name: file.name,
          path,
          size: file.size,
          category: getFileCategory(ext),
          sha256,
          status,
          threatLevel: analysis.threatLevel,
          threatName: analysis.threatName,
          riskScore: analysis.riskScore,
          details: analysis.details,
          scannedAt: new Date().toISOString(),
        }
        scanResults.push(result)

        if (status === 'threat') threatsFound++
        else if (status === 'corrupted') corruptedFound++
        else cleanFound++

        // Save to Supabase
        await supabase.from('scans').insert({
          file_name: file.name,
          package_name: file.name.replace(/\.[^.]+$/, ''),
          version: '1.0.0',
          sha256,
          status: 'Complete',
          threat_level: analysis.threatLevel,
          risk_score: analysis.riskScore,
          risk_category: analysis.threatName || '',
          malware_name: analysis.threatName,
          scan_types: ['File System Scan', 'Heuristic Analysis', 'Signature Matching', 'Hash Verification'],
          user_id: userId,
        })
      } catch {
        scanResults.push({
          id: crypto.randomUUID(), name: file.name,
          path: (file as unknown as { webkitRelativePath?: string }).webkitRelativePath || file.name,
          size: file.size, category: 'Other', sha256: 'error',
          status: 'error', threatLevel: 'None', threatName: null,
          riskScore: 0, details: 'Failed to analyze', scannedAt: new Date().toISOString(),
        })
      }

      if (fileList.length > 10) await new Promise((r) => setTimeout(r, 30))
    }

    setResults(scanResults)
    setStats({ total: scanResults.length, clean: cleanFound, threats: threatsFound, corrupted: corruptedFound })
    setViewState('results')
  }

  function reset() {
    setFiles([])
    setResults([])
    setViewState('select')
    setFilter('all')
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (dirInputRef.current) dirInputRef.current.value = ''
  }

  const filteredResults = filter === 'all' ? results : results.filter((r) => r.status === filter)

  const threatBadge = (level: string) => {
    const map: Record<string, string> = {
      Critical: 'bg-error/15 text-error border-error/25',
      High: 'bg-error/10 text-error border-error/20',
      Medium: 'bg-secondary/15 text-secondary border-secondary/25',
      Low: 'bg-tertiary/15 text-tertiary border-tertiary/25',
      None: 'bg-surface-variant text-on-surface-variant border-outline-variant/50',
    }
    return <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-label-caps text-[10px] border ${map[level] || map.None}`}>{level.toUpperCase()}</span>
  }

  return (
    <>
      <div className="absolute -top-[20%] -right-[10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>

      <header className="mb-8 relative">
        <div className="flex items-center gap-3 mb-2">
          <span className="material-symbols-outlined text-primary">folder_open</span>
          <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">File Scanner</h2>
        </div>
        <p className="text-on-surface-variant text-body-md">
          Scan files and folders on your device for malware, corrupted files, and suspicious content.
        </p>
      </header>

      {/* File Selection */}
      {viewState === 'select' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="group bg-surface-container-high rounded-2xl border-2 border-dashed border-outline-variant p-8 text-center hover:border-primary hover:bg-primary/5 transition-all"
          >
            <div className="w-16 h-16 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary mx-auto mb-4 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-3xl">upload_file</span>
            </div>
            <h3 className="font-headline-md text-headline-md text-on-surface mb-2">Select Files</h3>
            <p className="text-on-surface-variant text-sm">Choose individual files to scan. Supports all file types.</p>
          </button>
          <button
            onClick={() => dirInputRef.current?.click()}
            className="group bg-surface-container-high rounded-2xl border-2 border-dashed border-outline-variant p-8 text-center hover:border-tertiary hover:bg-tertiary/5 transition-all"
          >
            <div className="w-16 h-16 rounded-full bg-tertiary/15 border border-tertiary/30 flex items-center justify-center text-tertiary mx-auto mb-4 group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-3xl">folder</span>
            </div>
            <h3 className="font-headline-md text-headline-md text-on-surface mb-2">Select Folder</h3>
            <p className="text-on-surface-variant text-sm">Scan an entire directory recursively for all files.</p>
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect} />
          <input ref={dirInputRef} type="file" multiple className="hidden" onChange={handleDirectorySelect} {...{ webkitdirectory: '' }} />
        </div>
      )}

      {/* Scanning Progress */}
      {viewState === 'scanning' && (
        <div className="max-w-lg mx-auto">
          <div className="bg-surface-container-high rounded-2xl border border-outline-variant p-8 text-center">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <svg className="w-full h-full animate-spin text-primary" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" fill="none" r="10" stroke="currentColor" strokeWidth="2" />
                <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary-container">shield</span>
              </div>
            </div>
            <p className="font-label-caps text-label-caps text-primary animate-pulse mb-2">SCANNING FILES...</p>
            <p className="text-on-surface-variant text-sm mb-4 truncate max-w-xs mx-auto">{progress.name}</p>
            <div className="w-full bg-surface-variant h-2 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-primary-container rounded-full transition-all" style={{ width: `${progress.percent}%` }}></div>
            </div>
            <p className="text-on-surface-variant text-xs mt-2">{progress.current} / {progress.total}</p>
          </div>
        </div>
      )}

      {/* Results */}
      {viewState === 'results' && (
        <div>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-surface-container-high p-4 rounded-xl border border-outline-variant text-center">
              <p className="font-label-caps text-label-caps text-on-surface-variant mb-1">TOTAL</p>
              <p className="font-headline-lg text-headline-lg text-on-surface">{stats.total}</p>
            </div>
            <div className="bg-surface-container-high p-4 rounded-xl border border-tertiary/30 text-center">
              <p className="font-label-caps text-label-caps text-on-surface-variant mb-1">CLEAN</p>
              <p className="font-headline-lg text-headline-lg text-tertiary">{stats.clean}</p>
            </div>
            <div className="bg-surface-container-high p-4 rounded-xl border border-error/30 text-center">
              <p className="font-label-caps text-label-caps text-on-surface-variant mb-1">THREATS</p>
              <p className="font-headline-lg text-headline-lg text-error">{stats.threats}</p>
            </div>
            <div className="bg-surface-container-high p-4 rounded-xl border border-secondary/30 text-center">
              <p className="font-label-caps text-label-caps text-on-surface-variant mb-1">CORRUPTED</p>
              <p className="font-headline-lg text-headline-lg text-secondary">{stats.corrupted}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-3 mb-4">
            {(['all', 'threat', 'clean'] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`px-4 py-1.5 rounded-full font-label-caps text-label-caps transition-all border ${
                filter === f ? 'border-primary bg-primary/10 text-primary' : 'border-outline-variant text-on-surface-variant hover:bg-surface-variant'
              }`}>
                {f.charAt(0).toUpperCase() + f.slice(1)} ({f === 'all' ? results.length : results.filter((r) => r.status === f).length})
              </button>
            ))}
            <div className="flex-1"></div>
            <button onClick={reset} className="px-4 py-2 rounded-lg bg-surface-container border border-outline-variant text-on-surface-variant text-sm hover:bg-surface-variant transition-all flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              New Scan
            </button>
          </div>

          {/* Results Table */}
          <div className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden">
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-surface-container-high border-b border-outline-variant">
                    <th className="p-3 font-label-caps text-label-caps text-on-surface-variant uppercase">File</th>
                    <th className="p-3 font-label-caps text-label-caps text-on-surface-variant uppercase">Category</th>
                    <th className="p-3 font-label-caps text-label-caps text-on-surface-variant uppercase">Size</th>
                    <th className="p-3 font-label-caps text-label-caps text-on-surface-variant uppercase text-center">Status</th>
                    <th className="p-3 font-label-caps text-label-caps text-on-surface-variant uppercase text-center">Threat</th>
                    <th className="p-3 font-label-caps text-label-caps text-on-surface-variant uppercase text-right">Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {filteredResults.length === 0 ? (
                    <tr><td colSpan={6} className="text-center text-on-surface-variant py-8">No results</td></tr>
                  ) : (
                    filteredResults.map((r) => (
                      <tr key={r.id} className="hover:bg-surface-variant/20 transition-colors">
                        <td className="p-3">
                          <div>
                            <p className="font-code-sm text-sm text-primary truncate max-w-[200px]" title={r.name}>{r.name}</p>
                            <p className="text-[10px] text-on-surface-variant truncate max-w-[200px]" title={r.path}>{r.path}</p>
                          </div>
                        </td>
                        <td className="p-3 text-xs text-on-surface-variant">{r.category}</td>
                        <td className="p-3 text-xs text-on-surface-variant">{formatBytes(r.size)}</td>
                        <td className="p-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-label-caps text-[10px] ${
                            r.status === 'clean' ? 'bg-tertiary/15 text-tertiary border border-tertiary/25' :
                            r.status === 'threat' ? 'bg-error/15 text-error border border-error/25' :
                            r.status === 'corrupted' ? 'bg-secondary/15 text-secondary border border-secondary/25' :
                            'bg-surface-variant text-on-surface-variant border border-outline-variant/50'
                          }`}>
                            {r.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-3 text-center">{threatBadge(r.threatLevel)}</td>
                        <td className="p-3 text-right font-bold text-sm text-on-surface">{r.riskScore}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useUser } from '../lib/userContext'
import { computeSHA256, analyzeFileForThreats, getFileCategory, getExtension, formatBytes } from '../lib/scanner'

type ViewState = 'idle' | 'analyzing' | 'results'

export default function ScanSubmission() {
  const navigate = useNavigate()
  const { userId } = useUser()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [viewState, setViewState] = useState<ViewState>('idle')
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [sha256, setSha256] = useState('')
  const [analysis, setAnalysis] = useState<ReturnType<typeof analyzeFileForThreats> | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [progress, setProgress] = useState('')

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) analyzeFile(dropped)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(true)
  }

  function handleDragLeave() {
    setDragOver(false)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (selected) analyzeFile(selected)
  }

  async function analyzeFile(f: File) {
    setFile(f)
    setViewState('analyzing')
    setSaved(false)
    setProgress('Computing SHA-256 hash...')

    try {
      const hash = await computeSHA256(f)
      setSha256(hash)
      setProgress('Running heuristic analysis...')

      // Small delay for UI
      await new Promise((r) => setTimeout(r, 300))
      const result = analyzeFileForThreats(f, hash)
      setAnalysis(result)
      setViewState('results')
    } catch {
      setAnalysis({
        threatLevel: 'None',
        threatName: 'Analysis Error',
        riskScore: 0,
        details: 'Failed to analyze file',
        reasons: ['Analysis failed due to an error'],
      })
      setViewState('results')
    }
  }

  async function saveToDb() {
    if (!file || !analysis || !sha256) return
    setSaving(true)

    const { error } = await supabase.from('scans').insert({
      file_name: file.name,
      package_name: file.name.replace(/\.[^.]+$/, ''),
      version: '1.0.0',
      sha256: sha256,
      status: 'Complete',
      threat_level: analysis.threatLevel,
      risk_score: analysis.riskScore,
      risk_category: analysis.threatName || '',
      malware_name: analysis.threatName,
      scan_types: ['Heuristic Analysis', 'Signature Matching', 'Extension Check', 'Hash Verification'],
      user_id: userId,
    })

    setSaving(false)
    if (!error) setSaved(true)
  }

  function reset() {
    setFile(null)
    setSha256('')
    setAnalysis(null)
    setViewState('idle')
    setSaved(false)
    setProgress('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const ext = file ? getExtension(file.name) : ''
  const category = file ? getFileCategory(ext) : ''

  const threatConfig: Record<string, { bg: string; text: string; border: string; icon: string }> = {
    Critical: { bg: 'bg-error/15', text: 'text-error', border: 'border-error/30', icon: 'report' },
    High: { bg: 'bg-error/10', text: 'text-error', border: 'border-error/20', icon: 'warning' },
    Medium: { bg: 'bg-secondary/15', text: 'text-secondary', border: 'border-secondary/30', icon: 'info' },
    Low: { bg: 'bg-tertiary/15', text: 'text-tertiary', border: 'border-tertiary/30', icon: 'check_circle' },
    None: { bg: 'bg-surface-variant', text: 'text-on-surface-variant', border: 'border-outline-variant', icon: 'verified' },
  }

  return (
    <>
      <div className="absolute -top-[20%] -left-[10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute -bottom-[20%] -right-[10%] w-[400px] h-[400px] bg-tertiary/3 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Header */}
      <div className="flex flex-col gap-1 mb-8 relative">
        <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
          File Analysis
        </h2>
        <p className="text-on-surface-variant font-body-md opacity-80">
          Drop any file for instant client-side threat analysis and threat intelligence check.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
        {/* Main Content */}
        <div className="lg:col-span-8 space-y-6">
          {/* Drop Zone / Analyzing / Results */}
          {viewState === 'idle' && (
            <div
              className={`group relative flex flex-col items-center justify-center h-72 border-2 border-dashed border-outline-variant rounded-xl bg-surface-container-lowest transition-all duration-300 hover:border-primary hover:bg-primary/5 overflow-hidden ${dragOver ? 'border-primary bg-primary/5' : ''}`}
              role="button"
              tabIndex={0}
              aria-label="Drop a file here or click to browse"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click() } }}
            >
              <div className="absolute inset-0 bg-gradient-glow opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
              <div className="flex flex-col items-center gap-4 text-center p-8 z-10">
                <div className="w-16 h-16 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary mb-2 group-hover:scale-110 group-hover:shadow-glow-primary transition-all duration-300">
                  <span className="material-symbols-outlined text-4xl">upload_file</span>
                </div>
                <div>
                  <p className="text-on-surface font-headline-md text-headline-md">
                    Drag & drop any file
                  </p>
                  <p className="text-on-surface-variant font-body-md">
                    APK, EXE, DLL, PDF, DOC, ZIP, scripts, or any file type
                  </p>
                </div>
                <p className="text-on-surface-variant/50 text-sm">or <span className="text-primary font-bold">browse files</span></p>
              </div>
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileInput} />
            </div>
          )}

          {viewState === 'analyzing' && (
            <div className="bg-surface-container-high rounded-xl p-8 border border-outline-variant">
              <div className="flex flex-col items-center gap-6">
                <div className="relative w-20 h-20">
                  <svg className="w-full h-full animate-spin text-primary" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" fill="none" r="10" stroke="currentColor" strokeWidth="2" />
                    <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary-container">shield</span>
                  </div>
                </div>
                <div className="text-center">
                  <p className="font-label-caps text-label-caps text-primary animate-pulse">{progress}</p>
                  <p className="text-on-surface-variant text-sm mt-2">{file?.name}</p>
                </div>
              </div>
            </div>
          )}

          {viewState === 'results' && file && analysis && (
            <div className="space-y-4">
              {/* Threat Level Banner */}
              <div className={`rounded-xl p-6 border ${threatConfig[analysis.threatLevel].bg} ${threatConfig[analysis.threatLevel].border}`}>
                <div className="flex items-center gap-4">
                  <span className={`material-symbols-outlined text-4xl ${threatConfig[analysis.threatLevel].text}`}>
                    {threatConfig[analysis.threatLevel].icon}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className={`font-headline-md text-headline-md ${threatConfig[analysis.threatLevel].text}`}>
                        {analysis.threatLevel === 'None' ? 'Clean' : analysis.threatLevel}
                      </h3>
                      {analysis.threatName && (
                        <span className={`px-2 py-0.5 rounded-full font-label-caps text-[10px] ${threatConfig[analysis.threatLevel].bg} ${threatConfig[analysis.threatLevel].text} border ${threatConfig[analysis.threatLevel].border}`}>
                          {analysis.threatName}
                        </span>
                      )}
                    </div>
                    <p className="text-on-surface-variant text-sm mt-1">Risk Score: {analysis.riskScore}/100</p>
                  </div>
                  <button onClick={reset} className="text-on-surface-variant hover:text-error p-2 rounded-lg hover:bg-error/10 transition-colors">
                    <span className="material-symbols-outlined">refresh</span>
                  </button>
                </div>
              </div>

              {/* File Info */}
              <div className="bg-surface-container-high rounded-xl p-5 border border-outline-variant">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="font-label-caps text-label-caps text-on-surface-variant mb-1">FILE</p>
                    <p className="text-sm text-on-surface font-medium truncate" title={file.name}>{file.name}</p>
                  </div>
                  <div>
                    <p className="font-label-caps text-label-caps text-on-surface-variant mb-1">SIZE</p>
                    <p className="text-sm text-on-surface font-medium">{formatBytes(file.size)}</p>
                  </div>
                  <div>
                    <p className="font-label-caps text-label-caps text-on-surface-variant mb-1">CATEGORY</p>
                    <p className="text-sm text-on-surface font-medium">{category}</p>
                  </div>
                  <div>
                    <p className="font-label-caps text-label-caps text-on-surface-variant mb-1">EXTENSION</p>
                    <p className="text-sm text-primary font-code-sm font-medium">{ext || 'None'}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="font-label-caps text-label-caps text-on-surface-variant mb-1">SHA-256</p>
                  <p className="text-xs text-on-surface-variant font-code-sm break-all bg-surface-container-lowest p-2 rounded border border-outline-variant/50">{sha256}</p>
                </div>
              </div>

              {/* Detection Details */}
              <div className="bg-surface-container-high rounded-xl p-5 border border-outline-variant">
                <h4 className="font-label-caps text-label-caps text-on-surface-variant mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-primary">search</span>
                  DETECTION DETAILS
                </h4>
                {analysis.reasons.length > 0 ? (
                  <div className="space-y-2">
                    {analysis.reasons.map((reason, i) => (
                      <div key={i} className="flex items-start gap-2 p-3 bg-surface-container rounded-lg border border-outline-variant/30">
                        <span className={`material-symbols-outlined text-[16px] mt-0.5 ${analysis.threatLevel === 'None' ? 'text-tertiary' : 'text-secondary'}`}>
                          {analysis.threatLevel === 'None' ? 'check_circle' : 'info'}
                        </span>
                        <p className="text-sm text-on-surface">{reason}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-on-surface-variant">No threats detected</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={saveToDb}
                  disabled={saving || saved}
                  className={`flex-1 py-3 rounded-xl font-label-caps text-label-caps transition-all flex items-center justify-center gap-2 ${
                    saved
                      ? 'bg-tertiary/15 text-tertiary border border-tertiary/30'
                      : saving
                        ? 'bg-outline-variant/30 text-on-surface-variant cursor-not-allowed'
                        : 'bg-gradient-to-r from-primary to-primary-container text-on-primary hover:shadow-glow-primary active:scale-[0.98]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">{saved ? 'check_circle' : 'save'}</span>
                  {saved ? 'Saved to History' : saving ? 'Saving...' : 'Save to History'}
                </button>
                <button
                  onClick={() => navigate('/scan-history')}
                  className="px-6 py-3 rounded-xl bg-surface-container border border-outline-variant text-on-surface-variant hover:bg-surface-variant transition-all flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[18px]">history</span>
                  View History
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Side Panel */}
        <div className="lg:col-span-4 space-y-6">
          <div className="glass-panel rounded-xl p-6">
            <h3 className="font-label-caps text-label-caps text-on-surface-variant border-b border-outline-variant pb-3 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-primary">info</span>
              SUPPORTED FORMATS
            </h3>
            <div className="space-y-3">
              {[
                { group: 'Android', exts: '.apk .dex .aab .obb', color: 'primary' },
                { group: 'Executables', exts: '.exe .dll .msi .bat .cmd .ps1 .sh', color: 'error' },
                { group: 'Archives', exts: '.zip .rar .7z .tar .gz', color: 'secondary' },
                { group: 'Documents', exts: '.pdf .doc .docx .xls .xlsx .ppt .pptx', color: 'tertiary' },
                { group: 'Scripts', exts: '.js .ts .py .rb .go .java .php', color: 'primary' },
                { group: 'Media', exts: '.mp3 .mp4 .png .jpg .gif .svg', color: 'secondary' },
                { group: 'Other', exts: 'Any file type supported', color: 'on-surface-variant' },
              ].map((item) => (
                <div key={item.group} className="flex items-start gap-3">
                  <span className={`w-2 h-2 rounded-full bg-${item.color} mt-1.5 shrink-0`}></span>
                  <div>
                    <p className="text-sm font-medium text-on-surface">{item.group}</p>
                    <p className="text-xs text-on-surface-variant font-code-sm">{item.exts}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-xl p-6">
            <h3 className="font-label-caps text-label-caps text-on-surface-variant border-b border-outline-variant pb-3 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-secondary">psychology</span>
              ANALYSIS ENGINE
            </h3>
            <div className="space-y-3 text-sm text-on-surface-variant">
              <p>10 heuristic detection methods:</p>
              <ul className="space-y-1.5 ml-1">
                <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-primary"></span>Signature matching</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-primary"></span>Extension classification</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-primary"></span>File size anomalies</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-primary"></span>Double extension detection</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-primary"></span>Suspicious naming patterns</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-primary"></span>System path detection</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-primary"></span>Hidden file detection</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-primary"></span>Hash anomaly detection</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-primary"></span>Archive analysis</li>
                <li className="flex items-center gap-2"><span className="w-1 h-1 rounded-full bg-primary"></span>Macro document detection</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

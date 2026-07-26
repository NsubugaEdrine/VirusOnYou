import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useUser } from '../lib/userContext'

type UploadState = 'idle' | 'processing' | 'ready'

export default function ScanSubmission() {
  const navigate = useNavigate()
  const { userId } = useUser()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [dragOver, setDragOver] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) processFile(dropped)
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
    if (selected) processFile(selected)
  }

  function processFile(f: File) {
    setFile(f)
    setUploadState('processing')
    timerRef.current = setTimeout(() => setUploadState('ready'), 1800)
  }

  function resetUpload() {
    setFile(null)
    setUploadState('idle')
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleStartAnalysis() {
    if (!file) return
    setSubmitting(true)

    const { error } = await supabase.from('scans').insert({
      file_name: file.name,
      package_name: file.name.replace('.apk', ''),
      version: '1.0.0',
      sha256: 'pending',
      status: 'Queued',
      threat_level: 'None',
      risk_score: 0,
      risk_category: '',
      scan_types: ['Manifest Analysis', 'Permission Analysis', 'Code Analysis', 'Network Analysis'],
      user_id: userId,
    })

    setSubmitting(false)

    if (error) {
      alert('Error submitting scan: ' + error.message)
    } else {
      navigate('/scan-history')
    }
  }

  return (
    <>
      <div className="absolute -top-[20%] -left-[10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute -bottom-[20%] -right-[10%] w-[400px] h-[400px] bg-tertiary/3 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Header */}
      <div className="flex flex-col gap-1 mb-8 relative">
        <h2 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">
          Submit New Analysis
        </h2>
        <p className="text-on-surface-variant font-body-md opacity-80">
          Upload suspicious binary samples for deep behavioral and static heuristic inspection.
        </p>
      </div>

      {/* Bento Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
        {/* Main Upload Area */}
        <div className="lg:col-span-8 space-y-6">
          {/* Drop Zone */}
          {uploadState !== 'ready' && (
            <div
              className={`group relative flex flex-col items-center justify-center h-80 border-2 border-dashed border-outline-variant rounded-xl bg-surface-container-lowest transition-all duration-300 hover:border-primary hover:bg-primary/5 overflow-hidden ${dragOver ? 'drag-over' : ''}`}
              role="button"
              tabIndex={0}
              aria-label="Upload APK file. Drop a file here or click to browse."
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click() } }}
            >
              <div className="absolute inset-0 bg-gradient-glow opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

              {uploadState === 'idle' && (
                <div className="flex flex-col items-center gap-4 text-center p-8 z-10">
                  <div className="w-16 h-16 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary mb-2 group-hover:scale-110 group-hover:shadow-glow-primary transition-all duration-300">
                    <span className="material-symbols-outlined text-4xl">upload_file</span>
                  </div>
                  <div>
                    <p className="text-on-surface font-headline-md text-headline-md">
                      Drag and drop APK file
                    </p>
                    <p className="text-on-surface-variant font-body-md">
                      or <span className="text-primary font-bold">browse files</span> from your computer
                    </p>
                  </div>
                </div>
              )}

              {uploadState === 'processing' && (
                <div className="flex flex-col items-center gap-6 p-8 z-10">
                  <div className="relative w-20 h-20">
                    <svg className="w-full h-full animate-spin text-primary" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" fill="none" r="10" stroke="currentColor" strokeWidth="2" />
                      <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary-container">data_object</span>
                    </div>
                  </div>
                  <p className="font-label-caps text-label-caps text-primary animate-pulse">
                    VALIDATING ARCHIVE INTEGRITY...
                  </p>
                  <div className="w-48 h-1 bg-surface-variant rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary to-tertiary rounded-full animate-shimmer relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                    </div>
                  </div>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".apk,.dex,.zip"
                className="hidden"
                aria-label="Select APK, DEX, or ZIP file"
                onChange={handleFileInput}
              />
            </div>
          )}

          {/* File Details (shown after upload) */}
          {uploadState === 'ready' && file && (
            <div className="glass-panel rounded-xl p-6 border-l-4 border-l-primary transition-all animate-glow-pulse">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-tertiary">check_circle</span>
                  <span className="font-headline-md text-headline-md text-on-surface">{file.name}</span>
                </div>
                <button
                  onClick={resetUpload}
                  className="text-on-surface-variant hover:text-error transition-colors p-1 rounded-lg hover:bg-error/10"
                >
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="font-label-caps text-label-caps text-on-surface-variant block mb-1">
                    FILE SIZE
                  </label>
                  <div className="bg-surface-container-lowest border border-outline-variant p-3 rounded-lg font-code-sm text-code-sm text-primary">
                    {(file.size / (1024 * 1024)).toFixed(1)} MB
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-surface-container p-3 rounded-lg border border-outline-variant/50">
                    <p className="font-label-caps text-label-caps text-on-surface-variant">FORMAT</p>
                    <p className="font-body-md text-body-md text-on-surface">
                      {file.name.endsWith('.apk') ? 'Android Package' : file.name.endsWith('.dex') ? 'Dalvik Executable' : 'Archive'}
                    </p>
                  </div>
                  <div className="bg-surface-container p-3 rounded-lg border border-outline-variant/50">
                    <p className="font-label-caps text-label-caps text-on-surface-variant">TYPE</p>
                    <p className="font-body-md text-body-md text-on-surface">
                      {file.type || 'application/octet-stream'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={handleStartAnalysis}
            disabled={uploadState !== 'ready' || submitting}
            className={`w-full py-4 rounded-xl font-headline-md text-headline-md transition-all duration-300 flex items-center justify-center gap-3 overflow-hidden relative ${
              uploadState === 'ready' && !submitting
                ? 'bg-gradient-to-r from-primary to-primary-container text-on-primary hover:shadow-glow-primary active:scale-[0.98]'
                : 'bg-outline-variant/30 text-on-surface-variant cursor-not-allowed'
            }`}
          >
            {submitting ? (
              <>
                <span className="animate-spin material-symbols-outlined relative z-10">sync</span>
                <span className="relative z-10">Initializing Sandbox...</span>
              </>
            ) : (
              <>
                <span className="relative z-10">Start Analysis</span>
                <span className="material-symbols-outlined relative z-10" style={{ fontVariationSettings: "'FILL' 1" }}>
                  play_arrow
                </span>
              </>
            )}
          </button>
        </div>

        {/* Side Panel */}
        <div className="lg:col-span-4 space-y-6">
          {/* Supported Formats */}
          <div className="glass-panel rounded-xl p-6">
            <h3 className="font-label-caps text-label-caps text-on-surface-variant border-b border-outline-variant pb-3 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-primary">info</span>
              SUPPORTED FORMATS
            </h3>
            <ul className="space-y-4">
              {[
                { ext: '.apk', label: 'Android Package' },
                { ext: '.dex', label: 'Dalvik Executable' },
                { ext: '.zip', label: 'Compressed Archive' },
              ].map((fmt) => (
                <li key={fmt.ext} className="flex items-center justify-between group/item">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center font-code-sm text-code-sm text-primary group-hover/item:shadow-glow-primary transition-shadow">
                      {fmt.ext}
                    </span>
                    <span className="text-body-md text-on-surface">{fmt.label}</span>
                  </div>
                  <span className="material-symbols-outlined text-tertiary text-[18px]">verified</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Environment Info */}
          <div className="glass-panel rounded-xl p-6">
            <h3 className="font-label-caps text-label-caps text-on-surface-variant border-b border-outline-variant pb-3 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-secondary">terminal</span>
              ENVIRONMENT
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Sandbox Host:', value: 'Isolated-A6', highlight: false },
                { label: 'OS Profile:', value: 'Android 13.0 (API 33)', highlight: false },
                { label: 'Internet Access:', value: 'Simulated / Off', highlight: true },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center text-body-md">
                  <span className="text-on-surface-variant">{item.label}</span>
                  <span className={`font-medium font-code-sm text-[13px] ${item.highlight ? 'text-secondary bg-secondary/10 px-2 py-0.5 rounded' : 'text-on-surface'}`}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Insight Visual */}
          <div className="rounded-xl overflow-hidden h-40 relative group border border-outline-variant shadow-card">
            <div className="w-full h-full bg-gradient-to-br from-primary/10 via-surface-container to-tertiary/5 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary/20 text-6xl group-hover:text-primary/30 transition-colors">neurology</span>
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-surface-container-low via-surface-container-low/50 to-transparent flex flex-col justify-end p-4">
              <p className="font-label-caps text-label-caps text-primary mb-1">GLOBAL TRENDS</p>
              <p className="text-body-md font-bold text-on-surface">Malware activity up 12% today</p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

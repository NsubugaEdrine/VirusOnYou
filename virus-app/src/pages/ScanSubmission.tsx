import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Upload, Link, Globe } from 'lucide-react'

export default function ScanSubmission() {
  const navigate = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [packageName, setPackageName] = useState('')
  const [version, setVersion] = useState('')
  const [hash, setHash] = useState('')
  const [url, setUrl] = useState('')
  const [playUrl, setPlayUrl] = useState('')
  const [scanTypes, setScanTypes] = useState({
    manifest: true,
    permission: true,
    code: true,
    network: true,
  })
  const [loading, setLoading] = useState(false)

  const scanTypeLabels: Record<string, string> = {
    manifest: 'Manifest Analysis',
    permission: 'Permission Analysis',
    code: 'Code Analysis',
    network: 'Network Analysis',
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0]
    if (selected) {
      setFile(selected)
      if (!packageName) setPackageName(selected.name.replace('.apk', ''))
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) {
      setFile(droppedFile)
      if (!packageName) setPackageName(droppedFile.name.replace('.apk', ''))
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  async function handleScan() {
    const selectedTypes = Object.entries(scanTypes)
      .filter(([, v]) => v)
      .map(([k]) => scanTypeLabels[k])

    if (selectedTypes.length === 0) {
      alert('Please select at least one scan type')
      return
    }

    setLoading(true)

    const { error } = await supabase.from('scans').insert({
      file_name: file?.name || 'manual-entry.apk',
      package_name: packageName,
      version: version,
      sha256: hash,
      status: 'Queued',
      threat_level: 'None',
      risk_score: 0,
      risk_category: '',
      scan_types: selectedTypes,
    })

    setLoading(false)

    if (error) {
      alert('Error submitting scan: ' + error.message)
    } else {
      alert('Scan submitted successfully!')
      setTimeout(() => navigate('/scan-history'), 2000)
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Scan Submission</h1>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700/50">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5 text-indigo-400" />
            APK File Upload
          </h2>
          <div
            className="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center hover:border-indigo-500 transition-colors cursor-pointer"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => document.getElementById('apk-input')?.click()}
          >
            <Upload className="w-12 h-12 text-slate-500 mx-auto mb-3" />
            {file ? (
              <p className="text-white text-sm">{file.name}</p>
            ) : (
              <p className="text-slate-400 text-sm">Drag & drop your APK file here, or click to browse</p>
            )}
            <input
              id="apk-input"
              type="file"
              accept=".apk"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
          {file && (
            <button
              onClick={handleScan}
              disabled={loading}
              className="mt-4 w-full px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Scan Now'}
            </button>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700/50">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Link className="w-5 h-5 text-indigo-400" />
              Upload from URL
            </h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://example.com/app.apk"
                className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
              <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium text-sm transition-colors">
                Fetch
              </button>
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700/50">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-400" />
              Upload from Google Play URL
            </h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={playUrl}
                onChange={e => setPlayUrl(e.target.value)}
                placeholder="https://play.google.com/store/apps/details?id=..."
                className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500"
              />
              <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium text-sm transition-colors">
                Fetch
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl p-6 border border-slate-700/50">
        <h2 className="text-lg font-semibold text-white mb-4">Scan Configuration</h2>
        <div className="grid grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-slate-300 text-sm mb-2">Package Name</label>
            <input
              type="text"
              value={packageName}
              onChange={e => setPackageName(e.target.value)}
              placeholder="com.example.app"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-slate-300 text-sm mb-2">Version</label>
            <input
              type="text"
              value={version}
              onChange={e => setVersion(e.target.value)}
              placeholder="1.0.0"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-slate-300 text-sm mb-2">SHA256 Hash</label>
            <input
              type="text"
              value={hash}
              onChange={e => setHash(e.target.value)}
              placeholder="Auto-filled after upload"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm placeholder-slate-400 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-slate-300 text-sm mb-3">Scan Types</label>
          <div className="flex gap-6">
            {Object.entries(scanTypeLabels).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scanTypes[key as keyof typeof scanTypes]}
                  onChange={e => setScanTypes({ ...scanTypes, [key]: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0"
                />
                <span className="text-slate-300 text-sm">{label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

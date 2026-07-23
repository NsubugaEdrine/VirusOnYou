import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Scan, Permission, NetworkIndicator, Component } from '../lib/types'
import { FileText, Shield, AlertTriangle, Wifi, Puzzle } from 'lucide-react'

export default function ScanResult() {
  const [searchParams] = useSearchParams()
  const scanId = searchParams.get('id')

  const [scan, setScan] = useState<Scan | null>(null)
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [networkIndicators, setNetworkIndicators] = useState<NetworkIndicator[]>([])
  const [components, setComponents] = useState<Component[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (scanId) fetchResult()
  }, [scanId])

  async function fetchResult() {
    setLoading(true)

    const { data: scanData } = await supabase.from('scans').select('*').eq('id', scanId).single()
    if (scanData) setScan(scanData)

    const { data: perms } = await supabase.from('permissions').select('*').eq('scan_id', scanId)
    if (perms) setPermissions(perms)

    const { data: network } = await supabase.from('network_indicators').select('*').eq('scan_id', scanId)
    if (network) setNetworkIndicators(network)

    const { data: comps } = await supabase.from('components').select('*').eq('scan_id', scanId)
    if (comps) setComponents(comps)

    setLoading(false)
  }

  function getScoreColor(score: number): string {
    if (score >= 75) return '#ef4444'
    if (score >= 50) return '#f97316'
    if (score >= 25) return '#eab308'
    return '#22c55e'
  }

  function getScoreLabel(score: number): string {
    if (score >= 75) return 'Critical'
    if (score >= 50) return 'High'
    if (score >= 25) return 'Medium'
    return 'Low'
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

  if (!scan) {
    return <div className="min-h-screen bg-slate-900 text-slate-400 flex items-center justify-center">No data found</div>
  }

  const circumference = 2 * Math.PI * 45
  const offset = circumference - (scan.risk_score / 100) * circumference
  const scoreColor = getScoreColor(scan.risk_score)

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Scan Result Report</h1>

      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700/50">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            App Info
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wide">Package Name</p>
              <p className="text-white text-sm">{scan.package_name}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wide">Version</p>
              <p className="text-white text-sm">{scan.version}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wide">SHA256</p>
              <p className="text-white text-sm font-mono break-all">{scan.sha256}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700/50 flex flex-col items-center justify-center">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-400" />
            Risk Score
          </h2>
          <div className="relative w-32 h-32">
            <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#334155" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="45"
                fill="none"
                stroke={scoreColor}
                strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-white">{scan.risk_score}</span>
              <span className="text-xs text-slate-400">/ 100</span>
            </div>
          </div>
          <span className={`mt-3 inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${threatBadgeColors[getScoreLabel(scan.risk_score)]}`}>
            {getScoreLabel(scan.risk_score)}
          </span>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700/50">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            Malware Detected
          </h2>
          <div className="space-y-3">
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wide">Malware Name</p>
              <p className="text-white text-sm">{scan.malware_name || 'None'}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wide">Risk Category</p>
              <p className="text-white text-sm">{scan.risk_category || 'N/A'}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs uppercase tracking-wide">Threat Level</p>
              <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${threatBadgeColors[scan.threat_level]}`}>
                {scan.threat_level}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700/50">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-400" />
            Permissions Analysis
          </h2>
          <table className="w-full">
            <thead>
              <tr className="bg-slate-700/50">
                <th className="text-left text-slate-300 text-sm font-medium px-4 py-3 rounded-l-lg">Permission</th>
                <th className="text-left text-slate-300 text-sm font-medium px-4 py-3">Risk Level</th>
                <th className="text-left text-slate-300 text-sm font-medium px-4 py-3 rounded-r-lg">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {permissions.length === 0 ? (
                <tr><td colSpan={3} className="text-center text-slate-400 py-6">No data found</td></tr>
              ) : (
                permissions.map(perm => (
                  <tr key={perm.id}>
                    <td className="px-4 py-3 text-white text-sm">{perm.name}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${threatBadgeColors[perm.risk_level]}`}>
                        {perm.risk_level}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-sm">{perm.description}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700/50">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Wifi className="w-5 h-5 text-indigo-400" />
              Network Analysis
            </h2>
            <table className="w-full">
              <thead>
                <tr className="bg-slate-700/50">
                  <th className="text-left text-slate-300 text-sm font-medium px-4 py-3 rounded-l-lg">Domain</th>
                  <th className="text-left text-slate-300 text-sm font-medium px-4 py-3">IP Address</th>
                  <th className="text-left text-slate-300 text-sm font-medium px-4 py-3 rounded-r-lg">Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {networkIndicators.length === 0 ? (
                  <tr><td colSpan={3} className="text-center text-slate-400 py-6">No data found</td></tr>
                ) : (
                  networkIndicators.map(ni => (
                    <tr key={ni.id}>
                      <td className="px-4 py-3 text-white text-sm">{ni.domain}</td>
                      <td className="px-4 py-3 text-slate-300 text-sm font-mono">{ni.ip_address}</td>
                      <td className="px-4 py-3 text-slate-300 text-sm">{ni.indicator_type}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700/50">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Puzzle className="w-5 h-5 text-indigo-400" />
              Components Analysis
            </h2>
            <table className="w-full">
              <thead>
                <tr className="bg-slate-700/50">
                  <th className="text-left text-slate-300 text-sm font-medium px-4 py-3 rounded-l-lg">Type</th>
                  <th className="text-left text-slate-300 text-sm font-medium px-4 py-3">Name</th>
                  <th className="text-left text-slate-300 text-sm font-medium px-4 py-3 rounded-r-lg">Risk Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {components.length === 0 ? (
                  <tr><td colSpan={3} className="text-center text-slate-400 py-6">No data found</td></tr>
                ) : (
                  components.map(comp => (
                    <tr key={comp.id}>
                      <td className="px-4 py-3 text-white text-sm">{comp.component_type}</td>
                      <td className="px-4 py-3 text-slate-300 text-sm">{comp.name}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${threatBadgeColors[comp.risk_level]}`}>
                          {comp.risk_level}
                        </span>
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

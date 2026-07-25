import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Scan, Permission, NetworkIndicator, Component } from '../lib/types'

export default function ScanResult() {
  const [searchParams] = useSearchParams()
  const scanId = searchParams.get('id')
  const [scan, setScan] = useState<Scan | null>(null)
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [networkIndicators, setNetworkIndicators] = useState<NetworkIndicator[]>([])
  const [components, setComponents] = useState<Component[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedFindings, setExpandedFindings] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (scanId) fetchResult()
    else {
      setLoading(false)
      setError('No scan ID provided')
    }
  }, [scanId])

  async function fetchResult() {
    setLoading(true)
    setError(null)
    try {
      const [scanRes, permsRes, networkRes, compsRes] = await Promise.all([
        supabase.from('scans').select('*').eq('id', scanId).single(),
        supabase.from('permissions').select('*').eq('scan_id', scanId),
        supabase.from('network_indicators').select('*').eq('scan_id', scanId),
        supabase.from('components').select('*').eq('scan_id', scanId),
      ])

      if (scanRes.error) {
        setError('Scan not found')
        setLoading(false)
        return
      }
      if (scanRes.data) setScan(scanRes.data)
      if (permsRes.data) setPermissions(permsRes.data)
      if (networkRes.data) setNetworkIndicators(networkRes.data)
      if (compsRes.data) setComponents(compsRes.data)
    } catch {
      setError('Failed to load scan results')
    }
    setLoading(false)
  }

  function toggleFinding(id: string) {
    setExpandedFindings((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function getScoreColor(score: number): string {
    if (score >= 75) return 'text-error'
    if (score >= 50) return 'text-error'
    if (score >= 25) return 'text-on-surface'
    return 'text-tertiary'
  }

  function getScoreLabel(score: number): string {
    if (score >= 75) return 'CRITICAL THREAT'
    if (score >= 50) return 'HIGH RISK'
    if (score >= 25) return 'MEDIUM RISK'
    return 'LOW RISK'
  }

  function getRiskBg(score: number): string {
    if (score >= 50) return 'bg-error/15 text-error border border-error/20'
    return 'bg-tertiary/15 text-tertiary border border-tertiary/20'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-on-surface-variant text-body-md">
          <span className="material-symbols-outlined animate-spin">sync</span>
          Loading scan results...
        </div>
      </div>
    )
  }

  if (error || !scan) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <span className="material-symbols-outlined text-5xl text-on-surface-variant">search_off</span>
        <p className="text-on-surface-variant text-body-md">{error || 'No data found'}</p>
        <Link to="/scan-history" className="px-4 py-2 bg-primary text-on-primary rounded-lg font-label-caps text-label-caps hover:opacity-90 transition-opacity">
          Back to Scan History
        </Link>
      </div>
    )
  }

  const dangerousPerms = permissions.filter((p) => p.risk_level === 'Critical' || p.risk_level === 'High')
  const normalPerms = permissions.filter((p) => p.risk_level === 'Low' || p.risk_level === 'Medium')

  return (
    <>
      <div className="absolute -top-[15%] -right-[10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 mb-6 text-on-surface-variant relative">
        <span className="font-label-caps text-label-caps">Scans</span>
        <span className="material-symbols-outlined text-xs">chevron_right</span>
        <span className="font-label-caps text-label-caps text-primary">App Report: {scan.file_name}</span>
      </div>

      <div className="grid grid-cols-12 gap-6 relative">
        {/* Hero Header Card */}
        <section className="col-span-12 lg:col-span-8 etched-border rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-error/5 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-outline-variant to-error/50"></div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-2xl bg-surface-container-highest border border-outline-variant flex items-center justify-center p-4 shadow-card">
                <span className="material-symbols-outlined text-4xl text-primary">android</span>
              </div>
              <div>
                <h2 className="font-headline-lg text-headline-lg text-on-surface mb-1">{scan.package_name}</h2>
                <p className="font-code-sm text-code-sm text-on-surface-variant bg-surface-container-lowest px-2 py-1 rounded inline-block border border-outline-variant/30">
                  {scan.file_name}
                </p>
                <div className="flex items-center gap-3 mt-3">
                  <span className={`px-2 py-0.5 rounded font-label-caps text-label-caps ${getRiskBg(scan.risk_score)}`}>
                    {getScoreLabel(scan.risk_score)}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-outline-variant/15 text-on-surface-variant font-label-caps text-label-caps border border-outline-variant/30">
                    APK FILE
                  </span>
                </div>
              </div>
            </div>
            <div className={`flex flex-col items-center justify-center border rounded-2xl p-6 w-full md:w-40 h-40 relative overflow-hidden ${
              scan.risk_score >= 50
                ? 'bg-error/10 border-error/30 shadow-glow-error'
                : 'bg-tertiary/10 border-tertiary/30 shadow-glow-tertiary'
            }`}>
              <div className="absolute inset-0 risk-gradient-red pointer-events-none"></div>
              <span className="font-label-caps text-label-caps text-on-surface-variant mb-1 relative z-10">RISK SCORE</span>
              <span className={`text-5xl font-extrabold relative z-10 ${getScoreColor(scan.risk_score)}`}>{scan.risk_score}</span>
              <span className="text-sm font-bold text-on-surface-variant relative z-10">/ 100</span>
            </div>
          </div>
        </section>

        {/* Confidence & Actions */}
        <section className="col-span-12 lg:col-span-4 space-y-6">
          <div className="etched-border rounded-xl p-6 flex flex-col justify-between h-full">
            <div>
              <h3 className="font-label-caps text-label-caps text-on-surface-variant mb-4">ANALYSIS CONFIDENCE</h3>
              <div className="flex items-end gap-2 mb-2">
                <span className="text-4xl font-bold text-primary">98.4%</span>
                <span className="text-tertiary text-xs pb-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  High Certainty
                </span>
              </div>
              <div className="w-full h-2 bg-surface-variant rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-tertiary w-[98.4%] rounded-full"></div>
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-3">
              <button className="w-full py-3 rounded-lg bg-gradient-to-r from-primary to-primary-container text-on-primary font-bold hover:shadow-glow-primary transition-all flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-sm">download</span>
                Download Full Report
              </button>
              <button className="w-full py-3 rounded-lg border border-outline-variant text-on-surface font-bold hover:bg-surface-variant hover:border-primary/30 transition-all flex items-center justify-center gap-2">
                <span className="material-symbols-outlined text-sm">share</span>
                Quarantine File
              </button>
            </div>
          </div>
        </section>

        {/* Package Metadata */}
        <section className="col-span-12 lg:col-span-4 etched-border rounded-xl p-6 relative">
          <div className="absolute -top-4 -right-4 w-16 h-16 bg-primary/5 rounded-full blur-xl pointer-events-none"></div>
          <h3 className="font-label-caps text-label-caps text-primary mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">info</span>
            PACKAGE METADATA
          </h3>
          <div className="space-y-4 font-code-sm text-code-sm">
            {[
              { label: 'Package Name', value: scan.package_name },
              { label: 'Version', value: scan.version },
              { label: 'SHA-256', value: scan.sha256 },
            ].map((item) => (
              <div key={item.label} className="border-b border-outline-variant/30 pb-3">
                <p className="text-on-surface-variant mb-1">{item.label}</p>
                <p className="text-on-surface break-all">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Permissions */}
        <section className="col-span-12 lg:col-span-8 etched-border rounded-xl p-6">
          <h3 className="font-label-caps text-label-caps text-primary mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">lock_open</span>
            REQUESTED PERMISSIONS
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Dangerous */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-error px-3 py-1.5 bg-error/10 rounded-lg w-fit border border-error/20">
                <span className="material-symbols-outlined text-sm">warning</span>
                <span className="font-label-caps text-label-caps uppercase">Dangerous</span>
              </div>
              <ul className="space-y-2">
                {dangerousPerms.length === 0 ? (
                  <li className="text-on-surface-variant text-sm p-3 bg-surface-container rounded-lg border border-outline-variant/30">No dangerous permissions</li>
                ) : (
                  dangerousPerms.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 p-3 bg-surface-container rounded-lg border border-error/15 hover:border-error/30 transition-colors">
                      <span className="material-symbols-outlined text-error">gpp_maybe</span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-on-surface">{p.name}</p>
                        <p className="text-xs text-on-surface-variant">{p.description}</p>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
            {/* Normal */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-tertiary px-3 py-1.5 bg-tertiary/10 rounded-lg w-fit border border-tertiary/20">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                <span className="font-label-caps text-label-caps uppercase">Normal</span>
              </div>
              <ul className="space-y-2">
                {normalPerms.length === 0 ? (
                  <li className="text-on-surface-variant text-sm p-3 bg-surface-container rounded-lg border border-outline-variant/30">No normal permissions</li>
                ) : (
                  normalPerms.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 p-3 bg-surface-container rounded-lg border border-tertiary/15 hover:border-tertiary/30 transition-colors">
                      <span className="material-symbols-outlined text-tertiary">verified_user</span>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-on-surface">{p.name}</p>
                        <p className="text-xs text-on-surface-variant">{p.description}</p>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </section>

        {/* Behavioral Findings */}
        <section className="col-span-12 etched-border rounded-xl p-6">
          <h3 className="font-label-caps text-label-caps text-primary mb-6 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">query_stats</span>
            BEHAVIORAL FINDINGS & EVIDENCE
          </h3>
          <div className="space-y-4">
            {components.map((comp) => (
              <div key={`comp-${comp.id}`} className="border border-outline-variant/50 rounded-xl overflow-hidden bg-surface-container-low hover:border-outline-variant transition-colors">
                <button
                  onClick={() => toggleFinding(`comp-${comp.id}`)}
                  aria-expanded={!!expandedFindings[`comp-${comp.id}`]}
                  className="w-full flex items-center justify-between p-5 hover:bg-surface-variant/20 transition-colors text-left"
                >
                  <div className="flex items-center gap-4">
                    <span className={`w-12 h-12 flex items-center justify-center rounded-lg ${
                      comp.risk_level === 'Critical' || comp.risk_level === 'High'
                        ? 'bg-error/10 text-error border border-error/20'
                        : 'bg-secondary/10 text-secondary border border-secondary/20'
                    }`}>
                      <span className="material-symbols-outlined">
                        {comp.component_type === 'Service' ? 'dns' : comp.component_type === 'Receiver' ? 'sms_failed' : comp.component_type === 'Provider' ? 'storage' : 'web'}
                      </span>
                    </span>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="font-semibold text-on-surface">{comp.component_type}: {comp.name}</h4>
                        <span className={`px-2 py-0.5 rounded font-label-caps text-[9px] ${
                          comp.risk_level === 'Critical' || comp.risk_level === 'High'
                            ? 'bg-error text-on-error'
                            : 'bg-secondary-container text-on-secondary-container'
                        }`}>
                          {comp.risk_level.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-on-surface-variant">{comp.component_type} component</p>
                    </div>
                  </div>
                  <span className={`material-symbols-outlined transition-transform duration-300 text-on-surface-variant ${expandedFindings[`comp-${comp.id}`] ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </button>
                {expandedFindings[`comp-${comp.id}`] && (
                  <div className="border-t border-outline-variant/30 bg-surface-container-lowest p-5">
                    <p className="font-label-caps text-label-caps text-primary mb-3">COMPONENT DETAILS</p>
                    <pre className="font-code-sm text-code-sm p-4 bg-surface-dim rounded-lg border border-outline-variant/30 overflow-x-auto">
                      {`Component: ${comp.name}\nType: ${comp.component_type}\nRisk Level: ${comp.risk_level}`}
                    </pre>
                  </div>
                )}
              </div>
            ))}

            {networkIndicators.map((ni) => (
              <div key={`net-${ni.id}`} className="border border-outline-variant/50 rounded-xl overflow-hidden bg-surface-container-low hover:border-outline-variant transition-colors">
                <button
                  onClick={() => toggleFinding(`net-${ni.id}`)}
                  aria-expanded={!!expandedFindings[`net-${ni.id}`]}
                  className="w-full flex items-center justify-between p-5 hover:bg-surface-variant/20 transition-colors text-left"
                >
                  <div className="flex items-center gap-4">
                    <span className="w-12 h-12 flex items-center justify-center rounded-lg bg-secondary/10 text-secondary border border-secondary/20">
                      <span className="material-symbols-outlined">language</span>
                    </span>
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="font-semibold text-on-surface">{ni.indicator_type}: {ni.domain}</h4>
                        <span className="px-2 py-0.5 rounded bg-secondary/15 text-secondary border border-secondary/20 font-label-caps text-[9px]">
                          NETWORK
                        </span>
                      </div>
                      <p className="text-sm text-on-surface-variant">IP: {ni.ip_address}</p>
                    </div>
                  </div>
                  <span className={`material-symbols-outlined transition-transform duration-300 text-on-surface-variant ${expandedFindings[`net-${ni.id}`] ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </button>
                {expandedFindings[`net-${ni.id}`] && (
                  <div className="border-t border-outline-variant/30 bg-surface-container-lowest p-5">
                    <p className="font-label-caps text-label-caps text-primary mb-3">NETWORK EVIDENCE</p>
                    <pre className="font-code-sm text-code-sm p-4 bg-surface-dim rounded-lg border border-outline-variant/30 overflow-x-auto">
                      {`Domain: ${ni.domain}\nIP Address: ${ni.ip_address}\nType: ${ni.indicator_type}`}
                    </pre>
                  </div>
                )}
              </div>
            ))}

            {components.length === 0 && networkIndicators.length === 0 && (
              <p className="text-on-surface-variant text-center py-8 text-body-md">No behavioral findings available</p>
            )}
          </div>
        </section>
      </div>
    </>
  )
}

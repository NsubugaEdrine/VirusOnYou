import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Device } from '../lib/types'

export default function DeviceOverview() {
  const navigate = useNavigate()
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    fetchDevices()
  }, [])

  async function fetchDevices() {
    setLoading(true)
    try {
      const { data } = await supabase.from('devices').select('*').order('name')
      if (data) setDevices(data)
    } catch {
      // UI stays with empty devices
    }
    setLoading(false)
  }

  const filtered = devices.filter(
    (d) =>
      d.name.toLowerCase().includes(filter.toLowerCase()) ||
      d.os_version.toLowerCase().includes(filter.toLowerCase())
  )

  const critical = devices.filter((d) => d.risk_level === 'Critical').length
  const high = devices.filter((d) => d.risk_level === 'High').length
  const medium = devices.filter((d) => d.risk_level === 'Medium').length
  const low = devices.filter((d) => d.risk_level === 'Low').length
  const total = devices.length || 1

  function riskBadge(level: Device['risk_level']) {
    const map: Record<string, string> = {
      Critical: 'bg-error/15 text-error border border-error/25',
      High: 'bg-secondary/15 text-secondary border border-secondary/25',
      Medium: 'bg-secondary/15 text-secondary border border-secondary/25',
      Low: 'bg-tertiary/15 text-tertiary border border-tertiary/25',
    }
    const label: Record<string, string> = {
      Critical: 'CRITICAL',
      High: 'WARNING',
      Medium: 'WARNING',
      Low: 'CLEAN',
    }
    return (
      <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${map[level] || map.Low}`}>
        {label[level] || level.toUpperCase()}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-on-surface-variant text-body-md">
          <span className="material-symbols-outlined animate-spin">sync</span>
          Loading devices...
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="absolute -top-[20%] -right-[10%] w-[500px] h-[500px] bg-secondary/4 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Top Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6 relative">
        {/* Security Posture */}
        <div className="lg:col-span-4 glass-panel p-6 rounded-xl flex flex-col justify-between overflow-hidden relative">
          <div className="absolute -top-8 -right-8 w-24 h-24 bg-secondary/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="relative z-10">
            <p className="font-label-caps text-label-caps text-on-surface-variant mb-2">Fleet Security Posture</p>
            <div className="flex items-baseline gap-2">
              <h2 className="font-headline-lg text-headline-lg text-secondary">Warning</h2>
              <span className="text-secondary/60 text-sm">Action required</span>
            </div>
          </div>
          <div className="mt-8 relative z-10">
            <div className="flex justify-between items-end mb-2">
              <span className="text-4xl font-bold">68<span className="text-lg font-medium opacity-50">/100</span></span>
              <span className="text-error text-xs flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">trending_down</span> -4.2%
              </span>
            </div>
            <div className="w-full bg-surface-variant h-1.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-secondary to-secondary-container h-full rounded-full" style={{ width: '68%' }}></div>
            </div>
          </div>
        </div>

        {/* Risk Distribution Chart */}
        <div className="lg:col-span-8 glass-panel p-6 rounded-xl relative">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-headline-md text-headline-md">Risk Distribution</h3>
            <span className="px-3 py-1 bg-surface-variant rounded-full text-[10px] font-bold text-on-surface-variant border border-outline-variant/50">7 DAYS</span>
          </div>
          <div className="h-40 w-full flex items-end justify-between gap-2 px-2" role="img" aria-label="Weekly risk distribution chart">
            {[
              { day: 'MON', h: '40%', c: 'bg-primary/20 hover:bg-primary/40' },
              { day: 'TUE', h: '65%', c: 'bg-primary/20 hover:bg-primary/40' },
              { day: 'WED', h: '85%', c: 'bg-secondary/40 hover:bg-secondary/60' },
              { day: 'THU', h: '50%', c: 'bg-primary/20 hover:bg-primary/40' },
              { day: 'FRI', h: '95%', c: 'bg-gradient-to-t from-error to-error/60 hover:from-error hover:to-error/80' },
              { day: 'SAT', h: '30%', c: 'bg-primary/20 hover:bg-primary/40' },
              { day: 'SUN', h: '25%', c: 'bg-primary/20 hover:bg-primary/40' },
            ].map((bar) => (
              <div key={bar.day} className="flex-1 flex flex-col items-center gap-2 group">
                <div className={`w-full rounded-t-sm transition-all ${bar.c}`} style={{ height: bar.h }}></div>
                <span className="text-[9px] text-on-surface-variant">{bar.day}</span>
              </div>
            ))}
          </div>
          <div className="absolute top-6 right-6 flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-primary"></div>
              <span className="text-[10px] text-on-surface-variant">Low</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-secondary"></div>
              <span className="text-[10px] text-on-surface-variant">Medium</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-error"></div>
              <span className="text-[10px] text-on-surface-variant">Critical</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bento Table + Side */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
        {/* Device Table */}
        <div className="lg:col-span-8 glass-panel rounded-xl flex flex-col overflow-hidden shadow-card">
          <div className="p-6 border-b border-outline-variant flex justify-between items-center bg-surface-container">
            <h3 className="font-headline-md text-headline-md">Device Inventory</h3>
            <div className="flex items-center gap-2 bg-surface-container-lowest px-3 py-1.5 rounded-lg border border-outline-variant glow-active">
              <span className="material-symbols-outlined text-sm text-on-surface-variant">search</span>
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter devices..."
                aria-label="Filter devices"
                className="bg-transparent border-none focus:ring-0 text-body-md w-32 md:w-48 placeholder:text-outline-variant"
              />
            </div>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left" aria-label="Device inventory">
              <thead className="bg-surface-container-high">
                <tr>
                  <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant">Device ID</th>
                  <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant">Model</th>
                  <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant">OS Version</th>
                  <th className="px-6 py-4 font-label-caps text-label-caps text-on-surface-variant">Risk Level</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/50">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-on-surface-variant py-8 text-body-md">No devices found</td>
                  </tr>
                ) : (
                  filtered.map((device, i) => (
                    <tr key={device.id} className="hover:bg-surface-variant/20 transition-colors group cursor-pointer" onClick={() => navigate(`/scan-history`)}>
                      <td className="px-6 py-4 font-code-sm text-code-sm text-primary">
                        {device.id}
                      </td>
                      <td className="px-6 py-4 font-body-md text-body-md">{device.name}</td>
                      <td className="px-6 py-4 font-body-md text-body-md">{device.os_version}</td>
                      <td className="px-6 py-4">{riskBadge(device.risk_level)}</td>
                      <td className="px-6 py-4 text-right">
                        <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">chevron_right</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-outline-variant flex justify-between items-center bg-surface-container/50 mt-auto">
            <p className="font-label-caps text-label-caps text-on-surface-variant">
              Displaying {filtered.length} of {devices.length} devices
            </p>
            <div className="flex gap-2">
              <button className="p-1 hover:text-primary transition-colors text-on-surface-variant" disabled aria-label="Previous page">
                <span className="material-symbols-outlined">arrow_back_ios</span>
              </button>
              <button className="p-1 hover:text-primary transition-colors text-on-surface-variant" aria-label="Next page">
                <span className="material-symbols-outlined">arrow_forward_ios</span>
              </button>
            </div>
          </div>
        </div>

        {/* Side Details */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* App Risk Breakdown */}
          <div className="glass-panel p-6 rounded-xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <h4 className="font-label-caps text-label-caps text-on-surface-variant">Fleet Risk Breakdown</h4>
            </div>
            <div className="flex items-center gap-6">
              <div className="relative w-24 h-24">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36" role="img" aria-label={`Critical risk: ${Math.round((critical / total) * 100)}%`}>
                  <circle className="stroke-surface-variant" cx="18" cy="18" fill="none" r="16" strokeDasharray="100, 100" strokeWidth="4" />
                  <circle className="stroke-error" cx="18" cy="18" fill="none" r="16" strokeDasharray={`${(critical / total) * 100}, 100`} strokeDashoffset="0" strokeWidth="4" style={{ filter: 'drop-shadow(0 0 6px rgba(255, 123, 138, 0.4))' }} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold">{Math.round((critical / total) * 100)}%</span>
                  <span className="text-[8px] uppercase opacity-60">Risk</span>
                </div>
              </div>
              <div className="flex-1 space-y-3">
                {[
                  { label: 'Low Risk', count: low, color: 'bg-tertiary' },
                  { label: 'Critical', count: critical, color: 'bg-error' },
                  { label: 'Warning', count: high + medium, color: 'bg-secondary' },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${item.color}`}></div>
                      <span className="text-body-md font-body-md">{item.label}</span>
                    </div>
                    <span className="text-body-md font-bold">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="glass-panel p-6 rounded-xl flex-1">
            <h4 className="font-label-caps text-label-caps text-on-surface-variant mb-6">Security Events Timeline</h4>
            <div className="relative space-y-6 before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-px before:bg-outline-variant/50">
              {[
                { icon: 'warning', color: 'bg-error/20 border border-error/30', textColor: 'text-error', title: 'Malware Blocked', time: '09:42 AM', desc: "Potentially unwanted application intercepted on download." },
                { icon: 'search', color: 'bg-primary/15 border border-primary/25', textColor: 'text-primary', title: 'Scheduled Scan', time: '04:00 AM', desc: 'Full system integrity check completed. No new vulnerabilities.' },
                { icon: 'sync', color: 'bg-secondary/15 border border-secondary/25', textColor: 'text-secondary', title: 'Policy Updated', time: 'Yesterday', desc: 'Enterprise security profile v2.4 applied to 42 devices.' },
                { icon: 'check_circle', color: 'bg-tertiary/15 border border-tertiary/25', textColor: 'text-tertiary', title: 'New Device Enrolled', time: 'Oct 24', desc: 'Device verified and added to fleet monitoring.' },
              ].map((item, i) => (
                <div key={i} className="relative pl-10">
                  <div className={`absolute left-0 top-1 w-7 h-7 rounded-full ${item.color} flex items-center justify-center`}>
                    <span className={`material-symbols-outlined text-[14px] ${item.textColor}`}>{item.icon}</span>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex justify-between items-start">
                      <span className="text-body-md font-bold text-on-surface">{item.title}</span>
                      <span className="text-[10px] text-on-surface-variant">{item.time}</span>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-1">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

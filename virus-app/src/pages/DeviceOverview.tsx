import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Device } from '../lib/types'
import { Shield, AlertTriangle, Eye } from 'lucide-react'

export default function DeviceOverview() {
  const [devices, setDevices] = useState<Device[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDevices()
  }, [])

  async function fetchDevices() {
    setLoading(true)
    const { data } = await supabase.from('devices').select('*').order('name')
    if (data) setDevices(data)
    setLoading(false)
  }

  const riskBadgeColors: Record<string, string> = {
    Critical: 'bg-red-500/20 text-red-400',
    High: 'bg-orange-500/20 text-orange-400',
    Medium: 'bg-yellow-500/20 text-yellow-400',
    Low: 'bg-green-500/20 text-green-400',
  }

  if (loading) {
    return <div className="min-h-screen bg-slate-900 text-slate-400 flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Device Risk Overview</h1>

      <div className="bg-slate-800 rounded-xl border border-slate-700/50 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-700/50">
              <th className="text-left text-slate-300 text-sm font-medium px-6 py-3">Device Name</th>
              <th className="text-left text-slate-300 text-sm font-medium px-6 py-3">OS Version</th>
              <th className="text-left text-slate-300 text-sm font-medium px-6 py-3">Risk Level</th>
              <th className="text-left text-slate-300 text-sm font-medium px-6 py-3">Last Scan</th>
              <th className="text-left text-slate-300 text-sm font-medium px-6 py-3">Status</th>
              <th className="text-left text-slate-300 text-sm font-medium px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {devices.length === 0 ? (
              <tr><td colSpan={6} className="text-center text-slate-400 py-8">No data found</td></tr>
            ) : (
              devices.map(device => (
                <tr key={device.id} className="hover:bg-slate-700/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Shield className="w-5 h-5 text-indigo-400" />
                      <span className="text-white text-sm font-medium">{device.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-300 text-sm">{device.os_version}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${riskBadgeColors[device.risk_level] || ''}`}>
                      {device.risk_level}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-400 text-sm">{new Date(device.last_scan).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${device.status === 'Active' ? 'bg-green-400' : 'bg-slate-500'}`} />
                      <span className={`text-sm ${device.status === 'Active' ? 'text-green-400' : 'text-slate-400'}`}>
                        {device.status}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button className="px-3 py-1.5 border border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-lg text-xs font-medium transition-colors flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Quarantine
                      </button>
                      <button className="px-3 py-1.5 border border-blue-500/50 text-blue-400 hover:bg-blue-500/10 rounded-lg text-xs font-medium transition-colors">
                        Update
                      </button>
                      <button className="px-3 py-1.5 border border-green-500/50 text-green-400 hover:bg-green-500/10 rounded-lg text-xs font-medium transition-colors flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        Monitor
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

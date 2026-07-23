import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  Upload,
  Smartphone,
  History,
  Search,
  Shield,
} from 'lucide-react'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/scan-submission', label: 'Scan Submission', icon: Upload },
  { to: '/device-overview', label: 'Device Overview', icon: Smartphone },
  { to: '/scan-history', label: 'Scan History', icon: History },
  { to: '/threat-intel', label: 'Threat Intel', icon: Search },
]

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-60 bg-slate-900 text-slate-300 flex flex-col shrink-0">
        <div className="flex items-center gap-2 px-5 py-5 border-b border-slate-700/50">
          <Shield className="w-7 h-7 text-indigo-400" />
          <span className="text-lg font-bold text-white tracking-tight">
            VirusOnYou
          </span>
        </div>
        <nav className="flex-1 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-400 border-r-2 border-indigo-400'
                    : 'hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <item.icon className="w-4.5 h-4.5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-slate-700/50 text-xs text-slate-500">
          VirusOnYou v0.1.0
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/dashboard', label: 'DASHBOARD', icon: 'dashboard' },
  { to: '/scan-submission', label: 'NEW SCAN', icon: 'upload_file' },
  { to: '/scan-history', label: 'SCANS', icon: 'security' },
  { to: '/device-overview', label: 'DEVICES', icon: 'devices' },
  { to: '/threat-intel', label: 'THREAT INTEL', icon: 'shield' },
]

export default function NavigationDrawer() {
  return (
    <aside className="hidden md:flex flex-col h-full z-40 pt-16 fixed left-0 top-0 w-[240px] bg-surface-container border-r border-outline-variant">
      <nav className="flex-1 py-6">
        <div className="space-y-1 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 transition-all ${
                  isActive
                    ? 'text-primary bg-primary-container/10 border-r-2 border-primary scale-[0.98]'
                    : 'text-on-surface-variant hover:bg-surface-variant rounded-lg'
                }`
              }
            >
              <span className="material-symbols-outlined">
                {item.icon}
              </span>
              <span className="font-label-caps text-label-caps">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="p-6 mt-auto border-t border-outline-variant">
        <span className="flex items-center gap-3 px-4 py-3 text-on-surface-variant rounded-lg opacity-50 cursor-not-allowed">
          <span className="material-symbols-outlined">settings</span>
          <span className="font-label-caps text-label-caps">SETTINGS</span>
        </span>
      </div>
    </aside>
  )
}

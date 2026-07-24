import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/dashboard', label: 'HOME', icon: 'dashboard' },
  { to: '/scan-submission', label: 'NEW SCAN', icon: 'upload_file' },
  { to: '/scan-history', label: 'SCANS', icon: 'security' },
  { to: '/device-overview', label: 'DEVICES', icon: 'devices' },
  { to: '/threat-intel', label: 'INTEL', icon: 'shield' },
]

export default function BottomNavBar() {
  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex md:hidden justify-around items-center px-4 py-2 pb-safe bg-surface-container-high border-t border-outline-variant shadow-lg rounded-t-xl" aria-label="Mobile navigation">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center p-2 transition-all ${
              isActive
                ? 'text-primary bg-primary-container/20 rounded-xl scale-90'
                : 'text-on-surface-variant hover:text-primary'
            }`
          }
        >
          <span className="material-symbols-outlined">{item.icon}</span>
          <span className="font-label-caps text-[9px] mt-1">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

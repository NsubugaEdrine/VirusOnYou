import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/dashboard', label: 'HOME', icon: 'dashboard' },
  { to: '/scan-submission', label: 'NEW', icon: 'upload_file' },
  { to: '/file-scanner', label: 'FILES', icon: 'folder_open' },
  { to: '/device-scan', label: 'SCAN DEV', icon: 'usb' },
  { to: '/scan-history', label: 'SCANS', icon: 'security' },
  { to: '/settings', label: 'CONFIG', icon: 'settings' },
]

export default function BottomNavBar() {
  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex md:hidden justify-around items-center px-2 py-2 pb-safe bg-surface-container-high border-t border-outline-variant shadow-lg rounded-t-xl" aria-label="Mobile navigation">
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

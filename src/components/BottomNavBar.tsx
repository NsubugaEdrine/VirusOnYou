import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/dashboard', label: 'HOME', icon: 'dashboard' },
  { to: '/scan-submission', label: 'NEW', icon: 'upload_file' },
  { to: '/device-scan', label: 'SCAN', icon: 'usb' },
  { to: '/scan-history', label: 'SCANS', icon: 'security' },
  { to: '/settings', label: 'CONFIG', icon: 'settings' },
]

export default function BottomNavBar() {
  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex md:hidden justify-around items-center px-1 py-1 pb-[env(safe-area-inset-bottom,0px)] bg-surface-container-high border-t border-outline-variant/50" aria-label="Mobile navigation">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-w-[56px] py-1 transition-all duration-200 ${
              isActive
                ? 'text-on-secondary-container'
                : 'text-on-surface-variant hover:text-on-surface'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div className={`relative flex items-center justify-center w-16 h-8 rounded-full transition-all duration-300 ease-out ${
                isActive
                  ? 'bg-secondary-container'
                  : ''
              }`}>
                <span className={`material-symbols-outlined text-[24px] transition-all duration-200 ${
                  isActive ? 'font-variation-settings-fill-1' : ''
                }`} style={isActive ? { fontVariationSettings: "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24" } : {}}>
                  {item.icon}
                </span>
              </div>
              <span className={`font-label-caps text-[9px] mt-0.5 transition-all duration-200 ${
                isActive ? 'opacity-100' : 'opacity-70'
              }`}>{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

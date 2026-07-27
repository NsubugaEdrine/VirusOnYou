import { NavLink } from 'react-router-dom'
import { useUser } from '../lib/userContext'
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded'
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded'
import DevicesRoundedIcon from '@mui/icons-material/DevicesRounded'
import PolicyRoundedIcon from '@mui/icons-material/PolicyRounded'
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded'
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'

const navItems = [
  { to: '/dashboard', label: 'DASHBOARD', Icon: DashboardRoundedIcon },
  { to: '/scan-history', label: 'SCANS', Icon: ShieldRoundedIcon },
  { to: '/device-overview', label: 'DEVICES', Icon: DevicesRoundedIcon },
  { to: '/threat-intel', label: 'THREAT INTEL', Icon: PolicyRoundedIcon },
]

export default function NavigationDrawer() {
  const { admin } = useUser()

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
                    ? 'text-primary bg-primary-container/10 border-r-2 border-primary rounded-none'
                    : 'text-on-surface-variant hover:bg-surface-variant rounded-lg'
                }`
              }
            >
              <item.Icon sx={{ fontSize: 24 }} />
              <span className="font-label-caps text-label-caps">{item.label}</span>
            </NavLink>
          ))}

          {admin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 transition-all mt-2 ${
                  isActive
                    ? 'text-error bg-error/10 border-r-2 border-error rounded-none'
                    : 'text-error/70 hover:bg-error/5 rounded-lg'
                }`
              }
            >
              <AdminPanelSettingsRoundedIcon sx={{ fontSize: 24 }} />
              <span className="font-label-caps text-label-caps">ADMIN</span>
            </NavLink>
          )}
        </div>
      </nav>

      <div className="p-6 mt-auto border-t border-outline-variant shrink-0">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 transition-all rounded-lg ${
              isActive
                ? 'text-primary bg-primary/10'
                : 'text-on-surface-variant hover:bg-surface-variant'
            }`
          }
        >
          <SettingsRoundedIcon sx={{ fontSize: 24 }} />
          <span className="font-label-caps text-label-caps">SETTINGS</span>
        </NavLink>
      </div>
    </aside>
  )
}

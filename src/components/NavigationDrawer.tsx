import { useEffect, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import { useUser } from '../lib/userContext'

const navItems = [
  { to: '/dashboard', label: 'DASHBOARD', icon: 'dashboard' },
  { to: '/scan-submission', label: 'NEW SCAN', icon: 'upload_file' },
  { to: '/file-scanner', label: 'FILE SCANNER', icon: 'folder_open' },
  { to: '/app-scanner', label: 'APP SCANNER', icon: 'phone_android' },
  { to: '/device-scan', label: 'DEVICE SCAN', icon: 'usb' },
  { to: '/device-health', label: 'HEALTH SCAN', icon: 'health_and_safety' },
  { to: '/scan-history', label: 'SCANS', icon: 'security' },
  { to: '/device-overview', label: 'DEVICES', icon: 'devices' },
  { to: '/threat-intel', label: 'THREAT INTEL', icon: 'shield' },
]

export default function NavigationDrawer() {
  const { admin } = useUser()
  const asideRef = useRef<HTMLElement>(null)
  const settingsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const aside = asideRef.current
    const settings = settingsRef.current
    if (!aside || !settings) return
    const asideRect = aside.getBoundingClientRect()
    const settingsRect = settings.getBoundingClientRect()
    const styles = getComputedStyle(aside)
    // #region agent log
    fetch('http://127.0.0.1:7542/ingest/63a7cef4-3441-4b2c-b41f-ae792e84b7b4',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d394df'},body:JSON.stringify({sessionId:'d394df',location:'NavigationDrawer.tsx:mount',message:'sidebar layout metrics',data:{viewportW:window.innerWidth,viewportH:window.innerHeight,asideH:asideRect.height,asideDisplay:styles.display,settingsTop:settingsRect.top,settingsBottom:settingsRect.bottom,settingsVisible:settingsRect.bottom<=window.innerHeight&&settingsRect.top>=0,mdBreakpoint:window.matchMedia('(min-width:768px)').matches},timestamp:Date.now(),hypothesisId:'H1-H2-H3'})}).catch(()=>{});
    // #endregion
  }, [])

  return (
    <aside ref={asideRef} className="hidden md:flex flex-col h-full z-40 pt-16 fixed left-0 top-0 w-[240px] bg-surface-container border-r border-outline-variant">
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
              <span className="material-symbols-outlined">
                {item.icon}
              </span>
              <span className="font-label-caps text-label-caps">{item.label}</span>
            </NavLink>
          ))}

          {admin && (
            <>
              <div className="border-t border-outline-variant my-3"></div>
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 transition-all ${
                    isActive
                      ? 'text-error bg-error/10 border-r-2 border-error rounded-none'
                      : 'text-error/70 hover:bg-error/5 rounded-lg'
                  }`
                }
              >
                <span className="material-symbols-outlined">admin_panel_settings</span>
                <span className="font-label-caps text-label-caps">ADMIN</span>
              </NavLink>
            </>
          )}
        </div>
      </nav>

      <div ref={settingsRef} className="p-6 mt-auto border-t border-outline-variant shrink-0">
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
          <span className="material-symbols-outlined">settings</span>
          <span className="font-label-caps text-label-caps">SETTINGS</span>
        </NavLink>
      </div>
    </aside>
  )
}

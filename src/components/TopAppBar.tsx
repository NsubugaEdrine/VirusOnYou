import { useState } from 'react'
import { useTheme } from '../lib/ThemeContext'
import { useUser } from '../lib/userContext'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import PersonRoundedIcon from '@mui/icons-material/PersonRounded'
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded'
import LightModeRoundedIcon from '@mui/icons-material/LightModeRounded'
import DarkModeRoundedIcon from '@mui/icons-material/DarkModeRounded'

export default function TopAppBar() {
  const [searchFocused, setSearchFocused] = useState(false)
  const { theme, setTheme } = useTheme()
  const { userIdShort, admin } = useUser()

  return (
    <header className="fixed top-0 left-0 md:left-[240px] w-full md:w-[calc(100%-240px)] z-50 flex justify-between items-center px-margin h-16 bg-surface-container-low border-b border-outline-variant/50">
      <div className="flex items-center gap-3">
        <button className="md3-icon-btn md3-state-layer text-on-surface-variant" aria-label="Open menu">
          <MenuRoundedIcon />
        </button>
        <img src="/favicon.png" alt="VirusOnYou" className="w-8 h-8 rounded-xl object-cover shrink-0" />
        <h1 className="font-headline-md text-headline-md font-bold text-primary tracking-tight hidden sm:block whitespace-nowrap">
          VirusOnYou
        </h1>
      </div>

      <div className="flex-1 max-w-xl px-8 hidden md:block">
        <div className="relative">
          <SearchRoundedIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant" sx={{ fontSize: 20 }} />
          <input
            type="text"
            placeholder="Search threats, hash, or device ID..."
            aria-label="Search threats, hashes, or device IDs"
            className="w-full bg-surface-container-lowest border border-outline-variant rounded-2xl py-2 pl-10 pr-4 text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-xl bg-surface-container border border-outline-variant/50 text-on-surface-variant">
          <PersonRoundedIcon sx={{ fontSize: 16 }} />
          <span className="font-code-sm text-xs hidden sm:inline">{userIdShort}</span>
          {admin && (
            <span className="px-1.5 py-0.5 bg-error/15 text-error border border-error/25 rounded-full font-label-caps text-[8px]">ADM</span>
          )}
        </div>

        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="md3-icon-btn md3-state-layer text-on-surface-variant"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <LightModeRoundedIcon /> : <DarkModeRoundedIcon />}
        </button>

        <button className="md3-icon-btn md3-state-layer text-on-surface-variant relative" aria-label="Notifications">
          <NotificationsRoundedIcon />
          <span className="absolute top-1.5 right-1.5 md3-badge" style={{ minWidth: '8px', height: '8px', padding: 0 }}></span>
        </button>
      </div>
    </header>
  )
}

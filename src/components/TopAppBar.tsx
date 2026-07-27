import { useState } from 'react'
import { useTheme } from '../lib/ThemeContext'
import { useUser } from '../lib/userContext'

export default function TopAppBar() {
  const [searchFocused, setSearchFocused] = useState(false)
  const { theme, setTheme } = useTheme()
  const { userIdShort, admin } = useUser()

  return (
    <header className="fixed top-0 left-0 md:left-[240px] w-full md:w-[calc(100%-240px)] z-50 flex justify-between items-center px-margin h-16 bg-surface-container-low border-b border-outline-variant">
      <div className="flex items-center gap-3">
        <button className="material-symbols-outlined text-on-surface-variant hover:bg-surface-variant p-2 rounded-full transition-colors" aria-label="Open menu">
          menu
        </button>
        <img src="/favicon.png" alt="VirusOnYou" className="w-8 h-8 rounded-lg object-cover shrink-0" />
        <h1 className="font-headline-md text-headline-md font-bold text-primary tracking-tight hidden sm:block whitespace-nowrap">
          VirusOnYou
        </h1>
      </div>

      <div className="flex-1 max-w-xl px-8 hidden md:block">
        <div className={`relative transition-all ${searchFocused ? 'scale-[1.01]' : ''}`}>
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant">
            search
          </span>
          <input
            type="text"
            placeholder="Search threats, hash, or device ID..."
            aria-label="Search threats, hashes, or device IDs"
            className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg py-2 pl-10 pr-4 text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <div className="flex items-center gap-2 px-2 sm:px-3 py-1.5 rounded-lg bg-surface-container border border-outline-variant text-on-surface-variant">
          <span className="material-symbols-outlined text-[16px]">person</span>
          <span className="font-code-sm text-xs hidden sm:inline">{userIdShort}</span>
          {admin && (
            <span className="px-1.5 py-0.5 bg-error/15 text-error border border-error/25 rounded-full font-label-caps text-[8px]">ADM</span>
          )}
        </div>

        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="relative p-2 text-on-surface-variant hover:bg-surface-variant rounded-full transition-colors"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          <span className="material-symbols-outlined">{theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
        </button>

        <button className="relative p-2 text-on-surface-variant hover:bg-surface-variant rounded-full transition-colors" aria-label="Notifications (2 unread)">
          <span className="material-symbols-outlined">notifications</span>
          <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full" aria-hidden="true"></span>
        </button>
      </div>
    </header>
  )
}

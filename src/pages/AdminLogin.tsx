import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminLogin } from '../lib/user'
import { useUser } from '../lib/userContext'

export default function AdminLogin() {
  const navigate = useNavigate()
  const { refreshAdmin } = useUser()
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [shaking, setShaking] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (adminLogin(pin)) {
      refreshAdmin()
      navigate('/admin')
    } else {
      setError(true)
      setShaking(true)
      setTimeout(() => setShaking(false), 500)
      setTimeout(() => setError(false), 2000)
    }
  }

  return (
    <>
      <div className="absolute -top-[20%] -right-[10%] w-[500px] h-[500px] bg-error/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute -bottom-[20%] -left-[10%] w-[400px] h-[400px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="flex items-center justify-center min-h-[70vh] relative">
        <div className={`w-full max-w-md bg-surface-container-high rounded-2xl border border-outline-variant p-8 shadow-card ${shaking ? 'animate-shake' : ''}`}>
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-error/15 border border-error/30 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-error text-3xl">admin_panel_settings</span>
            </div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface">Admin Access</h2>
            <p className="text-on-surface-variant text-body-md mt-1">Enter your PIN to access the admin panel</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="font-label-caps text-label-caps text-on-surface-variant block mb-2">ADMIN PIN</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => { setPin(e.target.value); setError(false) }}
                placeholder="Enter PIN"
                autoFocus
                className={`w-full bg-surface-container-lowest border rounded-lg px-4 py-3 text-center text-headline-md font-code-sm tracking-[0.5em] focus:ring-1 outline-none transition-all ${
                  error ? 'border-error focus:border-error focus:ring-error text-error' : 'border-outline-variant focus:border-primary focus:ring-primary text-on-surface'
                }`}
              />
              {error && (
                <p className="text-error text-sm mt-2 text-center">Incorrect PIN. Access denied.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={pin.length < 4}
              className={`w-full py-3 rounded-xl font-headline-md text-headline-md transition-all duration-300 flex items-center justify-center gap-3 ${
                pin.length >= 4
                  ? 'bg-gradient-to-r from-error to-error/80 text-on-error hover:shadow-glow-error active:scale-[0.98]'
                  : 'bg-outline-variant/30 text-on-surface-variant cursor-not-allowed'
              }`}
            >
              <span className="material-symbols-outlined">lock</span>
              Authenticate
            </button>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0) }
          20% { transform: translateX(-8px) }
          40% { transform: translateX(8px) }
          60% { transform: translateX(-4px) }
          80% { transform: translateX(4px) }
        }
        .animate-shake { animation: shake 0.5s ease-in-out }
      `}</style>
    </>
  )
}

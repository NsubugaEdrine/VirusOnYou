import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import MailRoundedIcon from '@mui/icons-material/MailRounded'

export default function Login() {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const result = await signIn(email, password)
    if (result.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <>
      <div className="absolute -top-[20%] -right-[10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute -bottom-[20%] -left-[10%] w-[400px] h-[400px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="flex items-center justify-center min-h-[80vh] relative">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center mx-auto mb-4">
              <LockRoundedIcon className="text-primary" sx={{ fontSize: 32 }} />
            </div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface">Welcome Back</h2>
            <p className="text-on-surface-variant text-body-md mt-1">Sign in to access your threat dashboard</p>
          </div>

          <div className="bg-surface-container-high rounded-2xl border border-outline-variant p-8 shadow-card">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3 rounded-lg bg-error/10 border border-error/30 text-error text-body-sm text-center">
                  {error}
                </div>
              )}

              <div>
                <label className="font-label-caps text-label-caps text-on-surface-variant block mb-2">EMAIL</label>
                <div className="relative">
                  <MailRoundedIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant" sx={{ fontSize: 20 }} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError('') }}
                    placeholder="analyst@example.com"
                    required
                    autoFocus
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 pl-10 pr-4 text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="font-label-caps text-label-caps text-on-surface-variant block mb-2">PASSWORD</label>
                <div className="relative">
                  <LockRoundedIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant" sx={{ fontSize: 20 }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError('') }}
                    placeholder="Enter your password"
                    required
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 pl-10 pr-10 text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-outline-variant hover:text-on-surface-variant transition-colors"
                  >
                    {showPassword ? <span className="material-symbols-outlined text-[20px]">visibility_off</span> : <span className="material-symbols-outlined text-[20px]">visibility</span>}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !email || !password}
                className={`w-full py-3 rounded-xl font-headline-md text-headline-md transition-all duration-300 flex items-center justify-center gap-3 ${
                  !submitting && email && password
                    ? 'bg-primary text-on-primary hover:shadow-glow-primary active:scale-[0.98]'
                    : 'bg-outline-variant/30 text-on-surface-variant cursor-not-allowed'
                }`}
              >
                {submitting ? (
                  <>
                    <span className="animate-spin material-symbols-outlined">sync</span>
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-on-surface-variant text-body-sm">
                Don't have an account?{' '}
                <Link to="/signup" className="text-primary hover:text-primary-container font-medium transition-colors">
                  Sign Up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

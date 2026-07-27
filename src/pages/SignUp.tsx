import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import PersonAddRoundedIcon from '@mui/icons-material/PersonAddRounded'
import MailRoundedIcon from '@mui/icons-material/MailRounded'
import LockRoundedIcon from '@mui/icons-material/LockRounded'

export default function SignUp() {
  const navigate = useNavigate()
  const { signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setSubmitting(true)

    const result = await signUp(email, password)
    if (result.error) {
      setError(result.error)
      setSubmitting(false)
    } else {
      setSuccess(true)
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <>
        <div className="absolute -top-[20%] -right-[10%] w-[500px] h-[500px] bg-tertiary/5 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute -bottom-[20%] -left-[10%] w-[400px] h-[400px] bg-tertiary/5 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="flex items-center justify-center min-h-[80vh] relative">
          <div className="w-full max-w-md text-center">
            <div className="bg-surface-container-high rounded-2xl border border-outline-variant p-8 shadow-card">
              <div className="w-16 h-16 rounded-full bg-tertiary/15 border border-tertiary/30 flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-tertiary text-3xl">check_circle</span>
              </div>
              <h2 className="font-headline-lg text-headline-lg text-on-surface mb-2">Check Your Email</h2>
              <p className="text-on-surface-variant text-body-md mb-6">
                We've sent a confirmation link to <span className="text-primary font-medium">{email}</span>. Please verify your email to continue.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-primary text-on-primary font-headline-md text-headline-md hover:shadow-glow-primary active:scale-[0.98] transition-all"
              >
                Go to Sign In
              </Link>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <div className="absolute -top-[20%] -right-[10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute -bottom-[20%] -left-[10%] w-[400px] h-[400px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="flex items-center justify-center min-h-[80vh] relative">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center mx-auto mb-4">
              <PersonAddRoundedIcon className="text-primary" sx={{ fontSize: 32 }} />
            </div>
            <h2 className="font-headline-lg text-headline-lg text-on-surface">Create Account</h2>
            <p className="text-on-surface-variant text-body-md mt-1">Join VirusOnYou to start threat analysis</p>
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
                    placeholder="At least 6 characters"
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

              <div>
                <label className="font-label-caps text-label-caps text-on-surface-variant block mb-2">CONFIRM PASSWORD</label>
                <div className="relative">
                  <LockRoundedIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant" sx={{ fontSize: 20 }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError('') }}
                    placeholder="Re-enter your password"
                    required
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl py-3 pl-10 pr-4 text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !email || !password || !confirmPassword}
                className={`w-full py-3 rounded-xl font-headline-md text-headline-md transition-all duration-300 flex items-center justify-center gap-3 ${
                  !submitting && email && password && confirmPassword
                    ? 'bg-primary text-on-primary hover:shadow-glow-primary active:scale-[0.98]'
                    : 'bg-outline-variant/30 text-on-surface-variant cursor-not-allowed'
                }`}
              >
                {submitting ? (
                  <>
                    <span className="animate-spin material-symbols-outlined">sync</span>
                    Creating account...
                  </>
                ) : (
                  'Create Account'
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-on-surface-variant text-body-sm">
                Already have an account?{' '}
                <Link to="/login" className="text-primary hover:text-primary-container font-medium transition-colors">
                  Sign In
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

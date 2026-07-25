import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export default function SignUp() {
  const navigate = useNavigate()
  const { signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setSubmitting(true)

    const { error } = await signUp(email, password)

    if (error) {
      setError(error.message)
      setSubmitting(false)
    } else {
      setSuccess(true)
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-container-lowest px-4">
        <div className="w-full max-w-md text-center">
          <div className="glass-panel rounded-xl p-8">
            <span className="material-symbols-outlined text-6xl text-tertiary mb-4 block">check_circle</span>
            <h2 className="font-headline-md text-headline-md text-on-surface mb-2">Check your email</h2>
            <p className="text-on-surface-variant text-body-md mb-6">
              We sent a confirmation link to <strong>{email}</strong>. Click the link to activate your account.
            </p>
            <Link
              to="/login"
              className="inline-block px-6 py-3 bg-primary text-on-primary rounded-xl font-bold hover:shadow-glow-primary transition-all"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-container-lowest px-4">
      <div className="absolute -top-[20%] -left-[10%] w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute -bottom-[20%] -right-[10%] w-[400px] h-[400px] bg-tertiary/3 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <h1 className="font-headline-lg text-headline-lg text-primary tracking-tight mb-2">
            VirusOnYou
          </h1>
          <p className="text-on-surface-variant text-body-md">
            Create an analyst account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass-panel rounded-xl p-8 space-y-6">
          {error && (
            <div className="p-4 rounded-lg bg-error/10 border border-error/30 text-error text-body-md flex items-start gap-2">
              <span className="material-symbols-outlined text-[18px] mt-0.5">error</span>
              {error}
            </div>
          )}

          <div>
            <label className="font-label-caps text-label-caps text-on-surface-variant block mb-2">
              EMAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="analyst@company.com"
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3 text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
            />
          </div>

          <div>
            <label className="font-label-caps text-label-caps text-on-surface-variant block mb-2">
              PASSWORD
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="At least 6 characters"
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3 text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
            />
          </div>

          <div>
            <label className="font-label-caps text-label-caps text-on-surface-variant block mb-2">
              CONFIRM PASSWORD
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="Repeat your password"
              className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3 text-body-md focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-3 rounded-xl font-headline-md text-headline-md transition-all duration-300 flex items-center justify-center gap-3 ${
              submitting
                ? 'bg-outline-variant/30 text-on-surface-variant cursor-not-allowed'
                : 'bg-gradient-to-r from-primary to-primary-container text-on-primary hover:shadow-glow-primary active:scale-[0.98]'
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

          <p className="text-center text-on-surface-variant text-body-md">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-bold hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}

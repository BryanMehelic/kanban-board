import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'

type AuthMode = 'signin' | 'signup'

interface AuthModalProps {
  open: boolean
  initialMode?: AuthMode
  onClose: () => void
}

export function AuthModal({ open, initialMode = 'signin', onClose }: AuthModalProps) {
  const { signIn, signUp, isGuest } = useAuth()
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (open) setMode(initialMode)
  }, [open, initialMode])

  if (!open) return null

  function resetForm() {
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setError(null)
    setSuccess(null)
  }

  function switchMode(next: AuthMode) {
    setMode(next)
    setError(null)
    setSuccess(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      if (mode === 'signin') {
        await signIn(email, password)
        resetForm()
        onClose()
      } else {
        await signUp(email, password)
        setSuccess('Account created! Check your email if confirmation is required, then sign in.')
        setMode('signin')
        setPassword('')
        setConfirmPassword('')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-white">
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          {mode === 'signin'
            ? 'Sign in to access teams and sync your work across devices.'
            : 'Create a permanent account with email and password.'}
        </p>

        {isGuest && (
          <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            Signing in replaces your guest session. To keep current guest tasks, use{' '}
            <strong>Upgrade account</strong> instead.
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => switchMode('signin')}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
              mode === 'signin'
                ? 'bg-indigo-500 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => switchMode('signup')}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
              mode === 'signup'
                ? 'bg-indigo-500 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <label className="block">
            <span className="text-sm text-slate-300">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-300">Password</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
            />
          </label>

          {mode === 'signup' && (
            <label className="block">
              <span className="text-sm text-slate-300">Confirm password</span>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
              />
            </label>
          )}

          {error && <p className="text-sm text-rose-400">{error}</p>}
          {success && <p className="text-sm text-emerald-400">{success}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
            >
              {loading
                ? 'Please wait...'
                : mode === 'signin'
                  ? 'Sign in'
                  : 'Create account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

import { useState } from 'react'

interface InviteMemberModalProps {
  open: boolean
  teamId: string | null
  onClose: () => void
  onInvite: (teamId: string, email: string) => Promise<void>
}

export function InviteMemberModal({ open, teamId, onClose, onInvite }: InviteMemberModalProps) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!open || !teamId) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!teamId) return
    setError(null)

    if (!email.trim()) {
      setError('Email is required')
      return
    }

    setLoading(true)
    try {
      await onInvite(teamId, email.trim())
      setEmail('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invite')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-white">Invite team member</h2>
        <p className="mt-1 text-sm text-slate-400">
          The invitee must have a registered account with this email to accept.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <label className="block">
            <span className="text-sm text-slate-300">Email address</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
              placeholder="teammate@example.com"
            />
          </label>

          {error && <p className="text-sm text-rose-400">{error}</p>}

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
              {loading ? 'Sending...' : 'Send invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

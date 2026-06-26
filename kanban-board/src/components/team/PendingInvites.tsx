import { useTeams } from '../../contexts/TeamsContext'

export function PendingInvites() {
  const { pendingInvites, acceptInvite, declineInvite, error } = useTeams()

  if (pendingInvites.length === 0) return null

  return (
    <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-4">
      <h3 className="text-sm font-semibold text-indigo-200">Pending team invites</h3>
      {error && <p className="mt-1 text-xs text-rose-400">{error}</p>}
      <ul className="mt-3 space-y-2">
        {pendingInvites.map((invite) => (
          <li
            key={invite.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-900/60 px-3 py-2"
          >
            <span className="text-sm text-slate-200">
              Join <strong>{invite.teams?.name ?? 'a team'}</strong>
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void acceptInvite(invite)}
                className="rounded-md bg-indigo-500 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-400"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={() => void declineInvite(invite.id)}
                className="rounded-md bg-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-600"
              >
                Decline
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

import { useAuth } from '../../contexts/AuthContext'
import { useTeams } from '../../contexts/TeamsContext'
import { useBoardScope } from '../../contexts/BoardContext'

interface TeamSwitcherProps {
  onCreateTeam: () => void
  onInvite: (teamId: string) => void
  onSignIn: () => void
}

export function TeamSwitcher({ onCreateTeam, onInvite, onSignIn }: TeamSwitcherProps) {
  const { isGuest } = useAuth()
  const { scope, setPersonalBoard, setTeamBoard } = useBoardScope()
  const { teams } = useTeams()

  if (isGuest) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-slate-500">Sign in to create and join teams.</p>
        <button
          type="button"
          onClick={onSignIn}
          className="rounded-lg bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-400"
        >
          Sign in
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={setPersonalBoard}
        className={`rounded-lg px-3 py-1.5 text-sm ${
          scope.type === 'personal'
            ? 'bg-indigo-500 text-white'
            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
        }`}
      >
        Personal
      </button>

      {teams.map((team) => (
        <div key={team.id} className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setTeamBoard(team.id, team.name)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              scope.type === 'team' && scope.teamId === team.id
                ? 'bg-indigo-500 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {team.name}
          </button>
          <button
            type="button"
            onClick={() => onInvite(team.id)}
            className="rounded-lg bg-slate-800 px-2 py-1.5 text-xs text-slate-400 hover:bg-slate-700 hover:text-white"
            title="Invite member"
          >
            +
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={onCreateTeam}
        className="rounded-lg border border-dashed border-slate-600 px-3 py-1.5 text-sm text-slate-400 hover:border-indigo-500 hover:text-indigo-300"
      >
        + New team
      </button>
    </div>
  )
}

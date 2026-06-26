import { useState } from 'react'
import { AuthModal } from './components/auth/AuthModal'
import { UpgradeAccountModal } from './components/auth/UpgradeAccountModal'
import { KanbanBoard } from './components/board/KanbanBoard'
import { TaskDetailDrawer } from './components/task/TaskDetailDrawer'
import { CreateTeamModal } from './components/team/CreateTeamModal'
import { InviteMemberModal } from './components/team/InviteMemberModal'
import { PendingInvites } from './components/team/PendingInvites'
import { TeamSwitcher } from './components/team/TeamSwitcher'
import { ErrorBanner } from './components/ui/ErrorBanner'
import { GuestBanner } from './components/ui/GuestBanner'
import { LoadingSpinner } from './components/ui/LoadingSpinner'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { BoardProvider, useBoardScope } from './contexts/BoardContext'
import { TeamsProvider, useTeams } from './contexts/TeamsContext'
import { isSupabaseConfigured } from './lib/supabase'
import type { Task } from './types/database'

function AppContent() {
  const { loading, error: authError, isGuest, user, signOut } = useAuth()
  const { createTeam, inviteMember, error: teamsError } = useTeams()
  const { setTeamBoard } = useBoardScope()
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [createTeamOpen, setCreateTeamOpen] = useState(false)
  const [inviteTeamId, setInviteTeamId] = useState<string | null>(null)

  function openSignIn() {
    setAuthMode('signin')
    setAuthOpen(true)
  }

  function openSignUp() {
    setAuthMode('signup')
    setAuthOpen(true)
  }

  async function handleCreateTeam(name: string) {
    const team = await createTeam(name)
    setTeamBoard(team.id, team.name)
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <ErrorBanner
          message="Supabase is not configured. Copy .env.example to .env.local and add your project URL and anon key."
        />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner label="Starting guest session..." />
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">
              Kanban Board
            </p>
            <p className="text-sm text-slate-400">
              {isGuest ? 'Guest session' : user?.email ?? 'Signed in'}
            </p>
          </div>

          <TeamSwitcher
            onCreateTeam={() => setCreateTeamOpen(true)}
            onInvite={(teamId) => setInviteTeamId(teamId)}
            onSignIn={openSignIn}
          />

          <div className="flex items-center gap-2">
            {isGuest ? (
              <>
                <button
                  type="button"
                  onClick={openSignIn}
                  className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700"
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={openSignUp}
                  className="rounded-lg bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-400"
                >
                  Create account
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void signOut()}
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-4 px-4 py-6">
        {authError && <ErrorBanner message={authError} />}
        {teamsError && <ErrorBanner message={teamsError} />}

        <GuestBanner onUpgrade={() => setUpgradeOpen(true)} onSignIn={openSignIn} />
        <PendingInvites />
        <KanbanBoard onTaskClick={setSelectedTask} />
      </main>

      <TaskDetailDrawer task={selectedTask} onClose={() => setSelectedTask(null)} />

      <AuthModal
        open={authOpen}
        initialMode={authMode}
        onClose={() => setAuthOpen(false)}
      />

      <UpgradeAccountModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />

      <CreateTeamModal
        open={createTeamOpen}
        onClose={() => setCreateTeamOpen(false)}
        onCreate={handleCreateTeam}
      />

      <InviteMemberModal
        open={Boolean(inviteTeamId)}
        teamId={inviteTeamId}
        onClose={() => setInviteTeamId(null)}
        onInvite={inviteMember}
      />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <TeamsProvider>
        <BoardProvider>
          <AppContent />
        </BoardProvider>
      </TeamsProvider>
    </AuthProvider>
  )
}

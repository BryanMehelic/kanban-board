import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'
import { getErrorMessage } from '../lib/errors'
import type { Team, TeamInvite, TeamMember } from '../types/database'

interface TeamsContextValue {
  teams: Team[]
  members: TeamMember[]
  pendingInvites: TeamInvite[]
  loading: boolean
  error: string | null
  fetchTeams: () => Promise<void>
  fetchTeamMembers: (teamId: string) => Promise<void>
  createTeam: (name: string) => Promise<Team>
  inviteMember: (teamId: string, email: string) => Promise<void>
  acceptInvite: (invite: TeamInvite) => Promise<void>
  declineInvite: (inviteId: string) => Promise<void>
}

const TeamsContext = createContext<TeamsContextValue | null>(null)

export function TeamsProvider({ children }: { children: ReactNode }) {
  const { user, isGuest } = useAuth()
  const subscriptionId = useId()
  const [teams, setTeams] = useState<Team[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [pendingInvites, setPendingInvites] = useState<TeamInvite[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTeams = useCallback(async () => {
    if (!user || isGuest) {
      setTeams([])
      return
    }

    setLoading(true)
    setError(null)

    const { data: memberRows, error: memberError } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', user.id)

    if (memberError) {
      setError(memberError.message)
      setLoading(false)
      return
    }

    const teamIds = memberRows?.map((m) => m.team_id) ?? []

    if (teamIds.length === 0) {
      setTeams([])
      setLoading(false)
      return
    }

    const { data: teamRows, error: teamError } = await supabase
      .from('teams')
      .select('*')
      .in('id', teamIds)
      .order('created_at', { ascending: true })

    if (teamError) {
      setError(teamError.message)
    } else {
      setTeams(teamRows ?? [])
    }

    setLoading(false)
  }, [user, isGuest])

  const fetchPendingInvites = useCallback(async () => {
    if (!user?.email || isGuest) {
      setPendingInvites([])
      return
    }

    const { data, error: inviteError } = await supabase
      .from('team_invites')
      .select('*, teams(name)')
      .eq('status', 'pending')
      .ilike('email', user.email)

    if (inviteError) {
      setError(inviteError.message)
    } else {
      setPendingInvites((data ?? []) as TeamInvite[])
    }
  }, [user, isGuest])

  const fetchTeamMembers = useCallback(async (teamId: string) => {
    const { data, error: membersError } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)

    if (membersError) {
      setError(membersError.message)
    } else {
      setMembers(data ?? [])
    }
  }, [])

  useEffect(() => {
    void fetchTeams()
    void fetchPendingInvites()
  }, [fetchTeams, fetchPendingInvites])

  useEffect(() => {
    if (!user || isGuest) return

    const channel = supabase
      .channel(`team_members:${user.id}:${subscriptionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'team_members', filter: `user_id=eq.${user.id}` },
        () => {
          void fetchTeams()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user, isGuest, fetchTeams, subscriptionId])

  const createTeam = useCallback(
    async (name: string) => {
      if (!user) throw new Error('Not authenticated')
      if (isGuest) throw new Error('Sign in or upgrade your account to create a team')

      setError(null)

      const { data: team, error: teamError } = await supabase.rpc('create_team_with_owner', {
        p_name: name,
      })

      if (teamError) {
        const message = getErrorMessage(teamError)
        setError(message)
        throw new Error(message)
      }

      if (!team) {
        const message = 'Team was not created'
        setError(message)
        throw new Error(message)
      }

      setTeams((prev) => [...prev, team as Team])
      return team as Team
    },
    [user, isGuest],
  )

  const inviteMember = useCallback(
    async (teamId: string, email: string) => {
      if (!user) throw new Error('Not authenticated')

      setError(null)

      const { error: inviteError } = await supabase.from('team_invites').insert({
        team_id: teamId,
        email: email.trim().toLowerCase(),
        invited_by: user.id,
      })

      if (inviteError) {
        setError(inviteError.message)
        throw inviteError
      }
    },
    [user],
  )

  const acceptInvite = useCallback(
    async (invite: TeamInvite) => {
      if (!user) throw new Error('Not authenticated')

      setError(null)

      const { error: memberError } = await supabase.from('team_members').insert({
        team_id: invite.team_id,
        user_id: user.id,
        role: 'member',
      })

      if (memberError) {
        setError(memberError.message)
        throw memberError
      }

      const { error: updateError } = await supabase
        .from('team_invites')
        .update({ status: 'accepted' })
        .eq('id', invite.id)

      if (updateError) {
        setError(updateError.message)
        throw updateError
      }

      setPendingInvites((prev) => prev.filter((i) => i.id !== invite.id))
      await fetchTeams()
    },
    [user, fetchTeams],
  )

  const declineInvite = useCallback(async (inviteId: string) => {
    setError(null)

    const { error: updateError } = await supabase
      .from('team_invites')
      .update({ status: 'declined' })
      .eq('id', inviteId)

    if (updateError) {
      setError(updateError.message)
      throw updateError
    }

    setPendingInvites((prev) => prev.filter((i) => i.id !== inviteId))
  }, [])

  const value = useMemo(
    () => ({
      teams,
      members,
      pendingInvites,
      loading,
      error,
      fetchTeams,
      fetchTeamMembers,
      createTeam,
      inviteMember,
      acceptInvite,
      declineInvite,
    }),
    [
      teams,
      members,
      pendingInvites,
      loading,
      error,
      fetchTeams,
      fetchTeamMembers,
      createTeam,
      inviteMember,
      acceptInvite,
      declineInvite,
    ],
  )

  return <TeamsContext.Provider value={value}>{children}</TeamsContext.Provider>
}

export function useTeams() {
  const context = useContext(TeamsContext)
  if (!context) {
    throw new Error('useTeams must be used within TeamsProvider')
  }
  return context
}

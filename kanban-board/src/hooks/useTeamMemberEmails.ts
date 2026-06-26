import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import type { TaskActivity } from '../types/database'

export function useTeamMemberEmails(teamId: string | null) {
  const { user } = useAuth()
  const [emailByUserId, setEmailByUserId] = useState<Record<string, string>>({})

  const loadEmails = useCallback(async () => {
    if (!teamId) {
      setEmailByUserId({})
      return
    }

    const { data, error } = await supabase.rpc('get_team_member_emails', {
      p_team_id: teamId,
    })

    const map: Record<string, string> = {}

    if (!error && data) {
      for (const row of data as { user_id: string; email: string | null }[]) {
        if (row.email) map[row.user_id] = row.email
      }
    }

    if (user?.id && user.email) {
      map[user.id] = user.email
    }

    setEmailByUserId(map)
  }, [teamId, user?.id, user?.email])

  useEffect(() => {
    void loadEmails()
  }, [loadEmails])

  return { emailByUserId, refetchEmails: loadEmails }
}

export function resolveUserEmail(
  userId: string | null | undefined,
  emailByUserId: Record<string, string>,
): string | null {
  if (!userId) return null
  return emailByUserId[userId] ?? null
}

export function resolveActivityEmail(
  activity: TaskActivity,
  emailByUserId: Record<string, string>,
): string | null {
  const fromMetadata = activity.metadata?.actor_email
  if (typeof fromMetadata === 'string' && fromMetadata.length > 0) {
    return fromMetadata
  }
  return resolveUserEmail(activity.actor_id, emailByUserId)
}

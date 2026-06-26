import { formatActivityMessage, formatRelativeTime } from '../../lib/activity'
import { resolveActivityEmail } from '../../hooks/useTeamMemberEmails'
import type { TaskActivity } from '../../types/database'
import { LoadingSpinner } from '../ui/LoadingSpinner'

interface ActivityFeedProps {
  activity: TaskActivity[]
  loading: boolean
  showAuthors?: boolean
  emailByUserId?: Record<string, string>
}

export function ActivityFeed({
  activity,
  loading,
  showAuthors = false,
  emailByUserId = {},
}: ActivityFeedProps) {
  if (loading) {
    return <LoadingSpinner label="Loading activity..." />
  }

  if (activity.length === 0) {
    return <p className="text-sm text-slate-500">No activity yet.</p>
  }

  return (
    <ul className="space-y-3">
      {activity.map((entry) => {
        const actorEmail = showAuthors
          ? entry.actor_email ?? resolveActivityEmail(entry, emailByUserId)
          : null

        return (
          <li key={entry.id} className="flex gap-3 text-sm">
            <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-400" />
            <div>
              <p className="text-slate-200">
                {formatActivityMessage(entry, actorEmail)}
              </p>
              <p className="text-xs text-slate-500">{formatRelativeTime(entry.created_at)}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

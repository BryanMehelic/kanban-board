import { formatDistanceToNow } from 'date-fns'
import { STATUS_LABELS } from '../lib/constants'
import type { TaskActivity } from '../types/database'

export function formatActivityMessage(
  activity: TaskActivity,
  actorEmail?: string | null,
): string {
  const prefix = actorEmail ? `${actorEmail} ` : ''
  switch (activity.action) {
    case 'created':
      return `${prefix}${actorEmail ? 'created this task' : 'Task created'}`
    case 'status_changed':
      return `${prefix}${actorEmail ? 'moved' : 'Moved'} from ${STATUS_LABELS[activity.from_value as keyof typeof STATUS_LABELS] ?? activity.from_value} → ${STATUS_LABELS[activity.to_value as keyof typeof STATUS_LABELS] ?? activity.to_value}`
    case 'priority_changed':
      return `${prefix}${actorEmail ? 'changed priority' : 'Priority changed'} from ${activity.from_value} to ${activity.to_value}`
    case 'assignee_changed':
      return actorEmail
        ? `${actorEmail} ${activity.to_value ? 'updated the assignee' : 'removed the assignee'}`
        : activity.to_value
          ? 'Assignee updated'
          : 'Assignee removed'
    case 'comment_added':
      return `${prefix}${actorEmail ? 'added a comment' : 'Added a comment'}`
    default:
      return `${prefix}${activity.action.replace(/_/g, ' ')}`
  }
}

export function formatRelativeTime(date: string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

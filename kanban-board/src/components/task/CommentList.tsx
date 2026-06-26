import { formatRelativeTime } from '../../lib/activity'
import { resolveUserEmail } from '../../hooks/useTeamMemberEmails'
import { useAuth } from '../../contexts/AuthContext'
import type { TaskComment } from '../../types/database'
import { LoadingSpinner } from '../ui/LoadingSpinner'

interface CommentListProps {
  comments: TaskComment[]
  loading: boolean
  saving: boolean
  showAuthors?: boolean
  emailByUserId?: Record<string, string>
  onAdd: (body: string) => Promise<void>
  onDelete: (commentId: string) => Promise<void>
}

export function CommentList({
  comments,
  loading,
  saving,
  showAuthors = false,
  emailByUserId = {},
  onAdd,
  onDelete,
}: CommentListProps) {
  const { user } = useAuth()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    const body = (formData.get('body') as string)?.trim()
    if (!body) return

    await onAdd(body)
    form.reset()
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          name="body"
          rows={3}
          placeholder="Write a comment..."
          className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-600 disabled:opacity-50"
        >
          {saving ? 'Posting...' : 'Add comment'}
        </button>
      </form>

      {loading ? (
        <LoadingSpinner label="Loading comments..." />
      ) : comments.length === 0 ? (
        <p className="text-sm text-slate-500">No comments yet.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((comment) => {
            const authorEmail = showAuthors
              ? comment.author_email ?? resolveUserEmail(comment.user_id, emailByUserId)
              : null

            return (
              <li
                key={comment.id}
                className="rounded-lg border border-slate-800 bg-slate-800/50 p-3"
              >
                {authorEmail && (
                  <p className="mb-1 text-xs font-medium text-indigo-300">{authorEmail}</p>
                )}
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-slate-200">{comment.body}</p>
                  {user?.id === comment.user_id && (
                    <button
                      type="button"
                      onClick={() => void onDelete(comment.id)}
                      className="shrink-0 text-xs text-rose-400 hover:text-rose-300"
                    >
                      Delete
                    </button>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {formatRelativeTime(comment.created_at)}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

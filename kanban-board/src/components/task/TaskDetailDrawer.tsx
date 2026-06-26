import { useEffect, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { PRIORITY_LABELS, STATUS_LABELS } from '../../lib/constants'
import { useAuth } from '../../contexts/AuthContext'
import { useBoardScope } from '../../contexts/BoardContext'
import { useTaskActivity } from '../../hooks/useTaskActivity'
import { useTaskComments } from '../../hooks/useTaskComments'
import { useTasks } from '../../hooks/useTasks'
import type { Task, TaskPriority, TaskStatus } from '../../types/database'
import { ActivityFeed } from './ActivityFeed'
import { CommentList } from './CommentList'
import { ErrorBanner } from '../ui/ErrorBanner'

interface TaskDetailDrawerProps {
  task: Task | null
  onClose: () => void
}

export function TaskDetailDrawer({ task, onClose }: TaskDetailDrawerProps) {
  const { user } = useAuth()
  const { scope } = useBoardScope()
  const { updateTask, deleteTask, saving, error: taskError } = useTasks(scope)

  const isTeamTask =
    scope.type === 'team' &&
    task != null &&
    task.team_id != null &&
    task.team_id === scope.teamId

  const {
    comments,
    loading: commentsLoading,
    saving: commentSaving,
    error: commentError,
    addComment,
    deleteComment,
  } = useTaskComments(task?.id ?? null, isTeamTask)
  const { activity, loading: activityLoading, error: activityError } = useTaskActivity(
    task?.id ?? null,
    isTeamTask,
  )

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<TaskPriority>('medium')
  const [status, setStatus] = useState<TaskStatus>('todo')
  const [dueDate, setDueDate] = useState('')

  useEffect(() => {
    if (!task) return
    setTitle(task.title)
    setDescription(task.description ?? '')
    setPriority(task.priority)
    setStatus(task.status)
    setDueDate(task.due_date ?? '')
  }, [task])

  if (!task) return null

  async function handleSave() {
    if (!task) return
    await updateTask(task.id, {
      title: title.trim(),
      description: description.trim() || null,
      priority,
      status,
      due_date: dueDate || null,
    })
  }

  async function handleDelete() {
    if (!task) return
    if (!confirm('Delete this task?')) return
    await deleteTask(task.id)
    onClose()
  }

  const combinedError = taskError || commentError || activityError

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/60">
      <button type="button" className="flex-1" aria-label="Close drawer" onClick={onClose} />

      <aside className="flex h-full w-full max-w-lg flex-col border-l border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h2 className="text-lg font-semibold text-white">Task details</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
          {combinedError && <ErrorBanner message={combinedError} />}

          <div className="space-y-4">
            <label className="block">
              <span className="text-sm text-slate-400">Title</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
              />
            </label>

            <label className="block">
              <span className="text-sm text-slate-400">Description</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
              />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm text-slate-400">Status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                >
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm text-slate-400">Priority</span>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                >
                  {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="text-sm text-slate-400">Due date</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
              />
            </label>

            <p className="text-xs text-slate-500">
              Created {format(parseISO(task.created_at), 'MMM d, yyyy h:mm a')}
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                className="rounded-lg border border-rose-500/40 px-4 py-2 text-sm text-rose-300 hover:bg-rose-500/10"
              >
                Delete
              </button>
            </div>
          </div>

          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Activity
            </h3>
            <ActivityFeed
              activity={activity}
              loading={activityLoading}
              showAuthors={isTeamTask}
            />
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Comments
            </h3>
            <CommentList
              comments={comments}
              loading={commentsLoading}
              saving={commentSaving}
              showAuthors={isTeamTask}
              onAdd={async (body) => {
                if (!user) return
                await addComment(body, user.id)
              }}
              onDelete={deleteComment}
            />
          </section>
        </div>
      </aside>
    </div>
  )
}

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { format, isPast, parseISO } from 'date-fns'
import { PRIORITY_COLORS, PRIORITY_LABELS } from '../../lib/constants'
import type { Task } from '../../types/database'

interface TaskCardProps {
  task: Task
  onClick: () => void
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const overdue = task.due_date && isPast(parseISO(task.due_date)) && task.status !== 'done'

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (isDragging) return
        e.stopPropagation()
        onClick()
      }}
      className={`w-full rounded-lg border border-slate-700 bg-slate-800/80 p-3 text-left shadow-sm transition hover:border-indigo-500/50 hover:bg-slate-800 ${
        isDragging ? 'opacity-50 ring-2 ring-indigo-400' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-white">{task.title}</h3>
        <span
          className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase ${PRIORITY_COLORS[task.priority]}`}
        >
          {PRIORITY_LABELS[task.priority]}
        </span>
      </div>

      {task.description && (
        <p className="mt-2 line-clamp-2 text-xs text-slate-400">{task.description}</p>
      )}

      {task.due_date && (
        <p className={`mt-2 text-xs ${overdue ? 'text-rose-400' : 'text-slate-500'}`}>
          Due {format(parseISO(task.due_date), 'MMM d, yyyy')}
        </p>
      )}
    </button>
  )
}

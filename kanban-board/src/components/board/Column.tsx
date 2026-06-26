import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Task, TaskStatus } from '../../types/database'
import { TaskCard } from './TaskCard'

interface ColumnProps {
  id: TaskStatus
  label: string
  tasks: Task[]
  onTaskClick: (task: Task) => void
}

export function Column({ id, label, tasks, onTaskClick }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { type: 'column', status: id } })

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[420px] w-72 shrink-0 flex-col rounded-xl border bg-slate-900/50 ${
        isOver ? 'border-indigo-400 bg-indigo-500/5' : 'border-slate-800'
      }`}
    >
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-200">{label}</h2>
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
          {tasks.length}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-slate-700 p-4 text-center text-xs text-slate-500">
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  )
}

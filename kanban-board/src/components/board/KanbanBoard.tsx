import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useMemo, useState } from 'react'
import { COLUMNS } from '../../lib/constants'
import { useBoardScope } from '../../contexts/BoardContext'
import { useTasks } from '../../hooks/useTasks'
import type { Task, TaskStatus } from '../../types/database'
import { Column } from './Column'
import { CreateTaskModal } from './CreateTaskModal'
import { TaskCard } from './TaskCard'
import { ErrorBanner } from '../ui/ErrorBanner'
import { LoadingSpinner } from '../ui/LoadingSpinner'

interface KanbanBoardProps {
  onTaskClick: (task: Task) => void
}

export function KanbanBoard({ onTaskClick }: KanbanBoardProps) {
  const { scope } = useBoardScope()
  const { tasks, loading, error, saving, fetchTasks, createTask, moveTask } = useTasks(scope)
  const [createOpen, setCreateOpen] = useState(false)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [dismissedError, setDismissedError] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  )

  const tasksByColumn = useMemo(() => {
    return COLUMNS.reduce(
      (acc, column) => {
        acc[column.id] = tasks
          .filter((t) => t.status === column.id)
          .sort((a, b) => a.position - b.position)
        return acc
      },
      {} as Record<TaskStatus, Task[]>,
    )
  }, [tasks])

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === event.active.id)
    setActiveTask(task ?? null)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null)

    const { active, over } = event
    if (!over || saving) return

    const taskId = active.id as string
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return

    let newStatus: TaskStatus = task.status

    if (over.data.current?.type === 'column') {
      newStatus = over.data.current.status as TaskStatus
    } else if (over.data.current?.type === 'task') {
      newStatus = (over.data.current.task as Task).status
    } else if (COLUMNS.some((c) => c.id === over.id)) {
      newStatus = over.id as TaskStatus
    }

    if (newStatus === task.status && over.id === taskId) return

    const columnTasks = tasksByColumn[newStatus].filter((t) => t.id !== taskId)
    let newPosition = columnTasks.length

    if (over.data.current?.type === 'task') {
      const overTask = over.data.current.task as Task
      const overIndex = columnTasks.findIndex((t) => t.id === overTask.id)
      newPosition = overIndex >= 0 ? overIndex : columnTasks.length
    }

    try {
      await moveTask(taskId, newStatus, newPosition)
    } catch {
      // error handled in hook
    }
  }

  if (loading) {
    return <LoadingSpinner label="Loading board..." />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {scope.type === 'personal' ? 'Personal Board' : scope.teamName}
          </h1>
          <p className="text-sm text-slate-400">
            {scope.type === 'personal'
              ? 'Your private tasks'
              : 'Shared team board — changes sync in real time'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
        >
          + New task
        </button>
      </div>

      {error && !dismissedError && (
        <ErrorBanner
          message={error}
          onRetry={() => {
            setDismissedError(false)
            void fetchTasks()
          }}
          onDismiss={() => setDismissedError(true)}
        />
      )}

      {saving && (
        <p className="text-xs text-indigo-300">Saving changes...</p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((column) => (
            <Column
              key={column.id}
              id={column.id}
              label={column.label}
              tasks={tasksByColumn[column.id]}
              onTaskClick={onTaskClick}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="w-72 rotate-2 opacity-90">
              <TaskCard task={activeTask} onClick={() => undefined} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <CreateTaskModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={createTask}
        saving={saving}
      />
    </div>
  )
}

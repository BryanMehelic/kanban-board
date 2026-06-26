import { useCallback, useEffect, useId, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { BoardScope } from '../contexts/BoardContext'
import type { Task, TaskStatus } from '../types/database'

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.status !== b.status) return a.status.localeCompare(b.status)
    return a.position - b.position
  })
}

export function useTasks(scope: BoardScope) {
  const { user } = useAuth()
  const subscriptionId = useId()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchTasks = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }

    setError(null)
    setLoading(true)

    let query = supabase.from('tasks').select('*').order('position', { ascending: true })

    if (scope.type === 'personal') {
      query = query.is('team_id', null).eq('user_id', user.id)
    } else {
      query = query.eq('team_id', scope.teamId)
    }

    const { data, error: fetchError } = await query

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setTasks(sortTasks(data ?? []))
    }

    setLoading(false)
  }, [user, scope])

  useEffect(() => {
    void fetchTasks()
  }, [fetchTasks])

  useEffect(() => {
    if (!user) return

    const filter =
      scope.type === 'personal'
        ? `user_id=eq.${user.id}`
        : `team_id=eq.${scope.teamId}`

    const channel = supabase
      .channel(`tasks:${scope.type === 'personal' ? 'personal' : scope.teamId}:${subscriptionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newTask = payload.new as Task
            if (scope.type === 'personal' && newTask.team_id !== null) return
            if (scope.type === 'team' && newTask.team_id !== scope.teamId) return
            setTasks((prev) => sortTasks([...prev.filter((t) => t.id !== newTask.id), newTask]))
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Task
            if (scope.type === 'personal' && updated.team_id !== null) {
              setTasks((prev) => prev.filter((t) => t.id !== updated.id))
              return
            }
            if (scope.type === 'team' && updated.team_id !== scope.teamId) {
              setTasks((prev) => prev.filter((t) => t.id !== updated.id))
              return
            }
            setTasks((prev) =>
              sortTasks(prev.map((t) => (t.id === updated.id ? updated : t))),
            )
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string }
            setTasks((prev) => prev.filter((t) => t.id !== deleted.id))
          }
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user, scope, subscriptionId])

  const createTask = useCallback(
    async (input: {
      title: string
      description?: string
      priority: Task['priority']
      due_date?: string
    }) => {
      if (!user) throw new Error('Not authenticated')

      setSaving(true)
      setError(null)

      const maxPosition =
        tasks.filter((t) => t.status === 'todo').reduce((max, t) => Math.max(max, t.position), -1) +
        1

      const { data, error: insertError } = await supabase
        .from('tasks')
        .insert({
          title: input.title,
          description: input.description ?? null,
          priority: input.priority,
          due_date: input.due_date ?? null,
          user_id: user.id,
          team_id: scope.type === 'team' ? scope.teamId : null,
          status: 'todo',
          position: maxPosition,
        })
        .select()
        .single()

      setSaving(false)

      if (insertError) {
        setError(insertError.message)
        throw insertError
      }

      if (data) {
        setTasks((prev) => sortTasks([...prev, data]))
      }

      return data
    },
    [user, scope, tasks],
  )

  const moveTask = useCallback(
    async (taskId: string, newStatus: TaskStatus, newPosition: number) => {
      setSaving(true)
      setError(null)

      const previous = tasks
      setTasks((prev) =>
        sortTasks(
          prev.map((t) =>
            t.id === taskId ? { ...t, status: newStatus, position: newPosition } : t,
          ),
        ),
      )

      const { error: updateError } = await supabase
        .from('tasks')
        .update({ status: newStatus, position: newPosition })
        .eq('id', taskId)

      setSaving(false)

      if (updateError) {
        setTasks(previous)
        setError(updateError.message)
        throw updateError
      }
    },
    [tasks],
  )

  const updateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
    setSaving(true)
    setError(null)

    const { data, error: updateError } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', taskId)
      .select()
      .single()

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      throw updateError
    }

    if (data) {
      setTasks((prev) => sortTasks(prev.map((t) => (t.id === taskId ? data : t))))
    }

    return data
  }, [])

  const deleteTask = useCallback(async (taskId: string) => {
    setSaving(true)
    setError(null)

    const { error: deleteError } = await supabase.from('tasks').delete().eq('id', taskId)

    setSaving(false)

    if (deleteError) {
      setError(deleteError.message)
      throw deleteError
    }

    setTasks((prev) => prev.filter((t) => t.id !== taskId))
  }, [])

  return {
    tasks,
    loading,
    error,
    saving,
    fetchTasks,
    createTask,
    moveTask,
    updateTask,
    deleteTask,
  }
}

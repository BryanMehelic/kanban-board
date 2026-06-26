import { useCallback, useEffect, useId, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { TaskActivity } from '../types/database'

export function useTaskActivity(taskId: string | null, includeAuthors = false) {
  const subscriptionId = useId()
  const [activity, setActivity] = useState<TaskActivity[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchActivity = useCallback(async () => {
    if (!taskId) {
      setActivity([])
      return
    }

    setLoading(true)
    setError(null)

    if (includeAuthors) {
      const { data, error: fetchError } = await supabase.rpc('get_task_activity_with_authors', {
        p_task_id: taskId,
      })

      if (fetchError) {
        setError(fetchError.message)
      } else {
        setActivity((data ?? []) as TaskActivity[])
      }
    } else {
      const { data, error: fetchError } = await supabase
        .from('task_activity')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false })

      if (fetchError) {
        setError(fetchError.message)
      } else {
        setActivity(data ?? [])
      }
    }

    setLoading(false)
  }, [taskId, includeAuthors])

  useEffect(() => {
    void fetchActivity()
  }, [fetchActivity])

  useEffect(() => {
    if (!taskId) return

    const channel = supabase
      .channel(`activity:${taskId}:${subscriptionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_activity',
          filter: `task_id=eq.${taskId}`,
        },
        () => {
          void fetchActivity()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [taskId, subscriptionId, fetchActivity])

  return { activity, loading, error, refetch: fetchActivity }
}

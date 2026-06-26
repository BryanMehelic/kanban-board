import { useCallback, useEffect, useId, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { TaskComment } from '../types/database'

export function useTaskComments(taskId: string | null, includeAuthors = false) {
  const subscriptionId = useId()
  const [comments, setComments] = useState<TaskComment[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchComments = useCallback(async () => {
    if (!taskId) {
      setComments([])
      return
    }

    setLoading(true)
    setError(null)

    if (includeAuthors) {
      const { data, error: fetchError } = await supabase.rpc('get_task_comments_with_authors', {
        p_task_id: taskId,
      })

      if (fetchError) {
        setError(fetchError.message)
      } else {
        setComments((data ?? []) as TaskComment[])
      }
    } else {
      const { data, error: fetchError } = await supabase
        .from('task_comments')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: true })

      if (fetchError) {
        setError(fetchError.message)
      } else {
        setComments(data ?? [])
      }
    }

    setLoading(false)
  }, [taskId, includeAuthors])

  useEffect(() => {
    void fetchComments()
  }, [fetchComments])

  useEffect(() => {
    if (!taskId) return

    const channel = supabase
      .channel(`comments:${taskId}:${subscriptionId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_comments',
          filter: `task_id=eq.${taskId}`,
        },
        () => {
          void fetchComments()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [taskId, subscriptionId, fetchComments])

  const addComment = useCallback(
    async (body: string, userId: string) => {
      if (!taskId) throw new Error('No task selected')

      setSaving(true)
      setError(null)

      const { error: insertError } = await supabase
        .from('task_comments')
        .insert({ task_id: taskId, user_id: userId, body })

      setSaving(false)

      if (insertError) {
        setError(insertError.message)
        throw insertError
      }

      await fetchComments()
    },
    [taskId, fetchComments],
  )

  const deleteComment = useCallback(
    async (commentId: string) => {
      setSaving(true)
      setError(null)

      const { error: deleteError } = await supabase
        .from('task_comments')
        .delete()
        .eq('id', commentId)

      setSaving(false)

      if (deleteError) {
        setError(deleteError.message)
        throw deleteError
      }

      await fetchComments()
    },
    [fetchComments],
  )

  return {
    comments,
    loading,
    error,
    saving,
    addComment,
    deleteComment,
    refetch: fetchComments,
  }
}

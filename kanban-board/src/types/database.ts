export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export interface Task {
  id: string
  title: string
  status: TaskStatus
  user_id: string
  team_id: string | null
  description: string | null
  due_date: string | null
  assignee_id: string | null
  priority: TaskPriority
  position: number
  created_at: string
}

export interface Team {
  id: string
  name: string
  owner_id: string
  created_at: string
}

export interface TeamMember {
  team_id: string
  user_id: string
  role: 'owner' | 'member'
  joined_at: string
}

export interface TeamInvite {
  id: string
  team_id: string
  email: string
  invited_by: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
  teams?: Pick<Team, 'name'> | null
}

export interface TaskComment {
  id: string
  task_id: string
  user_id: string
  body: string
  created_at: string
  author_email?: string | null
}

export interface TaskActivity {
  id: string
  task_id: string
  actor_id: string | null
  action: string
  from_value: string | null
  to_value: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  actor_email?: string | null
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      tasks: {
        Row: Task
        Insert: {
          id?: string
          title: string
          status?: TaskStatus
          user_id: string
          team_id?: string | null
          description?: string | null
          due_date?: string | null
          assignee_id?: string | null
          priority?: TaskPriority
          position?: number
          created_at?: string
        }
        Update: {
          id?: string
          title?: string
          status?: TaskStatus
          user_id?: string
          team_id?: string | null
          description?: string | null
          due_date?: string | null
          assignee_id?: string | null
          priority?: TaskPriority
          position?: number
          created_at?: string
        }
        Relationships: []
      }
      teams: {
        Row: Team
        Insert: {
          id?: string
          name: string
          owner_id: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          owner_id?: string
          created_at?: string
        }
        Relationships: []
      }
      team_members: {
        Row: TeamMember
        Insert: {
          team_id: string
          user_id: string
          role: 'owner' | 'member'
          joined_at?: string
        }
        Update: {
          team_id?: string
          user_id?: string
          role?: 'owner' | 'member'
          joined_at?: string
        }
        Relationships: []
      }
      team_invites: {
        Row: TeamInvite
        Insert: {
          id?: string
          team_id: string
          email: string
          invited_by: string
          status?: 'pending' | 'accepted' | 'declined'
          created_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          email?: string
          invited_by?: string
          status?: 'pending' | 'accepted' | 'declined'
          created_at?: string
        }
        Relationships: []
      }
      task_comments: {
        Row: TaskComment
        Insert: {
          id?: string
          task_id: string
          user_id: string
          body: string
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          user_id?: string
          body?: string
          created_at?: string
        }
        Relationships: []
      }
      task_activity: {
        Row: TaskActivity
        Insert: {
          id?: string
          task_id: string
          actor_id?: string | null
          action: string
          from_value?: string | null
          to_value?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          actor_id?: string | null
          action?: string
          from_value?: string | null
          to_value?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
  }
}

# Database Schema (Read-Only Reference)

This document satisfies the requirement to **share read-only access to the database schema** by including the complete Supabase/PostgreSQL DDL.

## Where the full SQL lives

The entire schema is in one file:

**[`supabase/schema.sql`](../supabase/schema.sql)**

Copy that file into your final report/PDF as an appendix, or link to it in your GitHub repository.

## Schema overview

| Object | Purpose |
|--------|---------|
| `tasks` | Kanban cards (title, status, priority, due date, team_id) |
| `teams` | Shared team workspaces |
| `team_members` | Team membership (owner / member) |
| `team_invites` | Pending email invites |
| `task_comments` | Comments on tasks |
| `task_activity` | Audit log (status changes, comments, etc.) |
| `profiles` | User emails for team author display |
| RLS policies | Users only access their own data or shared team data |
| RPC functions | `create_team_with_owner`, `get_task_activity_with_authors`, etc. |

### Enum types

- `task_status`: `todo`, `in_progress`, `in_review`, `done`
- `task_priority`: `low`, `medium`, `high`

## How reviewers can inspect the schema (read-only)

### Option 1 — SQL file in your repo (recommended for assignments)

1. Push the project to GitHub.
2. Point reviewers to [`supabase/schema.sql`](../supabase/schema.sql).
3. In your write-up, add: *“Full database schema is in `supabase/schema.sql`; no write access to the live database is required.”*

### Option 2 — Export from Supabase Dashboard

1. Open your project → **SQL Editor**.
2. Run:

```sql
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;
```

3. For a full DDL dump, use **Database → Schema Visualizer** (diagram) or install the [Supabase CLI](https://supabase.com/docs/guides/cli) and run:

```bash
supabase db dump --schema-only -f schema_export.sql
```

Paste the output into your final document.

### Option 3 — Invite a reviewer to Supabase (optional)

1. Supabase Dashboard → **Project Settings → Team** (or Organization members).
2. Invite with **Read-only** / **Developer** role if your plan supports it.
3. They can use **Table Editor** and **Schema Visualizer** without changing data.

On the **free tier**, the simplest approach for graders is still **Option 1**: the SQL file in GitHub.

## Reproduce the schema on a new Supabase project

1. Create a new Supabase project.
2. Enable **Anonymous sign-ins** under Authentication → Providers.
3. SQL Editor → paste and run the entire contents of [`schema.sql`](../supabase/schema.sql).

## Migration history (incremental)

If the live database was built step-by-step, these files were applied in order:

1. `migrations/001_initial.sql` — core tables, RLS, Realtime
2. `migrations/003_create_team_rpc.sql` — team creation fix (if needed)
3. `migrations/006_activity_authors_rpc.sql` — profiles + author emails

The consolidated [`schema.sql`](../supabase/schema.sql) reflects the **final** state after all changes.

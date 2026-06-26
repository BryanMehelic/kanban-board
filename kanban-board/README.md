# Kanban Board

A real-time Kanban task board built with React, Vite, and Supabase. Guest users get an anonymous session on first launch; upgraded accounts can create teams, invite members, and share boards.

## Features

- Four default columns: **To Do**, **In Progress**, **In Review**, **Done**
- Drag-and-drop task management with real-time sync
- Guest sessions via Supabase anonymous auth
- Account upgrade (email + password) preserves your tasks
- Team boards with member invites
- Task comments and activity history

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- A [Supabase](https://supabase.com/) project (free tier)

## Supabase setup

1. Create a new Supabase project.
2. Go to **Authentication → Providers** and enable **Anonymous sign-ins**.
3. Open the **SQL Editor** and run migrations:

   **New project (first time):**
   1. Run [`supabase/migrations/001_initial.sql`](supabase/migrations/001_initial.sql) — creates all tables, RLS, and the team RPC
   2. Skip 002 and 003 if 001 already includes the RPC (current version of 001 does)

   **Existing project (you already ran 001 earlier):**
   1. Run [`supabase/migrations/003_create_team_rpc.sql`](supabase/migrations/003_create_team_rpc.sql) if team creation fails
   2. Run [`supabase/migrations/006_activity_authors_rpc.sql`](supabase/migrations/006_activity_authors_rpc.sql) — self-contained; creates `profiles` + author RPCs (skips 004/005)
   3. Do **not** re-run 001 — you will get errors like `type "task_status" already exists`

4. Confirm Realtime is enabled for `tasks`, `task_comments`, `task_activity`, and `team_members` (the migration adds them to `supabase_realtime`).

## Local development

1. Clone or copy this repository.

2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy the environment template and add your Supabase credentials:

   ```bash
   cp .env.example .env.local
   ```

   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

5. Open the URL shown in the terminal (usually `http://localhost:5173`).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview production build |

## GitHub

Git is not required for local development. When you are ready to publish, initialize a repository and push to GitHub:

```bash
git init
git add .
git commit -m "Initial Kanban board app"
git remote add origin https://github.com/YOUR_USER/kanban-board.git
git push -u origin main
```

> **Note:** Install [Git](https://git-scm.com/) if `git` is not available in your terminal.

## Database schema (read-only sharing)

For assignments or reviewers, the **complete SQL schema** is documented in:

- [`supabase/schema.sql`](supabase/schema.sql) — full DDL (paste into your final document)
- [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) — overview and how to share read-only access

## Architecture

- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **Drag-and-drop:** `@dnd-kit`
- **Backend:** Supabase (Postgres, Auth, Realtime, RLS)
- **Auth:** Anonymous guest on first visit; `updateUser` upgrades to permanent account
- **Teams:** Shared boards via `team_id`; RLS restricts access to team members

## Database tables

| Table | Purpose |
|---|---|
| `tasks` | Kanban cards |
| `teams` | Shared workspaces |
| `team_members` | Team membership |
| `team_invites` | Pending email invites |
| `task_comments` | Task discussion |
| `task_activity` | Change history (auto-logged via triggers) |

## License

MIT

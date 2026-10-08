# LinkedIn Autoposter

Claude drafts posts from your topics and voice, you approve them in a queue, and the app publishes them to your personal LinkedIn profile through the official API on a schedule.

**Stack:** Next.js 16 (App Router) · Supabase (Postgres + Storage) · Anthropic API · LinkedIn Posts & Images API · Vercel Cron

## Features

- **Three ways to fill the queue:** Claude writes N drafts across your topics, Claude writes N versions of a rough idea you give it, or you paste your own post.
- **Your voice, your rules.** Background/voice notes, an "always / never" rules box that overrides the defaults, a hashtag limit, and your most recent published posts are fed back to Claude as style examples.
- **Approval queue.** Nothing posts until you approve it. Approving assigns the next free slot (or the time you pick).
- **Rewrite with Claude:** one-click "Shorter", "Punchier hook", "More personal", or any instruction. The result lands in the editor for review; nothing is saved until you save.
- **LinkedIn-style preview** with the "…see more" fold, so you can judge the hook.
- **Images:** attach a JPG/PNG/GIF (≤ 4 MB) with alt text; it's uploaded to LinkedIn at publish time.
- **Time-zone-aware scheduling:** posting times in any IANA zone (DST-correct), per-weekday on/off, and a 60-minute minimum gap between posts.
- **Safe publishing:** atomic claim (no double posts), automatic retry for failures that can't have created the post (rate limits, gateway errors, image upload), honest "may or may not have posted" errors where the outcome is unknown, and recovery of posts stuck mid-publish.
- **Autopilot:** the cron can keep the draft queue topped up (drafts still need approval).
- **Activity log** of publishes, failures, generations, connections and token warnings.
- **Setup checklist** in the dashboard that says exactly which env var, schema step or connection is missing.
- **Security:** HTTP Basic auth on everything except the cron (which needs a Bearer secret), constant-time secret comparison, cross-site write blocking (Basic-auth credentials are sent cross-site by browsers, so CSRF is a real risk), OAuth `state` check, service-role key and LinkedIn token kept server-side.

## Setup (about 20 minutes)

### 1. Supabase
Create a project, open **SQL Editor**, paste and run [`supabase/schema.sql`](supabase/schema.sql). It creates the tables and a private `post-images` storage bucket. Copy the **Project URL** and the **service_role** key (Project Settings → API).

> Upgrading from an earlier version? Just run `schema.sql` again. It's idempotent and migrates the old fixed `utc_offset_minutes` setting to a time zone.

### 2. LinkedIn developer app
1. <https://www.linkedin.com/developers/apps> → **Create app** (it needs a LinkedIn Page to attach to; a placeholder page is fine).
2. **Products** tab → request **Share on LinkedIn** and **Sign In with LinkedIn using OpenID Connect** (both self-serve).
3. **Auth** tab → add redirect URL `https://YOUR-APP-URL/api/linkedin/callback` (and `http://localhost:3000/api/linkedin/callback` for local dev).
4. Copy the Client ID and Client Secret.

### 3. Environment variables
Copy `.env.example` to `.env.local` and fill it in. Set the same values in Vercel → Project → Settings → Environment Variables. Generate secrets with `openssl rand -hex 32`.

| Variable | What it is |
|---|---|
| `APP_URL` | Public URL, no trailing slash |
| `ADMIN_PASSWORD` | Dashboard password (any username) |
| `CRON_SECRET` | Bearer secret for `/api/cron/publish` |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | From step 1 |
| `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | From step 2 |
| `LINKEDIN_VERSION` | LinkedIn API version, `YYYYMM` (default `202608`) |
| `ANTHROPIC_API_KEY` | From console.anthropic.com |
| `ANTHROPIC_MODEL` | Default `claude-sonnet-5-5` |

### 4. Run / deploy
```bash
npm install
npm run dev          # http://localhost:3000
vercel --prod        # or push to GitHub and import the repo in Vercel
```
Open the app (username anything, password = `ADMIN_PASSWORD`). Work through the setup checklist if it appears, click **Connect LinkedIn**, then fill in **Settings**: topics, voice, rules, time zone, posting times and days.

## How it works

```
Generate / idea / manual ─▶ draft ─(approve)─▶ approved + slot ─(cron or Post now)─▶ publishing ─▶ published
                                                     ▲                                  │
                                                     └──── retry (safe errors, ≤3) ◀────┤
                                                                                        └▶ failed (shows why)
```

- **Cron** (`GET|POST /api/cron/publish`, `Authorization: Bearer $CRON_SECRET`): fails any post stuck in `publishing` for over 10 minutes, publishes the single most overdue approved post (one per run, so it never bursts), tops up drafts if autopilot is on, and logs a token-expiry warning when the LinkedIn token has 7 days or less left.
- **Post now** publishes immediately, saving unsaved edits first.
- **Retries:** a failure that happens before the post request (image upload) or a 429/502/503/504 on it can't have created a post, so it's retried automatically 20 and 40 minutes later. A 500 or a timeout on the post request might have created it, so the post is marked failed and you're told to check LinkedIn before retrying.

## Things to know

- **Cron frequency:** `vercel.json` runs once a day at 06:00 UTC (08:00 SAST) because Vercel Hobby only allows daily crons, so at most one post a day goes out on Hobby. For exact posting times, either upgrade and change the schedule to `*/15 * * * *`, or point a free pinger such as [cron-job.org](https://cron-job.org) at `https://YOUR-APP-URL/api/cron/publish` every 15 minutes with header `Authorization: Bearer <CRON_SECRET>`.
- **Token expiry:** LinkedIn access tokens last 60 days and refresh tokens are partner-only. The dashboard warns you 7 days out; click **Reconnect** (two clicks).
- **API version:** LinkedIn retires each `LINKEDIN_VERSION` about 12 months after release, after which posting fails with `426`. The setup checklist flags the version once it's 10 months old; bump it to a recent `YYYYMM` from [LinkedIn's versioning page](https://learn.microsoft.com/linkedin/marketing/versioning) and redeploy.
- **Formatting:** LinkedIn doesn't render Markdown. The app escapes LinkedIn's reserved characters (an unescaped `(` can silently truncate a post) and turns `#tags` into real hashtags.
- **Claude:** drafts come back as schema-validated JSON (structured outputs). On supported models a refusal is retried server-side on a fallback model; otherwise you get a clear "Claude declined" message.
- **Security:** the LinkedIn token is stored in Supabase with RLS enabled and no policies, so only the service role key can read it. Keep that key out of the browser and out of git.
- **Review your drafts.** The prompt forbids invented stats, employers and anecdotes, but your name is on the post.

## Development

```bash
npm run typecheck   # next typegen + tsc
npm test            # vitest unit tests (scheduling/DST, LinkedIn escaping, validation, auth, prompts)
npm run build
```

CI (`.github/workflows/ci.yml`) runs all three on every push and pull request.

### Project layout

```
app/
  page.tsx                 dashboard (client)
  components/              PostCard, Composer, SettingsForm, LinkedInPreview, ActivityList, SetupChecklist
  api/
    cron/publish           scheduled job
    generate               Claude drafts (topics or idea)
    posts, posts/[id]      list/create, edit/approve/delete
    posts/[id]/publish     post now
    posts/[id]/rewrite     Claude rewrite (not saved)
    posts/[id]/image       upload/remove image
    posts/[id]/duplicate   copy to queue as draft
    settings, activity, health
    linkedin/connect|callback|disconnect
lib/
  schedule.ts              time-zone slot maths (pure)
  littletext.ts            LinkedIn commentary escaping + hashtags (pure)
  prompts.ts               Claude prompts + JSON schemas (pure)
  validate.ts, auth.ts     request validation, auth helpers (pure)
  claude.ts, linkedin.ts   API clients
  publish.ts, generate.ts  workflows
  supabase.ts, images.ts, activity.ts, health.ts
proxy.ts                   Basic auth + cross-site write blocking
supabase/schema.sql        idempotent schema + migrations
```

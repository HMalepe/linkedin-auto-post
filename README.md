# LinkedIn Autoposter

Claude drafts posts from your topics and voice, you approve them in a queue, and the app publishes them to your personal LinkedIn profile through the official API on a schedule.

**Stack:** Next.js (App Router) · Supabase · Anthropic API · LinkedIn Posts API · Vercel Cron

## Setup (about 20 minutes)

### 1. Supabase
Create a project, open the SQL editor, run `supabase/schema.sql`. Copy the project URL and the **service role** key.

### 2. LinkedIn developer app
1. https://www.linkedin.com/developers/apps → Create app (it needs a LinkedIn Page to attach to; a placeholder page is fine).
2. **Products** tab → request **Share on LinkedIn** and **Sign In with LinkedIn using OpenID Connect** (both self-serve).
3. **Auth** tab → add redirect URL: `https://YOUR-APP-URL/api/linkedin/callback` (add `http://localhost:3000/api/linkedin/callback` for local dev).
4. Copy the Client ID and Client Secret.

### 3. Env vars
Copy `.env.example` to `.env.local` (and set the same in Vercel → Project → Settings → Environment Variables). Generate `CRON_SECRET` and `ADMIN_PASSWORD` yourself.

### 4. Deploy
```bash
npm install
vercel --prod        # or push to GitHub and import in Vercel
```
Open the app (browser asks for a password: username anything, password = `ADMIN_PASSWORD`), click **Connect LinkedIn**, then **Settings**: add topics, your voice and background, posting times.

## How it works
- **Generate drafts** → Claude writes N posts, avoiding your recent ones. Nothing posts until you approve.
- **Approve** → assigns the next free posting slot (or the time you pick).
- **Cron** (`/api/cron/publish`) → publishes the next approved post that's due (max one per run), and optionally tops the draft queue back up.
- **Post now** publishes immediately.

## Things to know
- **Token expiry:** LinkedIn access tokens last 60 days and refresh tokens are partner-only. The app warns you 7 days out; click **Reconnect** (two clicks).
- **Cron frequency:** `vercel.json` runs once daily (06:00 UTC) because Vercel Hobby only allows daily crons. For exact posting times, either upgrade and change the schedule to `*/15 * * * *`, or point a free pinger such as cron-job.org at `GET /api/cron/publish` with header `Authorization: Bearer <CRON_SECRET>` every 15 minutes.
- **API version:** LinkedIn retires API versions roughly every 12 months. If posting starts returning a version error, bump `LINKEDIN_VERSION`.
- **Security:** the LinkedIn token is stored in Supabase with RLS enabled and no policies, so only the server's service role key can read it. Keep that key out of the browser and out of git.
- **Review your drafts.** The prompt forbids invented stats and credentials, but you're the one whose name is on the post.

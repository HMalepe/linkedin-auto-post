"use client";
import { useCallback, useEffect, useState } from "react";
import { api, errText, fmt, type Check, type Conn, type Post, type SettingsResponse } from "./components/api";
import { PostCard } from "./components/PostCard";
import { Composer } from "./components/Composer";
import { SettingsForm } from "./components/SettingsForm";
import { ActivityList } from "./components/ActivityList";
import { SetupChecklist } from "./components/SetupChecklist";

type Tab = "queue" | "published" | "activity" | "settings";
type Filter = "all" | "draft" | "approved" | "failed";

const STATUS_ORDER: Record<string, number> = { publishing: 0, approved: 1, failed: 2, draft: 3 };

export default function Home() {
  const [tab, setTab] = useState<Tab>("queue");
  const [filter, setFilter] = useState<Filter>("all");
  const [posts, setPosts] = useState<Post[]>([]);
  const [cfg, setCfg] = useState<SettingsResponse | null>(null);
  const [checks, setChecks] = useState<Check[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [p, s, h] = await Promise.allSettled([
      api<{ posts: Post[] }>("/api/posts"),
      api<SettingsResponse>("/api/settings"),
      api<{ checks: Check[] }>("/api/health"),
    ]);
    if (p.status === "fulfilled") setPosts(p.value.posts);
    if (s.status === "fulfilled") setCfg(s.value);
    if (h.status === "fulfilled") setChecks(h.value.checks);
    const firstErr = [p, s].find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
    setErr(firstErr ? errText(firstErr.reason) : null);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
    const q = new URLSearchParams(window.location.search);
    if (q.get("li_connected")) setFlash({ kind: "ok", text: "LinkedIn connected." });
    if (q.get("li_error")) setFlash({ kind: "bad", text: `LinkedIn: ${q.get("li_error")}` });
    if (q.size) window.history.replaceState({}, "", "/");
  }, [load]);

  // Keep "publishing" / just-scheduled posts fresh without a manual reload.
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && load(), 60_000);
    return () => clearInterval(t);
  }, [load]);

  const conn: Conn = cfg?.connection ?? { connected: false };
  const tz = cfg?.settings.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const daysLeft = conn.expires_at ? Math.floor((new Date(conn.expires_at).getTime() - Date.now()) / 86_400_000) : 0;

  const queue = posts
    .filter((p) => p.status !== "published")
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        (a.scheduled_for ?? "").localeCompare(b.scheduled_for ?? "") ||
        b.created_at.localeCompare(a.created_at),
    );
  const shown = filter === "all" ? queue : queue.filter((p) => p.status === filter);
  const published = posts
    .filter((p) => p.status === "published")
    .sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? ""));
  const nextUp = queue.find((p) => p.status === "approved" && p.scheduled_for);
  const counts = (s: Filter) => (s === "all" ? queue.length : queue.filter((p) => p.status === s).length);

  const disconnect = async () => {
    if (!confirm("Forget the stored LinkedIn token? Scheduled posts won't publish until you reconnect.")) return;
    try {
      await api("/api/linkedin/disconnect", "POST");
      await load();
    } catch (e) {
      setErr(errText(e));
    }
  };

  // Key includes the fields the card copies into local state, so it resets when the server copy changes.
  const cardKey = (p: Post) => `${p.id}:${p.status}:${p.content.length}:${p.scheduled_for}:${p.image_path}:${p.image_alt}`;

  return (
    <main>
      <header>
        <div className="who">
          {conn.picture && <img className="avatar" src={conn.picture} alt="" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />}
          <div>
            <h1>LinkedIn Autoposter</h1>
            <div className="muted">{conn.connected ? `Connected as ${conn.name ?? "you"}` : "Not connected to LinkedIn"}</div>
          </div>
        </div>
        <div className="row" style={{ marginTop: 0 }}>
          {conn.connected && (
            <button className="danger" onClick={disconnect}>
              Disconnect
            </button>
          )}
          <a className={`btn ${conn.connected ? "" : "primary"}`} href="/api/linkedin/connect">
            {conn.connected ? "Reconnect" : "Connect LinkedIn"}
          </a>
        </div>
      </header>

      {flash && <div className={`banner ${flash.kind}`}>{flash.text}</div>}
      {conn.connected && daysLeft <= 0 && <div className="banner bad">Your LinkedIn token has expired. Reconnect or nothing will post.</div>}
      {conn.connected && daysLeft > 0 && daysLeft <= 7 && (
        <div className="banner warn">
          LinkedIn token expires in {daysLeft} day{daysLeft === 1 ? "" : "s"}. Reconnect before then (tokens last 60 days).
        </div>
      )}
      {err && <div className="banner bad">{err}</div>}
      <SetupChecklist checks={checks} />

      <div className="tabs">
        {(["queue", "published", "activity", "settings"] as const).map((t) => (
          <button key={t} className={`tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>
            {t === "queue" ? `Queue (${queue.length})` : t === "published" ? `Published (${published.length})` : t === "activity" ? "Activity" : "Settings"}
          </button>
        ))}
      </div>

      {tab === "queue" && (
        <>
          <Composer onChange={load} hasTopics={!!cfg?.settings.topics.length} />
          <div className="row between" style={{ marginBottom: 12 }}>
            <div className="row" style={{ marginTop: 0 }}>
              {(["all", "draft", "approved", "failed"] as const).map((f) => (
                <button key={f} className={`chip ${filter === f ? "on" : ""}`} onClick={() => setFilter(f)}>
                  {f === "approved" ? "scheduled" : f} ({counts(f)})
                </button>
              ))}
            </div>
            {nextUp && <span className="muted">Next post: {fmt(nextUp.scheduled_for, tz)}</span>}
          </div>
          {loaded && shown.length === 0 && (
            <div className="muted">{filter === "all" ? "Queue is empty. Generate some drafts." : "Nothing here."}</div>
          )}
          {shown.map((p) => (
            <PostCard key={cardKey(p)} post={p} tz={tz} conn={conn} maxHashtags={cfg?.settings.max_hashtags ?? 3} onChange={load} />
          ))}
        </>
      )}

      {tab === "published" && (
        <>
          {loaded && published.length === 0 && <div className="muted">Nothing published yet.</div>}
          {published.map((p) => (
            <PostCard key={cardKey(p)} post={p} tz={tz} conn={conn} maxHashtags={cfg?.settings.max_hashtags ?? 3} onChange={load} />
          ))}
        </>
      )}

      {tab === "activity" && <ActivityList tz={tz} />}

      {tab === "settings" && cfg && (
        <SettingsForm key={JSON.stringify(cfg.settings)} settings={cfg.settings} upcoming={cfg.upcoming} model={cfg.model} onSaved={load} />
      )}
      {tab === "settings" && !cfg && loaded && <div className="muted">Settings couldn't be loaded. Check the setup list above.</div>}
    </main>
  );
}

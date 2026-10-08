"use client";
import { useCallback, useEffect, useState } from "react";

type Post = {
  id: string; content: string; topic: string | null;
  status: "draft" | "approved" | "publishing" | "published" | "failed";
  scheduled_for: string | null; published_at: string | null; error: string | null;
};
type Settings = {
  topics: string[]; voice: string; post_times: string[]; utc_offset_minutes: number;
  auto_generate: boolean; queue_target: number;
};
type Conn = { connected: boolean; name?: string | null; expires_at?: string };

const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "unscheduled");

async function api<T = unknown>(url: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || `HTTP ${res.status}`);
  return json as T;
}

function PostCard({ post, onChange }: { post: Post; onChange: () => void }) {
  const [text, setText] = useState(post.content);
  const [when, setWhen] = useState(toLocalInput(post.scheduled_for));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(post.error);
  const locked = post.status === "published" || post.status === "publishing";
  const dirty = text !== post.content;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr(null);
    try { await fn(); onChange(); } catch (e) { setErr(e instanceof Error ? e.message : "failed"); }
    setBusy(false);
  };
  const iso = () => (when ? new Date(when).toISOString() : undefined);

  return (
    <div className="card">
      <div className="row between" style={{ marginTop: 0 }}>
        <span className={`badge ${post.status}`}>{post.status}</span>
        <span className="muted">
          {post.status === "published" ? `published ${fmt(post.published_at)}` : post.topic || ""}
        </span>
      </div>
      <div style={{ marginTop: 10 }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} disabled={locked} />
        <div className={`muted count ${text.length > 3000 ? "over" : ""}`}>{text.length} / 3000</div>
      </div>
      {!locked && (
        <div className="row">
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} style={{ width: "auto" }} />
          {post.status !== "approved" ? (
            <button className="primary" disabled={busy} onClick={() => run(() =>
              api(`/api/posts/${post.id}`, "PATCH", { content: text, status: "approved", scheduled_for: iso() }))}>
              Approve{when ? "" : " (next slot)"}
            </button>
          ) : (
            <>
              <button disabled={busy} onClick={() => run(() =>
                api(`/api/posts/${post.id}`, "PATCH", { content: text, scheduled_for: iso() }))}>Reschedule</button>
              <button disabled={busy} onClick={() => run(() =>
                api(`/api/posts/${post.id}`, "PATCH", { status: "draft" }))}>Unapprove</button>
            </>
          )}
          {dirty && post.status !== "approved" && (
            <button disabled={busy} onClick={() => run(() => api(`/api/posts/${post.id}`, "PATCH", { content: text }))}>Save</button>
          )}
          <button disabled={busy} onClick={() => {
            if (confirm("Publish this to LinkedIn right now?"))
              run(async () => {
                if (dirty) await api(`/api/posts/${post.id}`, "PATCH", { content: text });
                await api(`/api/posts/${post.id}/publish`, "POST");
              });
          }}>Post now</button>
          <button className="danger" disabled={busy} onClick={() => run(() => api(`/api/posts/${post.id}`, "DELETE"))}>Delete</button>
        </div>
      )}
      {post.status === "approved" && post.scheduled_for && (
        <div className="muted" style={{ marginTop: 8 }}>Goes out {fmt(post.scheduled_for)}</div>
      )}
      {err && <div className="err">{err}</div>}
    </div>
  );
}

function SettingsForm({ settings, onSaved }: { settings: Settings; onSaved: () => void }) {
  const [topics, setTopics] = useState(settings.topics.join("\n"));
  const [voice, setVoice] = useState(settings.voice);
  const [times, setTimes] = useState(settings.post_times.join(", "));
  const [offset, setOffset] = useState(settings.utc_offset_minutes);
  const [auto, setAuto] = useState(settings.auto_generate);
  const [target, setTarget] = useState(settings.queue_target);
  const [msg, setMsg] = useState("");

  const save = async () => {
    try {
      await api("/api/settings", "PUT", {
        topics: topics.split("\n"), voice,
        post_times: times.split(",").map((t) => t.trim()).filter(Boolean),
        utc_offset_minutes: offset, auto_generate: auto, queue_target: target,
      });
      setMsg("Saved"); onSaved();
    } catch (e) { setMsg(e instanceof Error ? e.message : "failed"); }
  };

  return (
    <div className="card">
      <label>Topics (one per line)</label>
      <textarea value={topics} onChange={(e) => setTopics(e.target.value)} style={{ minHeight: 110 }} />
      <label>Voice and background (who you are, what you can credibly say, tone)</label>
      <textarea value={voice} onChange={(e) => setVoice(e.target.value)} />
      <label>Posting times (local, 24h, comma separated, e.g. 08:00, 17:30)</label>
      <input type="text" value={times} onChange={(e) => setTimes(e.target.value)} />
      <label>UTC offset in minutes (South Africa = 120)</label>
      <input type="number" value={offset} onChange={(e) => setOffset(Number(e.target.value))} />
      <label>
        <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />{" "}
        Auto-generate drafts when the daily job runs (drafts still need your approval)
      </label>
      <label>Keep this many drafts/approved posts in the queue</label>
      <input type="number" min={1} max={20} value={target} onChange={(e) => setTarget(Number(e.target.value))} />
      <div className="row">
        <button className="primary" onClick={save}>Save settings</button>
        <span className="muted">{msg}</span>
      </div>
    </div>
  );
}

export default function Home() {
  const [tab, setTab] = useState<"queue" | "published" | "settings">("queue");
  const [posts, setPosts] = useState<Post[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [conn, setConn] = useState<Conn>({ connected: false });
  const [count, setCount] = useState(3);
  const [gen, setGen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);
  const [manual, setManual] = useState("");

  const load = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([
        api<{ posts: Post[] }>("/api/posts"),
        api<{ settings: Settings; connection: Conn }>("/api/settings"),
      ]);
      setPosts(p.posts); setSettings(s.settings); setConn(s.connection);
    } catch (e) { setErr(e instanceof Error ? e.message : "failed to load"); }
  }, []);

  useEffect(() => {
    load();
    const q = new URLSearchParams(window.location.search);
    if (q.get("li_connected")) setFlash({ kind: "ok", text: "LinkedIn connected." });
    if (q.get("li_error")) setFlash({ kind: "bad", text: `LinkedIn: ${q.get("li_error")}` });
    if (q.size) window.history.replaceState({}, "", "/");
  }, [load]);

  const generate = async () => {
    setGen(true); setErr(null);
    try { await api("/api/generate", "POST", { count }); await load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "failed"); }
    setGen(false);
  };

  const daysLeft = conn.expires_at ? Math.floor((new Date(conn.expires_at).getTime() - Date.now()) / 86_400_000) : 0;
  const queue = posts.filter((p) => p.status !== "published")
    .sort((a, b) => (a.scheduled_for ?? "9").localeCompare(b.scheduled_for ?? "9"));
  const published = posts.filter((p) => p.status === "published");

  return (
    <main>
      <header>
        <div>
          <h1>LinkedIn Autoposter</h1>
          <div className="muted">
            {conn.connected ? `Connected as ${conn.name ?? "you"}` : "Not connected to LinkedIn"}
          </div>
        </div>
        <a className={`btn ${conn.connected ? "" : "primary"}`} href="/api/linkedin/connect">
          {conn.connected ? "Reconnect" : "Connect LinkedIn"}
        </a>
      </header>

      {flash && <div className={`banner ${flash.kind}`}>{flash.text}</div>}
      {conn.connected && daysLeft <= 0 && <div className="banner bad">Your LinkedIn token has expired. Reconnect or nothing will post.</div>}
      {conn.connected && daysLeft > 0 && daysLeft <= 7 && (
        <div className="banner warn">LinkedIn token expires in {daysLeft} day{daysLeft === 1 ? "" : "s"}. Reconnect before then (tokens last 60 days).</div>
      )}
      {err && <div className="banner bad">{err}</div>}

      <div className="tabs">
        {(["queue", "published", "settings"] as const).map((t) => (
          <button key={t} className={`tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>
            {t === "queue" ? `Queue (${queue.length})` : t === "published" ? `Published (${published.length})` : "Settings"}
          </button>
        ))}
      </div>

      {tab === "queue" && (
        <>
          <div className="card">
            <div className="row" style={{ marginTop: 0 }}>
              <button className="primary" onClick={generate} disabled={gen}>{gen ? "Writing…" : "Generate drafts"}</button>
              <input type="number" min={1} max={7} value={count} onChange={(e) => setCount(Number(e.target.value))} style={{ width: 70 }} />
              <span className="muted">drafts from your topics and voice</span>
            </div>
            <div style={{ marginTop: 12 }}>
              <textarea placeholder="Or paste a post you wrote yourself…" value={manual} onChange={(e) => setManual(e.target.value)} style={{ minHeight: 70 }} />
              <div className="row">
                <button disabled={!manual.trim()} onClick={async () => {
                  try { await api("/api/posts", "POST", { content: manual }); setManual(""); load(); }
                  catch (e) { setErr(e instanceof Error ? e.message : "failed"); }
                }}>Add to queue</button>
              </div>
            </div>
          </div>
          {queue.length === 0 && <div className="muted">Queue is empty. Generate some drafts.</div>}
          {queue.map((p) => <PostCard key={p.id + p.status + p.content.length} post={p} onChange={load} />)}
        </>
      )}

      {tab === "published" && (
        <>
          {published.length === 0 && <div className="muted">Nothing published yet.</div>}
          {published.map((p) => <PostCard key={p.id} post={p} onChange={load} />)}
        </>
      )}

      {tab === "settings" && settings && <SettingsForm settings={settings} onSaved={load} />}
    </main>
  );
}

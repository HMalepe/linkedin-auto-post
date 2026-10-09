"use client";
import { useCallback, useEffect, useState } from "react";
import { api, errText, type Check, type Conn, type Post, type SettingsResponse } from "./components/api";
import { PostCard } from "./components/PostCard";
import { Composer } from "./components/Composer";
import { SettingsForm } from "./components/SettingsForm";
import { ActivityList } from "./components/ActivityList";
import { SetupChecklist } from "./components/SetupChecklist";
import { AccountPanel } from "./components/AccountPanel";
import { NextUp } from "./components/NextUp";
import { Rail, TabBar, TopBar, TABS, type Tab } from "./components/Nav";
import { Icon } from "./components/Icon";
import { useUi } from "./components/ui";

type Filter = "all" | "draft" | "approved" | "failed";

const STATUS_ORDER: Record<string, number> = { publishing: 0, approved: 1, failed: 2, draft: 3 };
const FILTERS: [Filter, string][] = [
  ["all", "All"],
  ["draft", "Drafts"],
  ["approved", "Scheduled"],
  ["failed", "Failed"],
];

export default function Home() {
  const { confirm, toast } = useUi();
  const [tab, setTab] = useState<Tab>("queue");
  const [filter, setFilter] = useState<Filter>("all");
  const [posts, setPosts] = useState<Post[]>([]);
  const [cfg, setCfg] = useState<SettingsResponse | null>(null);
  const [checks, setChecks] = useState<Check[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  const load = useCallback(async () => {
    const [p, s, h] = await Promise.allSettled([
      api<{ posts: Post[] }>("/api/posts"),
      api<SettingsResponse>("/api/settings"),
      api<{ checks: Check[] }>("/api/health"),
    ]);
    // A 401 means the session ended: go to the sign-in page instead of showing an error.
    if ([p, s, h].some((r) => r.status === "rejected" && /not signed in/i.test(errText(r.reason)))) {
      window.location.assign("/login");
      return;
    }
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
    if (q.get("li_connected")) toast("ok", "LinkedIn connected.");
    if (q.get("li_error")) toast("bad", `LinkedIn: ${q.get("li_error")}`);
    if (q.size) window.history.replaceState({}, "", "/");
  }, [load, toast]);

  // Keep "publishing" / just-scheduled posts fresh without a manual reload.
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && load(), 60_000);
    return () => clearInterval(t);
  }, [load]);

  const conn: Conn = cfg?.connection ?? { connected: false };
  const tz = cfg?.settings.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const daysLeft = conn.expires_at ? Math.floor((new Date(conn.expires_at).getTime() - Date.now()) / 86_400_000) : 0;
  const maxHashtags = cfg?.settings.max_hashtags ?? 3;

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
  const counts = (f: Filter) => (f === "all" ? queue.length : queue.filter((p) => p.status === f).length);

  const disconnect = async () => {
    const ok = await confirm({
      title: "Disconnect LinkedIn?",
      body: "The stored token is forgotten. Scheduled posts won't publish until you reconnect.",
      confirmLabel: "Disconnect",
      danger: true,
    });
    if (!ok) return;
    try {
      await api("/api/linkedin/disconnect", "POST");
      toast("ok", "LinkedIn disconnected.");
      await load();
    } catch (e) {
      toast("bad", errText(e));
    }
  };

  const signOut = async () => {
    try {
      await api("/api/auth/logout", "POST");
    } finally {
      window.location.assign("/login");
    }
  };

  const openPost = (p: Post) => {
    setTab("queue");
    setFilter("all");
    setTimeout(() => document.getElementById(`post-${p.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };

  // Key includes the fields the card copies into local state, so it resets when the server copy changes.
  const cardKey = (p: Post) => `${p.id}:${p.status}:${p.content.length}:${p.scheduled_for}:${p.image_path}:${p.image_alt}`;
  const card = (p: Post) => <PostCard key={cardKey(p)} post={p} tz={tz} conn={conn} maxHashtags={maxHashtags} onChange={load} />;

  const goTab = (t: Tab) => {
    setTab(t);
    window.scrollTo({ top: 0 });
  };
  const title = TABS.find((t) => t.id === tab)?.label;

  return (
    <div className="app">
      <Rail tab={tab} onTab={goTab} counts={{ queue: queue.length, published: published.length }} conn={conn} daysLeft={daysLeft} onNew={() => setComposerOpen(true)} onSignOut={signOut} />
      <TopBar conn={conn} daysLeft={daysLeft} onConn={() => goTab("settings")} onNew={() => setComposerOpen(true)} />

      <main className="main" id="main">
        <h1 className="page-title">{title}</h1>

        <div className="stack">
          {conn.connected && daysLeft <= 0 && (
            <div className="notice notice--bad" role="alert">
              <Icon name="alert" size={20} />
              <div className="notice__body">Your LinkedIn access has expired, so nothing will post. Reconnect in Settings.</div>
            </div>
          )}
          {conn.connected && daysLeft > 0 && daysLeft <= 7 && (
            <div className="notice notice--warn">
              <Icon name="alert" size={20} />
              <div className="notice__body">
                LinkedIn access expires in {daysLeft} day{daysLeft === 1 ? "" : "s"}. Reconnect before then. It lasts 60 days.
              </div>
            </div>
          )}
          {err && (
            <div className="notice notice--bad" role="alert">
              <Icon name="alert" size={20} />
              <div className="notice__body">{err}</div>
            </div>
          )}

          {tab === "queue" && (
            <>
              <SetupChecklist checks={checks} />

              {loaded && !conn.connected && (
                <section className="panel">
                  <h2 className="panel__title">Connect LinkedIn</h2>
                  <p className="panel__lede">Approve access once and Autoposter can publish to your profile on schedule.</p>
                  <a className="btn btn--primary" style={{ marginTop: 14 }} href="/api/linkedin/connect">
                    Connect LinkedIn
                  </a>
                </section>
              )}

              <NextUp post={nextUp} tz={tz} onOpen={openPost} onNew={() => setComposerOpen(true)} />

              <div className="seg" role="group" aria-label="Filter the queue">
                {FILTERS.map(([f, label]) => (
                  <button key={f} className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                    {label} <span className="chip__n">{counts(f)}</span>
                  </button>
                ))}
              </div>

              {loaded && queue.length === 0 && (
                <section className="panel">
                  <h2 className="panel__title">Your queue is empty</h2>
                  <p className="panel__lede">Have Claude draft a few posts from your topics, or write your own.</p>
                  <button className="btn btn--primary" style={{ marginTop: 14 }} onClick={() => setComposerOpen(true)}>
                    <Icon name="plus" size={20} /> New post
                  </button>
                </section>
              )}
              {loaded && queue.length > 0 && shown.length === 0 && <p className="muted">Nothing here.</p>}
              {shown.map(card)}
            </>
          )}

          {tab === "published" && (
            <>
              {loaded && published.length === 0 && (
                <section className="panel">
                  <h2 className="panel__title">Nothing published yet</h2>
                  <p className="panel__lede">Approved posts show up here after they go out.</p>
                </section>
              )}
              {published.map(card)}
            </>
          )}

          {tab === "activity" && <ActivityList tz={tz} />}

          {tab === "settings" && (
            <>
              <AccountPanel conn={conn} daysLeft={daysLeft} onDisconnect={disconnect} onSignOut={signOut} />
              {cfg ? (
                <SettingsForm key={JSON.stringify(cfg.settings)} settings={cfg.settings} upcoming={cfg.upcoming} model={cfg.model} onSaved={load} />
              ) : (
                loaded && <p className="muted">Settings couldn&apos;t be loaded. Check the setup list in your queue.</p>
              )}
            </>
          )}
        </div>
      </main>

      <TabBar tab={tab} onTab={goTab} counts={{ queue: queue.length }} />

      <Composer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        hasTopics={!!cfg?.settings.topics.length}
        onDone={(msg) => {
          setComposerOpen(false);
          setTab("queue");
          toast("ok", msg);
          load();
        }}
      />
    </div>
  );
}

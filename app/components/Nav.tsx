"use client";
import { Icon, Logo, type IconName } from "./Icon";
import type { Conn } from "./api";

export type Tab = "queue" | "published" | "activity" | "settings";

export const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: "queue", label: "Queue", icon: "queue" },
  { id: "published", label: "Published", icon: "published" },
  { id: "activity", label: "Activity", icon: "activity" },
  { id: "settings", label: "Settings", icon: "settings" },
];

type Counts = Partial<Record<Tab, number>>;

export function connState(conn: Conn, daysLeft: number) {
  if (!conn.connected) return { tone: "off", label: "Not connected" } as const;
  if (daysLeft <= 0) return { tone: "off", label: "Token expired" } as const;
  if (daysLeft <= 7) return { tone: "warn", label: `Expires in ${daysLeft} d` } as const;
  return { tone: "ok", label: "Connected" } as const;
}

export function Avatar({ conn, large }: { conn: Conn; large?: boolean }) {
  const cls = `avatar${large ? " avatar--lg" : ""}`;
  return conn.picture ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className={cls} src={conn.picture} alt="" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
  ) : (
    <span className={cls} />
  );
}

export function TopBar(props: { conn: Conn; daysLeft: number; onConn: () => void; onNew: () => void }) {
  const s = connState(props.conn, props.daysLeft);
  return (
    <header className="topbar">
      <div className="brand">
        <Logo size={30} />
        <span className="brand__name">Autoposter</span>
      </div>
      <div className="topbar__actions">
        <button className="conn" onClick={props.onConn} aria-label={`LinkedIn: ${s.label}. Open settings`}>
          <span className={`dot dot--${s.tone}`} />
          {s.label}
        </button>
        <button className="btn btn--primary newpost" onClick={props.onNew} aria-label="New post">
          <Icon name="plus" size={22} />
        </button>
      </div>
    </header>
  );
}

export function TabBar(props: { tab: Tab; onTab: (t: Tab) => void; counts: Counts }) {
  return (
    <nav className="tabbar" aria-label="Sections">
      {TABS.map((t) => (
        <button key={t.id} className="tab" aria-current={props.tab === t.id ? "page" : undefined} onClick={() => props.onTab(t.id)}>
          <Icon name={t.icon} />
          {t.label}
          {t.id === "queue" && !!props.counts.queue && <span className="tab__badge">{props.counts.queue}</span>}
        </button>
      ))}
    </nav>
  );
}

export function Rail(props: {
  tab: Tab;
  onTab: (t: Tab) => void;
  counts: Counts;
  conn: Conn;
  daysLeft: number;
  onNew: () => void;
  onSignOut: () => void;
}) {
  const s = connState(props.conn, props.daysLeft);
  return (
    <aside className="rail">
      <div className="brand">
        <Logo size={34} />
        <span className="brand__name">Autoposter</span>
      </div>

      <button className="btn btn--primary btn--block" onClick={props.onNew}>
        <Icon name="plus" size={20} /> New post
      </button>

      <nav className="rail__nav" aria-label="Sections">
        {TABS.map((t) => (
          <button key={t.id} className="nav__item" aria-current={props.tab === t.id ? "page" : undefined} onClick={() => props.onTab(t.id)}>
            <Icon name={t.icon} />
            {t.label}
            {props.counts[t.id] !== undefined && <span className="nav__count">{props.counts[t.id]}</span>}
          </button>
        ))}
      </nav>

      <div className="rail__foot">
        <button className="account" onClick={() => props.onTab("settings")}>
          <Avatar conn={props.conn} large />
          <span className="account__text">
            <span className="account__name">{props.conn.name ?? "LinkedIn"}</span>
            <span className="status">
              <span className={`dot dot--${s.tone}`} />
              {s.label}
            </span>
          </span>
        </button>
        <button className="btn btn--quiet btn--sm" onClick={props.onSignOut}>
          <Icon name="logout" size={18} /> Sign out
        </button>
      </div>
    </aside>
  );
}

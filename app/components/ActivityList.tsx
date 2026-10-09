"use client";
import { useEffect, useState } from "react";
import { api, errText, fmt, type Activity } from "./api";
import { Icon } from "./Icon";

export function ActivityList(props: { tz: string }) {
  const [items, setItems] = useState<Activity[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = () =>
    api<{ activity: Activity[] }>("/api/activity")
      .then((r) => {
        setItems(r.activity);
        setErr(null);
      })
      .catch((e) => setErr(errText(e)));

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="panel">
      <div className="row between">
        <p className="muted">Publishes, generations and errors, newest first.</p>
        <button className="btn btn--quiet btn--sm" onClick={load}>
          <Icon name="refresh" size={18} /> Refresh
        </button>
      </div>
      {err && <p className="err" style={{ marginTop: 10 }}>{err}</p>}
      {!items && !err && <p className="muted" style={{ marginTop: 14 }}>Loading…</p>}
      {items && items.length === 0 && <p className="muted" style={{ marginTop: 14 }}>Nothing yet. Activity shows up here after the first publish or draft run.</p>}
      {items && items.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, marginTop: 12 }}>
          {items.map((a) => (
            <li key={a.id} className="log">
              <span className={`log__dot ${a.ok ? "" : "log__dot--bad"}`} aria-label={a.ok ? "OK" : "Problem"} />
              <div className="log__main">
                <div className="log__top">
                  <span className="log__kind">{a.kind}</span>
                  <span className="muted">{fmt(a.at, props.tz)}</span>
                </div>
                <p className={`log__msg ${a.ok ? "" : "log__msg--bad"}`}>{a.message}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

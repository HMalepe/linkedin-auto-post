"use client";
import { useEffect, useState } from "react";
import { api, errText, fmt, type Activity } from "./api";

export function ActivityList(props: { tz: string }) {
  const [items, setItems] = useState<Activity[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = () =>
    api<{ activity: Activity[] }>("/api/activity")
      .then((r) => setItems(r.activity))
      .catch((e) => setErr(errText(e)));

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="card">
      <div className="row between" style={{ marginTop: 0 }}>
        <h2 style={{ margin: 0 }}>Activity</h2>
        <button onClick={load}>Refresh</button>
      </div>
      {err && <div className="err">{err}</div>}
      {items && items.length === 0 && <div className="muted" style={{ marginTop: 10 }}>Nothing logged yet.</div>}
      {items && items.length > 0 && (
        <ul className="activity" style={{ marginTop: 10 }}>
          {items.map((a) => (
            <li key={a.id}>
              <span className="muted">{fmt(a.at, props.tz)}</span>
              <span className={a.ok ? "muted" : "bad"}>{a.kind}</span>
              <span className={a.ok ? "" : "bad"} style={{ overflowWrap: "anywhere" }}>{a.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

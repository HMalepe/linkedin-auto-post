"use client";
import type { Check } from "./api";

export function SetupChecklist(props: { checks: Check[] }) {
  const failing = props.checks.filter((c) => !c.ok);
  if (!failing.length) return null;
  return (
    <div className="card" style={{ borderColor: "var(--warn)" }}>
      <h2>Finish setting up</h2>
      <ul className="checklist">
        {props.checks.map((c) => (
          <li key={c.id}>
            <span aria-hidden>{c.ok ? "✅" : "⬜"}</span>
            <span>
              {c.label}
              {!c.ok && c.hint && <div className="muted">{c.hint}</div>}
            </span>
          </li>
        ))}
      </ul>
      <div className="muted" style={{ marginTop: 8 }}>
        Environment variables are set in <code>.env.local</code> locally, or in Vercel → Project → Settings → Environment Variables (redeploy after changing them).
      </div>
    </div>
  );
}

"use client";
import type { Check } from "./api";
import { Icon } from "./Icon";

export function SetupChecklist(props: { checks: Check[] }) {
  const done = props.checks.filter((c) => c.ok).length;
  if (done === props.checks.length) return null;
  return (
    <section className="panel" aria-labelledby="setup-title">
      <div className="row between">
        <h2 className="panel__title" id="setup-title">Finish setting up</h2>
        <span className="muted">
          {done} of {props.checks.length} done
        </span>
      </div>
      <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={props.checks.length} aria-valuenow={done} aria-label="Setup progress">
        <div className="meter__fill" style={{ width: `${(done / props.checks.length) * 100}%` }} />
      </div>
      <ul className="steps">
        {props.checks.map((c) => (
          <li key={c.id} className={`step ${c.ok ? "step--done" : ""}`}>
            <span className="step__icon">
              <Icon name="check" size={16} />
            </span>
            <span>
              <span className="step__label">{c.label}</span>
              {!c.ok && c.hint && <span className="hint" style={{ display: "block" }}>{c.hint}</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className="hint" style={{ marginTop: 14 }}>
        Environment variables live in Vercel under Project, Settings, Environment Variables. Redeploy after changing them.
      </p>
    </section>
  );
}

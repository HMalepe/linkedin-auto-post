"use client";
import { useState } from "react";
import { api, errText } from "./api";

type Mode = "topics" | "idea" | "manual";

export function Composer(props: { onChange: () => void; hasTopics: boolean }) {
  const [mode, setMode] = useState<Mode>("topics");
  const [count, setCount] = useState(3);
  const [idea, setIdea] = useState("");
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const go = async (fn: () => Promise<string>) => {
    setBusy(true);
    setMsg(null);
    try {
      setMsg({ ok: true, text: await fn() });
      props.onChange();
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    }
    setBusy(false);
  };

  const generate = (body: Record<string, unknown>) =>
    go(async () => {
      const r = await api<{ created: number }>("/api/generate", "POST", body);
      return `Claude wrote ${r.created} draft${r.created === 1 ? "" : "s"}. Review them below.`;
    });

  return (
    <div className="card">
      <div className="row" style={{ marginTop: 0 }}>
        {(
          [
            ["topics", "From my topics"],
            ["idea", "From an idea"],
            ["manual", "Write my own"],
          ] as const
        ).map(([m, label]) => (
          <button key={m} className={`chip ${mode === m ? "on" : ""}`} onClick={() => setMode(m)}>
            {label}
          </button>
        ))}
      </div>

      {mode === "topics" && (
        <div className="row">
          <button className="primary" onClick={() => generate({ count })} disabled={busy}>
            {busy ? "Writing…" : "Generate drafts"}
          </button>
          <input type="number" min={1} max={7} value={count} onChange={(e) => setCount(Number(e.target.value))} style={{ width: 70 }} aria-label="Number of drafts" />
          <span className="muted">
            {props.hasTopics ? "drafts spread across your topics" : "No topics yet: add some in Settings for better drafts"}
          </span>
        </div>
      )}

      {mode === "idea" && (
        <div style={{ marginTop: 10 }}>
          <textarea
            placeholder="Rough idea, story or opinion. e.g. 'What dispensing 300 scripts a day taught me about systems thinking'"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            style={{ minHeight: 90 }}
          />
          <div className="row">
            <button className="primary" disabled={busy || !idea.trim()} onClick={() => generate({ count, idea })}>
              {busy ? "Writing…" : `Write ${count} version${count === 1 ? "" : "s"}`}
            </button>
            <input type="number" min={1} max={5} value={count} onChange={(e) => setCount(Number(e.target.value))} style={{ width: 70 }} aria-label="Number of versions" />
          </div>
        </div>
      )}

      {mode === "manual" && (
        <div style={{ marginTop: 10 }}>
          <textarea placeholder="Paste or write a post…" value={manual} onChange={(e) => setManual(e.target.value)} style={{ minHeight: 90 }} />
          <div className="row">
            <button
              disabled={busy || !manual.trim()}
              onClick={() =>
                go(async () => {
                  await api("/api/posts", "POST", { content: manual });
                  setManual("");
                  return "Added to the queue as a draft.";
                })
              }
            >
              Add to queue
            </button>
            <span className="muted">{manual.length} / 3000</span>
          </div>
        </div>
      )}

      {msg && <div className={msg.ok ? "muted" : "err"} style={{ marginTop: 8 }}>{msg.text}</div>}
    </div>
  );
}

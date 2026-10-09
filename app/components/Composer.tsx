"use client";
import { useEffect, useRef, useState } from "react";
import { api, errText } from "./api";
import { Icon } from "./Icon";

type Mode = "topics" | "idea" | "manual";

const MODES: [Mode, string][] = [
  ["topics", "From my topics"],
  ["idea", "From an idea"],
  ["manual", "Write my own"],
];

function Stepper(props: { value: number; min: number; max: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="stepper" role="group" aria-label={props.label}>
      <button type="button" className="stepper__btn" aria-label="Fewer" disabled={props.value <= props.min} onClick={() => props.onChange(props.value - 1)}>
        −
      </button>
      <span className="stepper__val" aria-live="polite">
        {props.value}
      </span>
      <button type="button" className="stepper__btn" aria-label="More" disabled={props.value >= props.max} onClick={() => props.onChange(props.value + 1)}>
        +
      </button>
    </div>
  );
}

export function Composer(props: { open: boolean; onClose: () => void; onDone: (message: string) => void; hasTopics: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<Mode>("topics");
  const [count, setCount] = useState(3);
  const [idea, setIdea] = useState("");
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (props.open && !d.open) d.showModal();
    if (!props.open && d.open) d.close();
  }, [props.open]);

  const go = async (fn: () => Promise<string>) => {
    setBusy(true);
    setError(null);
    try {
      props.onDone(await fn());
    } catch (e) {
      setError(errText(e));
    }
    setBusy(false);
  };

  const generate = (body: Record<string, unknown>) =>
    go(async () => {
      const r = await api<{ created: number }>("/api/generate", "POST", body);
      if (body.idea) setIdea("");
      return `Claude wrote ${r.created} draft${r.created === 1 ? "" : "s"}. Review them in your queue.`;
    });

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby="composer-title"
      onClose={props.onClose}
      onClick={(e) => e.target === e.currentTarget && props.onClose()}
    >
      <div className="sheet__body">
        <div className="sheet__head">
          <h2 className="sheet__title" id="composer-title">
            New post
          </h2>
          <button className="btn btn--quiet btn--icon" onClick={props.onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>

        <div className="seg" style={{ marginTop: 16 }} role="group" aria-label="How to start">
          {MODES.map(([m, label]) => (
            <button key={m} className="chip" aria-pressed={mode === m} onClick={() => setMode(m)}>
              {label}
            </button>
          ))}
        </div>

        {mode === "topics" && (
          <div className="stack" style={{ marginTop: 18 }}>
            <p className="muted">
              {props.hasTopics ? "Claude writes drafts spread across your topics, in your voice." : "You haven't added topics yet. Add some in Settings for sharper drafts."}
            </p>
            <div className="row between">
              <span className="label">How many drafts</span>
              <Stepper value={count} min={1} max={7} onChange={setCount} label="Number of drafts" />
            </div>
            <button className="btn btn--primary btn--block" disabled={busy} onClick={() => generate({ count })}>
              {busy ? "Claude is writing…" : "Generate drafts"}
            </button>
          </div>
        )}

        {mode === "idea" && (
          <div className="stack" style={{ marginTop: 18 }}>
            <textarea
              className="textarea"
              placeholder="A rough idea, story or opinion. e.g. what dispensing 300 scripts a day taught me about systems thinking"
              aria-label="Your idea"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
            />
            <div className="row between">
              <span className="label">How many versions</span>
              <Stepper value={Math.min(count, 5)} min={1} max={5} onChange={setCount} label="Number of versions" />
            </div>
            <button className="btn btn--primary btn--block" disabled={busy || !idea.trim()} onClick={() => generate({ count: Math.min(count, 5), idea })}>
              {busy ? "Claude is writing…" : `Write ${Math.min(count, 5)} version${Math.min(count, 5) === 1 ? "" : "s"}`}
            </button>
          </div>
        )}

        {mode === "manual" && (
          <div className="stack" style={{ marginTop: 18 }}>
            <textarea className="textarea" style={{ minHeight: 160 }} placeholder="Write or paste your post…" aria-label="Your post" value={manual} onChange={(e) => setManual(e.target.value)} />
            <div className="row between">
              <span className="muted">{manual.length} / 3000</span>
            </div>
            <button
              className="btn btn--primary btn--block"
              disabled={busy || !manual.trim() || manual.length > 3000}
              onClick={() =>
                go(async () => {
                  await api("/api/posts", "POST", { content: manual });
                  setManual("");
                  return "Added to your queue as a draft.";
                })
              }
            >
              Add to queue
            </button>
          </div>
        )}

        {error && (
          <p className="err" role="alert" style={{ marginTop: 14 }}>
            {error}
          </p>
        )}
      </div>
    </dialog>
  );
}

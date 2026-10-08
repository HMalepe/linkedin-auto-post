"use client";
import { useMemo, useState } from "react";
import { api, errText, fmt, DAY_NAMES, type Settings } from "./api";

function timeZones(current: string) {
  try {
    const all = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
    return all.includes(current) ? all : [current, ...all];
  } catch {
    return [current];
  }
}

export function SettingsForm(props: { settings: Settings; upcoming: string[]; model: string; onSaved: () => void }) {
  const s = props.settings;
  const [topics, setTopics] = useState(s.topics.join("\n"));
  const [voice, setVoice] = useState(s.voice);
  const [rules, setRules] = useState(s.rules);
  const [times, setTimes] = useState(s.post_times.join(", "));
  const [days, setDays] = useState<number[]>(s.post_days);
  const [tz, setTz] = useState(s.timezone);
  const [auto, setAuto] = useState(s.auto_generate);
  const [target, setTarget] = useState(s.queue_target);
  const [maxTags, setMaxTags] = useState(s.max_hashtags);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const zones = useMemo(() => timeZones(s.timezone), [s.timezone]);
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const toggleDay = (d: number) => setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d].sort()));

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await api("/api/settings", "PUT", {
        topics: topics.split("\n"),
        voice,
        rules,
        post_times: times.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean),
        post_days: days,
        timezone: tz,
        auto_generate: auto,
        queue_target: target,
        max_hashtags: maxTags,
      });
      setMsg({ ok: true, text: "Saved" });
      props.onSaved();
    } catch (e) {
      setMsg({ ok: false, text: errText(e) });
    }
    setSaving(false);
  };

  return (
    <>
      <div className="card">
        <h2>What Claude writes about</h2>
        <label>Topics (one per line)</label>
        <textarea value={topics} onChange={(e) => setTopics(e.target.value)} style={{ minHeight: 110 }} placeholder={"Lessons from pharmacy operations\nLearning to code as a career changer\nSport and discipline"} />
        <label>Voice and background: who you are, what you can credibly say, how you sound</label>
        <textarea value={voice} onChange={(e) => setVoice(e.target.value)} placeholder="e.g. Dispensary manager and pharmacist in South Africa, former athlete, teaching myself to code. Direct, dry humour, no corporate speak." />
        <label>Your rules (always / never). These override the defaults.</label>
        <textarea value={rules} onChange={(e) => setRules(e.target.value)} style={{ minHeight: 80 }} placeholder={"Never mention my employer by name.\nUse South African English spelling.\nNo emoji."} />
        <label>Maximum hashtags per post</label>
        <input type="number" min={0} max={10} value={maxTags} onChange={(e) => setMaxTags(Number(e.target.value))} style={{ width: 90 }} />
        <div className="muted" style={{ marginTop: 8 }}>Model: {props.model} (set ANTHROPIC_MODEL to change)</div>
      </div>

      <div className="card">
        <h2>When posts go out</h2>
        <label>Time zone</label>
        <select value={tz} onChange={(e) => setTz(e.target.value)}>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
        {tz !== browserTz && (
          <div className="muted" style={{ marginTop: 4 }}>
            Your browser is in {browserTz}. <button className="link" onClick={() => setTz(browserTz)}>Use that</button>
          </div>
        )}
        <label>Posting times (24h, comma separated, e.g. 08:00, 17:30)</label>
        <input type="text" value={times} onChange={(e) => setTimes(e.target.value)} />
        <label>Posting days</label>
        <div className="days">
          {DAY_NAMES.map((n, d) => (
            <button key={d} className={`chip ${days.includes(d) ? "on" : ""}`} onClick={() => toggleDay(d)}>
              {n}
            </button>
          ))}
        </div>
        {props.upcoming.length > 0 && (
          <div className="muted" style={{ marginTop: 10 }}>
            Next free slots: {props.upcoming.map((u) => fmt(u, s.timezone)).join(" · ")}
          </div>
        )}
      </div>

      <div className="card">
        <h2>Autopilot</h2>
        <label className="inline">
          <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
          Auto-generate drafts when the scheduled job runs (drafts still need your approval)
        </label>
        <label>Keep this many drafts + approved posts in the queue</label>
        <input type="number" min={1} max={20} value={target} onChange={(e) => setTarget(Number(e.target.value))} style={{ width: 90 }} />
      </div>

      <div className="row">
        <button className="primary" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </button>
        {msg && <span className={msg.ok ? "muted" : "err"} style={{ marginTop: 0 }}>{msg.text}</span>}
      </div>
    </>
  );
}

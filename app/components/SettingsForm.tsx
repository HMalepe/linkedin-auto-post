"use client";
import { useMemo, useState } from "react";
import { api, errText, fmt, DAY_NAMES, type Settings } from "./api";
import { useUi } from "./ui";

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
  const { toast } = useUi();
  const [topics, setTopics] = useState(s.topics.join("\n"));
  const [voice, setVoice] = useState(s.voice);
  const [rules, setRules] = useState(s.rules);
  const [times, setTimes] = useState(s.post_times.join(", "));
  const [days, setDays] = useState<number[]>(s.post_days);
  const [tz, setTz] = useState(s.timezone);
  const [auto, setAuto] = useState(s.auto_generate);
  const [target, setTarget] = useState(s.queue_target);
  const [maxTags, setMaxTags] = useState(s.max_hashtags);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const zones = useMemo(() => timeZones(s.timezone), [s.timezone]);
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const toggleDay = (d: number) => setDays((ds) => (ds.includes(d) ? ds.filter((x) => x !== d) : [...ds, d].sort()));

  const save = async () => {
    setSaving(true);
    setError(null);
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
      toast("ok", "Settings saved.");
      props.onSaved();
    } catch (e) {
      setError(errText(e));
    }
    setSaving(false);
  };

  return (
    <div className="stack">
      <section className="panel">
        <h2 className="panel__title">What Claude writes about</h2>
        <p className="panel__lede">The more specific you are here, the more the drafts sound like you.</p>

        <div className="field">
          <label className="label" htmlFor="topics">Topics</label>
          <textarea id="topics" className="textarea" value={topics} onChange={(e) => setTopics(e.target.value)} placeholder={"Lessons from pharmacy operations\nLearning to code as a career changer\nSport and discipline"} />
          <p className="hint">One per line.</p>
        </div>
        <div className="field">
          <label className="label" htmlFor="voice">Voice and background</label>
          <textarea id="voice" className="textarea" value={voice} onChange={(e) => setVoice(e.target.value)} placeholder="Who you are, what you can credibly speak about, how you sound. e.g. Dispensary manager and pharmacist in South Africa, former athlete, teaching myself to code. Direct, dry humour, no corporate speak." />
        </div>
        <div className="field">
          <label className="label" htmlFor="rules">Your rules</label>
          <textarea id="rules" className="textarea" value={rules} onChange={(e) => setRules(e.target.value)} placeholder={"Never mention my employer by name.\nUse South African English spelling.\nNo emoji."} />
          <p className="hint">Always and never instructions. These override Claude&apos;s defaults.</p>
        </div>
        <div className="field">
          <label className="label" htmlFor="maxtags">Maximum hashtags per post</label>
          <input id="maxtags" className="input" style={{ maxWidth: 120 }} type="number" inputMode="numeric" min={0} max={10} value={maxTags} onChange={(e) => setMaxTags(Number(e.target.value))} />
        </div>
        <p className="hint" style={{ marginTop: 14 }}>Model: {props.model}. Set ANTHROPIC_MODEL to change it.</p>
      </section>

      <section className="panel">
        <h2 className="panel__title">When posts go out</h2>

        <div className="field">
          <label className="label" htmlFor="tz">Time zone</label>
          <select id="tz" className="select" value={tz} onChange={(e) => setTz(e.target.value)}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>
          {tz !== browserTz && (
            <p className="hint">
              This device is in {browserTz}.{" "}
              <button className="btn btn--quiet btn--sm" style={{ minHeight: 0, padding: 0, color: "var(--accent)" }} onClick={() => setTz(browserTz)}>
                Use that
              </button>
            </p>
          )}
        </div>
        <div className="field">
          <label className="label" htmlFor="times">Posting times</label>
          <input id="times" className="input" type="text" inputMode="text" value={times} onChange={(e) => setTimes(e.target.value)} placeholder="08:00, 17:30" />
          <p className="hint">24-hour clock, separated by commas.</p>
        </div>
        <div className="field">
          <span className="label" id="days-label">Posting days</span>
          <div className="days" role="group" aria-labelledby="days-label">
            {DAY_NAMES.map((n, d) => (
              <button key={d} className="chip" aria-pressed={days.includes(d)} onClick={() => toggleDay(d)}>
                {n}
              </button>
            ))}
          </div>
        </div>
        {props.upcoming.length > 0 && (
          <p className="hint" style={{ marginTop: 16 }}>
            Next free slots: {props.upcoming.map((u) => fmt(u, s.timezone)).join(" · ")}
          </p>
        )}
      </section>

      <section className="panel">
        <h2 className="panel__title">Autopilot</h2>
        <div className="setting-row" style={{ marginTop: 12 }}>
          <div>
            <div className="label" id="auto-label">Write drafts automatically</div>
            <p className="hint">Each scheduled run tops up your queue. Drafts still need your approval.</p>
          </div>
          <button type="button" role="switch" className="switch" aria-checked={auto} aria-labelledby="auto-label" onClick={() => setAuto((a) => !a)} />
        </div>
        <div className="setting-row" style={{ marginTop: 18 }}>
          <div>
            <div className="label">Queue size</div>
            <p className="hint">Drafts plus scheduled posts to keep ready.</p>
          </div>
          <div className="stepper" role="group" aria-label="Queue size">
            <button type="button" className="stepper__btn" aria-label="Fewer" disabled={target <= 1} onClick={() => setTarget((t) => Math.max(1, t - 1))}>−</button>
            <span className="stepper__val">{target}</span>
            <button type="button" className="stepper__btn" aria-label="More" disabled={target >= 20} onClick={() => setTarget((t) => Math.min(20, t + 1))}>+</button>
          </div>
        </div>
      </section>

      <div className="savebar">
        <button className="btn btn--primary grow" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </button>
      </div>
      {error && <p className="err" role="alert">{error}</p>}
    </div>
  );
}

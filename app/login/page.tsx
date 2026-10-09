"use client";
import { useState, type FormEvent } from "react";
import { Icon, Logo } from "../components/Icon";
import { api, errText } from "../components/api";

export default function SignIn() {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !password) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/login", "POST", { password });
      const next = new URLSearchParams(window.location.search).get("next");
      // Full navigation so the new session cookie is used for the page request too.
      window.location.assign(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
    } catch (err) {
      setError(errText(err));
      setBusy(false);
    }
  };

  return (
    <main className="login">
      <section className="login__brand">
        <div className="brand">
          <Logo size={36} />
          <span className="brand__name">Autoposter</span>
        </div>
        <div>
          <h1 className="login__title">Drafted by Claude. Approved by you.</h1>
          <p className="login__lede">Your LinkedIn posts, written in your voice and sent on your schedule.</p>
        </div>
      </section>

      <section className="login__panel">
        <form className="login__form" onSubmit={submit}>
          <h2 className="panel__title">Sign in</h2>
          <p className="panel__lede">Enter your dashboard password to open your queue.</p>

          {/* Gives password managers a username to pair with the password. */}
          <input className="sr-only" type="text" name="username" autoComplete="username" defaultValue="autoposter" tabIndex={-1} aria-hidden="true" readOnly />

          <div className="field">
            <label className="label" htmlFor="password">
              Password
            </label>
            <div className="input-wrap">
              <input
                id="password"
                className="input"
                type={show ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                autoFocus
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!error}
                aria-describedby={error ? "login-error" : undefined}
              />
              <button type="button" className="btn btn--quiet btn--icon btn--sm input-wrap__btn" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}>
                <Icon name={show ? "eyeOff" : "eye"} size={20} />
              </button>
            </div>
          </div>

          <div id="login-error" role="alert" className="err" style={{ minHeight: 22, marginTop: 10 }}>
            {error}
          </div>

          <button className="btn btn--primary btn--block" type="submit" disabled={busy || !password} style={{ marginTop: 6 }}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}

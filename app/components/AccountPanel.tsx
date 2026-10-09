"use client";
import type { Conn } from "./api";
import { Avatar, connState } from "./Nav";

export function AccountPanel(props: {
  conn: Conn;
  daysLeft: number;
  onDisconnect: () => void;
  onSignOut: () => void;
}) {
  const { conn } = props;
  const s = connState(conn, props.daysLeft);
  return (
    <section className="panel">
      <h2 className="panel__title">LinkedIn</h2>
      <div className="row" style={{ flexWrap: "nowrap", marginTop: 14 }}>
        <Avatar conn={conn} large />
        <div className="grow">
          <div className="account__name">{conn.connected ? conn.name ?? "Connected" : "Not connected"}</div>
          <div className="status">
            <span className={`dot dot--${s.tone}`} />
            {conn.connected
              ? props.daysLeft > 0
                ? `Access renews in ${props.daysLeft} day${props.daysLeft === 1 ? "" : "s"}`
                : "Access has expired"
              : "Connect to start posting"}
          </div>
        </div>
      </div>
      <div className="row" style={{ marginTop: 14 }}>
        <a className={`btn ${conn.connected ? "" : "btn--primary"}`} href="/api/linkedin/connect">
          {conn.connected ? "Reconnect" : "Connect LinkedIn"}
        </a>
        {conn.connected && (
          <button className="btn btn--danger" onClick={props.onDisconnect}>
            Disconnect
          </button>
        )}
        <span className="grow" />
        <button className="btn btn--quiet" onClick={props.onSignOut}>
          Sign out
        </button>
      </div>
    </section>
  );
}

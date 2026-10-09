"use client";
import { fmt, until, type Post } from "./api";
import { Icon } from "./Icon";

export function NextUp(props: { post?: Post; tz: string; onOpen: (p: Post) => void; onNew: () => void }) {
  const { post } = props;

  if (!post || !post.scheduled_for) {
    return (
      <section className="nextup" aria-label="Next scheduled post">
        <div className="nextup__top">Next up</div>
        <p className="nextup__empty">Nothing is scheduled yet.</p>
        <p className="muted" style={{ marginTop: 10, color: "var(--hero-ink-2)" }}>
          Approve a draft and it waits here until it&apos;s time to go out.
        </p>
        <div className="nextup__foot">
          <button className="btn btn--hero" onClick={props.onNew}>
            <Icon name="plus" size={20} /> New post
          </button>
        </div>
      </section>
    );
  }

  const when = until(post.scheduled_for);
  return (
    <section className="nextup" aria-label="Next scheduled post">
      <div className="nextup__top">
        <span>Next up</span>
        <span className="nextup__in">{when}</span>
      </div>
      <h2 className="nextup__when">{fmt(post.scheduled_for, props.tz)}</h2>
      <p className="nextup__text">{post.content}</p>
      {when === "due now" && (
        <p className="muted" style={{ marginTop: 12, color: "var(--hero-ink-2)" }}>
          This goes out on the next scheduled run.
        </p>
      )}
      <div className="nextup__foot">
        <button className="btn btn--hero" onClick={() => props.onOpen(post)}>
          Review post
        </button>
      </div>
    </section>
  );
}

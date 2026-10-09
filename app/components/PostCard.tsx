"use client";
import { useRef, useState } from "react";
import { api, errText, fmt, fromZonedInput, toZonedInput, type Conn, type Post } from "./api";
import { AutoTextarea } from "./AutoTextarea";
import { Icon } from "./Icon";
import { LinkedInPreview } from "./LinkedInPreview";
import { useUi } from "./ui";

const MAX = 3000;
const QUICK_REWRITES = ["Shorter", "Punchier hook", "More personal", "Less formal", "Add a clear takeaway"];

const LABEL: Record<Post["status"], string> = {
  draft: "Draft",
  approved: "Scheduled",
  publishing: "Publishing",
  published: "Published",
  failed: "Failed",
};
const PILL: Record<Post["status"], string> = {
  draft: "",
  approved: "pill--scheduled",
  publishing: "pill--publishing",
  published: "pill--published",
  failed: "pill--failed",
};

const countHashtags = (s: string) => (s.match(/(^|[^\p{L}\p{N}_&/#])#[\p{L}\p{N}_]*\p{L}/gu) ?? []).length;

type RunOpts = { refresh?: boolean; done?: string };

export function PostCard(props: { post: Post; tz: string; conn: Conn; maxHashtags: number; onChange: () => void }) {
  const { post, tz } = props;
  const { confirm, toast } = useUi();
  const [text, setText] = useState(post.content);
  const [when, setWhen] = useState(toZonedInput(post.scheduled_for, tz));
  const [alt, setAlt] = useState(post.image_alt ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(post.error);
  const [preview, setPreview] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [rewriteOpen, setRewriteOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const locked = post.status === "published" || post.status === "publishing";
  const dirty = text !== post.content;
  const altDirty = alt !== (post.image_alt ?? "");
  const tags = countHashtags(text);
  const tooLong = text.length > MAX;

  const run = async (label: string, fn: () => Promise<unknown>, opts: RunOpts = {}) => {
    setBusy(label);
    setErr(null);
    try {
      await fn();
      if (opts.done) toast("ok", opts.done);
      if (opts.refresh !== false) props.onChange();
    } catch (e) {
      setErr(errText(e));
    }
    setBusy(null);
  };
  const patch = (body: Record<string, unknown>) => api(`/api/posts/${post.id}`, "PATCH", body);
  const edits = () => ({
    ...(dirty ? { content: text } : {}),
    ...(altDirty ? { image_alt: alt } : {}),
  });
  const iso = () => (when ? fromZonedInput(when, tz) : undefined);

  const rewrite = (instr: string) =>
    run(
      "rewrite",
      async () => {
        const r = await api<{ content: string }>(`/api/posts/${post.id}/rewrite`, "POST", { instruction: instr, content: text });
        setText(r.content);
        setRewriteOpen(false);
        setInstruction("");
      },
      { refresh: false, done: "Rewritten. Review it, then save or approve." },
    );

  const upload = (file: File) => {
    const form = new FormData();
    form.append("file", file);
    if (alt) form.append("alt", alt);
    return run("image", () => api(`/api/posts/${post.id}/image`, "POST", form), { done: "Image added." });
  };

  const postNow = async () => {
    const ok = await confirm({
      title: "Post to LinkedIn now?",
      body: "It goes out immediately under your name.",
      confirmLabel: "Post now",
    });
    if (!ok) return;
    setMenuOpen(false);
    await run(
      "publish",
      async () => {
        if (dirty || altDirty) await patch(edits());
        await api(`/api/posts/${post.id}/publish`, "POST");
      },
      { done: "Posted to LinkedIn." },
    );
  };

  const remove = async () => {
    const ok = await confirm({ title: "Delete this post?", body: "This can't be undone.", confirmLabel: "Delete", danger: true });
    if (ok) await run("delete", () => api(`/api/posts/${post.id}`, "DELETE"), { done: "Deleted." });
  };

  return (
    <article className={`post ${post.status === "failed" ? "post--failed" : ""}`} id={`post-${post.id}`}>
      <div className="post__head">
        <div className="row">
          <span className={`pill ${PILL[post.status]}`}>{LABEL[post.status]}</span>
          {post.topic && <span className="muted">{post.topic}</span>}
          {post.source === "manual" && <span className="muted">Written by you</span>}
        </div>
        <span className="post__when">
          {post.status === "published" && post.linkedin_post_urn ? (
            <>Published {fmt(post.published_at, tz)}</>
          ) : post.status === "approved" && post.scheduled_for ? (
            <>Goes out {fmt(post.scheduled_for, tz)}</>
          ) : null}
        </span>
      </div>

      {locked ? (
        <p className="post__read">{post.content}</p>
      ) : (
        <>
          <AutoTextarea className="post__text" value={text} onChange={(e) => setText(e.target.value)} aria-label="Post text" />
          <div className="post__meta">
            <span className={`muted post__count ${tooLong ? "over" : ""}`}>
              {text.length} / {MAX}
              {tags > props.maxHashtags && (
                <span className="warn-text">
                  {" "}
                  · {tags} hashtags (limit {props.maxHashtags})
                </span>
              )}
            </span>
            <button className="btn btn--quiet btn--sm" onClick={() => setPreview((p) => !p)} aria-pressed={preview}>
              {preview ? "Hide preview" : "Preview"}
            </button>
          </div>
        </>
      )}

      {preview && (
        <LinkedInPreview text={text} name={props.conn.name} picture={props.conn.picture} imageUrl={post.image_url} imageAlt={alt} />
      )}

      {post.image_url && !preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="post__img" src={post.image_url} alt={post.image_alt ?? ""} />
      )}
      {post.image_url && !locked && (
        <input className="input" style={{ marginTop: 10 }} type="text" placeholder="Alt text: describe the image for screen readers" value={alt} onChange={(e) => setAlt(e.target.value)} aria-label="Image alt text" />
      )}

      {!locked && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/gif"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
              setMenuOpen(false);
            }}
          />

          <div className="post__sched">
            <label className="label" htmlFor={`when-${post.id}`}>
              Send at
            </label>
            <input id={`when-${post.id}`} className="input" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
            <p className="hint">{when ? `Time zone: ${tz}` : "Leave empty and the next free slot is used."}</p>
          </div>

          <div className="post__actions">
            {post.status !== "approved" ? (
              <button className="btn btn--primary grow" disabled={!!busy || tooLong} onClick={() => run("approve", () => patch({ ...edits(), status: "approved", scheduled_for: iso() }), { done: "Approved. It's in your schedule." })}>
                {busy === "approve" ? "Approving…" : "Approve"}
              </button>
            ) : (
              <button className="btn btn--primary grow" disabled={!!busy || tooLong} onClick={() => run("save", () => patch({ ...edits(), scheduled_for: iso() ?? null }), { done: "Schedule updated." })}>
                {dirty || altDirty ? "Save & reschedule" : "Reschedule"}
              </button>
            )}
            {(dirty || altDirty) && post.status !== "approved" && (
              <button className="btn" disabled={!!busy || tooLong} onClick={() => run("save", () => patch(edits()), { done: "Saved." })}>
                Save
              </button>
            )}
            <button className="btn" disabled={!!busy} onClick={() => setRewriteOpen((o) => !o)} aria-expanded={rewriteOpen}>
              <Icon name="sparkle" size={18} /> Rewrite
            </button>
            <button className="btn btn--icon" aria-label="More actions" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
              <Icon name="more" />
            </button>
          </div>

          {menuOpen && (
            <div className="menu">
              <button className="btn btn--sm" disabled={!!busy || tooLong} onClick={postNow}>
                <Icon name="send" size={18} /> Post now
              </button>
              <button className="btn btn--sm" disabled={!!busy} onClick={() => fileRef.current?.click()}>
                <Icon name="image" size={18} /> {post.image_url ? "Replace image" : "Add image"}
              </button>
              {post.image_url && (
                <button className="btn btn--sm" disabled={!!busy} onClick={() => run("image", () => api(`/api/posts/${post.id}/image`, "DELETE"), { done: "Image removed." })}>
                  Remove image
                </button>
              )}
              {dirty && (
                <button className="btn btn--sm" disabled={!!busy} onClick={() => setText(post.content)}>
                  <Icon name="undo" size={18} /> Revert edits
                </button>
              )}
              {post.status === "approved" && (
                <button className="btn btn--sm" disabled={!!busy} onClick={() => run("draft", () => patch({ ...edits(), status: "draft" }), { done: "Moved back to drafts." })}>
                  Unapprove
                </button>
              )}
              <button className="btn btn--sm btn--danger" disabled={!!busy} onClick={remove}>
                <Icon name="trash" size={18} /> Delete
              </button>
            </div>
          )}

          {rewriteOpen && (
            <div className="rewrite">
              <div className="seg" style={{ margin: 0, padding: 0, flexWrap: "wrap", overflow: "visible" }}>
                {QUICK_REWRITES.map((q) => (
                  <button key={q} className="chip" disabled={!!busy} onClick={() => rewrite(q)}>
                    {q}
                  </button>
                ))}
              </div>
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <input
                  className="input grow"
                  type="text"
                  placeholder="Or tell Claude what to change"
                  aria-label="Rewrite instruction"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && instruction.trim() && rewrite(instruction)}
                />
                <button className="btn btn--primary" disabled={!!busy || !instruction.trim()} onClick={() => rewrite(instruction)}>
                  {busy === "rewrite" ? "Rewriting…" : "Rewrite"}
                </button>
              </div>
              <p className="hint">The rewrite replaces the text above. Nothing is saved until you save or approve.</p>
            </div>
          )}
        </>
      )}

      {post.status === "published" && (
        <div className="post__actions">
          {post.linkedin_post_urn && (
            <a className="btn btn--sm" href={`https://www.linkedin.com/feed/update/${encodeURIComponent(post.linkedin_post_urn)}/`} target="_blank" rel="noreferrer">
              View on LinkedIn <Icon name="external" size={16} />
            </a>
          )}
          <button className="btn btn--sm" disabled={!!busy} onClick={() => run("dup", () => api(`/api/posts/${post.id}/duplicate`, "POST"), { done: "Copied to your queue as a draft." })}>
            <Icon name="copy" size={18} /> Copy to queue as draft
          </button>
        </div>
      )}

      {post.status === "publishing" && <p className="hint" style={{ marginTop: 10 }}>Publishing now. This page refreshes on its own.</p>}
      {err && <p className="err" style={{ marginTop: 10 }}>{err}</p>}
    </article>
  );
}

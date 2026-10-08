"use client";
import { useRef, useState } from "react";
import { api, errText, fmt, fromZonedInput, toZonedInput, type Conn, type Post } from "./api";
import { LinkedInPreview } from "./LinkedInPreview";

const MAX = 3000;
const QUICK_REWRITES = ["Shorter", "Punchier hook", "More personal", "Less formal", "Add a clear takeaway"];

const countHashtags = (s: string) => (s.match(/(^|[^\p{L}\p{N}_&/#])#[\p{L}\p{N}_]*\p{L}/gu) ?? []).length;

export function PostCard(props: { post: Post; tz: string; conn: Conn; maxHashtags: number; onChange: () => void }) {
  const { post, tz } = props;
  const [text, setText] = useState(post.content);
  const [when, setWhen] = useState(toZonedInput(post.scheduled_for, tz));
  const [alt, setAlt] = useState(post.image_alt ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(post.error);
  const [preview, setPreview] = useState(false);
  const [rewriteOpen, setRewriteOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const locked = post.status === "published" || post.status === "publishing";
  const dirty = text !== post.content;
  const altDirty = alt !== (post.image_alt ?? "");
  const tags = countHashtags(text);

  const run = async (label: string, fn: () => Promise<unknown>, refresh = true) => {
    setBusy(label);
    setErr(null);
    try {
      await fn();
      if (refresh) props.onChange();
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
      false,
    );

  const upload = (file: File) => {
    const form = new FormData();
    form.append("file", file);
    if (alt) form.append("alt", alt);
    return run("image", () => api(`/api/posts/${post.id}/image`, "POST", form));
  };

  return (
    <div className="card">
      <div className="row between" style={{ marginTop: 0 }}>
        <div className="row" style={{ marginTop: 0 }}>
          <span className={`badge ${post.status}`}>{post.status}</span>
          {post.topic && <span className="muted">{post.topic}</span>}
          {post.source === "manual" && <span className="muted">· written by you</span>}
        </div>
        <span className="muted">
          {post.status === "published" && post.linkedin_post_urn ? (
            <a href={`https://www.linkedin.com/feed/update/${encodeURIComponent(post.linkedin_post_urn)}/`} target="_blank" rel="noreferrer">
              Published {fmt(post.published_at, tz)} ↗
            </a>
          ) : post.status === "approved" && post.scheduled_for ? (
            `Goes out ${fmt(post.scheduled_for, tz)}`
          ) : null}
        </span>
      </div>

      <div style={{ marginTop: 10 }}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} disabled={locked} aria-label="Post text" />
        <div className="row between" style={{ marginTop: 4 }}>
          <span className={`muted count ${text.length > MAX ? "over" : ""}`}>
            {text.length} / {MAX}
            {tags > props.maxHashtags && <span className="warn-text"> · {tags} hashtags (your limit is {props.maxHashtags})</span>}
          </span>
          <button className="link" onClick={() => setPreview((p) => !p)}>
            {preview ? "Hide preview" : "Preview"}
          </button>
        </div>
      </div>

      {preview && (
        <LinkedInPreview
          text={text}
          name={props.conn.name}
          picture={props.conn.picture}
          imageUrl={post.image_url}
          imageAlt={alt}
        />
      )}

      {(post.image_url || !locked) && (
        <div className="row">
          {post.image_url && !preview && <img className="thumb" src={post.image_url} alt={post.image_alt ?? ""} />}
          {post.image_url && !locked && (
            <input className="grow" type="text" placeholder="Alt text (describe the image for screen readers)" value={alt} onChange={(e) => setAlt(e.target.value)} />
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
                }}
              />
              <button disabled={!!busy} onClick={() => fileRef.current?.click()}>
                {busy === "image" ? "Uploading…" : post.image_url ? "Replace image" : "Add image"}
              </button>
              {post.image_url && (
                <button className="danger" disabled={!!busy} onClick={() => run("image", () => api(`/api/posts/${post.id}/image`, "DELETE"))}>
                  Remove image
                </button>
              )}
            </>
          )}
        </div>
      )}

      {!locked && (
        <div className="row">
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            style={{ width: "auto" }}
            title={`Time in ${tz}`}
          />
          {post.status !== "approved" ? (
            <button className="primary" disabled={!!busy || text.length > MAX} onClick={() => run("approve", () => patch({ ...edits(), status: "approved", scheduled_for: iso() }))}>
              Approve{when ? "" : " (next slot)"}
            </button>
          ) : (
            <>
              <button disabled={!!busy || text.length > MAX} onClick={() => run("save", () => patch({ ...edits(), scheduled_for: iso() ?? null }))}>
                {dirty || altDirty ? "Save & reschedule" : "Reschedule"}
              </button>
              <button disabled={!!busy} onClick={() => run("draft", () => patch({ ...edits(), status: "draft" }))}>
                Unapprove
              </button>
            </>
          )}
          {(dirty || altDirty) && post.status !== "approved" && (
            <button disabled={!!busy || text.length > MAX} onClick={() => run("save", () => patch(edits()))}>
              Save
            </button>
          )}
          {dirty && (
            <button disabled={!!busy} onClick={() => setText(post.content)}>
              Revert
            </button>
          )}
          <button disabled={!!busy} onClick={() => setRewriteOpen((o) => !o)}>
            Rewrite…
          </button>
          <button
            disabled={!!busy || text.length > MAX}
            onClick={() => {
              if (confirm("Publish this to LinkedIn right now?"))
                run("publish", async () => {
                  if (dirty || altDirty) await patch(edits());
                  await api(`/api/posts/${post.id}/publish`, "POST");
                });
            }}
          >
            {busy === "publish" ? "Posting…" : "Post now"}
          </button>
          <button
            className="danger"
            disabled={!!busy}
            onClick={() => confirm("Delete this post?") && run("delete", () => api(`/api/posts/${post.id}`, "DELETE"))}
          >
            Delete
          </button>
        </div>
      )}

      {rewriteOpen && !locked && (
        <div className="card" style={{ marginTop: 10, marginBottom: 0 }}>
          <div className="row" style={{ marginTop: 0 }}>
            {QUICK_REWRITES.map((q) => (
              <button key={q} className="chip" disabled={!!busy} onClick={() => rewrite(q)}>
                {q}
              </button>
            ))}
          </div>
          <div className="row">
            <input
              className="grow"
              type="text"
              placeholder="Or tell Claude what to change, e.g. 'mention my pharmacy experience'"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && instruction.trim() && rewrite(instruction)}
            />
            <button className="primary" disabled={!!busy || !instruction.trim()} onClick={() => rewrite(instruction)}>
              {busy === "rewrite" ? "Rewriting…" : "Rewrite"}
            </button>
          </div>
          <div className="muted" style={{ marginTop: 6 }}>The rewrite replaces the text in the editor. Nothing is saved until you save or approve.</div>
        </div>
      )}

      {post.status === "published" && (
        <div className="row">
          <button disabled={!!busy} onClick={() => run("dup", () => api(`/api/posts/${post.id}/duplicate`, "POST"))}>
            Copy to queue as draft
          </button>
        </div>
      )}

      {busy && busy !== "image" && busy !== "publish" && busy !== "rewrite" && <div className="muted" style={{ marginTop: 6 }}>Working…</div>}
      {err && <div className="err">{err}</div>}
    </div>
  );
}

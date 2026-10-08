"use client";
import { useState, type ReactNode } from "react";

// LinkedIn's feed shows roughly the first 3 lines / ~210 characters before "...see more".
const FOLD_CHARS = 210;
const FOLD_LINES = 3;

function foldIndex(text: string) {
  let lines = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n" && ++lines >= FOLD_LINES) return i;
    if (i >= FOLD_CHARS) return i;
  }
  return text.length;
}

function withHashtags(text: string): ReactNode[] {
  return text.split(/(#[\p{L}\p{N}_]+)/u).map((part, i) =>
    part.startsWith("#") && part.length > 1 ? (
      <span key={i} className="hashtag">{part}</span>
    ) : (
      part
    ),
  );
}

export function LinkedInPreview(props: {
  text: string;
  name?: string | null;
  picture?: string | null;
  imageUrl?: string | null;
  imageAlt?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const cut = foldIndex(props.text);
  const folded = !open && cut < props.text.length;
  return (
    <div className="preview">
      <div className="who" style={{ marginBottom: 8 }}>
        {props.picture ? <img className="avatar" src={props.picture} alt="" onError={(e) => (e.currentTarget.style.visibility = "hidden")} /> : <div className="avatar" />}
        <div>
          <strong>{props.name || "You"}</strong>
          <div className="muted">Now · 🌐</div>
        </div>
      </div>
      <div className="text">
        {withHashtags(folded ? props.text.slice(0, cut).trimEnd() : props.text)}
        {folded && (
          <span className="more" onClick={() => setOpen(true)}>
            {" "}…see more
          </span>
        )}
      </div>
      {props.imageUrl && <img className="post-image" src={props.imageUrl} alt={props.imageAlt ?? ""} />}
      <div className="muted" style={{ marginTop: 8 }}>
        {cut < props.text.length
          ? `Hook (shown before "see more"): ${cut} of ${props.text.length} characters`
          : "Whole post is visible without expanding"}
      </div>
    </div>
  );
}

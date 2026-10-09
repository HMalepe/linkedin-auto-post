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
    <div className="li" aria-label="Preview of how the post looks on LinkedIn">
      <div className="li__who">
        {props.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="avatar avatar--lg" src={props.picture} alt="" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
        ) : (
          <span className="avatar avatar--lg" />
        )}
        <div>
          <div className="li__name">{props.name || "You"}</div>
          <div className="muted">Now</div>
        </div>
      </div>
      <div className="li__text">
        {withHashtags(folded ? props.text.slice(0, cut).trimEnd() : props.text)}
        {folded && (
          <button className="li__more" onClick={() => setOpen(true)}>
            {" "}…see more
          </button>
        )}
      </div>
      {props.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="li__img" src={props.imageUrl} alt={props.imageAlt ?? ""} />
      )}
      <p className="hint" style={{ marginTop: 10 }}>
        {cut < props.text.length
          ? `Your hook is the part before "see more": ${cut} of ${props.text.length} characters.`
          : "The whole post is visible without expanding."}
      </p>
    </div>
  );
}

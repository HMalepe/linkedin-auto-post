// LinkedIn's Posts API parses `commentary` as "Little Text Format".
// Unescaped reserved characters (notably "(") can silently truncate a post,
// so everything reserved is backslash-escaped. Hashtags are emitted with the
// explicit {hashtag|\#|tag} template so they render as real, clickable tags.
// https://learn.microsoft.com/linkedin/marketing/community-management/shares/little-text-format

const RESERVED = /[\\|{}@[\]()<>#*_~]/g;

// "#" preceded by start/space/punctuation (not part of a word, URL fragment or HTML entity),
// followed by a tag containing at least one letter.
const HASHTAG = /(^|[^\p{L}\p{N}_&/#])#([\p{L}\p{N}_]*\p{L}[\p{L}\p{N}_]*)/gu;

export const escapeLittleText = (text: string) => text.replace(RESERVED, (m) => "\\" + m);

export function toLittleText(text: string) {
  let out = "";
  let last = 0;
  for (const m of text.matchAll(HASHTAG)) {
    const hashAt = m.index! + m[1].length;
    out += escapeLittleText(text.slice(last, hashAt)) + `{hashtag|\\#|${m[2]}}`;
    last = hashAt + 1 + m[2].length;
  }
  return out + escapeLittleText(text.slice(last));
}

export function countHashtags(text: string) {
  return [...text.matchAll(HASHTAG)].length;
}

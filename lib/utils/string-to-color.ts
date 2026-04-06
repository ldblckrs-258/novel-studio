export function stringToColor(
  string: string,
  options: { s?: number; l?: number } = {},
): string {
  const { s = 75, l = 65 } = options;

  if (string == null || String(string).trim() === "") {
    return `hsl(0, 0%, 65%)`;
  }

  const safeString = String(string);
  let hash = 0;
  for (let i = 0; i < safeString.length; i += 1) {
    hash = safeString.charCodeAt(i) + ((hash << 5) - hash);
  }

  const h = Math.abs(hash) % 360;
  return `hsl(${h}, ${s}%, ${l}%)`;
}

/** Tokenize a string into plain text and XML-like tags. */
export interface XmlToken {
  type: "text" | "tag";
  value: string;
  tagName: string;
}

const XML_TAG_RE = /<\/?[a-zA-Z][a-zA-Z0-9_:-]*(?:\s[^>]*)?\/?>/g;

export function tokenizeXml(text: string): XmlToken[] {
  const tokens: XmlToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  XML_TAG_RE.lastIndex = 0;
  while ((match = XML_TAG_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: "text", value: text.slice(lastIndex, match.index), tagName: "" });
    }
    const nameMatch = /^<\/?([a-zA-Z][a-zA-Z0-9_:-]*)/.exec(match[0]);
    tokens.push({ type: "tag", value: match[0], tagName: nameMatch?.[1] ?? "" });
    lastIndex = XML_TAG_RE.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: "text", value: text.slice(lastIndex), tagName: "" });
  }

  return tokens;
}

// Minimal, safe inline formatting for narration text: **bold** and *italic*.
// Produces tokens (no HTML), so untrusted text from the AI can never inject markup.

const INLINE = /(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g;

/**
 * Split text into [{ type: 'text' | 'bold' | 'italic', text }].
 * Unbalanced asterisks are left as they are.
 */
export function parseInline(text) {
  if (!text) return [];
  const tokens = [];
  let last = 0;

  for (const match of String(text).matchAll(INLINE)) {
    if (match.index > last) tokens.push({ type: 'text', text: text.slice(last, match.index) });
    const raw = match[0];
    if (raw.startsWith('**')) tokens.push({ type: 'bold', text: raw.slice(2, -2) });
    else tokens.push({ type: 'italic', text: raw.slice(1, -1) });
    last = match.index + raw.length;
  }
  if (last < text.length) tokens.push({ type: 'text', text: text.slice(last) });
  return tokens;
}

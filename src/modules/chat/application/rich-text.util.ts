// Namespace import, not a default import — this project sets
// allowSyntheticDefaultImports without esModuleInterop, so a default import
// of a CommonJS package type-checks but is undefined at runtime.
import * as sanitizeHtml from 'sanitize-html';

// The single allowlist for every piece of operator-authored rich text that
// can end up rendered as HTML in a browser: canned response bodies at rest,
// and chat messages sent from one (ChatMessage.isHtml). Deliberately tiny —
// it matches the restricted Quill toolbar the CMS exposes for canned
// responses (bold/italic/underline, lists, links). Anything outside this set
// is stripped rather than escaped.
//
// This is the security boundary. The client-side toolbar restriction is only
// a UX guard (pasted content bypasses it), so nothing may be persisted or
// broadcast without passing through sanitizeRichText first.
const RICH_TEXT_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'a', 'p', 'br'],
  allowedAttributes: { a: ['href'] },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }),
  },
};

// Quill's HTML serializer writes every space as U+00A0 (non-breaking space),
// not a regular U+0020 — round-trip safety for its own editor, not a
// rendering concern. Left as-is, a browser has no valid break point anywhere
// in the text once it's rendered as a chat bubble, so long lines don't wrap
// at word boundaries at all and get cut mid-character instead, regardless of
// overflow-wrap/word-break. Normalizing to a regular space here (before
// sanitizing) is what actually lets rendered bubbles wrap normally — it
// doesn't change how the text looks, since U+00A0 already renders
// identically to a normal space.
function normalizeNbsp(html: string): string {
  return html.replace(/\u00A0/g, ' ');
}

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(normalizeNbsp(html), RICH_TEXT_SANITIZE_OPTIONS);
}

// True when the value still carries markup after sanitization — used to
// decide whether a message is worth storing as isHtml at all, so a canned
// response that happens to be plain text stays a normal plain-text message
// rather than needlessly entering the HTML render path.
export function hasMarkup(html: string): boolean {
  return /<[a-z][\s\S]*>/i.test(html);
}

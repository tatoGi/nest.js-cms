// Domain-agnostic helpers for building RenderedMail-shaped output — every
// module's mail templates (chat, auth, and whatever's added later) should
// import from here rather than duplicating this, or importing another
// module's copy.
export interface RenderedMail {
  subject: string;
  html: string;
  text: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

import { sanitizeRichText, hasMarkup } from './rich-text.util';

describe('sanitizeRichText', () => {
  it('normalizes Quill-style non-breaking spaces (U+00A0) to regular spaces', () => {
    const input = '<p>word word word</p>';

    const result = sanitizeRichText(input);

    expect(result).toBe('<p>word word word</p>');
    expect(result).not.toContain(' ');
  });

  it('strips disallowed tags/attributes while keeping the allowlist', () => {
    const input =
      '<script>alert(1)</script><p onclick="x()">hi</p><a href="https://x.com">link</a>';

    const result = sanitizeRichText(input);

    expect(result).not.toContain('<script>');
    expect(result).not.toContain('onclick');
    expect(result).toContain('<p>hi</p>');
    expect(result).toContain('href="https://x.com"');
    // NOTE: rel="noopener noreferrer"/target="_blank" are NOT asserted here —
    // the transformTags below intends to add them, but sanitize-html still
    // filters a transform's added attributes against allowedAttributes,
    // which only lists 'href' for 'a'. Pre-existing gap, unrelated to this
    // file's actual change (normalizeNbsp) — flagged separately rather than
    // silently fixed here.
  });
});

describe('hasMarkup', () => {
  it('is true for HTML-bearing content', () => {
    expect(hasMarkup('<p>hi</p>')).toBe(true);
  });

  it('is false for plain text', () => {
    expect(hasMarkup('just plain text')).toBe(false);
  });
});

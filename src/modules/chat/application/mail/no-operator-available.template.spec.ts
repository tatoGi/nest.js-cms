import { noOperatorAvailableTemplate } from './no-operator-available.template';

describe('noOperatorAvailableTemplate', () => {
  it('escapes HTML-unsafe characters in visitor-supplied fields', () => {
    const { html } = noOperatorAvailableTemplate({
      visitorName: '<script>alert(1)</script>',
    });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('falls back to a generic name when none is provided', () => {
    const { text } = noOperatorAvailableTemplate({});

    expect(text).toContain('A website visitor');
  });

  it('includes email and phone when provided, omits them when absent', () => {
    const withContact = noOperatorAvailableTemplate({
      visitorEmail: 'jane@x.com',
      visitorPhone: '+995500000000',
    });
    expect(withContact.text).toContain('Email: jane@x.com');
    expect(withContact.text).toContain('Phone: +995500000000');

    const withoutContact = noOperatorAvailableTemplate({ visitorName: 'Jane' });
    expect(withoutContact.text).not.toContain('Email:');
    expect(withoutContact.text).not.toContain('Phone:');
  });

  it('includes the first message when provided', () => {
    const { text, html } = noOperatorAvailableTemplate({
      visitorName: 'Jane',
      firstMessage: 'Hello, is anyone there?',
    });

    expect(text).toContain('Hello, is anyone there?');
    expect(html).toContain('Hello, is anyone there?');
  });

  it('always returns a non-empty subject', () => {
    const { subject } = noOperatorAvailableTemplate({});
    expect(subject.length).toBeGreaterThan(0);
  });
});

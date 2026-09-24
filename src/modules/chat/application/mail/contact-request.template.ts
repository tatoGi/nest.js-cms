import { RenderedMail, escapeHtml } from '@/common/mail/template-helpers';

export interface ContactRequestData {
  visitorName?: string | null;
  visitorEmail?: string | null;
  visitorPhone?: string | null;
  message?: string | null;
}

// Sent when a visitor waiting in the chat queue chooses to leave their
// contact info instead of continuing to wait for an operator.
export function contactRequestTemplate(data: ContactRequestData): RenderedMail {
  const name = data.visitorName?.trim() || 'A website visitor';

  const contactLinesText = [
    data.visitorEmail ? `Email: ${data.visitorEmail}` : null,
    data.visitorPhone ? `Phone: ${data.visitorPhone}` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');

  const messageLineText = data.message ? `\n\nMessage: ${data.message}` : '';

  const text = `${name} was waiting in the live chat queue and left their contact info instead of continuing to wait.\n${contactLinesText}${messageLineText}`;

  const contactLinesHtml = [
    data.visitorEmail ? `<li>Email: ${escapeHtml(data.visitorEmail)}</li>` : '',
    data.visitorPhone ? `<li>Phone: ${escapeHtml(data.visitorPhone)}</li>` : '',
  ]
    .filter(Boolean)
    .join('');

  const messageHtml = data.message ? `<p>Message: ${escapeHtml(data.message)}</p>` : '';

  const html = `
    <p><strong>${escapeHtml(name)}</strong> was waiting in the live chat queue and left their contact info instead of continuing to wait.</p>
    ${contactLinesHtml ? `<ul>${contactLinesHtml}</ul>` : ''}
    ${messageHtml}
  `.trim();

  return {
    subject: 'Chat visitor left contact info while waiting',
    html,
    text,
  };
}

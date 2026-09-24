import { RenderedMail, escapeHtml } from '@/common/mail/template-helpers';

export interface NoOperatorAvailableData {
  visitorName?: string;
  visitorEmail?: string;
  visitorPhone?: string;
  firstMessage?: string;
}

// Unified "no operator available" notice — covers both the original
// "contact form delivery" and "off-hours notification" requirements at once,
// since they describe the same scenario (see chat-messaging-email-plan.md).
export function noOperatorAvailableTemplate(data: NoOperatorAvailableData): RenderedMail {
  const name = data.visitorName?.trim() || 'A website visitor';

  const contactLinesText = [
    data.visitorEmail ? `Email: ${data.visitorEmail}` : null,
    data.visitorPhone ? `Phone: ${data.visitorPhone}` : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');

  const messageLineText = data.firstMessage ? `\n\nMessage: ${data.firstMessage}` : '';

  const text = `${name} started a live chat outside business hours and no operator was online.\n${contactLinesText}${messageLineText}`;

  const contactLinesHtml = [
    data.visitorEmail ? `<li>Email: ${escapeHtml(data.visitorEmail)}</li>` : '',
    data.visitorPhone ? `<li>Phone: ${escapeHtml(data.visitorPhone)}</li>` : '',
  ]
    .filter(Boolean)
    .join('');

  const messageHtml = data.firstMessage ? `<p>Message: ${escapeHtml(data.firstMessage)}</p>` : '';

  const html = `
    <p><strong>${escapeHtml(name)}</strong> started a live chat outside business hours and no operator was online.</p>
    ${contactLinesHtml ? `<ul>${contactLinesHtml}</ul>` : ''}
    ${messageHtml}
  `.trim();

  return {
    subject: 'New chat visitor — no operator available',
    html,
    text,
  };
}

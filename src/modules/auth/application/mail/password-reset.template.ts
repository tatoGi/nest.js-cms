import { RenderedMail, escapeHtml } from '@/common/mail/template-helpers';

export interface PasswordResetData {
  resetUrl: string;
}

// Sent when a user requests a password reset — the email carries only a
// one-time link/token, never a password itself (see docs/reset-password).
export function passwordResetTemplate(data: PasswordResetData): RenderedMail {
  const text = `We received a request to reset your password. This link expires in 30 minutes and can only be used once:\n\n${data.resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`;

  const html = `
    <p>We received a request to reset your password.</p>
    <p><a href="${escapeHtml(data.resetUrl)}">Reset your password</a></p>
    <p>This link expires in 30 minutes and can only be used once.</p>
    <p>If you didn't request this, you can safely ignore this email.</p>
  `.trim();

  return {
    subject: 'Reset your password',
    html,
    text,
  };
}

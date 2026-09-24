import { Logger } from '@nestjs/common';
import { MailTransport } from '../mail-transport.interface';
import { SendMailInput } from '../mail.service';

export interface SendGridTransportConfig {
  apiKey: string;
  defaultFrom: string;
}

function toAddressList(value: string | string[] | undefined): { email: string }[] | undefined {
  if (!value) return undefined;
  const list = Array.isArray(value) ? value : [value];
  return list.map((email) => ({ email }));
}

// A second Strategy implementation of MailTransport — proves the interface
// isn't SMTP-shaped. Talks to SendGrid's HTTP API directly (Node's built-in
// fetch) instead of nodemailer, so it works for providers SMTP can't reach.
// Registered the same way as NodemailerTransport: MailService builds one per
// connection whose env vars select this provider (MAIL_<NAME>_PROVIDER=sendgrid
// + SENDGRID_<NAME>_API_KEY), or a caller can register a manual instance via
// mailService.registerTransport().
export class SendGridTransport implements MailTransport {
  private static readonly ENDPOINT = 'https://api.sendgrid.com/v3/mail/send';
  private readonly logger = new Logger(SendGridTransport.name);

  constructor(private readonly config: SendGridTransportConfig) {}

  async send(input: SendMailInput): Promise<void> {
    const from = input.from || this.config.defaultFrom;
    const to = toAddressList(input.to) ?? [];

    const body = {
      personalizations: [
        {
          to,
          cc: toAddressList(input.cc),
          bcc: toAddressList(input.bcc),
        },
      ],
      from: { email: from },
      reply_to: input.replyTo ? { email: input.replyTo } : undefined,
      subject: input.subject,
      content: [
        { type: 'text/plain', value: input.text },
        { type: 'text/html', value: input.html },
      ],
      attachments: input.attachments?.map((attachment) => ({
        filename: attachment.filename,
        type: attachment.contentType,
        content: Buffer.isBuffer(attachment.content)
          ? attachment.content.toString('base64')
          : Buffer.from(attachment.content ?? '', 'utf-8').toString('base64'),
      })),
    };

    const response = await fetch(SendGridTransport.ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`SendGrid send failed (${response.status}): ${detail}`);
    }

    this.logger.log(`Mail sent to ${input.to} (subject: "${input.subject}")`);
  }
}

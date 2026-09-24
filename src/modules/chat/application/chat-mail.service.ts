import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '@/common/mail/mail.service';
import { ContactRequestData, contactRequestTemplate } from './mail/contact-request.template';
import {
  NoOperatorAvailableData,
  noOperatorAvailableTemplate,
} from './mail/no-operator-available.template';

export interface MailRecipientOverrides {
  to?: string | string[];
  from?: string;
}

// Owns "what a chat notification email looks like and who it goes to by
// default" — MailService itself stays domain-agnostic (just transport), so
// other modules can add their own equivalent wrapper without touching it or
// this one. See _claude notes on the mail.service split.
//
// Which transport connection chat sends through is an env var, not a code
// change — set CHAT_MAIL_CONNECTION=gmail locally (with SMTP_GMAIL_USER/PASS
// set to a Gmail app password) to test chat mail via Gmail without touching
// the default SMTP_* connection other modules use.
@Injectable()
export class ChatMailService {
  private readonly logger = new Logger(ChatMailService.name);

  constructor(private readonly mailService: MailService) {}

  async sendNoOperatorAvailableNotice(
    data: NoOperatorAvailableData,
    overrides?: MailRecipientOverrides,
  ): Promise<boolean> {
    const to = overrides?.to ?? process.env.MAIL_CONTACT_TO ?? 'info@gedc.ge';
    const { subject, html, text } = noOperatorAvailableTemplate(data);
    return this.mailService
      .send({ to, from: overrides?.from, subject, html, text, connection: this.connection() })
      .then(() => true)
      .catch((err) => {
        this.logger.error('sendNoOperatorAvailableNotice failed', err);
        return false;
      });
  }

  async sendContactRequestNotice(
    data: ContactRequestData,
    overrides?: MailRecipientOverrides,
  ): Promise<boolean> {
    const to = overrides?.to ?? process.env.MAIL_CONTACT_TO ?? 'info@gedc.ge';
    const { subject, html, text } = contactRequestTemplate(data);
    return this.mailService
      .send({ to, from: overrides?.from, subject, html, text, connection: this.connection() })
      .then(() => true)
      .catch((err) => {
        this.logger.error('sendContactRequestNotice failed', err);
        return false;
      });
  }

  private connection(): string | undefined {
    return process.env.CHAT_MAIL_CONNECTION || undefined;
  }
}

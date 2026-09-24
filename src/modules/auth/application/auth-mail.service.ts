import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '@/common/mail/mail.service';
import { PasswordResetData, passwordResetTemplate } from './mail/password-reset.template';

// Owns "what an auth email looks like and who it goes to" — same shape as
// ChatMailService, proving the pattern generalizes: a new feature module
// plugs in its own thin wrapper over the shared MailService without that
// service (or any other module's wrapper) ever changing.
@Injectable()
export class AuthMailService {
  private readonly logger = new Logger(AuthMailService.name);

  constructor(private readonly mailService: MailService) {}

  async sendPasswordResetLink(to: string, data: PasswordResetData): Promise<boolean> {
    const { subject, html, text } = passwordResetTemplate(data);
    return this.mailService
      .send({ to, subject, html, text })
      .then(() => true)
      .catch((err) => {
        this.logger.error('sendPasswordResetLink failed', err);
        return false;
      });
  }
}

import { MailTransport } from '../mail-transport.interface';
import {
  MailTransportBuildParams,
  MailTransportFactory,
} from '../mail-transport-factory.interface';
import { NodemailerTransport } from './nodemailer.transport';

// Fully env-driven — no provider gets special-cased host/port defaults here.
// A connection named 'gmail' is configured exactly like any other:
// SMTP_GMAIL_HOST=smtp.gmail.com, SMTP_GMAIL_PORT=465, SMTP_GMAIL_SECURE=true,
// SMTP_GMAIL_USER/PASS, MAIL_GMAIL_FROM.
export class NodemailerTransportFactory implements MailTransportFactory {
  readonly providerId = 'smtp';

  build({ envPrefix, defaultFrom }: MailTransportBuildParams): MailTransport | null {
    const host = process.env[`${envPrefix}_HOST`];
    if (!host) return null;

    return new NodemailerTransport({
      host,
      port: Number(process.env[`${envPrefix}_PORT`] ?? 587),
      secure: process.env[`${envPrefix}_SECURE`] === 'true',
      user: process.env[`${envPrefix}_USER`],
      pass: process.env[`${envPrefix}_PASS`],
      defaultFrom,
    });
  }
}

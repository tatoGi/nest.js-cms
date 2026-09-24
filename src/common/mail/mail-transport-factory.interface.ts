import { MailTransport } from './mail-transport.interface';

export const MAIL_TRANSPORT_FACTORIES = Symbol('MAIL_TRANSPORT_FACTORIES');

export interface MailTransportBuildParams {
  // Logical connection name ('default', 'marketing', 'gmail', ...).
  connection: string;
  isDefault: boolean;
  // The env-var group prefix already resolved for this connection, e.g.
  // 'SMTP' for default or 'SMTP_MARKETING' for a named one — factories that
  // don't use the SMTP_* shape (e.g. an HTTP API provider) can ignore it and
  // read their own env vars off `connection` directly.
  envPrefix: string;
  defaultFrom: string;
}

// Strategy-factory: one implementation per mail provider. MailService only
// ever depends on this abstraction (a list of factories), never on a
// concrete provider class — adding a new provider (SES, Mailgun, Postmark,
// ...) means writing one new class and registering it in MailModule; nothing
// in MailService changes (Open/Closed).
export interface MailTransportFactory {
  // Matches MAIL_<NAME>_PROVIDER (default: 'smtp') to pick which factory
  // builds a given connection.
  readonly providerId: string;
  // Returns null when this connection isn't configured for this provider
  // (e.g. no host/API key in env) — MailService treats that as "not
  // configured", same as today's SMTP_HOST-missing case.
  build(params: MailTransportBuildParams): MailTransport | null;
}

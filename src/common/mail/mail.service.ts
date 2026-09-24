import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { MailTransport } from './mail-transport.interface';
import { MAIL_TRANSPORT_FACTORIES, MailTransportFactory } from './mail-transport-factory.interface';
import { NodemailerTransport } from './transports/nodemailer.transport';
import { RetryingTransport } from './transports/retrying.transport';

export interface MailAttachment {
  filename: string;
  // One of content or path — content for in-memory data (buffers/generated
  // PDFs/CSVs), path for a file already on disk. Mirrors nodemailer's own
  // attachment shape so NodemailerTransport can pass it through unchanged.
  content?: Buffer | string;
  path?: string;
  contentType?: string;
}

export interface SendMailInput {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
  // Overrides the connection's default "from" for this send — callers with
  // more specific context (e.g. a region-specific inbox) can supply their
  // own; omit to use the connection's configured default.
  from?: string;
  subject: string;
  html: string;
  text: string;
  attachments?: MailAttachment[];
  // Which registered transport to send through — omit for the default SMTP
  // connection (env: SMTP_HOST/SMTP_PORT/...). A named connection (e.g.
  // 'marketing') reads SMTP_MARKETING_HOST/... instead, a wholly different
  // provider (env: MAIL_<NAME>_PROVIDER=sendgrid), or a per-user relay
  // registered via registerUserTransport(). See docs on adding new
  // senders/providers.
  connection?: string;
}

export interface UserMailCredentials {
  host: string;
  port?: number;
  secure?: boolean;
  user: string;
  pass: string;
  from: string;
}

const DEFAULT_CONNECTION = 'default';
const DEFAULT_PROVIDER = 'smtp';

function userConnectionName(userId: string): string {
  return `user:${userId}`;
}

// Transport-only: knows how to deliver an already-rendered message via
// whichever registered MailTransport a call asks for, nothing about *what*
// any particular module sends or to whom by default. Content (templates)
// and domain-specific recipient defaults belong to the owning module (see
// modules/chat/application/mail and modules/auth/application/mail).
//
// Acts as a Strategy registry keyed by connection name. Building a
// connection's transport is delegated to injected MailTransportFactory
// implementations (Dependency Inversion — this class knows only the
// abstraction, never a concrete provider like Nodemailer/SendGrid), so
// adding a new provider is a new factory registered in MailModule, not a
// change here (Open/Closed). Each resolved transport is wrapped with retry
// per MAIL_RETRY_ATTEMPTS (or MAIL_<NAME>_RETRY_ATTEMPTS), so failure
// handling is one shared decorator instead of per-provider logic.
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transports = new Map<string, MailTransport>();

  constructor(
    @Optional()
    @Inject(MAIL_TRANSPORT_FACTORIES)
    private readonly factories: MailTransportFactory[] = [],
  ) {}

  // Escape hatch for a transport that doesn't fit the factory/env-var model
  // (a mocked transport in tests, a one-off manually constructed provider,
  // etc.) — registers under `connection` and takes priority over the
  // factory-based auto-construction in resolveTransport().
  registerTransport(connection: string, transport: MailTransport): void {
    this.transports.set(connection, transport);
  }

  // Registers a connection backed by one user's own SMTP credentials (e.g.
  // "send as the logged-in operator's personal mailbox") rather than a
  // shared env-configured connection. Call this once credentials are known
  // (e.g. when loading the user), then send with
  // connection: MailService.userConnection(userId).
  registerUserTransport(userId: string, credentials: UserMailCredentials): void {
    const connection = userConnectionName(userId);
    // Deliberately bypasses the factory registry — per-user credentials come
    // from application data (a User row), not process.env, so there's no
    // "provider selection" step to delegate to a MailTransportFactory.
    const transport = new NodemailerTransport({
      host: credentials.host,
      port: credentials.port ?? 587,
      secure: credentials.secure ?? false,
      user: credentials.user,
      pass: credentials.pass,
      defaultFrom: credentials.from,
    });
    this.transports.set(connection, this.wrapWithRetry(transport, connection));
  }

  static userConnection(userId: string): string {
    return userConnectionName(userId);
  }

  private findFactory(providerId: string): MailTransportFactory | undefined {
    return this.factories.find((factory) => factory.providerId === providerId);
  }

  private wrapWithRetry(transport: MailTransport, connection: string): MailTransport {
    const isDefault = connection === DEFAULT_CONNECTION;
    const attemptsEnvKey = isDefault
      ? 'MAIL_RETRY_ATTEMPTS'
      : `MAIL_${connection.toUpperCase()}_RETRY_ATTEMPTS`;
    const attempts = Number(process.env[attemptsEnvKey] ?? process.env.MAIL_RETRY_ATTEMPTS ?? 1);
    if (!Number.isFinite(attempts) || attempts <= 1) return transport;
    return new RetryingTransport(transport, { attempts });
  }

  private resolveTransport(connection: string): MailTransport | null {
    const existing = this.transports.get(connection);
    if (existing) return existing;

    const isDefault = connection === DEFAULT_CONNECTION;
    const envPrefix = isDefault ? 'SMTP' : `SMTP_${connection.toUpperCase()}`;
    const providerEnvKey = isDefault
      ? 'MAIL_PROVIDER'
      : `MAIL_${connection.toUpperCase()}_PROVIDER`;
    const providerId = (process.env[providerEnvKey] || DEFAULT_PROVIDER).toLowerCase();
    const fromEnvKey = isDefault ? 'MAIL_FROM' : `MAIL_${connection.toUpperCase()}_FROM`;
    const defaultFrom = process.env[fromEnvKey] || 'no-reply@gedc.ge';

    const factory = this.findFactory(providerId);
    if (!factory) {
      this.logger.warn(
        `No transport factory registered for provider "${providerId}" (connection "${connection}")`,
      );
      return null;
    }

    const built = factory.build({ connection, isDefault, envPrefix, defaultFrom });
    if (!built) return null;

    const transport = this.wrapWithRetry(built, connection);
    this.transports.set(connection, transport);
    return transport;
  }

  async send(input: SendMailInput): Promise<void> {
    const connection = input.connection ?? DEFAULT_CONNECTION;
    const transport = this.resolveTransport(connection);
    if (!transport) {
      // Throw rather than silently no-op — callers (ChatMailService etc.)
      // catch send() rejections and record the outcome (e.g.
      // ChatSession.contactRequestEmailSent); resolving here would mark a
      // never-attempted send as a false-positive success.
      throw new Error(
        `No transport configured for connection "${connection}" — cannot send email to ${input.to}: ${input.subject}`,
      );
    }
    await transport.send(input);
  }
}

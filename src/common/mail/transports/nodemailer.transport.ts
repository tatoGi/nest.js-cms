import { Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { MailTransport } from '../mail-transport.interface';
import { SendMailInput } from '../mail.service';

export interface NodemailerTransportConfig {
  host: string | undefined;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  defaultFrom: string;
}

// SMTP implementation of MailTransport, via nodemailer. Config is passed in
// (not read from process.env internally) so MailService can construct one
// instance per named connection, each with its own host/credentials —
// see mail.service.ts's transport registry.
export class NodemailerTransport implements MailTransport {
  private readonly logger = new Logger(NodemailerTransport.name);
  private transporter: Transporter | null = null;

  constructor(private readonly config: NodemailerTransportConfig) {}

  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;
    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: this.config.user ? { user: this.config.user, pass: this.config.pass } : undefined,
    });
    return this.transporter;
  }

  async send(input: SendMailInput): Promise<void> {
    const from = input.from || this.config.defaultFrom;
    const info = await this.getTransporter().sendMail({
      from,
      to: input.to,
      cc: input.cc,
      bcc: input.bcc,
      replyTo: input.replyTo,
      subject: input.subject,
      html: input.html,
      text: input.text,
      attachments: input.attachments,
    });
    // Guarded: the mail has already been accepted by the server at this point,
    // so a missing/odd info object must not turn a successful send into a
    // thrown error. Real SMTP always returns a messageId, but custom or
    // stubbed transports don't necessarily.
    this.logger.log(
      `Mail sent to ${input.to} (subject: "${input.subject}", messageId: ${info?.messageId ?? 'unknown'})`,
    );
  }
}

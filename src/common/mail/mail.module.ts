import { Module } from '@nestjs/common';
import { MAIL_TRANSPORT_FACTORIES } from './mail-transport-factory.interface';
import { MailService } from './mail.service';
import { NodemailerTransportFactory } from './transports/nodemailer.transport-factory';
import { SendGridTransportFactory } from './transports/sendgrid.transport-factory';

// Provider strategies are registered here, not inside MailService — adding a
// new provider (SES, Mailgun, Postmark, ...) means adding one factory class
// and one line to this array; MailService's own source never changes.
@Module({
  providers: [
    MailService,
    {
      provide: MAIL_TRANSPORT_FACTORIES,
      useValue: [new NodemailerTransportFactory(), new SendGridTransportFactory()],
    },
  ],
  exports: [MailService],
})
export class MailModule {}

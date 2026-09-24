import { MailTransport } from '../mail-transport.interface';
import {
  MailTransportBuildParams,
  MailTransportFactory,
} from '../mail-transport-factory.interface';
import { SendGridTransport } from './sendgrid.transport';

export class SendGridTransportFactory implements MailTransportFactory {
  readonly providerId = 'sendgrid';

  build({ connection, isDefault, defaultFrom }: MailTransportBuildParams): MailTransport | null {
    const apiKeyEnvKey = isDefault
      ? 'SENDGRID_API_KEY'
      : `SENDGRID_${connection.toUpperCase()}_API_KEY`;
    const apiKey = process.env[apiKeyEnvKey];
    if (!apiKey) return null;

    return new SendGridTransport({ apiKey, defaultFrom });
  }
}

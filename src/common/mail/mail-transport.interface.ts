import { SendMailInput } from './mail.service';

// Strategy interface — anything that can deliver an already-rendered
// message. NodemailerTransport (SMTP) is the only implementation today;
// a future SendGridTransport/SesTransport/etc. would implement this same
// contract, letting MailService register it under a connection name without
// MailService itself — or any domain wrapper calling send() — changing.
export interface MailTransport {
  send(input: SendMailInput): Promise<void>;
}

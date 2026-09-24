import { Test, TestingModule } from '@nestjs/testing';
import * as nodemailer from 'nodemailer';
import { MAIL_TRANSPORT_FACTORIES } from './mail-transport-factory.interface';
import { MailService } from './mail.service';
import { NodemailerTransportFactory } from './transports/nodemailer.transport-factory';
import { SendGridTransportFactory } from './transports/sendgrid.transport-factory';

jest.mock('nodemailer');

const DEFAULT_FACTORIES = [new NodemailerTransportFactory(), new SendGridTransportFactory()];

async function createMailService(factories = DEFAULT_FACTORIES): Promise<MailService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [MailService, { provide: MAIL_TRANSPORT_FACTORIES, useValue: factories }],
  }).compile();
  return module.get(MailService);
}

describe('MailService — no transport factories registered', () => {
  it('send() throws (rather than silently no-op) when no factories are provided', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MailService],
    }).compile();
    const service = module.get(MailService);

    await expect(
      service.send({ to: 'a@b.com', subject: 'Hi', html: '<p>hi</p>', text: 'hi' }),
    ).rejects.toThrow(/No transport configured/);
  });
});

describe('MailService — SMTP not configured', () => {
  let service: MailService;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    delete process.env.SMTP_HOST;
    service = await createMailService();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('send() throws (rather than silently no-op) when SMTP_HOST is unset', async () => {
    await expect(
      service.send({ to: 'a@b.com', subject: 'Hi', html: '<p>hi</p>', text: 'hi' }),
    ).rejects.toThrow(/No transport configured/);
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });
});

describe('MailService — SMTP configured', () => {
  let service: MailService;
  let sendMailMock: jest.Mock;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    // Mirrors what nodemailer actually resolves — the transport logs
    // info.messageId after a successful send.
    sendMailMock = jest.fn().mockResolvedValue({ messageId: '<test@example.com>' });
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail: sendMailMock });

    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_SECURE = 'false';
    process.env.MAIL_FROM = 'no-reply@gedc.ge';

    service = await createMailService();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  it('sends via the configured transporter, using MAIL_FROM by default', async () => {
    await service.send({ to: 'a@b.com', subject: 'Hi', html: '<p>hi</p>', text: 'hi' });

    expect(sendMailMock).toHaveBeenCalledWith({
      from: 'no-reply@gedc.ge',
      to: 'a@b.com',
      cc: undefined,
      bcc: undefined,
      replyTo: undefined,
      subject: 'Hi',
      html: '<p>hi</p>',
      text: 'hi',
      attachments: undefined,
    });
  });

  it('uses the per-call from override instead of MAIL_FROM when provided', async () => {
    await service.send({
      to: 'a@b.com',
      from: 'support@gedc.ge',
      subject: 'Hi',
      html: 'x',
      text: 'x',
    });

    expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({ from: 'support@gedc.ge' }));
  });

  it('accepts multiple recipients', async () => {
    await service.send({
      to: ['a@b.com', 'c@d.com'],
      subject: 'Hi',
      html: 'x',
      text: 'x',
    });

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: ['a@b.com', 'c@d.com'] }),
    );
  });

  it('passes cc, bcc, replyTo and attachments through to the transporter', async () => {
    await service.send({
      to: 'a@b.com',
      cc: 'cc@b.com',
      bcc: ['bcc1@b.com', 'bcc2@b.com'],
      replyTo: 'reply@b.com',
      subject: 'Hi',
      html: 'x',
      text: 'x',
      attachments: [
        { filename: 'invoice.pdf', content: Buffer.from('pdf'), contentType: 'application/pdf' },
      ],
    });

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cc: 'cc@b.com',
        bcc: ['bcc1@b.com', 'bcc2@b.com'],
        replyTo: 'reply@b.com',
        attachments: [
          expect.objectContaining({ filename: 'invoice.pdf', contentType: 'application/pdf' }),
        ],
      }),
    );
  });

  it('reuses the same transporter across multiple sends', async () => {
    await service.send({ to: 'a@b.com', subject: 'One', html: 'x', text: 'x' });
    await service.send({ to: 'a@b.com', subject: 'Two', html: 'x', text: 'x' });

    expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
  });
});

describe('MailService — named connections', () => {
  let service: MailService;
  let sendMailMock: jest.Mock;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    // Mirrors what nodemailer actually resolves — the transport logs
    // info.messageId after a successful send.
    sendMailMock = jest.fn().mockResolvedValue({ messageId: '<test@example.com>' });
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail: sendMailMock });

    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.MAIL_FROM = 'no-reply@gedc.ge';
    process.env.SMTP_MARKETING_HOST = 'smtp.marketing.example.com';
    process.env.SMTP_MARKETING_PORT = '2525';
    process.env.MAIL_MARKETING_FROM = 'campaigns@gedc.ge';

    service = await createMailService();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  it('a named connection reads its own env-var group instead of the default', async () => {
    await service.send({
      to: 'a@b.com',
      subject: 'Hi',
      html: 'x',
      text: 'x',
      connection: 'marketing',
    });

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'campaigns@gedc.ge' }),
    );
  });

  it('default and named connections build independent transporters', async () => {
    await service.send({ to: 'a@b.com', subject: 'Hi', html: 'x', text: 'x' });
    await service.send({
      to: 'a@b.com',
      subject: 'Hi',
      html: 'x',
      text: 'x',
      connection: 'marketing',
    });

    expect(nodemailer.createTransport).toHaveBeenCalledTimes(2);
  });

  it('throws when a named connection has no configured host', async () => {
    await expect(
      service.send({
        to: 'a@b.com',
        subject: 'Hi',
        html: 'x',
        text: 'x',
        connection: 'unconfigured',
      }),
    ).rejects.toThrow(/No transport configured/);
  });

  it('a connection named "gmail" is configured like any other — no built-in host/port', async () => {
    process.env.SMTP_GMAIL_USER = 'me@gmail.com';
    process.env.SMTP_GMAIL_PASS = 'app-password';

    await expect(
      service.send({ to: 'a@b.com', subject: 'Hi', html: 'x', text: 'x', connection: 'gmail' }),
    ).rejects.toThrow(/No transport configured/);
    expect(nodemailer.createTransport).not.toHaveBeenCalled();

    process.env.SMTP_GMAIL_HOST = 'smtp.gmail.com';
    process.env.SMTP_GMAIL_PORT = '465';
    process.env.SMTP_GMAIL_SECURE = 'true';

    await service.send({ to: 'a@b.com', subject: 'Hi', html: 'x', text: 'x', connection: 'gmail' });
    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'smtp.gmail.com', port: 465, secure: true }),
    );
  });
});

describe('MailService — registerTransport (a non-nodemailer provider)', () => {
  it('a manually registered transport takes priority over factory-based auto-construction', async () => {
    const service = await createMailService();

    const fakeTransport = { send: jest.fn().mockResolvedValue(undefined) };
    service.registerTransport('custom', fakeTransport);

    await service.send({
      to: 'a@b.com',
      subject: 'Hi',
      html: 'x',
      text: 'x',
      connection: 'custom',
    });

    expect(fakeTransport.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'a@b.com', subject: 'Hi' }),
    );
  });
});

describe('MailService — provider selection (MAIL_<NAME>_PROVIDER)', () => {
  const originalEnv = { ...process.env };
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ ok: true });
    (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  it('a connection configured with provider=sendgrid sends via the SendGrid HTTP API, not nodemailer', async () => {
    process.env.MAIL_TRANSACTIONAL_PROVIDER = 'sendgrid';
    process.env.SENDGRID_TRANSACTIONAL_API_KEY = 'sg-key';
    process.env.MAIL_TRANSACTIONAL_FROM = 'txn@gedc.ge';

    const service = await createMailService();
    await service.send({
      to: 'a@b.com',
      subject: 'Hi',
      html: 'x',
      text: 'x',
      connection: 'transactional',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.sendgrid.com/v3/mail/send',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  it('throws when the selected provider has no matching registered factory', async () => {
    process.env.MAIL_UNKNOWN_PROVIDER = 'ses';

    const service = await createMailService();
    await expect(
      service.send({ to: 'a@b.com', subject: 'Hi', html: 'x', text: 'x', connection: 'unknown' }),
    ).rejects.toThrow(/No transport configured/);
  });
});

describe('MailService — retry (MAIL_RETRY_ATTEMPTS)', () => {
  const originalEnv = { ...process.env };
  let sendMailMock: jest.Mock;

  beforeEach(() => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.MAIL_FROM = 'no-reply@gedc.ge';
    process.env.MAIL_RETRY_ATTEMPTS = '3';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  it('retries a failing send up to the configured attempts, then succeeds', async () => {
    sendMailMock = jest
      .fn()
      .mockRejectedValueOnce(new Error('smtp timeout'))
      .mockResolvedValueOnce(undefined);
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail: sendMailMock });

    const service = await createMailService();
    await service.send({ to: 'a@b.com', subject: 'Hi', html: 'x', text: 'x' });

    expect(sendMailMock).toHaveBeenCalledTimes(2);
  });

  it('throws once all retry attempts are exhausted', async () => {
    sendMailMock = jest.fn().mockRejectedValue(new Error('smtp down'));
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail: sendMailMock });

    const service = await createMailService();
    await expect(
      service.send({ to: 'a@b.com', subject: 'Hi', html: 'x', text: 'x' }),
    ).rejects.toThrow('smtp down');
    expect(sendMailMock).toHaveBeenCalledTimes(3);
  });
});

describe('MailService — registerUserTransport (per-user relay credentials)', () => {
  let sendMailMock: jest.Mock;

  beforeEach(() => {
    // Mirrors what nodemailer actually resolves — the transport logs
    // info.messageId after a successful send.
    sendMailMock = jest.fn().mockResolvedValue({ messageId: '<test@example.com>' });
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail: sendMailMock });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('sends through a transport built from the given user credentials, using their address as from', async () => {
    const service = await createMailService();
    service.registerUserTransport('user-42', {
      host: 'smtp.userhost.com',
      user: 'jane@personal.com',
      pass: 'secret',
      from: 'jane@personal.com',
    });

    await service.send({
      to: 'recipient@b.com',
      subject: 'Hi',
      html: 'x',
      text: 'x',
      connection: MailService.userConnection('user-42'),
    });

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'jane@personal.com', to: 'recipient@b.com' }),
    );
  });

  it('two different users get independent transporters', async () => {
    const service = await createMailService();
    service.registerUserTransport('user-1', {
      host: 'smtp.a.com',
      user: 'a@personal.com',
      pass: 'x',
      from: 'a@personal.com',
    });
    service.registerUserTransport('user-2', {
      host: 'smtp.b.com',
      user: 'b@personal.com',
      pass: 'x',
      from: 'b@personal.com',
    });

    await service.send({
      to: 'r@b.com',
      subject: 'Hi',
      html: 'x',
      text: 'x',
      connection: MailService.userConnection('user-1'),
    });
    await service.send({
      to: 'r@b.com',
      subject: 'Hi',
      html: 'x',
      text: 'x',
      connection: MailService.userConnection('user-2'),
    });

    expect(nodemailer.createTransport).toHaveBeenCalledTimes(2);
  });
});

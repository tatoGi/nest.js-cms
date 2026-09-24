import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from '@/common/mail/mail.service';
import { ChatMailService } from './chat-mail.service';

describe('ChatMailService', () => {
  let service: ChatMailService;
  let mailService: { send: jest.Mock };
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    mailService = { send: jest.fn().mockResolvedValue(undefined) };
    process.env.MAIL_CONTACT_TO = 'info@gedc.ge';

    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatMailService, { provide: MailService, useValue: mailService }],
    }).compile();

    service = module.get(ChatMailService);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('sendContactRequestNotice sends to MAIL_CONTACT_TO by default and reports success', async () => {
    const result = await service.sendContactRequestNotice({ visitorName: 'Jane' });

    expect(mailService.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'info@gedc.ge' }));
    expect(result).toBe(true);
  });

  it('sendContactRequestNotice honors a to/from override instead of the default', async () => {
    await service.sendContactRequestNotice(
      { visitorName: 'Jane' },
      { to: 'region-west@gedc.ge', from: 'support@gedc.ge' },
    );

    expect(mailService.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'region-west@gedc.ge', from: 'support@gedc.ge' }),
    );
  });

  it('sendContactRequestNotice reports failure instead of throwing when send() rejects', async () => {
    mailService.send.mockRejectedValue(new Error('smtp down'));

    const result = await service.sendContactRequestNotice({ visitorName: 'Jane' });

    expect(result).toBe(false);
  });

  it('sendNoOperatorAvailableNotice sends to MAIL_CONTACT_TO by default', async () => {
    const result = await service.sendNoOperatorAvailableNotice({ visitorName: 'Jane' });

    expect(mailService.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'info@gedc.ge' }));
    expect(result).toBe(true);
  });

  it('sendNoOperatorAvailableNotice reports failure instead of throwing when send() rejects', async () => {
    mailService.send.mockRejectedValue(new Error('smtp down'));

    const result = await service.sendNoOperatorAvailableNotice({ visitorName: 'Jane' });

    expect(result).toBe(false);
  });
});

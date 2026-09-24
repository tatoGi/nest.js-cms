import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from '@/common/mail/mail.service';
import { AuthMailService } from './auth-mail.service';

describe('AuthMailService', () => {
  let service: AuthMailService;
  let mailService: { send: jest.Mock };

  beforeEach(async () => {
    mailService = { send: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthMailService, { provide: MailService, useValue: mailService }],
    }).compile();

    service = module.get(AuthMailService);
  });

  it('sendPasswordResetLink sends to the given address with a rendered link and reports success', async () => {
    const result = await service.sendPasswordResetLink('jane@example.com', {
      resetUrl: 'https://cms.example.com/reset-password?token=abc123',
    });

    expect(mailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane@example.com',
        subject: expect.stringContaining('Reset your password'),
        html: expect.stringContaining('https://cms.example.com/reset-password?token=abc123'),
      }),
    );
    expect(result).toBe(true);
  });

  it('sendPasswordResetLink reports failure instead of throwing when send() rejects', async () => {
    mailService.send.mockRejectedValue(new Error('smtp down'));

    const result = await service.sendPasswordResetLink('jane@example.com', {
      resetUrl: 'https://cms.example.com/reset-password?token=abc123',
    });

    expect(result).toBe(false);
  });
});

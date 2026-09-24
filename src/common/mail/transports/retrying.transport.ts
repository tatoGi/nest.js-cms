import { Logger } from '@nestjs/common';
import { MailTransport } from '../mail-transport.interface';
import { SendMailInput } from '../mail.service';

export interface RetryOptions {
  attempts: number;
  baseDelayMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Decorator — wraps any MailTransport with exponential-backoff retry, so
// retry behavior is one wrapping call at construction time rather than
// something every transport implementation has to duplicate. Re-throws the
// last error once attempts are exhausted; callers (ChatMailService,
// AuthMailService, ...) already catch send() rejections today.
export class RetryingTransport implements MailTransport {
  private readonly logger = new Logger(RetryingTransport.name);

  constructor(
    private readonly inner: MailTransport,
    private readonly options: RetryOptions,
  ) {}

  async send(input: SendMailInput): Promise<void> {
    const attempts = Math.max(1, this.options.attempts);
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        await this.inner.send(input);
        return;
      } catch (err) {
        lastError = err;
        if (attempt < attempts) {
          const delay = (this.options.baseDelayMs ?? 500) * 2 ** (attempt - 1);
          this.logger.warn(
            `send attempt ${attempt}/${attempts} failed, retrying in ${delay}ms: ${(err as Error)?.message}`,
          );
          await sleep(delay);
        }
      }
    }

    throw lastError;
  }
}

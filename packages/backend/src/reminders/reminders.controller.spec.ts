import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { RemindersController, secretsMatch } from './reminders.controller';

const SECRET = 'a'.repeat(40);

function build(secret?: string) {
  const reminders = {
    sendDueReminders: jest.fn().mockResolvedValue({ sent: 0 }),
  };
  const config = { get: () => secret };
  return {
    controller: new RemindersController(reminders as never, config as never),
    reminders,
  };
}

describe('RemindersController', () => {
  it('runs the job with the right secret', async () => {
    const { controller, reminders } = build(SECRET);
    await controller.run(SECRET);
    expect(reminders.sendDueReminders).toHaveBeenCalled();
  });

  it('rejects a missing or wrong secret', () => {
    const { controller, reminders } = build(SECRET);
    expect(() => controller.run(undefined)).toThrow(UnauthorizedException);
    expect(() => controller.run('wrong')).toThrow(UnauthorizedException);
    expect(reminders.sendDueReminders).not.toHaveBeenCalled();
  });

  it('is unavailable when CRON_SECRET is not configured', () => {
    const { controller } = build(undefined);
    expect(() => controller.run(SECRET)).toThrow(ServiceUnavailableException);
  });

  it('compares secrets of different lengths without throwing', () => {
    expect(secretsMatch('short', SECRET)).toBe(false);
    expect(secretsMatch(SECRET, SECRET)).toBe(true);
  });
});

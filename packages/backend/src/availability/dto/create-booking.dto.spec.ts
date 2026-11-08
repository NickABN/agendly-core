import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateBookingDto } from './create-booking.dto';

function build(overrides: Record<string, unknown> = {}) {
  return plainToInstance(CreateBookingDto, {
    employeeId: 'emp-1',
    serviceId: 'svc-1',
    startTime: '2030-06-10T16:00:00.000Z',
    clientName: 'Ana López',
    clientPhone: '5512345678',
    clientEmail: 'ana@example.com',
    ...overrides,
  });
}

describe('CreateBookingDto clientPhone normalization', () => {
  it.each([
    ['5512345678', '+525512345678'],
    ['55 1234 5678', '+525512345678'],
    ['+52 55 1234 5678', '+525512345678'],
    ['5215512345678', '+525512345678'],
    ['0445512345678', '+525512345678'],
  ])('normalizes %s to %s on transform', async (input, expected) => {
    const dto = build({ clientPhone: input });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.clientPhone).toBe(expected);
  });

  it('keeps accepting the previous valid plain 10-digit input (regression)', async () => {
    const dto = build({ clientPhone: '5512345678' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.clientPhone).toBe('+525512345678');
  });

  it.each(['', 'abcdefghij', '12345', '+15512345678', '55 1234 ABCD'])(
    'rejects invalid phone %s with the friendly message',
    async (input) => {
      const dto = build({ clientPhone: input });
      const errors = await validate(dto);
      const phoneError = errors.find((e) => e.property === 'clientPhone');
      expect(phoneError).toBeDefined();
      expect(Object.values(phoneError!.constraints ?? {})).toContain(
        'El teléfono no es válido',
      );
    },
  );
});

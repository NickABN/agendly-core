import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateTenantDto } from './update-tenant.dto';

function build(overrides: Record<string, unknown> = {}) {
  return plainToInstance(UpdateTenantDto, { ...overrides });
}

describe('UpdateTenantDto phone normalization', () => {
  it.each([
    ['5512345678', '+525512345678'],
    ['55 1234 5678', '+525512345678'],
    ['+52 55 1234 5678', '+525512345678'],
    ['0445512345678', '+525512345678'],
    // International numbers accepted (E.164 passthrough)
    ['+1 415 555 1234', '+14155551234'],
    ['+34 612 345 678', '+34612345678'],
  ])('normalizes %s to %s', async (input, expected) => {
    const dto = build({ phone: input });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.phone).toBe(expected);
  });

  it('leaves the tenant phone absent when the field is not provided', async () => {
    const dto = build({ name: 'Salón' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.phone).toBeUndefined();
  });

  it('treats an empty string as clearing the phone (stays optional)', async () => {
    const dto = build({ phone: '' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    // Empty clears the value: null so Prisma removes the stored phone.
    expect(dto.phone).toBeNull();
  });

  it.each(['abcde', '12345', '+0123456789'])(
    'rejects invalid phone %s with the friendly message',
    async (input) => {
      const dto = build({ phone: input });
      const errors = await validate(dto);
      const phoneError = errors.find((e) => e.property === 'phone');
      expect(phoneError).toBeDefined();
      expect(Object.values(phoneError!.constraints ?? {})).toContain(
        'El teléfono no es válido',
      );
    },
  );
});

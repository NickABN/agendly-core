import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateProfileDto } from './update-profile.dto';

function build(overrides: Record<string, unknown> = {}) {
  return plainToInstance(UpdateProfileDto, { ...overrides });
}

describe('UpdateProfileDto phone normalization', () => {
  it('keeps accepting a strict E.164 value (regression)', async () => {
    const dto = build({ phone: '+525512345678' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.phone).toBe('+525512345678');
  });

  it.each([
    ['5512345678', '+525512345678'],
    ['55 1234 5678', '+525512345678'],
    ['0445512345678', '+525512345678'],
  ])(
    'also accepts loose MX input %s by normalizing to %s',
    async (input, expected) => {
      const dto = build({ phone: input });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.phone).toBe(expected);
    },
  );

  it('leaves phone absent when not provided', async () => {
    const dto = build({ name: 'Salón' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.phone).toBeUndefined();
  });

  it('keeps rejecting values that are neither E.164 nor normalizable MX', async () => {
    const dto = build({ phone: 'abcde' });
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'phone')).toBeDefined();
  });

  it('still accepts a generic E.164 number (profile keeps broad E.164 semantics)', async () => {
    const dto = build({ phone: '+15512345678' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.phone).toBe('+15512345678');
  });

  it.each([
    ['+1 415 555 1234', '+14155551234'],
    ['+34 612 345 678', '+34612345678'],
  ])(
    'normalizes international input with separators %s to %s',
    async (input, expected) => {
      const dto = build({ phone: input });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
      expect(dto.phone).toBe(expected);
    },
  );
});

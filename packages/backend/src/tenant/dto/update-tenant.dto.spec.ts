import { validate } from 'class-validator';
import { UpdateTenantDto } from './update-tenant.dto';

describe('UpdateTenantDto timezone validation', () => {
  async function timezoneErrors(timezone: string) {
    const dto = new UpdateTenantDto();
    dto.timezone = timezone;
    const errors = await validate(dto);
    return errors.filter((e) => e.property === 'timezone');
  }

  it('accepts the four Mexican IANA timezones', async () => {
    for (const tz of [
      'America/Mexico_City',
      'America/Cancun',
      'America/Hermosillo',
      'America/Tijuana',
    ]) {
      expect(await timezoneErrors(tz)).toHaveLength(0);
    }
  });

  it('rejects strings that are not valid IANA timezone identifiers', async () => {
    for (const tz of ['America/FakeCity', 'GMT-6', 'CDMX', '']) {
      expect((await timezoneErrors(tz)).length).toBeGreaterThan(0);
    }
  });
});

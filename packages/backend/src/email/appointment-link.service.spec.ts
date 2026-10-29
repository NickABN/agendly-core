import { ConfigService } from '@nestjs/config';
import { AppointmentLinkService } from './appointment-link.service';

function build(values: Record<string, string>) {
  return new AppointmentLinkService({
    get: (key: string) => values[key],
  } as ConfigService);
}

const SECRET = 'a'.repeat(64);

describe('AppointmentLinkService', () => {
  it('round-trips a signed appointment id', () => {
    const links = build({ JWT_SECRET: SECRET });
    expect(links.verify(links.sign('cm1abc'))).toBe('cm1abc');
  });

  it('rejects tampered ids, signatures and malformed tokens', () => {
    const links = build({ JWT_SECRET: SECRET });
    const [, sig] = links.sign('cm1abc').split('.');

    expect(links.verify(`cm1abd.${sig}`)).toBeNull();
    expect(links.verify(`cm1abc.${sig}x`)).toBeNull();
    expect(links.verify('cm1abc')).toBeNull();
    expect(links.verify('.abc')).toBeNull();
    expect(links.verify('')).toBeNull();
  });

  it('does not accept tokens signed with another secret', () => {
    const token = build({ JWT_SECRET: SECRET }).sign('cm1abc');
    expect(build({ JWT_SECRET: 'b'.repeat(64) }).verify(token)).toBeNull();
  });

  it('builds the manage URL on the public app origin', () => {
    const links = build({
      JWT_SECRET: SECRET,
      FRONTEND_URL: 'https://admin.agendly.mx',
      PUBLIC_APP_URL: 'https://agendly-admin1.netlify.app/',
    });
    expect(links.manageUrl('cm1abc')).toBe(
      `https://agendly-admin1.netlify.app/cita/${links.sign('cm1abc')}`,
    );
  });
});

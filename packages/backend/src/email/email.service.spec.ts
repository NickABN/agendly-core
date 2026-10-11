import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

const sendEmailMock = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: sendEmailMock,
    },
  })),
}));

function makeConfig(values: Record<string, string>) {
  return {
    get: (key: string) => values[key],
  } as ConfigService;
}

const bookingData = {
  clientName: 'Ana',
  clientEmail: 'ana@example.com',
  serviceName: 'Haircut',
  employeeName: 'Nico',
  businessName: 'Salon Calma',
  date: '2026-07-07',
  time: '10:00',
  slug: 'salon-calma',
};

describe('EmailService public booking links', () => {
  beforeEach(() => {
    sendEmailMock.mockReset();
    sendEmailMock.mockResolvedValue(undefined);
  });

  it('uses PUBLIC_APP_URL for the customer-facing booking link in cancellation emails', async () => {
    const service = new EmailService(
      makeConfig({
        RESEND_API_KEY: 'test-key',
        FRONTEND_URL: 'https://admin.agendly.mx',
        PUBLIC_APP_URL: 'https://agendly-admin1.netlify.app/',
      }),
    );

    await service.sendBookingCancellation(bookingData);

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining(
          'https://agendly-admin1.netlify.app/salon-calma',
        ),
      }),
    );
    expect(sendEmailMock).not.toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('https://admin.agendly.mx/salon-calma'),
      }),
    );
  });

  it('uses PUBLIC_APP_URL for the Agendly brand link in confirmation emails', async () => {
    const service = new EmailService(
      makeConfig({
        RESEND_API_KEY: 'test-key',
        FRONTEND_URL: 'https://admin.agendly.mx',
        PUBLIC_APP_URL: 'https://agendly-admin1.netlify.app/',
      }),
    );

    await service.sendBookingConfirmation(bookingData);

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining(
          'href="https://agendly-admin1.netlify.app"',
        ),
      }),
    );
  });

  it('falls back to FRONTEND_URL when PUBLIC_APP_URL is not configured locally', async () => {
    const service = new EmailService(
      makeConfig({
        RESEND_API_KEY: 'test-key',
        FRONTEND_URL: 'http://localhost:3001/',
      }),
    );

    await service.sendBookingCancellation(bookingData);

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining('http://localhost:3001/salon-calma'),
      }),
    );
  });
});

describe('EmailService password reset email', () => {
  beforeEach(() => {
    sendEmailMock.mockReset();
    sendEmailMock.mockResolvedValue(undefined);
  });

  it('sends the reset link and mentions the 30 minute validity', async () => {
    const service = new EmailService(
      makeConfig({
        RESEND_API_KEY: 'test-key',
        FRONTEND_URL: 'https://admin.agendly.mx',
      }),
    );
    const resetUrl = 'https://admin.agendly.mx/reset-password?token=abc123';

    await service.sendPasswordReset('ana@example.com', resetUrl);

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ana@example.com',
        subject: expect.stringContaining('contraseña'),
        html: expect.stringContaining(resetUrl),
      }),
    );
    const html: string = sendEmailMock.mock.calls[0][0].html;
    expect(html).toContain('30 minutos');
  });
});

describe('EmailService reminders and HTML escaping', () => {
  beforeEach(() => {
    sendEmailMock.mockReset();
    sendEmailMock.mockResolvedValue({ data: { id: 'e1' }, error: null });
  });

  const service = () =>
    new EmailService(
      makeConfig({
        RESEND_API_KEY: 'test-key',
        PUBLIC_APP_URL: 'https://agendly.mx',
      }),
    );

  it('escapes user-provided names in booking emails', async () => {
    await service().sendBookingConfirmation({
      ...bookingData,
      clientName: '<a href="https://phish.example">Ana</a>',
    });
    const html: string = sendEmailMock.mock.calls[0][0].html;
    expect(html).not.toContain('<a href="https://phish.example">');
    expect(html).toContain(
      '&lt;a href=&quot;https://phish.example&quot;&gt;Ana&lt;/a&gt;',
    );
  });

  it('sends a reminder with the business phone and a stronger ask for high risk', async () => {
    const ok = await service().sendBookingReminder({
      ...bookingData,
      businessPhone: '+52 33 1234 5678',
      emphasizeConfirmation: true,
    });
    expect(ok).toBe(true);
    const { subject, html } = sendEmailMock.mock.calls[0][0];
    expect(subject).toContain('Recordatorio');
    expect(html).toContain('tel:+52 33 1234 5678');
    expect(html).toContain('¿Sigues pudiendo asistir?');
    expect(html).toContain('https://agendly.mx/salon-calma');
  });

  it('reports failure when the provider rejects the email', async () => {
    sendEmailMock.mockResolvedValue({
      data: null,
      error: { message: 'rate limited' },
    });
    const ok = await service().sendBookingReminder({
      ...bookingData,
      businessPhone: null,
      emphasizeConfirmation: false,
    });
    expect(ok).toBe(false);
  });
});

describe('EmailService sender', () => {
  beforeEach(() => {
    sendEmailMock.mockReset();
    sendEmailMock.mockResolvedValue({ data: { id: 'e1' }, error: null });
  });

  it('uses EMAIL_FROM when configured', async () => {
    const service = new EmailService(
      makeConfig({
        RESEND_API_KEY: 'k',
        EMAIL_FROM: 'Agendly <hola@midominio.mx>',
      }),
    );
    await service.sendBookingConfirmation(bookingData);
    expect(sendEmailMock.mock.calls[0][0].from).toBe(
      'Agendly <hola@midominio.mx>',
    );
  });

  it('falls back to the default sender', async () => {
    const service = new EmailService(makeConfig({ RESEND_API_KEY: 'k' }));
    await service.sendBookingConfirmation(bookingData);
    expect(sendEmailMock.mock.calls[0][0].from).toBe(
      'Agendly <noreply@agendly.mx>',
    );
  });
});

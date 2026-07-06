import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

/** "ana@gmail.com" → "a***@gmail.com" para no loguear PII completa. */
function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return '***';
  return `${user.slice(0, 1)}***@${domain}`;
}

interface AppointmentEmailData {
  clientName: string;
  clientEmail: string;
  serviceName: string;
  employeeName: string;
  businessName: string;
  date: string;
  time: string;
  slug: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly fromEmail = 'Agendly <noreply@agendly.mx>';

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;

    if (!this.resend) {
      this.logger.warn(
        'RESEND_API_KEY not configured — emails will be logged only',
      );
    }
  }

  async sendBookingConfirmation(data: AppointmentEmailData) {
    const subject = `Cita confirmada — ${data.serviceName} en ${data.businessName}`;
    const html = this.confirmationTemplate(data);

    await this.send(data.clientEmail, subject, html);
  }

  async sendBookingCancellation(
    data: AppointmentEmailData & { reason?: string },
  ) {
    const subject = `Cita cancelada — ${data.serviceName} en ${data.businessName}`;
    const html = this.cancellationTemplate(data);

    await this.send(data.clientEmail, subject, html);
  }

  private async send(to: string, subject: string, html: string) {
    if (!this.resend) {
      // No loguear el email completo (PII). Solo dominio + asunto.
      this.logger.log(`[EMAIL] To: ${maskEmail(to)} | Subject: ${subject}`);
      return;
    }

    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject,
        html,
      });
    } catch (err) {
      this.logger.error(`Fallo al enviar email a ${maskEmail(to)}`, err);
    }
  }

  private confirmationTemplate(data: AppointmentEmailData): string {
    return `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #111;">¡Tu cita está confirmada!</h2>
      <p>Hola <strong>${data.clientName}</strong>,</p>
      <p>Tu cita ha sido agendada exitosamente:</p>
      <div style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Servicio:</strong> ${data.serviceName}</p>
        <p style="margin: 4px 0;"><strong>Con:</strong> ${data.employeeName}</p>
        <p style="margin: 4px 0;"><strong>Fecha:</strong> ${data.date}</p>
        <p style="margin: 4px 0;"><strong>Hora:</strong> ${data.time}</p>
        <p style="margin: 4px 0;"><strong>Lugar:</strong> ${data.businessName}</p>
      </div>
      <p style="color: #6b7280; font-size: 12px; margin-top: 32px;">
        Agenda gestionada por <a href="https://agendly.mx" style="color: #6366f1;">Agendly</a>
      </p>
    </div>`;
  }

  private cancellationTemplate(
    data: AppointmentEmailData & { reason?: string },
  ): string {
    return `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #111;">Tu cita ha sido cancelada</h2>
      <p>Hola <strong>${data.clientName}</strong>,</p>
      <p>Tu cita con los siguientes datos ha sido cancelada:</p>
      <div style="background: #fef2f2; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Servicio:</strong> ${data.serviceName}</p>
        <p style="margin: 4px 0;"><strong>Con:</strong> ${data.employeeName}</p>
        <p style="margin: 4px 0;"><strong>Fecha:</strong> ${data.date}</p>
        <p style="margin: 4px 0;"><strong>Hora:</strong> ${data.time}</p>
        ${data.reason ? `<p style="margin: 4px 0;"><strong>Motivo:</strong> ${data.reason}</p>` : ''}
      </div>
      <p>Si deseas reagendar, visita: <a href="https://agendly.mx/${data.slug}" style="color: #6366f1;">agendly.mx/${data.slug}</a></p>
      <p style="color: #6b7280; font-size: 12px; margin-top: 32px;">
        Agenda gestionada por <a href="https://agendly.mx" style="color: #6366f1;">Agendly</a>
      </p>
    </div>`;
  }
}

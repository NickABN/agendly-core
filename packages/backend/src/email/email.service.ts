import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

interface PaymentReceiptData {
  to: string;
  businessName: string;
  amount: string;
  currency: string;
  invoiceUrl?: string;
}

interface PaymentFailedData {
  to: string;
  businessName: string;
  manageUrl: string;
}

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
  private readonly publicAppUrl: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.publicAppUrl = (
      this.configService.get<string>('PUBLIC_APP_URL') ||
      this.configService.get<string>('FRONTEND_URL') ||
      'http://localhost:3001'
    ).replace(/\/+$/, '');

    if (!this.resend) {
      this.logger.warn(
        'RESEND_API_KEY not configured — emails will be logged only',
      );
    }
  }

  private publicBookingUrl(slug: string): string {
    return `${this.publicAppUrl}/${slug}`;
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

  // ── Auth ────────────────────────────────────────────────

  /** Password reset link for admin users. `resetUrl` must point at the admin app. */
  async sendPasswordReset(to: string, resetUrl: string): Promise<void> {
    const html = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #111;">Restablece tu contraseña</h2>
      <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta de Agendly.</p>
      <p style="margin: 24px 0;">
        <a href="${resetUrl}" style="display:inline-block;background:#6366f1;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;">Restablecer contraseña</a>
      </p>
      <p style="color: #6b7280; font-size: 14px;">
        Este enlace es válido por 30 minutos. Si no solicitaste este cambio, puedes ignorar
        este correo — tu contraseña seguirá siendo la misma.
      </p>
      <p style="color: #6b7280; font-size: 12px; margin-top: 32px;">Agendly</p>
    </div>`;
    await this.send(to, 'Restablece tu contraseña — Agendly', html);
  }

  // ── Billing (SaaS) ──────────────────────────────────────

  async sendPaymentReceipt(data: PaymentReceiptData): Promise<void> {
    const html = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #111;">Recibo de pago</h2>
      <p>Gracias por tu suscripción a Agendly para <strong>${data.businessName}</strong>.</p>
      <div style="background: #f0fdf4; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 4px 0;"><strong>Monto:</strong> $${data.amount} ${data.currency}</p>
      </div>
      ${data.invoiceUrl ? `<p><a href="${data.invoiceUrl}" style="color: #6366f1;">Ver factura</a></p>` : ''}
      <p style="color: #6b7280; font-size: 12px; margin-top: 32px;">Agendly</p>
    </div>`;
    await this.send(data.to, 'Recibo de pago — Agendly', html);
  }

  async sendPaymentFailed(data: PaymentFailedData): Promise<void> {
    const html = `
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
      <h2 style="color: #b91c1c;">No pudimos procesar tu pago</h2>
      <p>Hubo un problema al cobrar la suscripción de <strong>${data.businessName}</strong>.</p>
      <p>Actualiza tu método de pago para no perder el acceso:</p>
      <p><a href="${data.manageUrl}" style="display:inline-block;background:#6366f1;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;">Gestionar suscripción</a></p>
      <p style="color: #6b7280; font-size: 12px; margin-top: 32px;">Agendly</p>
    </div>`;
    await this.send(data.to, 'Problema con tu pago — Agendly', html);
  }

  private confirmationTemplate(data: AppointmentEmailData): string {
    const appUrl = this.publicAppUrl;

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
        Agenda gestionada por <a href="${appUrl}" style="color: #6366f1;">Agendly</a>
      </p>
    </div>`;
  }

  private cancellationTemplate(
    data: AppointmentEmailData & { reason?: string },
  ): string {
    const bookingUrl = this.publicBookingUrl(data.slug);
    const appUrl = this.publicAppUrl;

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
      <p>Si deseas reagendar, visita: <a href="${bookingUrl}" style="color: #6366f1;">${bookingUrl}</a></p>
      <p style="color: #6b7280; font-size: 12px; margin-top: 32px;">
        Agenda gestionada por <a href="${appUrl}" style="color: #6366f1;">Agendly</a>
      </p>
    </div>`;
  }
}

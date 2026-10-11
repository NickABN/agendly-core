import { Injectable, Logger } from '@nestjs/common';
import { formatDate, formatTime } from '@agendly/shared';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { NoShowRiskService } from '../insights/no-show-risk.service';
import { hasActiveAccess } from '../common/subscription-access';

/** Remind appointments starting within this many hours… */
export const REMINDER_WINDOW_HOURS = 24;
/** …but not ones starting this soon (too late to be useful)… */
export const REMINDER_MIN_LEAD_HOURS = 1;
/** …and only when the booking is at least this old (the confirmation isn't fresh). */
export const REMINDER_MIN_BOOKING_AGE_HOURS = 12;
/** Cap per run: Resend free tier is 100 emails/day. */
export const REMINDER_BATCH_LIMIT = 50;
/** Resend allows ~2 requests/second. */
const SEND_SPACING_MS = 600;

const HOUR_MS = 3_600_000;

export interface ReminderRunResult {
  candidates: number;
  sent: number;
  failed: number;
}

/**
 * Sends one email reminder per upcoming appointment. Triggered hourly by an
 * external scheduler (Render's free tier sleeps, so an in-process cron would
 * not fire). Each appointment is claimed atomically before sending, so two
 * overlapping runs never email the same client twice; a provider failure
 * releases the claim for the next run.
 */
@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly riskService: NoShowRiskService,
  ) {}

  async sendDueReminders(
    now: Date = new Date(),
    sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((r) => setTimeout(r, ms)),
  ): Promise<ReminderRunResult> {
    const candidates = await this.prisma.appointment.findMany({
      where: {
        status: 'CONFIRMED',
        reminderSentAt: null,
        clientEmail: { not: null },
        startTime: {
          gt: new Date(now.getTime() + REMINDER_MIN_LEAD_HOURS * HOUR_MS),
          lte: new Date(now.getTime() + REMINDER_WINDOW_HOURS * HOUR_MS),
        },
        createdAt: {
          lte: new Date(
            now.getTime() - REMINDER_MIN_BOOKING_AGE_HOURS * HOUR_MS,
          ),
        },
      },
      include: {
        employee: { select: { name: true } },
        service: { select: { name: true } },
        tenant: {
          select: {
            name: true,
            slug: true,
            phone: true,
            timezone: true,
            isActive: true,
            subscriptionStatus: true,
            trialEndsAt: true,
          },
        },
      },
      orderBy: { startTime: 'asc' },
      take: REMINDER_BATCH_LIMIT,
    });

    const eligible = candidates.filter((a) => hasActiveAccess(a.tenant));

    // Risk per tenant (one history query each) to tailor the call to action.
    const risks = new Map<string, string>();
    const byTenant = new Map<string, typeof eligible>();
    for (const a of eligible) {
      byTenant.set(a.tenantId, [...(byTenant.get(a.tenantId) ?? []), a]);
    }
    for (const [tenantId, appts] of byTenant) {
      const scored = await this.riskService.annotate(tenantId, appts, now);
      for (const [id, risk] of scored) if (risk) risks.set(id, risk.level);
    }

    let sent = 0;
    let failed = 0;
    for (const a of eligible) {
      const claim = await this.prisma.appointment.updateMany({
        where: { id: a.id, reminderSentAt: null, status: 'CONFIRMED' },
        data: { reminderSentAt: now },
      });
      if (claim.count === 0) continue; // another run took it, or it was cancelled

      const ok = await this.emailService.sendBookingReminder({
        clientName: a.clientName,
        clientEmail: a.clientEmail!,
        serviceName: a.service.name,
        employeeName: a.employee.name,
        businessName: a.tenant.name,
        businessPhone: a.tenant.phone,
        date: formatDate(a.startTime, 'long', a.tenant.timezone),
        time: formatTime(a.startTime, a.tenant.timezone),
        slug: a.tenant.slug,
        emphasizeConfirmation: risks.get(a.id) === 'HIGH',
      });

      if (ok) {
        sent += 1;
      } else {
        failed += 1;
        await this.prisma.appointment.updateMany({
          where: { id: a.id, reminderSentAt: now },
          data: { reminderSentAt: null },
        });
      }
      await sleep(SEND_SPACING_MS);
    }

    this.logger.log(
      `Recordatorios: ${sent} enviados, ${failed} fallidos, ${candidates.length} candidatos`,
    );
    return { candidates: candidates.length, sent, failed };
  }
}

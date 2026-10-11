import { BadRequestException, Injectable } from '@nestjs/common';
import {
  AppointmentChannel,
  BUSINESS_TZ,
  addDays,
  startOfWeek,
  todayKey,
  utcToDateKey,
  zonedToUtc,
} from '@agendly/shared';
import type { InsightsSummaryDto, InsightsWeekDto } from '@agendly/shared';
import { PrismaService } from '../prisma/prisma.service';
import { NoShowRiskService } from './no-show-risk.service';
import {
  RISK_MODEL,
  evaluateRiskModel,
  featuresFromHistory,
  scoreNoShowRisk,
} from './no-show-risk';

const DEFAULT_RANGE_DAYS = 30;
const MAX_RANGE_DAYS = 366;

/** Pure helpers kept exported for direct unit testing. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return Math.round(value * 10) / 10;
}

export function ratio(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 1000) / 1000 : null;
}

/**
 * Impact metrics for the owner (and the thesis evaluation): booking autonomy,
 * friction, no-shows, client retention and how well the risk model ranks
 * real no-shows. Everything is computed from appointment data — no external
 * services, no extra cost.
 */
@Injectable()
export class InsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly riskService: NoShowRiskService,
  ) {}

  async summary(
    tenantId: string,
    fromKey?: string,
    toKey?: string,
    now: Date = new Date(),
  ): Promise<InsightsSummaryDto> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { timezone: true },
    });
    const tz = tenant?.timezone ?? BUSINESS_TZ;

    const to = toKey ?? todayKey(tz, now);
    const from = fromKey ?? addDays(to, -(DEFAULT_RANGE_DAYS - 1));
    if (from > to) {
      throw new BadRequestException(
        'La fecha inicial debe ser anterior a la final',
      );
    }
    if (addDays(from, MAX_RANGE_DAYS) <= to) {
      throw new BadRequestException('El rango máximo es de un año');
    }
    const start = zonedToUtc(from, '00:00', tz);
    const end = zonedToUtc(addDays(to, 1), '00:00', tz);

    const appointments = await this.prisma.appointment.findMany({
      where: { tenantId, startTime: { gte: start, lt: end } },
      select: {
        status: true,
        channel: true,
        startTime: true,
        createdAt: true,
        clientPhone: true,
        clientEmail: true,
        bookingDurationSec: true,
        reminderSentAt: true,
      },
      orderBy: { startTime: 'asc' },
    });

    const totals = {
      appointments: appointments.length,
      completed: 0,
      noShows: 0,
      cancelled: 0,
      upcoming: 0,
    };
    const byChannel: Record<AppointmentChannel, number> = {
      WEB: 0,
      MANUAL: 0,
      WHATSAPP: 0,
    };
    const leadTimes: number[] = [];
    const durations: number[] = [];
    const weeks = new Map<string, InsightsWeekDto>();

    for (const a of appointments) {
      if (a.status === 'COMPLETED') totals.completed += 1;
      else if (a.status === 'NO_SHOW') totals.noShows += 1;
      else if (a.status === 'CANCELLED') totals.cancelled += 1;
      else if (a.startTime > now) totals.upcoming += 1;

      byChannel[a.channel as AppointmentChannel] += 1;
      if (a.status !== 'CANCELLED') {
        leadTimes.push(
          Math.max(
            0,
            (a.startTime.getTime() - a.createdAt.getTime()) / 3_600_000,
          ),
        );
      }
      if (a.bookingDurationSec !== null) durations.push(a.bookingDurationSec);

      const weekStart = startOfWeek(utcToDateKey(a.startTime, tz));
      const week = weeks.get(weekStart) ?? {
        weekStart,
        total: 0,
        autonomous: 0,
        noShows: 0,
      };
      week.total += 1;
      if (a.channel === 'WEB') week.autonomous += 1;
      if (a.status === 'NO_SHOW') week.noShows += 1;
      weeks.set(weekStart, week);
    }

    const resolvedWith = { total: 0, noShows: 0 };
    const resolvedWithout = { total: 0, noShows: 0 };
    for (const a of appointments) {
      if (a.status !== 'COMPLETED' && a.status !== 'NO_SHOW') continue;
      const bucket = a.reminderSentAt ? resolvedWith : resolvedWithout;
      bucket.total += 1;
      if (a.status === 'NO_SHOW') bucket.noShows += 1;
    }

    const phones = [...new Set(appointments.map((a) => a.clientPhone))];
    const returningClients = await this.countReturning(tenantId, phones, start);

    // Leakage-free evaluation: each resolved appointment is scored with the
    // history that existed before it, then compared with what really happened.
    const resolved = appointments.filter(
      (a) => a.status === 'COMPLETED' || a.status === 'NO_SHOW',
    );
    const history = await this.riskService.loadHistory(
      tenantId,
      [...new Set(resolved.map((a) => a.clientPhone))],
      end,
    );
    const evaluation = evaluateRiskModel(
      resolved.map((a) => ({
        score: scoreNoShowRisk(featuresFromHistory(a, history)).score,
        noShow: a.status === 'NO_SHOW',
      })),
    );

    return {
      from,
      to,
      totals,
      byChannel,
      noShowRate: ratio(totals.noShows, totals.completed + totals.noShows),
      cancellationRate: ratio(totals.cancelled, totals.appointments),
      autonomousShare: ratio(byChannel.WEB, totals.appointments),
      medianLeadTimeHours: median(leadTimes),
      medianBookingDurationSec: median(durations),
      uniqueClients: phones.length,
      returningClients,
      reminders: {
        sent: appointments.filter((a) => a.reminderSentAt !== null).length,
        noShowRateWithReminder: ratio(resolvedWith.noShows, resolvedWith.total),
        noShowRateWithoutReminder: ratio(
          resolvedWithout.noShows,
          resolvedWithout.total,
        ),
      },
      weekly: [...weeks.values()].sort((a, b) =>
        a.weekStart.localeCompare(b.weekStart),
      ),
      riskModel: { version: RISK_MODEL.version, ...evaluation },
    };
  }

  /** Clients with a non-cancelled appointment before the range start. */
  private async countReturning(
    tenantId: string,
    phones: string[],
    before: Date,
  ) {
    if (phones.length === 0) return 0;
    const earlier = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        clientPhone: { in: phones },
        startTime: { lt: before },
        status: { not: 'CANCELLED' },
      },
      select: { clientPhone: true },
      distinct: ['clientPhone'],
    });
    return earlier.length;
  }
}

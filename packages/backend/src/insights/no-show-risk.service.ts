import { Injectable } from '@nestjs/common';
import type { NoShowRiskDto } from '@agendly/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AppointmentStatus } from '../generated/prisma/client.js';
import {
  featuresFromHistory,
  scoreNoShowRisk,
  type RiskAppointment,
  type RiskHistoryEntry,
} from './no-show-risk';

/** Loads resolved client history and scores upcoming appointments. */
@Injectable()
export class NoShowRiskService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolved (COMPLETED/NO_SHOW) appointments of these clients before `before`. */
  async loadHistory(
    tenantId: string,
    phones: string[],
    before: Date,
  ): Promise<RiskHistoryEntry[]> {
    if (phones.length === 0) return [];
    const rows = await this.prisma.appointment.findMany({
      where: {
        tenantId,
        clientPhone: { in: phones },
        status: { in: ['COMPLETED', 'NO_SHOW'] },
        startTime: { lt: before },
      },
      select: { clientPhone: true, startTime: true, status: true },
    });
    return rows as RiskHistoryEntry[];
  }

  /**
   * Risk per appointment id. Only upcoming CONFIRMED appointments get a score;
   * the rest map to null (the outcome is already known or irrelevant).
   */
  async annotate(
    tenantId: string,
    appointments: (RiskAppointment & {
      id: string;
      status: AppointmentStatus;
    })[],
    now: Date = new Date(),
  ): Promise<Map<string, NoShowRiskDto | null>> {
    const result = new Map<string, NoShowRiskDto | null>();
    const upcoming = appointments.filter(
      (a) => a.status === 'CONFIRMED' && a.startTime.getTime() > now.getTime(),
    );
    for (const a of appointments) result.set(a.id, null);
    if (upcoming.length === 0) return result;

    const latest = new Date(
      Math.max(...upcoming.map((a) => a.startTime.getTime())),
    );
    const phones = [...new Set(upcoming.map((a) => a.clientPhone))];
    const history = await this.loadHistory(tenantId, phones, latest);

    for (const a of upcoming) {
      result.set(a.id, scoreNoShowRisk(featuresFromHistory(a, history)));
    }
    return result;
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Client CRM read-model: aggregates appointment history into per-client stats.
 * Separated from AppointmentsService (calendar reads/mutations) on purpose.
 */
@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async findClients(tenantId: string) {
    const appointments = await this.prisma.appointment.findMany({
      where: { tenantId },
      select: {
        clientName: true,
        clientPhone: true,
        clientEmail: true,
        startTime: true,
        status: true,
        service: { select: { name: true } },
      },
      orderBy: { startTime: 'desc' },
    });

    const clientMap = new Map<
      string,
      {
        name: string;
        phone: string;
        email: string | null;
        totalVisits: number;
        completedVisits: number;
        cancelledVisits: number;
        noShowVisits: number;
        lastVisit: string;
        topService: string;
      }
    >();

    for (const a of appointments) {
      const key = a.clientPhone;
      const existing = clientMap.get(key);

      if (!existing) {
        clientMap.set(key, {
          name: a.clientName,
          phone: a.clientPhone,
          email: a.clientEmail,
          totalVisits: 1,
          completedVisits: a.status === 'COMPLETED' ? 1 : 0,
          cancelledVisits: a.status === 'CANCELLED' ? 1 : 0,
          noShowVisits: a.status === 'NO_SHOW' ? 1 : 0,
          lastVisit: a.startTime.toISOString(),
          topService: a.service.name,
        });
      } else {
        existing.totalVisits++;
        if (a.status === 'COMPLETED') existing.completedVisits++;
        if (a.status === 'CANCELLED') existing.cancelledVisits++;
        if (a.status === 'NO_SHOW') existing.noShowVisits++;
        // name/email may vary between bookings — keep the latest
        if (!existing.email && a.clientEmail) existing.email = a.clientEmail;
      }
    }

    return Array.from(clientMap.values()).sort(
      (a, b) => b.totalVisits - a.totalVisits,
    );
  }
}

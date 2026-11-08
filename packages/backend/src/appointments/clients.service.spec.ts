import { normalizeMxPhone } from '@agendly/shared';
import { ClientsService } from './clients.service';

const TENANT_ID = 'tenant-1';

function appt(clientPhone: string, overrides: Record<string, unknown> = {}) {
  return {
    clientName: 'Ana López',
    clientPhone,
    clientEmail: null,
    startTime: new Date('2030-06-10T16:00:00.000Z'),
    status: 'COMPLETED',
    service: { name: 'Corte' },
    ...overrides,
  };
}

describe('ClientsService.findClients grouping', () => {
  it('groups bookings that normalized to the same phone as a single client', async () => {
    // Both raw inputs normalize to the same E.164 value, so the DTO stores one
    // canonical string and the CRM must see them as the same person.
    const canonical = normalizeMxPhone('55 1234 5678');
    const alsoCanonical = normalizeMxPhone('+52 55 1234 5678');
    expect(canonical).toBe('+525512345678');
    expect(alsoCanonical).toBe(canonical);

    const prisma = {
      appointment: {
        findMany: jest.fn().mockResolvedValue([
          appt(canonical as string, {
            startTime: new Date('2030-06-11T16:00:00.000Z'),
          }),
          appt(alsoCanonical as string, { status: 'NO_SHOW' }),
        ]),
      },
    };
    const service = new ClientsService(prisma as never);

    const clients = await service.findClients(TENANT_ID);

    expect(clients).toHaveLength(1);
    expect(clients[0].phone).toBe('+525512345678');
    expect(clients[0].totalVisits).toBe(2);
    expect(clients[0].completedVisits).toBe(1);
    expect(clients[0].noShowVisits).toBe(1);
  });
});

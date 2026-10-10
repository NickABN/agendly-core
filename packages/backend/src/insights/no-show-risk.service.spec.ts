import { NoShowRiskService } from './no-show-risk.service';

const NOW = new Date('2026-10-10T18:00:00.000Z');

describe('NoShowRiskService.annotate', () => {
  it('scores only upcoming confirmed appointments using prior history', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        clientPhone: '+521',
        startTime: new Date('2026-09-01T16:00:00Z'),
        status: 'NO_SHOW',
      },
      {
        clientPhone: '+521',
        startTime: new Date('2026-09-08T16:00:00Z'),
        status: 'NO_SHOW',
      },
    ]);
    const service = new NoShowRiskService({
      appointment: { findMany },
    } as never);

    const base = {
      clientPhone: '+521',
      clientEmail: null,
      createdAt: new Date('2026-10-09T16:00:00Z'),
      channel: 'WEB' as const,
    };
    const risks = await service.annotate(
      't1',
      [
        {
          ...base,
          id: 'up',
          status: 'CONFIRMED',
          startTime: new Date('2026-10-11T16:00:00Z'),
        },
        {
          ...base,
          id: 'past',
          status: 'CONFIRMED',
          startTime: new Date('2026-10-01T16:00:00Z'),
        },
        {
          ...base,
          id: 'done',
          status: 'COMPLETED',
          startTime: new Date('2026-10-12T16:00:00Z'),
        },
      ],
      NOW,
    );

    expect(risks.get('up')?.level).toBe('HIGH');
    expect(risks.get('up')?.reasons).toContain('Faltó a 2 citas anteriores');
    expect(risks.get('past')).toBeNull();
    expect(risks.get('done')).toBeNull();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 't1',
          clientPhone: { in: ['+521'] },
        }),
      }),
    );
  });

  it('skips the history query when nothing is upcoming', async () => {
    const findMany = jest.fn();
    const service = new NoShowRiskService({
      appointment: { findMany },
    } as never);
    const risks = await service.annotate('t1', [], NOW);
    expect(risks.size).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });
});

import {
  RISK_MODEL,
  evaluateRiskModel,
  featuresFromHistory,
  riskLevel,
  scoreNoShowRisk,
  type NoShowRiskFeatures,
} from './no-show-risk';

const loyalClient: NoShowRiskFeatures = {
  priorNoShows: 0,
  priorCompleted: 4,
  leadTimeHours: 6,
  channel: 'MANUAL',
  hasEmail: true,
};

describe('scoreNoShowRisk', () => {
  it('rates a loyal client booking same-day as LOW', () => {
    const risk = scoreNoShowRisk(loyalClient);
    expect(risk.level).toBe('LOW');
    expect(risk.score).toBeLessThan(RISK_MODEL.mediumAt);
    expect(risk.modelVersion).toBe(RISK_MODEL.version);
  });

  it('rates a client with past no-shows as HIGH and explains why', () => {
    const risk = scoreNoShowRisk({
      ...loyalClient,
      priorNoShows: 2,
      priorCompleted: 0,
    });
    expect(risk.level).toBe('HIGH');
    expect(risk.reasons).toContain('Faltó a 2 citas anteriores');
  });

  it('adds risk for new web clients without email booking far ahead', () => {
    const risky = scoreNoShowRisk({
      priorNoShows: 0,
      priorCompleted: 0,
      leadTimeHours: 14 * 24,
      channel: 'WEB',
      hasEmail: false,
    });
    expect(risky.score).toBeGreaterThan(scoreNoShowRisk(loyalClient).score);
    expect(risky.reasons).toEqual(
      expect.arrayContaining([
        'Cliente nuevo',
        'Reservó con 14 días de anticipación',
        'Sin correo para confirmación',
      ]),
    );
  });

  it('is monotonic in past no-shows and caps them at 3', () => {
    const scores = [0, 1, 2, 3, 10].map(
      (priorNoShows) => scoreNoShowRisk({ ...loyalClient, priorNoShows }).score,
    );
    expect(scores[1]).toBeGreaterThan(scores[0]);
    expect(scores[2]).toBeGreaterThan(scores[1]);
    expect(scores[3]).toBeGreaterThan(scores[2]);
    expect(scores[4]).toBe(scores[3]);
  });

  it('treats negative lead times (backfilled manual entries) as zero', () => {
    const a = scoreNoShowRisk({ ...loyalClient, leadTimeHours: -5 });
    const b = scoreNoShowRisk({ ...loyalClient, leadTimeHours: 0 });
    expect(a.score).toBe(b.score);
  });
});

describe('riskLevel', () => {
  it('maps the thresholds', () => {
    expect(riskLevel(0.05)).toBe('LOW');
    expect(riskLevel(RISK_MODEL.mediumAt)).toBe('MEDIUM');
    expect(riskLevel(RISK_MODEL.highAt)).toBe('HIGH');
  });
});

describe('evaluateRiskModel', () => {
  it('returns AUC 1 when every no-show outranks every show', () => {
    const ev = evaluateRiskModel([
      { score: 0.6, noShow: true },
      { score: 0.4, noShow: true },
      { score: 0.1, noShow: false },
      { score: 0.05, noShow: false },
    ]);
    expect(ev.auc).toBe(1);
    expect(ev.samples).toBe(4);
    expect(ev.noShows).toBe(2);
    expect(ev.precisionFlagged).toBe(1);
    expect(ev.recallFlagged).toBe(1);
  });

  it('returns AUC 0.5 for ties (no discrimination)', () => {
    const ev = evaluateRiskModel([
      { score: 0.2, noShow: true },
      { score: 0.2, noShow: false },
    ]);
    expect(ev.auc).toBe(0.5);
  });

  it('leaves AUC null with a single class and handles empty input', () => {
    expect(evaluateRiskModel([{ score: 0.1, noShow: false }]).auc).toBeNull();
    const empty = evaluateRiskModel([]);
    expect(empty).toEqual({
      samples: 0,
      noShows: 0,
      auc: null,
      brier: null,
      precisionFlagged: null,
      recallFlagged: null,
    });
  });

  it('computes the Brier score', () => {
    const ev = evaluateRiskModel([
      { score: 1, noShow: true },
      { score: 0.5, noShow: false },
    ]);
    // ((1-1)^2 + (0.5-0)^2) / 2
    expect(ev.brier).toBe(0.125);
  });
});

describe('featuresFromHistory', () => {
  const start = new Date('2026-10-20T16:00:00.000Z');
  const appt = {
    clientPhone: '+523312345678',
    clientEmail: null,
    startTime: start,
    createdAt: new Date('2026-10-18T16:00:00.000Z'),
    channel: 'WEB' as const,
  };

  it('counts only the same client and only appointments before this one', () => {
    const f = featuresFromHistory(appt, [
      {
        clientPhone: appt.clientPhone,
        startTime: new Date('2026-09-01T16:00:00Z'),
        status: 'NO_SHOW',
      },
      {
        clientPhone: appt.clientPhone,
        startTime: new Date('2026-09-15T16:00:00Z'),
        status: 'COMPLETED',
      },
      // after this appointment → must not leak into the features
      {
        clientPhone: appt.clientPhone,
        startTime: new Date('2026-11-01T16:00:00Z'),
        status: 'NO_SHOW',
      },
      // another client
      {
        clientPhone: '+520000000000',
        startTime: new Date('2026-09-01T16:00:00Z'),
        status: 'NO_SHOW',
      },
    ]);
    expect(f).toEqual({
      priorNoShows: 1,
      priorCompleted: 1,
      leadTimeHours: 48,
      channel: 'WEB',
      hasEmail: false,
    });
  });
});

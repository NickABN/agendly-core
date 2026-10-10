import type { AppointmentChannel } from '../generated/prisma/client.js';
import type { NoShowRiskDto, NoShowRiskLevel } from '@agendly/shared';

/**
 * Interpretable no-show risk model (logistic regression with prior weights).
 *
 * Why not a black box: the owner must understand *why* an appointment is
 * flagged, and with little history per business a trained model would overfit.
 * Weights are informed priors (no-show literature for appointment-based
 * services: past no-shows dominate, new clients and long lead times add risk).
 * `evaluateRiskModel` measures them against each tenant's real outcomes so
 * they can be re-fit once there is enough data.
 */
export interface NoShowRiskFeatures {
  /** Client's NO_SHOW appointments before this one (same tenant, same phone). */
  priorNoShows: number;
  /** Client's COMPLETED appointments before this one. */
  priorCompleted: number;
  /** Hours between booking (createdAt) and the appointment start. */
  leadTimeHours: number;
  channel: AppointmentChannel;
  hasEmail: boolean;
}

export const RISK_MODEL = {
  version: 'prior-v1',
  intercept: -2.4, // ≈ 8% base no-show rate for a returning, same-day, manual booking
  priorNoShow: 1.1, // per past no-show, capped at 3
  newClient: 0.5,
  priorCompleted: -0.25, // per completed visit, capped at 4
  leadTimeLogDays: 0.35, // × ln(1 + days of anticipation)
  webChannel: 0.3,
  noEmail: 0.3,
  /** Score thresholds for the visible levels. */
  mediumAt: 0.15,
  highAt: 0.3,
} as const;

const HOURS_PER_DAY = 24;

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

export function riskLevel(score: number): NoShowRiskLevel {
  if (score >= RISK_MODEL.highAt) return 'HIGH';
  if (score >= RISK_MODEL.mediumAt) return 'MEDIUM';
  return 'LOW';
}

/** Probability-like score in [0, 1] plus the human-readable drivers behind it. */
export function scoreNoShowRisk(f: NoShowRiskFeatures): NoShowRiskDto {
  const priorNoShows = Math.min(Math.max(f.priorNoShows, 0), 3);
  const priorCompleted = Math.min(Math.max(f.priorCompleted, 0), 4);
  const isNew = priorNoShows === 0 && priorCompleted === 0;
  const leadDays = Math.max(f.leadTimeHours, 0) / HOURS_PER_DAY;

  const z =
    RISK_MODEL.intercept +
    RISK_MODEL.priorNoShow * priorNoShows +
    (isNew ? RISK_MODEL.newClient : 0) +
    RISK_MODEL.priorCompleted * priorCompleted +
    RISK_MODEL.leadTimeLogDays * Math.log1p(leadDays) +
    (f.channel === 'WEB' ? RISK_MODEL.webChannel : 0) +
    (f.hasEmail ? 0 : RISK_MODEL.noEmail);

  const score = Math.round(sigmoid(z) * 1000) / 1000;

  const reasons: string[] = [];
  if (priorNoShows > 0) {
    reasons.push(
      priorNoShows === 1
        ? 'Faltó a 1 cita anterior'
        : `Faltó a ${priorNoShows} citas anteriores`,
    );
  }
  if (isNew) reasons.push('Cliente nuevo');
  if (leadDays >= 7)
    reasons.push(`Reservó con ${Math.floor(leadDays)} días de anticipación`);
  if (!f.hasEmail) reasons.push('Sin correo para confirmación');
  if (priorCompleted >= 2)
    reasons.push(`${f.priorCompleted} visitas completadas`);

  return {
    score,
    level: riskLevel(score),
    reasons,
    modelVersion: RISK_MODEL.version,
  };
}

export interface RiskEvaluation {
  /** Resolved appointments evaluated (COMPLETED or NO_SHOW). */
  samples: number;
  noShows: number;
  /** ROC AUC; null when only one class is present. 0.5 = random. */
  auc: number | null;
  /** Mean squared error of the score vs outcome (lower is better). */
  brier: number | null;
  /** Of the appointments flagged MEDIUM/HIGH, share that were no-shows. */
  precisionFlagged: number | null;
  /** Of the real no-shows, share the model had flagged MEDIUM/HIGH. */
  recallFlagged: number | null;
}

/** Offline evaluation of scores against real outcomes (true = no-show). */
export function evaluateRiskModel(
  samples: { score: number; noShow: boolean }[],
): RiskEvaluation {
  const n = samples.length;
  const positives = samples.filter((s) => s.noShow);
  const negatives = samples.filter((s) => !s.noShow);

  let auc: number | null = null;
  if (positives.length > 0 && negatives.length > 0) {
    // Mann–Whitney U: P(score of a random no-show > score of a random show)
    let wins = 0;
    for (const p of positives) {
      for (const q of negatives) {
        if (p.score > q.score) wins += 1;
        else if (p.score === q.score) wins += 0.5;
      }
    }
    auc = round3(wins / (positives.length * negatives.length));
  }

  const brier =
    n > 0
      ? round3(
          samples.reduce(
            (acc, s) => acc + (s.score - (s.noShow ? 1 : 0)) ** 2,
            0,
          ) / n,
        )
      : null;

  const flagged = samples.filter((s) => riskLevel(s.score) !== 'LOW');
  const truePositives = flagged.filter((s) => s.noShow).length;

  return {
    samples: n,
    noShows: positives.length,
    auc,
    brier,
    precisionFlagged:
      flagged.length > 0 ? round3(truePositives / flagged.length) : null,
    recallFlagged:
      positives.length > 0 ? round3(truePositives / positives.length) : null,
  };
}

function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

/** Minimal appointment shape needed to score risk. */
export interface RiskAppointment {
  clientPhone: string;
  clientEmail: string | null;
  startTime: Date;
  createdAt: Date;
  channel: AppointmentChannel;
}

/** Resolved past appointment of a client (COMPLETED or NO_SHOW). */
export interface RiskHistoryEntry {
  clientPhone: string;
  startTime: Date;
  status: 'COMPLETED' | 'NO_SHOW';
}

/**
 * Features for `appt` using only history strictly before its start, so the
 * same function serves live scoring and leakage-free offline evaluation.
 */
export function featuresFromHistory(
  appt: RiskAppointment,
  history: readonly RiskHistoryEntry[],
): NoShowRiskFeatures {
  let priorNoShows = 0;
  let priorCompleted = 0;
  for (const h of history) {
    if (h.clientPhone !== appt.clientPhone) continue;
    if (h.startTime.getTime() >= appt.startTime.getTime()) continue;
    if (h.status === 'NO_SHOW') priorNoShows += 1;
    else priorCompleted += 1;
  }
  return {
    priorNoShows,
    priorCompleted,
    leadTimeHours:
      (appt.startTime.getTime() - appt.createdAt.getTime()) / 3_600_000,
    channel: appt.channel,
    hasEmail: !!appt.clientEmail,
  };
}

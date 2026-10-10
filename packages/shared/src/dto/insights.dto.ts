import type { AppointmentChannel } from '../enums';

export type NoShowRiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

/** Interpretable no-show estimate attached to upcoming appointments. */
export interface NoShowRiskDto {
  /** Probability-like score in [0, 1]. */
  score: number;
  level: NoShowRiskLevel;
  /** Human-readable drivers (Spanish), most relevant first. */
  reasons: string[];
  modelVersion: string;
}

export interface InsightsWeekDto {
  /** Monday of the week, `YYYY-MM-DD` in the tenant timezone. */
  weekStart: string;
  total: number;
  autonomous: number;
  noShows: number;
}

/** GET /insights/summary — impact metrics for a date range (tenant timezone). */
export interface InsightsSummaryDto {
  from: string;
  to: string;
  totals: {
    appointments: number;
    completed: number;
    noShows: number;
    cancelled: number;
    upcoming: number;
  };
  byChannel: Record<AppointmentChannel, number>;
  /** NO_SHOW / (COMPLETED + NO_SHOW); null without resolved appointments. */
  noShowRate: number | null;
  /** CANCELLED / all appointments. */
  cancellationRate: number | null;
  /** Share of appointments the client booked alone (WEB) vs entered manually. */
  autonomousShare: number | null;
  /** Median hours between booking and appointment. */
  medianLeadTimeHours: number | null;
  /** Median seconds a client spent on the public booking form. */
  medianBookingDurationSec: number | null;
  uniqueClients: number;
  /** Clients in range with at least one earlier visit to this business. */
  returningClients: number;
  weekly: InsightsWeekDto[];
  riskModel: {
    version: string;
    samples: number;
    noShows: number;
    auc: number | null;
    brier: number | null;
    precisionFlagged: number | null;
    recallFlagged: number | null;
  };
}

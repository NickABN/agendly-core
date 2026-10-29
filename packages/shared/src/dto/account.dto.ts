/** Days between the owner's deletion request and the definitive purge. */
export const ACCOUNT_DELETION_GRACE_DAYS = 30;

/** GET /account/deletion */
export interface AccountDeletionStatus {
  /** UTC ISO instant of the scheduled purge, or null when no deletion is pending. */
  deletionScheduledAt: string | null;
  /** Upcoming CONFIRMED appointments (warned about before requesting deletion). */
  upcomingAppointments: number;
  /** False for Google-only owners (no password set): only the slug confirmation applies. */
  requiresPassword: boolean;
}

/** POST /account/deletion */
export interface RequestAccountDeletion {
  /** Must equal the tenant slug, typed by the owner. */
  confirmSlug: string;
  /** Required when the owner has a password. */
  password?: string;
}

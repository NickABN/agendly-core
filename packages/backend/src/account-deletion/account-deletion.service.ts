import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { ACCOUNT_DELETION_GRACE_DAYS, formatDate } from '@agendly/shared';
import type { AccountDeletionStatus } from '@agendly/shared';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { BillingService } from '../billing/billing.service';
import { StorageService } from '../profile/storage.service';

const DAY_MS = 86_400_000;
/** Tenants purged per job run (each one is a cascade delete + R2 cleanup). */
export const PURGE_BATCH_LIMIT = 20;

/** What JwtStrategy.validate puts on request.user. */
export interface SessionUser {
  userId: string;
  tenantId: string;
  role: string;
}

export interface PurgeRunResult {
  due: number;
  purged: number;
  failed: number;
}

/**
 * Owner-initiated account deletion with a grace period:
 * request → tenant deactivated (`isActive=false`: public page, bookings,
 * reminders and admin mutations stop) and `deletionScheduledAt` set; the owner
 * can still log in and reactivate. A daily job (GitHub Actions →
 * POST /account/purge/run) deletes due tenants with every related row
 * (cascade) and their R2 images.
 */
@Injectable()
export class AccountDeletionService {
  private readonly logger = new Logger(AccountDeletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly billing: BillingService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {}

  async status(
    user: SessionUser,
    now: Date = new Date(),
  ): Promise<AccountDeletionStatus> {
    const [tenant, owner, upcomingAppointments] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: user.tenantId },
        select: { deletionScheduledAt: true },
      }),
      this.prisma.user.findUnique({
        where: { id: user.userId },
        select: { passwordHash: true },
      }),
      this.prisma.appointment.count({
        where: {
          tenantId: user.tenantId,
          status: 'CONFIRMED',
          startTime: { gt: now },
        },
      }),
    ]);
    if (!tenant) throw new NotFoundException('Negocio no encontrado');
    return {
      deletionScheduledAt: tenant.deletionScheduledAt?.toISOString() ?? null,
      upcomingAppointments,
      requiresPassword: !!owner?.passwordHash,
    };
  }

  async requestDeletion(
    user: SessionUser,
    confirmSlug: string,
    password: string | undefined,
    now: Date = new Date(),
  ): Promise<AccountDeletionStatus> {
    if (user.role !== 'OWNER') {
      throw new ForbiddenException('Solo el dueño puede eliminar la cuenta');
    }
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        timezone: true,
        isActive: true,
        deletionScheduledAt: true,
        stripeSubscriptionId: true,
        subscriptionStatus: true,
      },
    });
    if (!tenant) throw new NotFoundException('Negocio no encontrado');
    if (tenant.deletionScheduledAt) {
      throw new ConflictException(
        'La eliminación de tu cuenta ya está programada',
      );
    }
    if (!tenant.isActive) {
      // Deactivated for another reason (e.g. suspension): not ours to schedule.
      throw new ForbiddenException('Cuenta desactivada');
    }
    if (confirmSlug.trim().toLowerCase() !== tenant.slug) {
      throw new BadRequestException('El texto de confirmación no coincide');
    }

    const owner = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { passwordHash: true },
    });
    // 400, not 401: a 401 would make the admin app refresh/log out.
    if (
      owner?.passwordHash &&
      !(password && (await bcrypt.compare(password, owner.passwordHash)))
    ) {
      throw new BadRequestException('La contraseña no es correcta');
    }

    const deletionScheduledAt = new Date(
      now.getTime() + ACCOUNT_DELETION_GRACE_DAYS * DAY_MS,
    );
    await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: { isActive: false, deletionScheduledAt },
    });
    this.logger.log(
      `Baja programada para el tenant ${tenant.id} (${deletionScheduledAt.toISOString()})`,
    );

    if (hasLiveSubscription(tenant)) {
      await this.billing
        .setCancelAtPeriodEnd(tenant.stripeSubscriptionId!, true)
        .catch((err: Error) =>
          this.logger.error(
            `No se pudo detener la renovación en Stripe (tenant ${tenant.id}): ${err.message}`,
          ),
        );
    }

    void this.ownerEmails(tenant.id)
      .then((emails) =>
        Promise.all(
          emails.map((to) =>
            this.emailService.sendAccountDeletionScheduled({
              to,
              businessName: tenant.name,
              deletionDate: formatDate(
                deletionScheduledAt,
                'long',
                tenant.timezone,
              ),
              loginUrl: `${this.frontendUrl()}/login`,
            }),
          ),
        ),
      )
      .catch((err: Error) =>
        this.logger.error(`Fallo al avisar la baja programada: ${err.message}`),
      );

    return this.status(user, now);
  }

  async cancelDeletion(
    user: SessionUser,
    now: Date = new Date(),
  ): Promise<AccountDeletionStatus> {
    if (user.role !== 'OWNER') {
      throw new ForbiddenException('Solo el dueño puede reactivar la cuenta');
    }
    // Conditional on a pending deletion still inside its grace period: never
    // re-activates a tenant deactivated for another reason, and never races the
    // purge job, which cleans R2/Stripe as soon as the grace period ends.
    const result = await this.prisma.tenant.updateMany({
      where: { id: user.tenantId, deletionScheduledAt: { not: null, gt: now } },
      data: { isActive: true, deletionScheduledAt: null },
    });
    if (result.count === 0) {
      throw new BadRequestException(
        'Tu cuenta no tiene una eliminación programada o el plazo para reactivarla ya venció',
      );
    }
    this.logger.log(`Baja cancelada para el tenant ${user.tenantId}`);

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { stripeSubscriptionId: true, subscriptionStatus: true },
    });
    if (tenant && hasLiveSubscription(tenant)) {
      await this.billing
        .setCancelAtPeriodEnd(tenant.stripeSubscriptionId!, false)
        .catch((err: Error) =>
          this.logger.error(
            `No se pudo reanudar la renovación en Stripe (tenant ${user.tenantId}): ${err.message}`,
          ),
        );
    }
    return this.status(user, now);
  }

  /** Deletes every tenant whose grace period is over. Idempotent; safe to overlap. */
  async purgeDue(now: Date = new Date()): Promise<PurgeRunResult> {
    const due = await this.prisma.tenant.findMany({
      where: { isActive: false, deletionScheduledAt: { lte: now } },
      select: {
        id: true,
        name: true,
        stripeSubscriptionId: true,
        subscriptionStatus: true,
      },
      orderBy: { deletionScheduledAt: 'asc' },
      take: PURGE_BATCH_LIMIT,
    });

    let purged = 0;
    let failed = 0;
    for (const tenant of due) {
      try {
        const emails = await this.ownerEmails(tenant.id);
        // External cleanup must complete first. If it fails, the tenant remains
        // due so the next run can retry it; both cleanup operations are safe to
        // repeat after a partial failure.
        await this.cleanupExternal(tenant);

        // The condition is re-checked atomically: a reactivation that landed
        // after the read above wins and the tenant is kept. Keep this check
        // immediately before the destructive database operation.
        const result = await this.prisma.tenant.deleteMany({
          where: {
            id: tenant.id,
            isActive: false,
            deletionScheduledAt: { lte: now },
          },
        });
        if (result.count === 0) continue;
        purged += 1;
        this.logger.log(`Tenant ${tenant.id} eliminado definitivamente`);
        for (const to of emails) {
          await this.emailService
            .sendAccountDeleted({ to, businessName: tenant.name })
            .catch((err: Error) =>
              this.logger.error(
                `Fallo al avisar la eliminación: ${err.message}`,
              ),
            );
        }
      } catch (err) {
        failed += 1;
        this.logger.error(
          `Fallo al eliminar el tenant ${tenant.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    this.logger.log(
      `Purga de cuentas: ${purged} eliminadas, ${failed} fallidas, ${due.length} vencidas`,
    );
    return { due: due.length, purged, failed };
  }

  private async cleanupExternal(tenant: {
    id: string;
    stripeSubscriptionId: string | null;
    subscriptionStatus: string | null;
  }): Promise<void> {
    if (!this.storage.isConfigured) {
      throw new Error(
        `R2 storage is not configured; cannot purge tenant ${tenant.id}`,
      );
    }
    await this.storage.deletePrefix(`tenants/${tenant.id}/`);
    const subscriptionId = tenant.stripeSubscriptionId;
    if (subscriptionId && hasLiveSubscription(tenant)) {
      if (!this.billing.isConfigured) {
        throw new Error(
          `Stripe is not configured; cannot cancel the subscription for tenant ${tenant.id}`,
        );
      }
      try {
        await this.billing.cancelSubscriptionNow(subscriptionId);
      } catch (err) {
        if (!isAlreadyCanceledSubscription(err)) throw err;
      }
    }
  }

  private async ownerEmails(tenantId: string): Promise<string[]> {
    const owners = await this.prisma.user.findMany({
      where: { tenantId, role: 'OWNER' },
      select: { email: true },
    });
    return owners.map((o) => o.email);
  }

  private frontendUrl(): string {
    return (
      this.config.get<string>('FRONTEND_URL') || 'http://localhost:3001'
    ).replace(/\/+$/, '');
  }
}

function hasLiveSubscription(tenant: {
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
}): boolean {
  return (
    !!tenant.stripeSubscriptionId && tenant.subscriptionStatus !== 'CANCELED'
  );
}

function isAlreadyCanceledSubscription(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;

  const stripeError = err as {
    code?: unknown;
    message?: unknown;
    raw?: { code?: unknown; message?: unknown };
  };
  if (
    // Only "the subscription no longer exists" proves cleanup is done; any other
    // invalid request must fail the purge so the tenant is retried.
    stripeError.code === 'resource_missing' ||
    stripeError.raw?.code === 'resource_missing'
  ) {
    return true;
  }

  const message =
    typeof stripeError.message === 'string'
      ? stripeError.message
      : typeof stripeError.raw?.message === 'string'
        ? stripeError.raw.message
        : '';
  return /subscription.*already.*cancel(?:led|ed)|already.*cancel(?:led|ed).*subscription/i.test(
    message,
  );
}

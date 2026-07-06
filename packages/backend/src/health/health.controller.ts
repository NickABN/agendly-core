import { Controller, Get } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorService,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';

/** Rechaza si la promesa no resuelve en `ms` milisegundos. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('DB ping timeout')), ms),
    ),
  ]);
}

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
    private readonly indicator: HealthIndicatorService,
  ) {}

  /** Liveness: el proceso responde. Barato, sin tocar la DB. */
  @Get()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  live() {
    return { status: 'ok' };
  }

  /** Readiness: la app puede servir tráfico (DB alcanzable). Para Render. */
  @Get('ready')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @HealthCheck()
  ready() {
    return this.health.check([() => this.checkDatabase()]);
  }

  private async checkDatabase() {
    const check = this.indicator.check('database');
    try {
      // Timeout corto: una DB caída/colgada debe fallar rápido (503), no colgar
      // el readiness probe (Render lo interpretaría como timeout).
      await withTimeout(this.prisma.$queryRaw`SELECT 1`, 3000);
      return check.up();
    } catch (err) {
      return check.down({
        message: err instanceof Error ? err.message : 'DB unreachable',
      });
    }
  }
}

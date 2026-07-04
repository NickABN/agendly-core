import { NotFoundException } from '@nestjs/common';

/**
 * Load-or-404 helper: unwraps a nullable query result or throws a
 * NotFoundException with a Spanish user-facing message.
 *
 *   const service = ensureExists(
 *     await this.prisma.service.findFirst({ where: { id, tenantId, deletedAt: null } }),
 *     'Servicio no encontrado',
 *   );
 */
export function ensureExists<T>(
  value: T | null | undefined,
  message: string,
): T {
  if (value === null || value === undefined) {
    throw new NotFoundException(message);
  }
  return value;
}

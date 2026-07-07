/**
 * Convierte una duración estilo `15m`, `7d`, `30d`, `90s`, `2h` a milisegundos.
 * La DB necesita ms (para calcular `expiresAt`), mientras que `JwtModule` consume
 * la string cruda — por eso el parser vive acá y se comparte.
 */
const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

export function parseDurationMs(value: string): number {
  const match = /^(\d+)\s*([smhd])$/.exec(value.trim());
  if (!match) {
    throw new Error(
      `Duración inválida: "${value}". Usá el formato <número><s|m|h|d> (ej. 15m, 7d).`,
    );
  }
  const amount = Number(match[1]);
  const unit = match[2];
  return amount * UNIT_MS[unit];
}

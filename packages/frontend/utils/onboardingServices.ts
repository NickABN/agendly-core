const mxnAmountFormatter = new Intl.NumberFormat('es-MX', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const ONBOARDING_SERVICE_DURATION_OPTIONS = [
  ...Array.from({ length: 16 }, (_, index) => (index + 1) * 15),
  40,
  50,
].sort((first, second) => first - second);

export function formatServiceDuration(durationMinutes: number): string {
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

export function formatMXNPrice(price: number): string {
  const safePrice = Number.isFinite(price) ? Math.max(0, price) : 0;
  return `$${mxnAmountFormatter.format(safePrice)}`;
}

export function parseMXNPrice(value: string): number {
  if (value.trim().startsWith('-')) return 0;

  const normalizedInput = value.trim().replace(/[^\d.,]/g, '');
  if (!normalizedInput) return 0;

  let normalized = normalizedInput;
  if (normalized.includes('.') && normalized.includes(',')) {
    normalized = normalized.replace(/,/g, '');
  } else if (normalized.includes(',')) {
    const commaCount = (normalized.match(/,/g) || []).length;
    const decimalDigits = normalized.length - normalized.lastIndexOf(',') - 1;
    normalized =
      commaCount === 1 && decimalDigits > 0 && decimalDigits <= 2
        ? normalized.replace(',', '.')
        : normalized.replace(/,/g, '');
  }

  const parsedPrice = Number(normalized);
  if (!Number.isFinite(parsedPrice)) return 0;
  return Math.round((Math.max(0, parsedPrice) + Number.EPSILON) * 100) / 100;
}

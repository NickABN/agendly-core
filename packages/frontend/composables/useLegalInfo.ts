import { LEGAL_DOCS_VERSION } from '@agendly/shared';

/** Placeholder rendered when a required legal field is not configured yet. */
const PENDING = '[pendiente de configurar]';

/**
 * Identity of the data controller ("responsable") shown in the legal pages.
 * Values come from NUXT_PUBLIC_LEGAL_* so they can change without a deploy of
 * new copy; missing values render a visible placeholder instead of a fake one.
 */
export function useLegalInfo() {
  const config = useRuntimeConfig().public;

  const name = (config.legalName as string) || PENDING;
  const address = (config.legalAddress as string) || PENDING;
  const email = (config.legalEmail as string) || '';

  const [year, month, day] = LEGAL_DOCS_VERSION.split('-').map(Number);
  const updatedAt = new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return {
    name,
    address,
    email,
    emailLabel: email || PENDING,
    supportUrl: (config.supportUrl as string) || '',
    version: LEGAL_DOCS_VERSION,
    updatedAt,
  };
}

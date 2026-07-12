import { computed } from 'vue';

export function normalizePublicAppUrl(appUrl: string): string {
  return appUrl.replace(/\/+$/, '');
}

function normalizeSlug(slug: string | null | undefined): string {
  return slug?.trim() || '';
}

export function formatPublicAppUrlForDisplay(appUrl: string): string {
  const normalizedUrl = normalizePublicAppUrl(appUrl);
  const url = new URL(normalizedUrl);
  const normalizedPathname = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '');

  return `${url.host}${normalizedPathname}`;
}

export function buildPublicBookingUrl(
  appUrl: string,
  slug: string | null | undefined,
): string {
  const normalizedSlug = normalizeSlug(slug);

  if (!normalizedSlug) {
    return '';
  }

  return `${normalizePublicAppUrl(appUrl)}/${normalizedSlug}`;
}

export function formatPublicBookingUrl(
  appUrl: string,
  slug: string | null | undefined,
): string {
  const normalizedSlug = normalizeSlug(slug);

  if (!normalizedSlug) {
    return '';
  }

  return `${formatPublicAppUrlForDisplay(appUrl)}/${normalizedSlug}`;
}

export function usePublicBookingUrl() {
  const runtimeConfig = useRuntimeConfig();
  const appUrl = computed(() => normalizePublicAppUrl(runtimeConfig.public.appUrl as string));
  const bookingBaseLabel = computed(() => `${formatPublicAppUrlForDisplay(appUrl.value)}/`);

  function bookingUrl(slug: string | null | undefined): string {
    return buildPublicBookingUrl(appUrl.value, slug);
  }

  function bookingDisplayUrl(slug: string | null | undefined): string {
    return formatPublicBookingUrl(appUrl.value, slug);
  }

  return {
    appUrl,
    bookingBaseLabel,
    bookingUrl,
    bookingDisplayUrl,
  };
}

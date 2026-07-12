import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(__dirname, 'onboarding.vue'), 'utf-8');

describe('onboarding.vue public booking link surfaces', () => {
  it('renders the runtime-config-driven booking base label in the slug field', () => {
    expect(source).toContain('{{ bookingBaseLabel }}');
    expect(source).toContain('const { bookingBaseLabel, bookingDisplayUrl, bookingUrl } = usePublicBookingUrl();');
  });

  it('renders the booking display URL in the success/share surface', () => {
    expect(source).toContain('return bookingDisplayUrl(slug);');
    expect(source).toContain('{{ publicUrl }}');
  });

  it('wires the copy button through the centralized booking URL helper', () => {
    expect(source).toContain('@click="copyUrl"');
    expect(source).toContain('const url = bookingUrl(businessForm.slug || store.tenant?.slug);');
    expect(source).toContain('navigator.clipboard.writeText(url);');
  });
});

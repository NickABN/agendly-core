import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const adminConfigSource = readFileSync(resolve(__dirname, 'pages/admin/config.vue'), 'utf-8');
const landingSource = readFileSync(resolve(__dirname, 'pages/index.vue'), 'utf-8');

describe('additional public booking link surfaces', () => {
  it('renders the runtime-config-driven booking base label in admin config', () => {
    expect(adminConfigSource).toContain('const { bookingBaseLabel } = usePublicBookingUrl();');
    expect(adminConfigSource).toContain('{{ bookingBaseLabel }}');
  });

  it('renders the runtime-config-driven booking example URL on the landing page', () => {
    expect(landingSource).toContain("const exampleBookingUrl = computed(() => bookingDisplayUrl('tu-salon'))");
    expect(landingSource).toContain('{{ exampleBookingUrl }}');
  });
});

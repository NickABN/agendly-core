/**
 * Preservation property tests for profile.vue
 *
 * These tests run on UNFIXED code and MUST PASS — they confirm the baseline
 * behavior that must be preserved after the scroll-fix is applied.
 *
 * Validates: Requirements 3.1, 3.2, 3.3
 *
 * Strategy: Since vitest.config.ts uses environment: 'node' (no jsdom),
 * we cannot mount Vue components. Instead we read the raw .vue source and
 * assert on the template strings directly, plus test the tab-switching
 * reactive logic in isolation.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ─── Load raw template source ──────────────────────────────────────────────────

const PROFILE_VUE_PATH = resolve(__dirname, 'profile.vue');
const source = readFileSync(PROFILE_VUE_PATH, 'utf-8');

// ─── Tab logic (isolated, no Vue runtime needed) ───────────────────────────────

type Tab = 'general' | 'imagenes' | 'ubicacion';

function makeTabState(initial: Tab = 'general') {
  let activeTab: Tab = initial;
  return {
    get activeTab() {
      return activeTab;
    },
    setTab(tab: Tab) {
      activeTab = tab;
    },
    isVisible(tab: Tab) {
      return activeTab === tab;
    },
  };
}

// ─── Property 2: Preservation ─────────────────────────────────────────────────

describe('profile.vue — Preservation (Property 2)', () => {
  /**
   * 3.1 — Header fijo
   * For any profile data combination, the header element must carry the
   * sticky/fixed classes so it stays pinned at the top of the content area.
   *
   * Validates: Requirements 3.1
   */
  describe('3.1 Header fijo — sticky classes present in template', () => {
    it('header element contains sticky top-0 z-40 shrink-0', () => {
      // The header tag with its class attribute must be present in the source
      expect(source).toContain('sticky top-0 z-40 shrink-0');
    });

    it('sticky classes appear inside a <header> element', () => {
      // Verify the sticky classes are on a <header> tag (not some other element)
      const headerBlockMatch = source.match(/<header[\s\S]*?>/);
      expect(headerBlockMatch).not.toBeNull();
      const headerOpenTag = headerBlockMatch![0];
      expect(headerOpenTag).toContain('sticky');
      expect(headerOpenTag).toContain('top-0');
      expect(headerOpenTag).toContain('z-40');
      expect(headerOpenTag).toContain('shrink-0');
    });

    // Property: for any profile data combination the header classes are static
    // (they don't depend on data bindings), so they are always present.
    it('header sticky classes are not conditionally bound (static class attribute)', () => {
      // If the classes were dynamic they would appear as :class="..." binding.
      // Assert the sticky classes appear in a plain class="..." attribute.
      const staticClassPattern = /class="[^"]*sticky top-0 z-40 shrink-0[^"]*"/;
      expect(staticClassPattern.test(source)).toBe(true);
    });
  });

  /**
   * 3.2 — All three tab sections accessible in the DOM
   * For any profile data combination, the three tab labels and their
   * corresponding v-show sections must be present in the template.
   *
   * Validates: Requirements 3.2
   */
  describe('3.2 Tab sections — all three present in template', () => {
    const expectedLabels = ['Información general', 'Imágenes', 'Ubicación'];
    const expectedTabIds: Tab[] = ['general', 'imagenes', 'ubicacion'];

    it.each(expectedLabels)('tab label "%s" is present in the template', (label) => {
      expect(source).toContain(label);
    });

    it.each(expectedTabIds)(
      'v-show section for tab "%s" is present in the template',
      (tabId) => {
        // Each section uses v-show="activeTab === '<tabId>'"
        const vShowPattern = new RegExp(`v-show="activeTab === '${tabId}'"`, 'g');
        expect(vShowPattern.test(source)).toBe(true);
      },
    );

    it('all three tab ids are defined in the tabs array in the script', () => {
      // The script defines: { id: 'general' }, { id: 'imagenes' }, { id: 'ubicacion' }
      expect(source).toContain("id: 'general'");
      expect(source).toContain("id: 'imagenes'");
      expect(source).toContain("id: 'ubicacion'");
    });
  });

  /**
   * 3.3 — Tab navigation logic
   * Clicking a tab sets activeTab to that tab's id, which controls v-show.
   * We test the reactive logic in isolation (no Vue runtime needed).
   *
   * Validates: Requirements 3.3
   */
  describe('3.3 Tab navigation logic', () => {
    it('initial active tab is "general"', () => {
      const state = makeTabState('general');
      expect(state.activeTab).toBe('general');
      expect(state.isVisible('general')).toBe(true);
      expect(state.isVisible('imagenes')).toBe(false);
      expect(state.isVisible('ubicacion')).toBe(false);
    });

    it('switching to "imagenes" shows only imagenes section', () => {
      const state = makeTabState('general');
      state.setTab('imagenes');
      expect(state.isVisible('general')).toBe(false);
      expect(state.isVisible('imagenes')).toBe(true);
      expect(state.isVisible('ubicacion')).toBe(false);
    });

    it('switching to "ubicacion" shows only ubicacion section', () => {
      const state = makeTabState('general');
      state.setTab('ubicacion');
      expect(state.isVisible('general')).toBe(false);
      expect(state.isVisible('imagenes')).toBe(false);
      expect(state.isVisible('ubicacion')).toBe(true);
    });

    it('switching back to "general" from another tab restores general visibility', () => {
      const state = makeTabState('imagenes');
      state.setTab('general');
      expect(state.isVisible('general')).toBe(true);
      expect(state.isVisible('imagenes')).toBe(false);
    });

    // Property: exactly one tab is visible at any time
    const allTabs: Tab[] = ['general', 'imagenes', 'ubicacion'];
    it.each(allTabs)('exactly one section is visible when activeTab is "%s"', (activeTab) => {
      const state = makeTabState(activeTab);
      const visibleCount = allTabs.filter((t) => state.isVisible(t)).length;
      expect(visibleCount).toBe(1);
    });

    it('template uses @click="activeTab = tab.id" to drive tab switching', () => {
      // Confirm the template wires click events to activeTab assignment
      expect(source).toContain('@click="activeTab = tab.id"');
    });

    it('template uses v-show (not v-if) so all sections remain in the DOM', () => {
      // v-show keeps elements in the DOM (accessible), v-if removes them.
      // Count v-show occurrences for each tab id.
      const vShowCount = (source.match(/v-show=/g) ?? []).length;
      expect(vShowCount).toBeGreaterThanOrEqual(3);

      // Confirm v-if is NOT used for the tab sections
      expect(source).not.toMatch(/v-if="activeTab === '(general|imagenes|ubicacion)'"/);
    });
  });
});

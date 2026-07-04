# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Scroll interno en página de perfil
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to the concrete failing case — the root div of `profile.vue` contains `h-full` and `overflow-hidden`, and a child element contains `overflow-y-auto`
  - Mount `packages/frontend/pages/admin/settings/profile.vue` with Vue Test Utils and inspect the rendered DOM
  - Assert that `isBugCondition` is false: the root element must NOT have both `h-full` and `overflow-hidden`, and no descendant must have `overflow-y-auto` inside a height-constrained parent
  - Run test on UNFIXED code (before removing the classes)
  - **EXPECTED OUTCOME**: Test FAILS (confirms the bug exists — root has `h-full overflow-hidden`, content div has `overflow-y-auto`)
  - Document counterexamples found: e.g. `rootEl.classList` contains `h-full` and `overflow-hidden`; `rootEl.querySelector('.overflow-y-auto')` is not null
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Header fijo, tabs y contenido accesibles
  - **IMPORTANT**: Follow observation-first methodology
  - Observe on UNFIXED code: header with `sticky top-0 z-40 shrink-0` renders correctly
  - Observe on UNFIXED code: all three tabs (Información general, Imágenes, Ubicación) are present in the DOM
  - Observe on UNFIXED code: switching tabs shows/hides the correct sections
  - Write property-based tests with Vitest + Vue Test Utils:
    - For any profile data combination (with/without logo, banner, address), the header renders with `sticky top-0 z-40 shrink-0`
    - For any profile data combination, all three tab sections are accessible in the DOM
    - Tab navigation logic (click tab → correct section visible) works correctly
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. Fix: eliminar contexto de scroll interno en profile.vue

  - [x] 3.1 Implement the fix
    - In `packages/frontend/pages/admin/settings/profile.vue`, change the root div class from `"flex flex-col h-full overflow-hidden"` to `"flex flex-col"`
    - Change the content div class from `"flex-1 overflow-y-auto p-4 sm:p-6"` to `"p-4 sm:p-6"`
    - Verify visually that the sticky header (`sticky top-0 z-40`) still works correctly after removing `overflow-hidden` from the parent
    - _Bug_Condition: isBugCondition(root) where root.classList contains 'h-full' AND 'overflow-hidden' AND root.querySelector('.overflow-y-auto') IS NOT NULL_
    - _Expected_Behavior: root does NOT have 'h-full' or 'overflow-hidden'; no descendant has 'overflow-y-auto' inside a height-constrained parent; scroll flows naturally through the layout_
    - _Preservation: header sticky top-0 z-40 shrink-0 remains visible; all tab content accessible; layout/sidebar unchanged_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Ausencia de scroll interno en página de perfil
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (no `h-full overflow-hidden` on root, no `overflow-y-auto` on content)
    - When this test passes, it confirms the fix is correct
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Header fijo, tabs y contenido accesibles
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions — header, tabs, and content still work correctly)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Run `pnpm --filter @agendly/frontend test -- --run` and verify all tests pass
  - Verify visually in browser: navigate to `/admin/settings/profile` and confirm no internal scrollbar appears
  - Verify visually: header remains fixed when scrolling the page
  - Verify visually: all three tabs and their content are accessible
  - Verify visually: navigating to other admin pages shows no layout or sidebar changes
  - Ensure all tests pass; ask the user if questions arise

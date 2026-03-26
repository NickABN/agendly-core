# Design System Specification: Professional Warmth & Operational Calm

## 1. Overview & Creative North Star
The North Star for this design system is **"The Digital Sanctuary."** In an era of chaotic scheduling and cognitive overload, this system acts as a high-end concierge. It moves beyond the "standard SaaS" look by prioritizing breathing room, soft tonal transitions, and an editorial layout that feels curated rather than automated.

To achieve this, we break the "template" look through:
*   **Intentional Asymmetry:** Using generous, off-center white space to guide the eye.
*   **Layered Depth:** Replacing harsh lines with a hierarchy of "nested" surfaces.
*   **Atmospheric Clarity:** Utilizing a "Mobile-First, Precision-Second" philosophy where touch targets are generous but the desktop experience feels like a premium workspace.

---

## 2. Color & Surface Architecture
We move away from the "flat web" by treating the UI as a series of physical layers—like stacked sheets of fine paper or frosted glass.

### The Palette (Material 3 Derived)
*   **Primary (`#005da9`):** Our core of trust. Used for high-intent actions.
*   **Secondary (`#006c49`):** Our "Success" signal, representing growth and completion.
*   **Tertiary (`#765700`):** Our "Celebrate" tone, used for highlights and moments of delight.
*   **Neutral-50 (`#f8f9fa`):** The canvas. A soft, warm grey that reduces eye strain compared to pure white.

### The "No-Line" Rule
**Strict Mandate:** Designers are prohibited from using 1px solid borders for sectioning. 
Structure is defined through:
1.  **Background Color Shifts:** Use `surface_container_low` on a `surface` background.
2.  **Tonal Transitions:** A transition from `surface_container_lowest` (white) to `surface_container` creates a boundary without the "boxed-in" feeling of a line.

### Glass & Gradient Implementation
To inject "soul" into the UI:
*   **The Glass Rule:** Floating elements (Modals, Navigation Bars) must use semi-transparent surface colors with a `backdrop-blur` (e.g., `surface_container_lowest` at 85% opacity).
*   **Signature Gradients:** Main CTAs should use a subtle linear gradient from `primary` to `primary_container`. This adds a 3D "pressable" quality that flat colors lack.

---

## 3. Typography: The Editorial Voice
We use **Inter** not just for legibility, but as a tool for hierarchy. The scale is aggressive to ensure an editorial, high-end feel.

*   **Display (Display-LG 3.5rem):** Reserved for "Hero" moments. Tracking should be set to -2% to feel tight and authoritative.
*   **Headlines (Headline-MD 1.75rem):** Use `on_surface` color. These are the anchors of your page.
*   **Body (Body-LG 1rem):** The workhorse. Always use a line-height of 1.5 to ensure "Operational Calm."
*   **Labels (Label-MD 0.75rem):** Use `on_surface_variant`. These should never be pure black; the slight grey shift reduces visual noise.

---

## 4. Elevation & Tonal Layering
Depth is achieved by "stacking" the surface-container tiers. Avoid traditional drop shadows unless an element is truly "floating" over content.

*   **The Layering Principle:** 
    *   **Level 0 (Canvas):** `surface` (`#f8f9fa`)
    *   **Level 1 (Sections):** `surface_container_low` (`#f3f4f5`)
    *   **Level 2 (Cards):** `surface_container_lowest` (`#ffffff`) - This creates a natural "pop" against the canvas.
*   **Ambient Shadows:** For floating elements, use a "Ghost Shadow": `0px 4px 20px rgba(25, 28, 29, 0.06)`. It should feel like a soft glow of light, not a dark smudge.
*   **The Ghost Border Fallback:** If a container is placed on an identical background color, use a 1px border with `outline_variant` at **15% opacity**. High-contrast borders are forbidden.

---

## 5. Components & Primitives

### Cards & Lists
*   **The Rule of Space:** Forbid divider lines. Separate list items using `spacing-4` (1rem) of vertical white space or a subtle background shift on hover/active states.
*   **Rounding:** All cards must use `rounded-xl` (1.5rem / 24px) for a soft, approachable feel.

### Buttons
*   **Primary:** `primary` background with `on_primary` text. `rounded-full` for a modern, mobile-friendly feel.
*   **Secondary:** `surface_container_high` background. No border.
*   **Tertiary:** Text-only with `primary` color. Reserved for "Cancel" or "Go Back."

### Input Fields
*   **Style:** Minimalist. No bottom line or full box. Use a `surface_container_highest` background with a `rounded-md` (0.75rem) corner.
*   **Focus State:** Transition the background to `surface_container_lowest` and add the "Ghost Border" in `primary`.

### Interaction Chips
*   **Action Chips:** Use `secondary_container` for positive feedback and `tertiary_fixed` for warnings or reminders. Ensure `spacing-2` (0.5rem) internal padding.

---

## 6. Do’s and Don’ts

### Do:
*   **Embrace Whitespace:** If a layout feels "busy," add more space, don't add more lines.
*   **Use Soft Transitions:** Animate state changes (hover, active) with a `200ms ease-out` curve.
*   **Prioritize the "Thumb Zone":** In mobile layouts, place primary actions within the bottom 30% of the screen.

### Don’t:
*   **Don't Use Pure Black:** It’s too harsh for "Professional Warmth." Use `on_surface` (`#191c1d`).
*   **Don't Overstack Shadows:** If one card is elevated, the others should remain flat to maintain a clear focal point.
*   **Don't Use Default Inter Spacing:** Tighten the letter-spacing on headlines (-0.02em) and slightly loosen it on small labels (+0.05em) for premium readability.
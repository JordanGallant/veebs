---
name: minimalui
description: >
  UI styling contract for all frontend work. Trigger on any HTML/CSS/UI task. Enforces a
  2-color + 2-font system, token-only styling, accessibility, responsive behavior, and anti-duplication rules.
---

# Minimal UI

## Intent
- Keep the UI clean, strict, and readable with minimal visual noise.
- Prefer consistency and reuse over one-off styling.
- prefer icons over text lables and buttons, where it makes sense
- Keep CSS easy to maintain for both humans and agents.

## Non-Negotiables
- Use exactly 2 core colors: `bg` and `fg`. Create hierarchy with spacing, opacity, border weight, and type scale only.
- Use exactly 2 fonts: one body font and one header font.
- Body copy uses one base size token. Larger text uses header tokens.
- Bold text uses the header font and only `--font-bold`.
- Font weights are limited to regular and bold.
- No box shadows. Use borders and spacing for structure.
- Radius is always `4px` on non-circular UI.
- No hardcoded colors, fonts, radius, spacing, or durations in component rules.
- No duplicated selector blocks with near-identical declarations.
- No duplicate `@keyframes` names.
- Every control has visible focus styles and a text label.
- Mobile and desktop support is mandatory.

## Theme Contract
Single source of truth. Never hardcode style primitives outside this token set.

```css
:root {
  --color-bg: ;
  --color-fg: ;
  --font: ;
  --font-header: ;
  --font-normal: 400;
  --font-bold: 700;
  --radius: 4px;
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 32px;
  --space-xl: 64px;

  --text-sm: 14px;
  --text-body: 16px;
  --text-header-md: 22px;
  --text-header-lg: 32px;

  --opacity-secondary: 0.55;
  --opacity-muted: 0.35;

  --border-subtle: 1px solid color-mix(in srgb, var(--color-fg) 10%, transparent);
  --border-default: 1px solid color-mix(in srgb, var(--color-fg) 20%, transparent);
  --border-strong: 1px solid color-mix(in srgb, var(--color-fg) 30%, transparent);
  --surface-soft: color-mix(in srgb, var(--color-bg) 94%, transparent);
  --surface-press: color-mix(in srgb, var(--color-fg) 8%, transparent);

  --focus-ring: 2px solid var(--color-fg);
  --motion-fast: 150ms;
  --motion-base: 250ms;
  --motion-slow: 450ms;
  --ease-standard: cubic-bezier(0.16, 1, 0.3, 1);
}
```

If TS controls theming, set these on `:root` via `theme.ts` during app startup.

## CSS Architecture
- Split styles by concern: `tokens.css`, `base.css`, `components/*.css`, `utilities.css`.
- Keep selectors shallow and class-based. Avoid deep descendant chains and ID-coupled styling.
- Prefer shared primitives for repeated patterns (panel, icon-button, help-toggle, collapsible help, full-screen stage).
- Use modifier classes for state (`.is-open`, `.is-active`, `.is-exiting`) instead of duplicate component variants.

## Component Standards
- Button primary: solid fg on bg inverse.
- Button secondary and danger: share one base variant and only differ by state token or opacity token.
- Inputs and textareas: use `--border-default`, focus uses `--focus-ring` or full-fg border.
- Tabs: inactive via opacity token, active via border + weight.
- Panels/cards: use `--border-default` and optional `--surface-soft`.
- Secondary and muted text must use opacity tokens, never ad hoc values.
- Icon-only buttons must include `aria-label`.

## Layout and Responsive
- Use one viewport-height strategy consistently (`min-height: 100svh` plus fallback where needed).
- Define and reuse layout primitives (`.stack`, `.cluster`, `.center`, `.screen-shell`) instead of repeating flex blocks.
- Keep touch targets at least `44px` on mobile.
- Prefer fluid type with `clamp()` only when needed; avoid duplicate declarations in the same media block.
- Ensure all screens work from `320px` width to desktop.

## Motion Rules
- Animations are optional and purposeful (state change, reveal, feedback).
- Reuse keyframes; never redefine the same keyframe name with different values.
- All transitions must use motion tokens.
- Respect reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation: none !important;
    transition: none !important;
  }
}
```

### Print Reveal
Reusable one-shot reveal animation that clips content in from top to bottom, like a receipt printing.
Use it anywhere a hidden section needs to appear with a lightweight entrance.

- Add `.print-reveal` to the element after making it visible (remove `hidden`, set `display`, etc.).
- To replay the animation, remove the class, force a reflow (`void el.offsetWidth`), then re-add it.
- Automatically disabled under `prefers-reduced-motion: reduce`.

```css
@keyframes print-reveal {
  from { clip-path: inset(0 0 100% 0); opacity: 0; }
  to   { clip-path: inset(0);           opacity: 1; }
}

.print-reveal {
  animation: print-reveal var(--motion-slow) var(--ease-standard) both;
}
```

## Accessibility Rules
- Labels are required for inputs; placeholders are supplemental only.
- Focus-visible style is required on all interactive controls.
- Inline error or status text must reserve space to avoid layout jumps.
- Color is never the only state indicator (also use border, icon, text, or weight).

## Redundancy Guardrails
- If two selectors share 80% or more declarations, extract a shared class.
- If the same literal value appears 3 or more times, create a token.
- Do not define the same selector twice in one media query unless intentionally overriding with a comment.
- Before merge, scan for duplicate keyframes/selectors and unresolved hardcoded values.

## Agent Workflow
1. Check if the style can be solved with existing tokens and component primitives.
2. If not, add/extend tokens first, then implement component styles.
3. Reuse shared classes before creating new variants.
4. Validate keyboard access, focus states, and mobile layout.
5. Run a quick redundancy pass before finalizing.

## Definition of Done
- No hardcoded design primitives outside theme tokens.
- No duplicate keyframe names or accidental selector overrides.
- Shared patterns extracted into reusable classes.
- Meets contrast, focus, and labeling requirements.
- Verified on mobile and desktop breakpoints.

## Never
- Hardcoded colors/fonts/radius/spacing in component rules.
- Shadows or decorative chrome that adds noise.
- Third font family or third font weight.
- Pill-shaped controls unless the element is truly circular.
- Duplicate animation names with different behavior.
- Mixed body text sizes for regular copy.

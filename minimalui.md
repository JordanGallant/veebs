---
name: minimalui
description: >
  UI design rules for every interface, component, or styling task. Trigger on any HTML, CSS,
  or frontend work. 2 colors, 2 fonts (body + header), no shadows, mandatory theme provider, 4px radius.
---

# Minimal UI

## Rules
- 2 colors: bg + fg. Hierarchy via opacity, spacing, size only.
- 2 fonts only: one body font + one header font.
- Body text is one size everywhere.
- Any text bigger than body size must use the header font.
- Any bold text must use the header font (including buttons).
- Weight is limited to regular + bold.
- No shadows. Borders and spacing separate elements.
- Radius: `4px` everywhere. Never pill-shaped on non-circular elements.
- Responsive: works on mobile and desktop
- Userfriendly: labels not placeholders, visible focus states, inline errors, no unlabeled icons.

## Theme Provider
Single source of truth. Never hardcode outside it.

```css
:root {
  --color-bg: ;
  --color-fg: ;
  --font: ;          /* body font */
  --font-header: ;   /* header font */
  --font-normal: 400;
  --font-bold: 700;
  --radius: 4px;
  --space-xs: 4px; --space-sm: 8px; --space-md: 16px; --space-lg: 32px; --space-xl: 64px;
  --text-body: 16px;
  --text-header-md: 20px;
  --text-header-lg: 28px;
}
```

For TS: a `theme.ts` that sets these on `:root` at load.

## Components
- **Button:** `bg: var(--color-fg)`, `color: var(--color-bg)`, `border-radius: var(--radius)`. Hover: `opacity: 0.85`.
- **Input:** `border: 1px solid color-mix(in srgb, var(--color-fg) 20%, transparent)`, `border-radius: var(--radius)`. Focus: full fg border.
- **Body text:** `font-family: var(--font)`, `font-size: var(--text-body)`.
- **Header text:** `font-family: var(--font-header)`, `font-size: var(--text-header-md|lg)`.
- **Secondary text:** `opacity: 0.5`.
- **Dividers:** `1px solid color-mix(in srgb, var(--color-fg) 10%, transparent)`.

## Never
Hardcoded colors/fonts/radii outside theme. Shadows. 3rd font weight. Decorative elements. Pill buttons. Mixed body font sizes.

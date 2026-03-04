---
name: minimalui
description: >
  UI design rules for every interface, component, or styling task. Trigger on any HTML, CSS,
  or frontend work. 2 colors, 2 font styles, no shadows, mandatory theme provider, 4px radius.
---

# Minimal UI

## Rules
- 2 colors: bg + fg. Hierarchy via opacity, spacing, size only.
- 2 font styles: one typeface, regular + bold. Nothing else.
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
  --color-bg-rgb: ;
  --color-fg-rgb: ;
  --font: ;
  --font-normal: 400;
  --font-bold: 700;
  --radius: 4px;
  --space-xs: 4px; --space-sm: 8px; --space-md: 16px; --space-lg: 32px; --space-xl: 64px;
  --text-sm: 13px; --text-md: 16px; --text-lg: 20px; --text-xl: 28px;
}
```

For TS: a `theme.ts` that sets these on `:root` at load.

## Components
- **Button:** `bg: var(--color-fg)`, `color: var(--color-bg)`, `border-radius: var(--radius)`. Hover: `opacity: 0.85`.
- **Input:** `border: 1px solid rgba(var(--color-fg-rgb), 0.2)`, `border-radius: var(--radius)`. Focus: full fg border.
- **Secondary text:** `opacity: 0.5`.
- **Dividers:** `1px solid rgba(var(--color-fg-rgb), 0.1)`.

## Never
Hardcoded colors/fonts/radii outside theme. Shadows. 3rd font weight. Decorative elements. Pill buttons.

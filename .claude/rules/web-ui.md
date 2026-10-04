---
paths:
  - "web/src/**"
---

# Web UI: palette and components

The palette is Tidal Grove (RAA-20). It is light-only and defined once, in `web/src/app/globals.css`: named colours (`cerulean`, `emerald`, `aqua`, `fern`, `mist`, `sage`, `navy`) and the semantic tokens components use (`background`, `foreground`, `surface`, `surface-2`, `muted`, `line`, `line-2`, `link`, `on-dark`, `primary`, `secondary`, `danger`, `warning`). `/admin/ui-kit` renders all of them, and every primitive, for reference.

- **Build from `src/components/ui/`**: `Button` / `ButtonLink`, `Card` / `CardBody`, `Badge`, `Pill`, `Field`, `DisplayTitle`, `SectionTitle`, `Eyebrow`, `Price`. Extend a primitive (a new variant, a new prop) rather than restyling one at its call site. A new primitive also goes on `/admin/ui-kit`.
- **No raw colours** in components: no hex values and no Tailwind default palette classes (`gray-*`, `blue-*`, `slate-*`). If a colour is missing, add a token in `globals.css`.
- **Contrast pairs**:
  - white on `primary` or `secondary` (not on `emerald`, which is 3.8:1);
  - navy on `aqua` or `fern`, never white;
  - `on-dark` or white on `navy`;
  - `muted` for secondary text on white or `surface-2`.
- **Type**: headings and prices use `font-display` (Cormorant Garamond, italic for headings); everything else is `font-sans` (DM Sans).
- **Classes don't merge**: `cn()` only joins class names, so a `className` passed to a primitive adds to its classes and can't reliably override one on the same property.

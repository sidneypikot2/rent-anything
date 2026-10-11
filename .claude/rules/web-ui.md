---
paths:
  - "web/src/**"
---

# Web UI: palette and components

The palette is Tidal Grove (RAA-20). It is light-only and defined once, in `web/src/app/globals.css`: named colours (`cerulean`, `emerald`, `aqua`, `fern`, `mist`, `sage`, `navy`) and the semantic tokens components use (`background`, `foreground`, `surface`, `surface-2`, `muted`, `line`, `line-2`, `line-strong`, `link`, `on-dark`, `primary`, `primary-hover`, `secondary`, `secondary-hover`, `danger`, `warning`). `/admin/ui-kit` shows the palette and every primitive, for reference.

- **Build from `src/components/ui/`**: `Button` / `ButtonLink`, `Card` / `CardBody`, `Badge`, `Pill`, `Field`, `PasswordField`, `SelectField`, `ComboboxField`, `PhoneField`, `TextareaField`, `CheckboxField`, `ChoiceCards` (radio cards with a description each), `StepperField` (a count with − and +), `DateRangeField` (one field opening a calendar for a range or, with `single`, one day — not two `type="date"` inputs), `Dialog`, `Toast`, `DisplayTitle`, `SectionTitle`, `Eyebrow`, `Price`. Extend a primitive (a new variant, a new prop) rather than restyling one at its call site. A new primitive also goes on `/admin/ui-kit`.
- **`Card` clips its content** (`overflow-hidden`): a `Menu` or other dropdown inside one needs `<Card clip={false}>`, or it is cut off at the card's edge (RAA-68).
- **Confirm with `Dialog`**: a step that needs confirming (saving an edit, deleting) opens `Dialog`, with the confirming button last and `variant="danger"` for a destructive one — never `window.confirm` or a one-off modal. A step in a flow (choosing a trip, editing one) is `Dialog placement="sheet"`, docked to the bottom on a phone. A note that something happened, which nothing waits for, is a `Toast`.
- **No raw colours** in components: no hex values and no Tailwind default palette classes (`gray-*`, `blue-*`, `slate-*`). If a colour is missing, add a token in `globals.css`.
- **Contrast pairs**:
  - white on `primary` or `secondary` (not on `emerald`, which is 3.8:1);
  - navy on `aqua` or `fern`, never white;
  - `on-dark`, white or `aqua` on `navy`;
  - `muted` for secondary text on white or `surface-2`;
  - `line` is for card borders only; form fields need `line-strong` (3:1 against white).
- **Type**: headings and prices use `font-display` (Cormorant Garamond, italic for headings); everything else is `font-sans` (DM Sans).
- **Classes don't merge**: `cn()` only joins class names, so a `className` passed to a primitive adds to its classes and can't reliably override one on the same property.
- **Brand**: the product name and tagline come from `web/src/lib/brand.ts` (`BRAND`, `BRAND_PARTS` for the two-tone wordmark in `Logo`, `TAGLINE`) — never write them out in a component or in page metadata (RAA-35). The repo, API and docs keep Rent-Anything. The smoke test (`tools/smoke/tests/smoke.spec.js`) is the one place outside `brand.ts` that spells the name, so a rename updates it too.

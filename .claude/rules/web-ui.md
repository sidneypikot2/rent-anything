---
paths:
  - "web/src/**"
---

# Web UI: palette and components

The palette is Sky & Forest (RAA-102; it replaced Tidal Grove): blue to sky for actions, deep forest green for trust and trips, slate neutrals, glass over photos. It is light-only and defined once, in `web/src/app/globals.css`: named colours (`cerulean`, `emerald`, `aqua`, `fern`, `mist`, `sage`, `navy`, `forest`, `sky-deep`, `sky-pale`, `sky-mist`, `scrim`) and the semantic tokens components use (`background`, `foreground`, `surface`, `surface-2`, `muted`, `line`, `line-2`, `line-strong`, `link`, `on-dark`, `primary`, `primary-hover`, `secondary`, `secondary-hover`, `danger`, `warning`). `/admin/ui-kit` shows the palette and every primitive, and the home page the full look (photo hero, glass, photo cards). The design system, with a usage note per token, is the Sky & Forest artifact (https://claude.ai/artifact/EHtuf5t9vYx8ygEhKEZJ4Z).

- **Build from `src/components/ui/`**: `Button` / `ButtonLink`, `Card` / `CardBody`, `Badge`, `Pill`, `Field`, `PasswordField`, `SelectField`, `ComboboxField`, `PhoneField`, `TextareaField`, `CheckboxField`, `ChoiceCards` (radio cards with a description each), `StepperField` (a count with − and +), `DateRangeField` (one field opening a react-day-picker calendar, styled through its `DayButton` and `classNames` rather than its stylesheet, for a range or, with `single`, one day — not two `type="date"` inputs), `Dialog`, `Toast`, `GlassPanel` (frosted glass over a photo, tones `dark` / `forest` / `light` / `frame`; `glassClasses()` for a link), `DisplayTitle`, `SectionTitle`, `Eyebrow`, `Price`. Extend a primitive (a new variant, a new prop) rather than restyling one at its call site. A new primitive also goes on `/admin/ui-kit`.
- **`Card` clips its content** (`overflow-hidden`): a `Menu` or other dropdown inside one needs `<Card clip={false}>`, or it is cut off at the card's edge (RAA-68).
- **Confirm with `Dialog`**: a step that needs confirming (saving an edit, deleting) opens `Dialog`, with the confirming button last and `variant="danger"` for a destructive one — never `window.confirm` or a one-off modal. A step in a flow (choosing a trip, editing one) is `Dialog placement="sheet"`, docked to the bottom on a phone. A note that something happened, which nothing waits for, is a `Toast`.
- **No raw colours** in components: no hex values and no Tailwind default palette classes (`gray-*`, `blue-*`, `slate-*`). If a colour is missing, add a token in `globals.css`.
- **Buttons are all blue**: `primary`, `secondary` (a deeper blue) and `accent` (pale `aqua` under navy) are shades of one hue, so a row of actions never mixes colours. Green (`emerald`, `forest`) marks trust and trips — badges, the trip header, bands — never a button. Don't alternate colours across a row of like items (tiles, cards).
- **Glass only over a photo**: a photo with text on it gets a scrim (`bg-linear-to-b from-scrim/.. to-scrim/..`); controls on it are `GlassPanel`. White text on dark or forest glass, `sky-mist` for its muted text, `sky-pale` for accents. On white, use a `Card`, never glass.
- **Sample photos**: destinations and activities have no photos in the API yet, so the home page uses stand-ins from `src/components/landing/sample-photos.ts` (`public/images/samples/`, alt text says "Sample photo"). Replace them when the API serves real ones.
- **No emoji as icons** in new work: line icons on a 24px grid, 1.8 stroke, `currentColor` (`TagGlyph` in `src/components/discovery/tag-glyphs.tsx` for activity tags). `icons.ts` emoji remain in search and area pages until they are replaced.
- **Contrast pairs**:
  - white on `primary` (5.2:1), `secondary` (8.7:1), `emerald` (7.1:1) or `forest`;
  - navy on `aqua` or `fern`, never white;
  - `on-dark`, white or `aqua` on `navy`;
  - `muted` for secondary text on white or `surface-2`;
  - `line` is for card borders only; form fields need `line-strong` (3:1 against white).
- **Type**: one family, Plus Jakarta Sans, for both `font-display` and `font-sans`. Headings are `font-display font-extrabold tracking-tight`, upright — no italic headings. The one italic is the hero's closing phrase on a photo, in `sky-pale`.
- **Classes don't merge**: `cn()` only joins class names, so a `className` passed to a primitive adds to its classes and can't reliably override one on the same property.
- **Brand**: the product name and tagline come from `web/src/lib/brand.ts` (`BRAND`, `BRAND_PARTS` for the two-tone wordmark in `Logo`, `TAGLINE`) — never write them out in a component or in page metadata (RAA-35). The repo, API and docs keep Rent-Anything. The smoke test (`tools/smoke/tests/smoke.spec.js`) is the one place outside `brand.ts` that spells the name, so a rename updates it too.

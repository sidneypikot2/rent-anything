---
paths:
  - "web/src/components/**"
  - "web/src/app/**"
---

# Web: image alt text and the heading outline

**Alt text** (RAA-230). An image is either content or decoration, and its `alt` says which:
- **Content** — a photo of a particular thing the page shows: a listing, a model, a business's logo or photos, a landmark, a person. Its `alt` names that thing, from the data it came with (the listing's or model's `title`, `<business> logo`, the landmark's name, `Sample photo: …` for a stand-in), even when the same name is printed beside it. A photo object passed between components carries its `alt` (`{ src, alt }`); build it where the name is known, never as `""`.
- **Decorative** — a photo that only sets the mood behind other content: the site backdrop, a banner's or band's photo under a scrim, the hero's port, a carousel's slides other than the one shown. `alt=""`, so a screen reader skips it.

When in doubt, it is content. A new `alt=""` is for decoration only; grep `alt=""` to review them.

**Headings** (RAA-235, RAA-243): a page has exactly one `h1` — its `DisplayTitle` (repeat the look elsewhere with `as="p"`) — and the outline steps down one level at a time, never skipping one (h1 → h3). A section's title is `SectionTitle` (h2, via `Section`); a card or row title inside it is h3, and one inside that h4. Fix a level by the primitive's `as` (or the tag), never by restyling: the level is the outline, the classes are the look. A heading that is only a styled label (no content under it) is a `p`. Not-found and error pages render their own `h1` on the server. The smoke test "one h1 per page" holds this for the public pages, a not-found and an unknown path; axe's `heading-order` is the check for skipped levels.

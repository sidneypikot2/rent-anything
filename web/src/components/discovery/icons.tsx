import { AreaGlyph, CategoryGlyph, PlaceGlyph, TagGlyph } from "./tag-glyphs";

// Line icons sized to the text around them (1em), for rows and headings that put an icon
// before a name: a tag, an area, a listing's category, or a landmark (the pin). Sky & Forest
// (RAA-102) replaced the emoji these used to return.
const INLINE = "inline-block size-[1.1em] shrink-0 align-[-0.15em]";

export function tagIcon(slug: string) {
  return <TagGlyph slug={slug} className={INLINE} />;
}

export function areaIcon(kind: string) {
  return <AreaGlyph kind={kind} className={INLINE} />;
}

export function categoryIcon(name: string) {
  return <CategoryGlyph name={name} className={INLINE} />;
}

export function placeIcon() {
  return <PlaceGlyph className={INLINE} />;
}

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardLink } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { LandmarkCard, ListingCard as PhotoListingCard } from "@/components/discovery/cards";
import { AreaGlyph, CategoryGlyph, CloseGlyph, TagGlyph } from "@/components/discovery/tag-glyphs";
import { landmarkPhoto, listingPhoto } from "@/components/landing/sample-photos";
import { GlassPanel } from "@/components/ui/glass";
import { PasswordField } from "@/components/ui/password-field";
import { SelectField } from "@/components/ui/select-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { Pill, PillLink } from "@/components/ui/pill";
import { DisplayTitle, Eyebrow, Price, SectionTitle } from "@/components/ui/typography";
import { DialogDemo, MenuDemo, ToastDemo } from "./dialog-demo";
import { InteractiveFields } from "./interactive-fields";

export const metadata: Metadata = {
  title: "UI kit",
};

// The Sky & Forest palette as Tailwind classes (defined in globals.css), with what each
// colour is for.
const SWATCHES = [
  { name: "Cerulean", hex: "#2563EB", className: "bg-cerulean", use: "Primary buttons, links, prices" },
  { name: "Forest", hex: "#14532D", className: "bg-forest", use: "Bands, trip headers, glass tint" },
  { name: "Emerald", hex: "#166534", className: "bg-emerald", use: "Trust badges, cart count, icons" },
  { name: "Aqua", hex: "#DBEAFE", className: "bg-aqua", use: "Accent button, highlight badges" },
  { name: "Fern", hex: "#BFDBFE", className: "bg-fern", use: "Accent hover, soft fills" },
  { name: "Sky pale", hex: "#BAE6FD", className: "bg-sky-pale", use: "Accent text on photos and glass" },
  { name: "Mist", hex: "#F0F9FF", className: "bg-mist", use: "Icon wells, soft buttons" },
  { name: "Sage", hex: "#ECFDF3", className: "bg-sage", use: "Trust notices" },
  { name: "White", hex: "#FFFFFF", className: "bg-white", use: "Page, cards, inputs" },
  { name: "Navy", hex: "#0F172A", className: "bg-navy", use: "Text, header, footer, dark glass" },
];

const CATEGORIES = ["Tours", "Transfers", "Motorbikes", "Freediving", "Stays"];

const ICON_TAGS = ["sightseeing", "snorkelling", "island-hopping", "freediving", "swimming", "sunset-viewing", "hiking", "photography"];
const ICON_CATEGORIES = ["Tour", "Hotel or cottage", "Motorcycle", "Van transfer", "Action camera", "Snorkel gear", "Camera"];

// A reference page for the palette and every component in src/components/ui/. Build new
// pages from these rather than from raw colours.
export default function UiKit() {
  return (
    // The kit shows each primitive as it looks on white, so it sits on a white panel inside the
    // admin section's glass sheet.
    <main
      data-testid="ui-kit"
      className="mx-auto my-3 flex w-full max-w-page flex-1 flex-col gap-12 rounded-card bg-surface px-gutter py-page-pad sm:my-6"
    >
      <header className="flex flex-col gap-2">
        <Eyebrow>Colour system · 10 colours</Eyebrow>
        <DisplayTitle>
          <span className="text-primary">Sky</span> &amp; Forest
        </DisplayTitle>
        <p className="max-w-prose text-muted">
          Blue to sky for actions, deep forest green for trust and trips, glass over photos. Light only.
        </p>
      </header>

      <Showcase title="Palette">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {SWATCHES.map((swatch) => (
            <Card key={swatch.name}>
              <div className={`h-16 border-b border-line ${swatch.className}`} />
              <CardBody pad="sm">
                <p className="font-display font-bold">{swatch.name}</p>
                <p className="text-xs tabular-nums text-muted">{swatch.hex}</p>
                <p className="mt-1 text-xs text-muted">{swatch.use}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </Showcase>

      <Showcase title="Typography">
        <div className="flex flex-col gap-2">
          <Eyebrow>Eyebrow</Eyebrow>
          <DisplayTitle as="p" size="hero">
            Hero title
          </DisplayTitle>
          <DisplayTitle as="p">Display title</DisplayTitle>
          <SectionTitle>Section title</SectionTitle>
          <p>Body text in Plus Jakarta Sans, the one family for headings and text.</p>
          <p className="text-sm text-muted">Muted text for notes and secondary detail.</p>
          <a href="#" className="text-sm font-semibold text-link">
            A link →
          </a>
        </div>
      </Showcase>

      <Showcase title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="soft">Soft</Button>
          <Button variant="danger">Danger</Button>
          <Button size="sm">Small</Button>
          <Button variant="soft" size="touch">Touch</Button>
          <Button disabled>Disabled</Button>
          <Button variant="ghost" size="sm">
            Ghost
          </Button>
          <Button variant="quiet" size="icon" aria-label="Close">
            <CloseGlyph className="size-5" />
          </Button>
          <ButtonLink href="/admin" variant="soft" size="sm">
            Link as button
          </ButtonLink>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-card bg-navy p-6">
          <p className="font-display text-2xl font-extrabold tracking-tight text-white">On navy</p>
          <span className="text-sm text-on-dark">Accent is for dark bands.</span>
          <Button variant="accent">Get started</Button>
        </div>
      </Showcase>

      <Showcase title="Badges and pills">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Best value</Badge>
          <Badge tone="emerald">Eco tour</Badge>
          <Badge tone="mist">New</Badge>
          <Badge tone="warning">Needs a price</Badge>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {CATEGORIES.map((category, index) => (
            <Pill key={category} on={index === 0}>
              {category}
            </Pill>
          ))}
          <PillLink href="/admin/ui-kit">Pill as link</PillLink>
        </div>
      </Showcase>

      <Showcase title="Form fields">
        <div className="grid max-w-md gap-3">
          <Field label="Email" name="email" type="email" placeholder="you@example.com" />
          <Field label="Phone" name="phone" type="tel" hint="With country code, e.g. +63" />
          <Field label="Password" name="password" type="password" error="At least 8 characters" />
          <PasswordField
            label="Password with Show/Hide"
            name="password-toggle"
            hint="PasswordField, with an action in the label row"
            action={<span className="text-xs font-medium text-link">Forgot password?</span>}
          />
          <SelectField
            label="Country"
            name="country"
            hint="SelectField"
            options={[
              { value: "PH", label: "Philippines" },
              { value: "SG", label: "Singapore" },
            ]}
          />
          <TextareaField label="Description" name="description" hint="TextareaField" />
          <CheckboxField label="Guide included (CheckboxField)" name="guide" />
          <InteractiveFields />
          <Field label="Disabled" name="disabled" disabled />
        </div>
      </Showcase>

      <Showcase title="Dialog">
        <DialogDemo />
      </Showcase>

      <Showcase title="Toast">
        <ToastDemo />
      </Showcase>

      <Showcase title="Menu">
        <MenuDemo />
      </Showcase>

      <Showcase title="Glass">
        <div className="relative isolate overflow-hidden rounded-card p-6">
          <Image src="/images/hero.jpg" alt="" fill sizes="(min-width: 1024px) 64rem, 100vw" className="-z-20 object-cover" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-scrim/30" />
          <div className="flex flex-wrap gap-3">
            <GlassPanel className="rounded-card px-4 py-3 font-semibold">Dark</GlassPanel>
            <GlassPanel tone="forest" className="rounded-card px-4 py-3 font-semibold">Forest</GlassPanel>
            <GlassPanel tone="light" className="rounded-card px-4 py-3 font-semibold">Light</GlassPanel>
          </div>
        </div>
        <p className="mt-2 text-sm text-muted">
          For controls on a photo. See it in place on{" "}
          <Link href="/" className="font-semibold text-link">
            the home page
          </Link>
          .
        </p>
      </Showcase>

      <Showcase title="Icons">
        <div className="flex flex-wrap gap-2">
          {ICON_TAGS.map((slug) => (
            <span key={slug} title={slug} className="flex size-11 items-center justify-center rounded-control bg-mist text-primary">
              <TagGlyph slug={slug} className="size-6" />
            </span>
          ))}
          {ICON_CATEGORIES.map((name) => (
            <span key={name} title={name} className="flex size-11 items-center justify-center rounded-control bg-sage text-forest">
              <CategoryGlyph name={name} className="size-6" />
            </span>
          ))}
        </div>
        <p className="mt-2 text-sm text-muted">Line icons for activity tags (blue) and listing categories (green), in place of emoji.</p>
      </Showcase>

      <Showcase title="Photo cards">
        <div className="grid gap-4 sm:grid-cols-2">
          <LandmarkCard
            landmark={{
              slug: "ui-kit-landmark",
              name: "Kota Beach",
              description: "A white-sand beach with a sandbar at low tide.",
              tags: [
                { slug: "white-sand", name: "White sand" },
                { slug: "swimming", name: "Swimming" },
              ],
            }}
            photo={landmarkPhoto([{ slug: "swimming" }], 0)}
          />
          <PhotoListingCard
            href="/admin/ui-kit"
            title="Virgin Island hopping"
            category="Tour"
            note="Tour · by Santa Fe Boats · per guest"
            summary="Half a day on the water, with snorkelling stops."
            photo={listingPhoto("Tour", 0)}
            action={<Button size="sm">Add to trip</Button>}
          />
        </div>
      </Showcase>

      <Showcase title="Cards">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ListingCard
            badge={<Badge>Best value</Badge>}
            tint="bg-sage"
            title="Sardine run snorkel"
            price="₱1,200"
            unit="/ person"
          />
          <ListingCard
            badge={<Badge tone="emerald">Eco tour</Badge>}
            tint="bg-mist"
            title="Kawasan canyoneering"
            price="₱2,500"
            unit="/ person"
          />
          <ListingCard tint="bg-sage" title="Honda Click 125" price="₱450" unit="/ day" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <CardLink href="/admin/ui-kit" className="flex items-center gap-3 p-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-control bg-mist text-primary">
              <AreaGlyph kind="island" className="size-6" />
            </span>
            <span>
              <span className="block font-semibold">Card as link</span>
              <span className="block text-sm text-muted">The whole card is one link</span>
            </span>
          </CardLink>
        </div>
      </Showcase>
    </main>
  );
}

function Showcase({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <SectionTitle>{title}</SectionTitle>
      <div>{children}</div>
    </section>
  );
}

// An example of composing the kit into a listing card; not a component of its own yet.
function ListingCard({
  badge,
  tint,
  title,
  price,
  unit,
}: {
  badge?: ReactNode;
  tint: string;
  title: string;
  price: string;
  unit: string;
}) {
  return (
    <Card>
      <div className={`relative h-32 ${tint}`}>{badge && <div className="absolute left-3 top-3">{badge}</div>}</div>
      <CardBody>
        <p className="font-display text-lg font-bold leading-tight">{title}</p>
        <p className="mt-0.5 text-xs text-muted">Moalboal, Cebu</p>
        <div className="mt-3">
          <Price amount={price} unit={unit} />
        </div>
        <Button variant="soft" size="sm" className="mt-3 w-full">
          View details →
        </Button>
      </CardBody>
    </Card>
  );
}

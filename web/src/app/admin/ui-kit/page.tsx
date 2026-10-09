import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardLink } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
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

// The Tidal Grove palette as Tailwind classes (defined in globals.css), with what each
// colour is for.
const SWATCHES = [
  { name: "Cerulean", hex: "#0369A1", className: "bg-cerulean", use: "Primary buttons, links, prices" },
  { name: "Emerald", hex: "#059669", className: "bg-emerald", use: "Eco labels, success, secondary" },
  { name: "Aqua", hex: "#22D3EE", className: "bg-aqua", use: "Highlight badges, accents on navy" },
  { name: "Fern", hex: "#6EE7B7", className: "bg-fern", use: "Icon fills, hover tints" },
  { name: "Mist", hex: "#F0F9FF", className: "bg-mist", use: "surface-2, soft buttons" },
  { name: "Sage", hex: "#ECFDF5", className: "bg-sage", use: "Alternate surfaces" },
  { name: "White", hex: "#FFFFFF", className: "bg-white", use: "Page, cards, inputs" },
  { name: "Navy", hex: "#0C1B2E", className: "bg-navy", use: "Text, header, footer" },
];

const CATEGORIES = ["Tours", "Transfers", "Motorbikes", "Freediving", "Stays"];

// A reference page for the palette and every component in src/components/ui/. Build new
// pages from these rather than from raw colours.
export default function UiKit() {
  return (
    <main data-testid="ui-kit" className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-4 py-12">
      <header className="flex flex-col gap-2">
        <Eyebrow>Colour system · 8 colours</Eyebrow>
        <DisplayTitle>
          <span className="not-italic text-primary">Tidal</span> Grove
        </DisplayTitle>
        <p className="max-w-prose text-muted">Blue-green accents from open ocean and forest, on white. Light only.</p>
      </header>

      <Showcase title="Palette">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
          <p>Body text in DM Sans, the face for everything that isn&apos;t a heading.</p>
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
          <Button disabled>Disabled</Button>
          <ButtonLink href="/admin" variant="soft" size="sm">
            Link as button
          </ButtonLink>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-2xl bg-navy p-6">
          <p className="font-display text-2xl font-bold italic text-white">On navy</p>
          <span className="text-sm text-on-dark">Accent is for dark bands.</span>
          <Button variant="accent">Get started</Button>
        </div>
      </Showcase>

      <Showcase title="Badges and pills">
        <div className="flex flex-wrap items-center gap-2">
          <Badge>Best value</Badge>
          <Badge tone="emerald">Eco tour</Badge>
          <Badge tone="mist">New</Badge>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {CATEGORIES.map((category, index) => (
            <Pill key={category} on={index === 0}>
              {category}
            </Pill>
          ))}
          <PillLink href="/admin/ui-kit">🤿 Pill as link</PillLink>
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
            <span aria-hidden className="text-2xl">
              🏝️
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

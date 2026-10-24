"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { LocationPicker } from "@/components/partner/location-picker";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { SelectField } from "@/components/ui/select-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { Toast } from "@/components/ui/toast";
import { DisplayTitle } from "@/components/ui/typography";
import type { LatLng } from "@/lib/map";
import { AliasesField, FormSection, slugify } from "./destination-form";
import { AreaStatusBadge } from "./destinations-list";
import { visitsLine } from "./landmarks-list";
import { useAreaOptions } from "./use-admin-areas";
import {
  useAdminLandmark,
  useSaveLandmark,
  type AdminLandmark,
  type AdminLandmarkBody,
  type LandmarkStatus,
} from "./use-admin-landmarks";

type FormState = {
  name: string;
  slug: string;
  status: LandmarkStatus;
  location: LatLng | null;
  description: string;
  tag_slugs: string[];
  aliases: string[];
};

const EMPTY: FormState = { name: "", slug: "", status: "draft", location: null, description: "", tag_slugs: [], aliases: [] };

function stateOf(landmark: AdminLandmark): FormState {
  return {
    name: landmark.name,
    slug: landmark.slug,
    status: landmark.status,
    location: landmark.location,
    description: landmark.description,
    tag_slugs: landmark.tags.map((tag) => tag.slug),
    aliases: landmark.aliases,
  };
}

// The whole form as the API takes it. The area is never sent: the API finds it from the pin.
function bodyOf(form: FormState): AdminLandmarkBody {
  return {
    name: form.name.trim(),
    slug: form.slug.trim(),
    status: form.status,
    location: form.location ?? undefined,
    description: form.description.trim(),
    tag_slugs: form.tag_slugs,
    aliases: form.aliases,
  };
}

// On a change, only what differs from the saved landmark: the API keeps every field left out.
function changesOf(form: FormState, saved: FormState): AdminLandmarkBody {
  const next = bodyOf(form);
  const before = bodyOf(saved);
  return Object.fromEntries(
    Object.entries(next).filter(
      ([key, value]) => JSON.stringify(value) !== JSON.stringify(before[key as keyof AdminLandmarkBody]),
    ),
  ) as AdminLandmarkBody;
}

// Why the form can't be sent yet; undefined when it can. The API checks everything again.
function problemOf(form: FormState, isNew: boolean) {
  if (isNew && !form.name.trim()) return "Give the place a name.";
  if (isNew && !form.slug.trim()) return "Give the place a slug.";
  if (isNew && !form.location) return "Put it on the map.";
  return undefined;
}

// Adding a place to see: once saved it opens in its editor.
export function LandmarkForm() {
  return <PlaceForm />;
}

// Editing one: loads it, then the same form with what Wikidata gave it.
export function LandmarkEditor({ slug }: { slug: string }) {
  const landmark = useAdminLandmark(slug);
  if (landmark.isPending) return <p className="py-6 text-sm text-muted">Loading place to see…</p>;
  if (landmark.error)
    return (
      <div className="flex flex-col items-start gap-3 py-6">
        <p role="alert" className="text-sm text-danger">
          {landmark.error.message}
        </p>
        <ButtonLink href="/admin/landmarks" size="sm" variant="soft">
          Back to places to see
        </ButtonLink>
      </div>
    );
  return <PlaceForm key={landmark.data.slug} landmark={landmark.data} />;
}

function PlaceForm({ landmark }: { landmark?: AdminLandmark }) {
  const router = useRouter();
  const isNew = !landmark;
  const [saved, setSaved] = useState(() => (landmark ? stateOf(landmark) : EMPTY));
  const [form, setForm] = useState(saved);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [problem, setProblem] = useState<string>();
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const save = useSaveLandmark();
  const options = useAreaOptions();

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((last) => ({ ...last, [key]: value }));
    setProblem(undefined);
  }

  const changes = isNew ? bodyOf(form) : changesOf(form, saved);
  const dirty = Object.keys(changes).length > 0;

  function submit(event: FormEvent) {
    event.preventDefault();
    const found = problemOf(form, isNew);
    if (found) return setProblem(found);
    save.mutate(
      { slug: landmark?.slug, body: changes },
      {
        onSuccess: (result) => {
          if (isNew || result.slug !== landmark.slug) return router.replace(`/admin/landmarks/${result.slug}`);
          setSaved(stateOf(result));
          setForm(stateOf(result));
          setToast((last) => ({ id: (last?.id ?? 0) + 1, message: `Saved ${result.name}.` }));
        },
      },
    );
  }

  const error = problem ?? save.error?.message;
  // The area as last saved (the cache holds the save's answer); a moved pin may change it.
  const area = landmark?.area ?? null;

  return (
    <main className="mx-auto flex w-full max-w-narrow flex-1 flex-col gap-section py-5 sm:py-6">
      <div className="flex flex-col gap-2">
        <ButtonLink href="/admin/landmarks" size="sm" variant="ghost" className="self-start px-0">
          ← Places to see
        </ButtonLink>
        <div className="flex flex-wrap items-center gap-3">
          <DisplayTitle size="compact">{landmark ? landmark.name : "Add place to see"}</DisplayTitle>
          {landmark && <AreaStatusBadge status={landmark.status} />}
        </div>
        {landmark && (
          <p className="text-sm text-muted">
            In {landmark.area.name} · {visitsLine(landmark.visit_count)}
            {landmark.status === "published" && (
              <>
                {" · "}
                <a href={`/${landmark.area.slug}`} target="_blank" rel="noreferrer" className="text-link hover:underline">
                  Open {landmark.area.name}
                </a>
              </>
            )}
          </p>
        )}
      </div>

      <form onSubmit={submit} noValidate className="flex flex-col gap-section" data-testid="admin-landmark-form">
        <FormSection title="Basics">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Name"
              value={form.name}
              onChange={(event) => {
                set("name", event.target.value);
                if (!slugTouched) set("slug", slugify(event.target.value));
              }}
              required
              data-testid="admin-landmark-name"
            />
            <Field
              label="Slug"
              hint="Lowercase letters, digits and dashes."
              value={form.slug}
              onChange={(event) => {
                setSlugTouched(true);
                set("slug", event.target.value);
              }}
              required
              data-testid="admin-landmark-slug"
            />
          </div>
          <SelectField
            label="Status"
            options={[
              { value: "draft", label: "Draft: only the team sees it" },
              { value: "published", label: "Published: guests see it on its destination" },
            ]}
            value={form.status}
            onChange={(event) => set("status", event.target.value as LandmarkStatus)}
            data-testid="admin-landmark-status"
          />
          <TextareaField
            label="Description"
            rows={5}
            value={form.description}
            onChange={(event) => set("description", event.target.value)}
          />
        </FormSection>

        <FormSection title="Location">
          <LocationPicker
            label="Pin"
            value={form.location}
            onChange={(point) => set("location", point)}
            areaQuery={form.location ? undefined : form.name || undefined}
          />
          <p className="text-sm text-muted" data-testid="admin-landmark-area">
            {area
              ? `In ${area.name}: the destination is the one listings at this pin go under, so moving the pin may change it.`
              : "Its destination comes from the pin: the published town, city or island it is in, or the nearest one."}
          </p>
        </FormSection>

        <FormSection title="Tags">
          {options.isPending ? (
            <p className="text-sm text-muted">Loading tags…</p>
          ) : options.error ? (
            <p role="alert" className="text-sm text-danger">
              {options.error.message}
            </p>
          ) : (
            <div role="group" aria-label="Tags" className="flex flex-wrap gap-2" data-testid="admin-landmark-tags">
              {options.data.tags.map((tag) => {
                const on = form.tag_slugs.includes(tag.slug);
                return (
                  <Pill
                    key={tag.slug}
                    on={on}
                    onClick={() =>
                      set("tag_slugs", on ? form.tag_slugs.filter((slug) => slug !== tag.slug) : [...form.tag_slugs, tag.slug])
                    }
                  >
                    {tag.name}
                  </Pill>
                );
              })}
            </div>
          )}
        </FormSection>

        <FormSection title="Search names">
          <AliasesField value={form.aliases} onChange={(aliases) => set("aliases", aliases)} testId="admin-landmark-alias" />
          {landmark && (landmark.wikidata_id || landmark.wikidata_aliases.length > 0) && (
            <div className="flex flex-col gap-2 text-sm">
              <p className="text-muted">
                From Wikidata{landmark.wikidata_id && ` (${landmark.wikidata_id})`}, read by the gazetteer, popularity{" "}
                {landmark.wikidata_popularity}:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {landmark.wikidata_aliases.map((name) => (
                  <Badge key={name} tone="mist">
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </FormSection>

        {error && (
          <p role="alert" className="text-sm font-semibold text-danger" data-testid="admin-landmark-error">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-end gap-3">
          <ButtonLink href="/admin/landmarks" variant="ghost">
            Cancel
          </ButtonLink>
          <Button type="submit" disabled={save.isPending || (!isNew && !dirty)} data-testid="admin-landmark-save">
            {save.isPending ? "Saving…" : isNew ? "Add place to see" : "Save changes"}
          </Button>
        </div>
      </form>

      <Toast message={toast?.message ?? null} id={toast?.id} onDismiss={() => setToast(null)} data-testid="admin-landmark-toast" />
    </main>
  );
}

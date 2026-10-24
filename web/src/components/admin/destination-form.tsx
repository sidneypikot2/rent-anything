"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { LocationPicker } from "@/components/partner/location-picker";
import { PHOTO_TYPES, photoProblem } from "@/components/partner/use-listing-photos";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { ComboboxField } from "@/components/ui/combobox-field";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Pill } from "@/components/ui/pill";
import { SelectField } from "@/components/ui/select-field";
import { TextareaField } from "@/components/ui/textarea-field";
import { Toast, type ToastTone } from "@/components/ui/toast";
import { DisplayTitle } from "@/components/ui/typography";
import type { LatLng } from "@/lib/map";
import { AreaStatusBadge, KIND_LABELS } from "./destinations-list";
import { SeedButton, seedCounts, seededAt, seedOutcome } from "./seed-area";
import {
  isSeeding,
  useAdminArea,
  useAdminAreas,
  useAreaBanner,
  useAreaOptions,
  useSaveArea,
  useSeedEnds,
  type AdminArea,
  type AdminAreaBody,
  type AreaKind,
  type AreaStatus,
} from "./use-admin-areas";

// Areas::Save's limits, checked here first so the team hears at once.
const TAGLINE_MAX = 120;
const MAX_ALIASES = 20;
const MAX_ALIAS_LENGTH = 60;

type FormState = {
  name: string;
  slug: string;
  kind: AreaKind | "";
  status: AreaStatus;
  parent: { slug: string; name: string } | null;
  center: LatLng | null;
  psgc_code: string;
  tagline: string;
  description: string;
  getting_there: string;
  best_time_to_visit: string;
  tag_slugs: string[];
  aliases: string[];
  wikidata_id: string;
};

const EMPTY: FormState = {
  name: "",
  slug: "",
  kind: "",
  status: "draft",
  parent: null,
  center: null,
  psgc_code: "",
  tagline: "",
  description: "",
  getting_there: "",
  best_time_to_visit: "",
  tag_slugs: [],
  aliases: [],
  wikidata_id: "",
};

function stateOf(area: AdminArea): FormState {
  return {
    name: area.name,
    slug: area.slug,
    kind: area.kind,
    status: area.status,
    parent: area.parent,
    center: area.center,
    psgc_code: area.psgc_code ?? "",
    tagline: area.tagline,
    description: area.description,
    getting_there: area.getting_there,
    best_time_to_visit: area.best_time_to_visit,
    tag_slugs: area.tags.map((tag) => tag.slug),
    aliases: area.aliases,
    wikidata_id: area.wikidata_id ?? "",
  };
}

// The whole form as the API takes it.
function bodyOf(form: FormState): AdminAreaBody {
  return {
    name: form.name.trim(),
    slug: form.slug.trim(),
    kind: form.kind || undefined,
    status: form.status,
    parent_slug: form.parent?.slug ?? null,
    center: form.center ?? undefined,
    psgc_code: form.psgc_code.trim() || null,
    tagline: form.tagline.trim(),
    description: form.description.trim(),
    getting_there: form.getting_there.trim(),
    best_time_to_visit: form.best_time_to_visit.trim(),
    tag_slugs: form.tag_slugs,
    aliases: form.aliases,
    wikidata_id: form.wikidata_id.trim() || null,
  };
}

// On a change, only what differs from the saved area: the API keeps every field left out, and
// sending an unchanged Wikidata ID or status would still be a no-op, but a smaller body is
// what was meant.
function changesOf(form: FormState, saved: FormState): AdminAreaBody {
  const next = bodyOf(form);
  const before = bodyOf(saved);
  return Object.fromEntries(
    Object.entries(next).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(before[key as keyof AdminAreaBody])),
  ) as AdminAreaBody;
}

// A slug from a name: "Santa Fe" → "santa-fe" (lowercase letters, digits, single dashes).
export function slugify(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// The form over a newer saved area (a seed run published it and set its Wikidata ID): each field
// left as it was saved takes the new value, and each one being edited keeps the edit.
function rebase(form: FormState, before: FormState, after: FormState): FormState {
  return Object.fromEntries(
    Object.entries(form).map(([key, value]) => {
      const field = key as keyof FormState;
      return [key, JSON.stringify(value) === JSON.stringify(before[field]) ? after[field] : value];
    }),
  ) as FormState;
}

// Why the form can't be sent yet; undefined when it can. The API checks everything again.
function problemOf(form: FormState, isNew: boolean) {
  if (isNew && !form.name.trim()) return "Give the destination a name.";
  if (isNew && !form.slug.trim()) return "Give the destination a slug.";
  if (isNew && !form.kind) return "Choose what kind of place it is.";
  if (isNew && !form.center) return "Put its centre on the map.";
  if (form.psgc_code.trim() && !/^\d{10}$/.test(form.psgc_code.trim())) return "A PSGC code is 10 digits.";
  if (form.wikidata_id.trim() && !/^Q\d+$/.test(form.wikidata_id.trim())) return "A Wikidata ID looks like Q123.";
  return undefined;
}

// Adding a destination (RAA-166): once saved it opens in its editor, where the banner photo can
// be added.
export function DestinationForm() {
  return <AreaForm />;
}

// Editing one: loads it, then the same form with the banner photo and what the gazetteer
// read about it.
export function DestinationEditor({ slug }: { slug: string }) {
  const area = useAdminArea(slug);
  if (area.isPending) return <p className="py-6 text-sm text-muted">Loading destination…</p>;
  if (area.error)
    return (
      <div className="flex flex-col items-start gap-3 py-6">
        <p role="alert" className="text-sm text-danger">
          {area.error.message}
        </p>
        <ButtonLink href="/admin/destinations" size="sm" variant="soft">
          Back to destinations
        </ButtonLink>
      </div>
    );
  return <AreaForm key={area.data.slug} area={area.data} />;
}

function AreaForm({ area }: { area?: AdminArea }) {
  const router = useRouter();
  const isNew = !area;
  const [saved, setSaved] = useState(() => (area ? stateOf(area) : EMPTY));
  const [form, setForm] = useState(saved);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [problem, setProblem] = useState<string>();
  const [toast, setToast] = useState<{ id: number; message: string; tone?: ToastTone } | null>(null);
  const save = useSaveArea();
  const options = useAreaOptions();

  const show = useCallback(
    (message: string, tone?: ToastTone) => setToast((last) => ({ id: (last?.id ?? 0) + 1, message, tone })),
    [],
  );
  // A seed run that ends while the editor is open says how it went, and what it changed in the
  // saved area shows in the form.
  const seedEnded = useCallback(
    (ended: AdminArea) => {
      const { message, tone } = seedOutcome(ended);
      show(message, tone);
      const after = stateOf(ended);
      setForm((current) => rebase(current, saved, after));
      setSaved(after);
    },
    [show, saved],
  );
  useSeedEnds(
    useMemo(() => (area ? [area] : []), [area]),
    seedEnded,
  );

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
      { slug: area?.slug, body: changes },
      {
        onSuccess: (result) => {
          if (isNew || result.slug !== area.slug) return router.replace(`/admin/destinations/${result.slug}`);
          setSaved(stateOf(result));
          setForm(stateOf(result));
          show(`Saved ${result.name}.`);
        },
      },
    );
  }

  const error = problem ?? save.error?.message;

  return (
    <main className="mx-auto flex w-full max-w-narrow flex-1 flex-col gap-section py-5 sm:py-6">
      <div className="flex flex-col gap-2">
        <ButtonLink href="/admin/destinations" size="sm" variant="ghost" className="self-start px-0">
          ← Destinations
        </ButtonLink>
        <div className="flex flex-wrap items-center gap-3">
          <DisplayTitle size="compact">{area ? area.name : "Add destination"}</DisplayTitle>
          {area && <AreaStatusBadge status={area.status} />}
        </div>
        {area && (
          <p className="text-sm text-muted">
            {area.listing_count} active listings · {area.landmark_count} published places to see
            {area.status === "published" && (
              <>
                {" · "}
                <a href={`/${area.slug}`} target="_blank" rel="noreferrer" className="text-link hover:underline">
                  Open its page
                </a>
              </>
            )}
          </p>
        )}
      </div>

      {area && <SeedSection area={area} onProblem={(message) => show(message, "danger")} />}

      <form onSubmit={submit} noValidate className="flex flex-col gap-section" data-testid="admin-destination-form">
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
              data-testid="admin-destination-name"
            />
            <Field
              label="Slug"
              hint="Its address: lowercase letters, digits and dashes."
              value={form.slug}
              onChange={(event) => {
                setSlugTouched(true);
                set("slug", event.target.value);
              }}
              required
              data-testid="admin-destination-slug"
            />
            <SelectField
              label="Kind"
              options={[
                ...(form.kind ? [] : [{ value: "", label: "Choose…" }]),
                ...(options.data?.kinds ?? Object.keys(KIND_LABELS)).map((kind) => ({
                  value: kind,
                  label: KIND_LABELS[kind as AreaKind],
                })),
              ]}
              value={form.kind}
              onChange={(event) => set("kind", event.target.value as AreaKind)}
              required
            />
            <ParentField
              value={form.parent}
              exclude={area?.slug}
              onChange={(parent) => set("parent", parent)}
            />
          </div>
          <SelectField
            label="Status"
            options={[
              { value: "draft", label: "Draft: only the team sees it" },
              { value: "published", label: "Published: guests can find it" },
            ]}
            value={form.status}
            onChange={(event) => set("status", event.target.value as AreaStatus)}
            hint={
              form.status === "published"
                ? "Publishing also publishes every area it sits in."
                : "It can't go back to draft while it has active listings or published areas inside it."
            }
            data-testid="admin-destination-status"
          />
        </FormSection>

        <FormSection title="Location">
          <LocationPicker
            label="Centre"
            value={form.center}
            onChange={(point) => set("center", point)}
            areaQuery={form.center ? undefined : form.name || undefined}
          />
          <Field
            label="PSGC code"
            hint="10 digits, from the Philippine Standard Geographic Code. Optional."
            inputMode="numeric"
            value={form.psgc_code}
            onChange={(event) => set("psgc_code", event.target.value)}
          />
          {area && (
            <p className="text-sm text-muted">
              {area.has_boundary
                ? "Has a boundary from the gazetteer: listings inside it belong here."
                : "No boundary yet: only the gazetteer sets one, and listings are placed by it."}
            </p>
          )}
        </FormSection>

        <FormSection title="About">
          <Field
            label="Tagline"
            counter={TAGLINE_MAX}
            maxLength={TAGLINE_MAX}
            value={form.tagline}
            onChange={(event) => set("tagline", event.target.value)}
          />
          <TextareaField
            label="Description"
            rows={6}
            value={form.description}
            onChange={(event) => set("description", event.target.value)}
          />
          <TextareaField
            label="Getting there"
            value={form.getting_there}
            onChange={(event) => set("getting_there", event.target.value)}
          />
          <Field
            label="Best time to visit"
            value={form.best_time_to_visit}
            onChange={(event) => set("best_time_to_visit", event.target.value)}
          />
        </FormSection>

        <FormSection title="Tags">
          {options.isPending ? (
            <p className="text-sm text-muted">Loading tags…</p>
          ) : options.error ? (
            <p role="alert" className="text-sm text-danger">
              {options.error.message}
            </p>
          ) : (
            <div role="group" aria-label="Tags" className="flex flex-wrap gap-2" data-testid="admin-destination-tags">
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
          <AliasesField value={form.aliases} onChange={(aliases) => set("aliases", aliases)} />
          <Field
            label="Wikidata ID"
            hint={
              area?.wikidata_id && form.wikidata_id.trim() !== area.wikidata_id
                ? "A new ID drops the names and popularity read from the old one until the gazetteer runs again."
                : "Like Q123. Optional."
            }
            value={form.wikidata_id}
            onChange={(event) => set("wikidata_id", event.target.value)}
          />
          {area && (area.wikidata_aliases.length > 0 || area.wikidata_popularity > 0) && (
            <div className="flex flex-col gap-2 text-sm">
              <p className="text-muted">From Wikidata (read by the gazetteer), popularity {area.wikidata_popularity}:</p>
              <div className="flex flex-wrap gap-1.5">
                {area.wikidata_aliases.map((name) => (
                  <Badge key={name} tone="mist">
                    {name}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </FormSection>

        {error && (
          <p role="alert" className="text-sm font-semibold text-danger" data-testid="admin-destination-error">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-end gap-3">
          <ButtonLink href="/admin/destinations" variant="ghost">
            Cancel
          </ButtonLink>
          <Button type="submit" disabled={save.isPending || (!isNew && !dirty)} data-testid="admin-destination-save">
            {save.isPending ? "Saving…" : isNew ? "Add destination" : "Save changes"}
          </Button>
        </div>
      </form>

      <FormSection title="Banner photo">
        {area ? (
          <BannerPhoto area={area} />
        ) : (
          <p className="text-sm text-muted">Add the destination first, then its banner photo.</p>
        )}
      </FormSection>

      <Toast
        message={toast?.message ?? null}
        id={toast?.id}
        tone={toast?.tone}
        onDismiss={() => setToast(null)}
        data-testid="admin-destination-toast"
      />
    </main>
  );
}

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-xl font-extrabold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

// Seeding from Wikidata (RAA-169, over RAA-168's API): the button, then how the last run went —
// what it added, with a link to the new drafts, and what Wikidata couldn't match.
function SeedSection({ area, onProblem }: { area: AdminArea; onProblem: (message: string) => void }) {
  const report = area.seed_report;
  const ended = !isSeeding(area) && area.seeded_at;

  return (
    <FormSection title="Seed from Wikidata">
      <p className="text-sm text-muted">
        Publishes it and every area it sits in, adds Wikidata&apos;s places to see in and around it as drafts, and
        gives it and its places to see Wikidata&apos;s names and popularity. Safe to run again: it skips what it
        already has.
      </p>
      <div className="flex flex-wrap items-center gap-3" data-testid="admin-destination-seed-report">
        <SeedButton area={area} onProblem={onProblem} />
        <p className="text-sm text-muted" aria-live="polite">
          {area.seed_status === "queued"
            ? "Waiting to start…"
            : area.seed_status === "running"
              ? "Seeding: this takes a minute or two."
              : !ended
                ? "Not seeded yet."
                : area.seed_status === "failed"
                  ? `Last run, ${seededAt(ended)}, stopped: ${report.error ?? "something went wrong"}.`
                  : `Last run, ${seededAt(ended)}: ${seedCounts(area)}.`}
        </p>
      </div>
      {ended && (
        <div className="flex flex-col gap-2 text-sm">
          <Link
            href={`/admin/landmarks?area=${encodeURIComponent(area.slug)}&status=draft`}
            className="self-start font-semibold text-link hover:underline"
            data-testid="admin-destination-seed-drafts"
          >
            Review its draft places to see
          </Link>
          {report.skipped.length > 0 && (
            <details className="text-muted">
              <summary className="cursor-pointer">
                {report.skipped.length} {report.skipped.length === 1 ? "place" : "places"} Wikidata couldn&apos;t match
              </summary>
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
                {report.skipped.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </FormSection>
  );
}

// The area it sits in, picked from a search of every destination; emptied, it has none.
function ParentField({
  value,
  exclude,
  onChange,
}: {
  value: { slug: string; name: string } | null;
  exclude?: string;
  onChange: (parent: { slug: string; name: string } | null) => void;
}) {
  const [text, setText] = useState(value?.name ?? "");
  const [query, setQuery] = useState("");
  const areas = useAdminAreas({ q: query, status: "", kind: "", page: 1 });

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text]);

  const options = (areas.data?.areas ?? [])
    .filter((area) => area.slug !== exclude)
    .map((area) => ({ value: area.slug, label: area.name }));

  return (
    <ComboboxField
      label="Sits in"
      hint={value ? `${value.name} (${value.slug})` : "None: a top-level area."}
      value={text}
      options={options}
      onChange={(next, option) => {
        setText(next);
        if (option) onChange({ slug: option.value, name: option.label });
        else if (!next.trim()) onChange(null);
      }}
      data-testid="admin-destination-parent"
    />
  );
}

// Other names guests search it by: each a removable pill, added one at a time. Shared with the
// landmark form, whose API has the same limits.
export function AliasesField({
  value,
  onChange,
  testId = "admin-destination-alias",
}: {
  value: string[];
  onChange: (aliases: string[]) => void;
  testId?: string;
}) {
  const [text, setText] = useState("");
  const name = text.trim();
  const full = value.length >= MAX_ALIASES;
  const problem = name.length > MAX_ALIAS_LENGTH ? `At most ${MAX_ALIAS_LENGTH} characters.` : undefined;

  function add() {
    if (!name || problem || full || value.includes(name)) return setText("");
    onChange([...value, name]);
    setText("");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2">
        <Field
          label="Also known as"
          className="flex-1"
          hint={full ? `Up to ${MAX_ALIASES} names.` : "Other names guests search it by. Press Enter to add."}
          error={problem}
          value={text}
          disabled={full}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            add();
          }}
          data-testid={testId}
        />
        <Button type="button" variant="soft" className="mt-7" onClick={add} disabled={!name || full || !!problem}>
          Add
        </Button>
      </div>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Names">
          {value.map((alias) => (
            <li key={alias}>
              <Pill aria-label={`Remove ${alias}`} onClick={() => onChange(value.filter((other) => other !== alias))}>
                {alias} <span aria-hidden>×</span>
              </Pill>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// The destination's one banner photo: choosing a file uploads it at once and replaces any
// banner it had; removing one asks first. Saved apart from the form, like a listing's photos.
function BannerPhoto({ area }: { area: AdminArea }) {
  const { upload, remove } = useAreaBanner(area.slug);
  const input = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string>();
  const [removing, setRemoving] = useState(false);
  const photo = area.banner_photo?.uploaded ? area.banner_photo : null;
  const busy = upload.isPending || remove.isPending;

  function choose(file: File | undefined) {
    if (!file) return;
    const found = photoProblem(file);
    setProblem(found);
    if (!found) upload.mutate(file);
  }

  const error = problem ?? upload.error?.message ?? remove.error?.message;

  return (
    <div className="flex flex-col gap-3" data-testid="admin-destination-banner">
      {photo ? (
        <div className="relative aspect-[16/7] overflow-hidden rounded-card bg-navy">
          {photo.ready ? (
            <Image src={photo.large_url} alt={`${area.name} banner`} fill unoptimized className="object-cover" />
          ) : (
            <p className="absolute inset-0 grid place-items-center text-sm text-sky-mist">Preparing the photo…</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted">No banner photo yet.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="soft" disabled={busy} onClick={() => input.current?.click()}>
          {upload.isPending ? "Uploading…" : photo ? "Replace photo" : "Add photo"}
        </Button>
        {photo && (
          <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setRemoving(true)}>
            Remove
          </Button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept={PHOTO_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          choose(event.target.files?.[0]);
          event.target.value = "";
        }}
        data-testid="admin-destination-banner-input"
      />
      <p className="text-xs text-muted">JPG, PNG or WebP, up to 10 MB. Wide photos work best.</p>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <Dialog
        open={removing}
        onClose={() => setRemoving(false)}
        title="Remove the banner photo?"
        actions={
          <>
            <Button variant="soft" onClick={() => setRemoving(false)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              disabled={remove.isPending}
              onClick={() => remove.mutate(undefined, { onSettled: () => setRemoving(false) })}
            >
              {remove.isPending ? "Removing…" : "Remove"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">{area.name} will have no banner photo until a new one is added.</p>
      </Dialog>
    </div>
  );
}

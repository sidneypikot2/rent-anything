"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { DisplayTitle } from "@/components/ui/typography";
import { AREAS_PER_PAGE, useAdminAreas, type AdminAreaRow, type AreaFilters } from "./use-admin-areas";

const SEARCH_DELAY_MS = 300;

export const KIND_LABELS: Record<AdminAreaRow["kind"], string> = {
  region: "Region",
  province: "Province",
  city: "City",
  town: "Town",
  island: "Island",
};

const KIND_OPTIONS = [{ value: "", label: "Any kind" }, ...Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label }))];
const STATUS_OPTIONS = [
  { value: "", label: "Any status" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
];

// A destination's kind, in the island or city tint where it has one (RAA-130).
export function KindBadge({ kind }: { kind: AdminAreaRow["kind"] }) {
  const tone = kind === "island" ? "island" : kind === "city" ? "city" : "mist";
  return <Badge tone={tone}>{KIND_LABELS[kind]}</Badge>;
}

export function AreaStatusBadge({ status }: { status: AdminAreaRow["status"] }) {
  return status === "published" ? <Badge tone="emerald">Published</Badge> : <Badge tone="warning">Draft</Badge>;
}

// Every destination (RAA-166, over RAA-164's API): searched by name, slug or alias, filtered by
// status and kind, 50 a page, published first. A row opens its editor. Dense, like Booking
// requests: a work screen for the team.
export function DestinationsList() {
  const [text, setText] = useState("");
  const [filters, setFilters] = useState<AreaFilters>({ q: "", status: "", kind: "", page: 1 });
  const areas = useAdminAreas(filters);

  // The search waits for typing to pause, and starts again from the first page.
  useEffect(() => {
    const timer = setTimeout(() => setFilters((last) => (last.q === text.trim() ? last : { ...last, q: text.trim(), page: 1 })), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const total = areas.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / AREAS_PER_PAGE));

  return (
    <main className="flex w-full flex-1 flex-col gap-4 py-5 sm:py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DisplayTitle size="compact">Destinations</DisplayTitle>
        <ButtonLink href="/admin/destinations/new" size="sm" data-testid="admin-destination-add">
          Add destination
        </ButtonLink>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_12rem]">
        <Field
          label="Search"
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Name, slug or alias"
          data-testid="admin-destination-search"
        />
        <SelectField
          label="Status"
          options={STATUS_OPTIONS}
          value={filters.status}
          onChange={(event) => setFilters({ ...filters, status: event.target.value as AreaFilters["status"], page: 1 })}
        />
        <SelectField
          label="Kind"
          options={KIND_OPTIONS}
          value={filters.kind}
          onChange={(event) => setFilters({ ...filters, kind: event.target.value as AreaFilters["kind"], page: 1 })}
        />
      </div>

      {areas.isPending ? (
        <div className="flex flex-col gap-2" aria-label="Loading destinations">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="h-12 animate-pulse rounded-control bg-mist" />
          ))}
        </div>
      ) : areas.error ? (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="text-sm text-danger">
            {areas.error.message}
          </p>
          <Button size="sm" variant="soft" onClick={() => void areas.refetch()}>
            Try again
          </Button>
        </div>
      ) : areas.data.areas.length === 0 ? (
        <Card edge="line" data-testid="admin-destinations-empty">
          <CardBody>
            <p className="text-sm text-muted">No destinations match.</p>
          </CardBody>
        </Card>
      ) : (
        <AreaTable areas={areas.data.areas} stale={areas.isPlaceholderData} />
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3 text-sm">
          <Button
            size="sm"
            variant="soft"
            disabled={filters.page <= 1}
            onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
          >
            Previous
          </Button>
          <span className="text-muted tabular-nums">
            Page {filters.page} of {pages} · {total} destinations
          </span>
          <Button
            size="sm"
            variant="soft"
            disabled={filters.page >= pages}
            onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
          >
            Next
          </Button>
        </nav>
      )}
    </main>
  );
}

const CELL = "px-3 py-2 align-middle";

// One line per destination from md, a short list below it: the name links to its editor.
function AreaTable({ areas, stale }: { areas: AdminAreaRow[]; stale: boolean }) {
  return (
    <Card edge="line" data-testid="admin-destinations" className={cn("transition-opacity duration-300 ease-calm", stale && "opacity-60")}>
      <ul className="divide-y divide-line md:hidden">
        {areas.map((area) => (
          <li key={area.slug} className="flex flex-col gap-1 px-4 py-2.5 text-sm" data-testid="admin-destination">
            <div className="flex items-center gap-2">
              <AreaLink area={area} />
              <AreaStatusBadge status={area.status} />
            </div>
            <p className="truncate text-xs text-muted">
              {KIND_LABELS[area.kind]}
              {area.parent && ` in ${area.parent.name}`} · {area.listing_count} listings · {area.landmark_count} places to see
            </p>
          </li>
        ))}
      </ul>
      <table className="hidden w-full table-fixed text-left text-sm md:table">
        <colgroup>
          <col />
          <col className="w-48" />
          <col className="w-32" />
          <col className="w-32" />
          <col className="w-24" />
          <col className="w-32" />
        </colgroup>
        <thead className="border-b border-line bg-surface-2 text-xs text-muted">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">Name</th>
            <th scope="col" className="px-3 py-2 font-semibold">In</th>
            <th scope="col" className="px-3 py-2 font-semibold">Kind</th>
            <th scope="col" className="px-3 py-2 font-semibold">Status</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">Listings</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">Places to see</th>
          </tr>
        </thead>
        <tbody>
          {areas.map((area) => (
            <tr key={area.slug} className="border-b border-line last:border-0 hover:bg-surface-2" data-testid="admin-destination">
              <td className={CELL}>
                <AreaLink area={area} />
                <span className="block truncate text-xs text-muted">{area.slug}</span>
              </td>
              <td className={cn(CELL, "truncate text-muted")}>{area.parent?.name ?? "—"}</td>
              <td className={CELL}>
                <KindBadge kind={area.kind} />
              </td>
              <td className={CELL}>
                <AreaStatusBadge status={area.status} />
              </td>
              <td className={cn(CELL, "text-right tabular-nums")}>{area.listing_count}</td>
              <td className={cn(CELL, "text-right tabular-nums")}>{area.landmark_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function AreaLink({ area }: { area: AdminAreaRow }) {
  return (
    <Link
      href={`/admin/destinations/${area.slug}`}
      className="min-w-0 flex-1 truncate font-medium hover:underline focus-visible:underline focus-visible:outline-none"
      data-testid="admin-destination-open"
    >
      {area.name}
    </Link>
  );
}

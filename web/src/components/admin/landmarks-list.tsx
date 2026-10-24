"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Field } from "@/components/ui/field";
import { SelectField } from "@/components/ui/select-field";
import { DisplayTitle } from "@/components/ui/typography";
import { AreaStatusBadge } from "./destinations-list";
import { LANDMARKS_PER_PAGE, useAdminLandmarks, type AdminLandmarkRow, type LandmarkFilters } from "./use-admin-landmarks";

const SEARCH_DELAY_MS = 300;

// "1 listing goes here", "3 listings go here".
export function visitsLine(count: number) {
  return count === 1 ? "1 listing goes here" : `${count} listings go here`;
}

const STATUS_OPTIONS = [
  { value: "", label: "Any status" },
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
];

// Every landmark, the places to see (over RAA-164's API): searched by name, slug or alias,
// filtered by status, 50 a page, published first. A row opens its editor. Dense, like
// Destinations: a work screen for the team.
export function LandmarksList() {
  const [text, setText] = useState("");
  const [filters, setFilters] = useState<LandmarkFilters>({ q: "", status: "", page: 1 });
  const landmarks = useAdminLandmarks(filters);

  // The search waits for typing to pause, and starts again from the first page.
  useEffect(() => {
    const timer = setTimeout(() => setFilters((last) => (last.q === text.trim() ? last : { ...last, q: text.trim(), page: 1 })), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const total = landmarks.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / LANDMARKS_PER_PAGE));

  return (
    <main className="flex w-full flex-1 flex-col gap-4 py-5 sm:py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DisplayTitle size="compact">Places to see</DisplayTitle>
        <ButtonLink href="/admin/landmarks/new" size="sm" data-testid="admin-landmark-add">
          Add place to see
        </ButtonLink>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <Field
          label="Search"
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Name, slug or alias"
          data-testid="admin-landmark-search"
        />
        <SelectField
          label="Status"
          options={STATUS_OPTIONS}
          value={filters.status}
          onChange={(event) => setFilters({ ...filters, status: event.target.value as LandmarkFilters["status"], page: 1 })}
        />
      </div>

      {landmarks.isPending ? (
        <div className="flex flex-col gap-2" aria-label="Loading places to see">
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className="h-12 animate-pulse rounded-control bg-mist" />
          ))}
        </div>
      ) : landmarks.error ? (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="text-sm text-danger">
            {landmarks.error.message}
          </p>
          <Button size="sm" variant="soft" onClick={() => void landmarks.refetch()}>
            Try again
          </Button>
        </div>
      ) : landmarks.data.landmarks.length === 0 ? (
        <Card edge="line" data-testid="admin-landmarks-empty">
          <CardBody>
            <p className="text-sm text-muted">No places to see match.</p>
          </CardBody>
        </Card>
      ) : (
        <LandmarkTable landmarks={landmarks.data.landmarks} stale={landmarks.isPlaceholderData} />
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
            Page {filters.page} of {pages} · {total} places to see
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

// One line per landmark from md, a short list below it: the name links to its editor.
function LandmarkTable({ landmarks, stale }: { landmarks: AdminLandmarkRow[]; stale: boolean }) {
  return (
    <Card edge="line" data-testid="admin-landmarks" className={cn("transition-opacity duration-300 ease-calm", stale && "opacity-60")}>
      <ul className="divide-y divide-line md:hidden">
        {landmarks.map((landmark) => (
          <li key={landmark.slug} className="flex flex-col gap-1 px-4 py-2.5 text-sm" data-testid="admin-landmark">
            <div className="flex items-center gap-2">
              <LandmarkLink landmark={landmark} />
              <AreaStatusBadge status={landmark.status} />
            </div>
            <p className="truncate text-xs text-muted">
              In {landmark.area.name} · {visitsLine(landmark.visit_count)}
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
        </colgroup>
        <thead className="border-b border-line bg-surface-2 text-xs text-muted">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">Name</th>
            <th scope="col" className="px-3 py-2 font-semibold">In</th>
            <th scope="col" className="px-3 py-2 font-semibold">Status</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">Listings go here</th>
          </tr>
        </thead>
        <tbody>
          {landmarks.map((landmark) => (
            <tr key={landmark.slug} className="border-b border-line last:border-0 hover:bg-surface-2" data-testid="admin-landmark">
              <td className={CELL}>
                <LandmarkLink landmark={landmark} />
                <span className="block truncate text-xs text-muted">{landmark.slug}</span>
              </td>
              <td className={cn(CELL, "truncate text-muted")}>{landmark.area.name}</td>
              <td className={CELL}>
                <AreaStatusBadge status={landmark.status} />
              </td>
              <td className={cn(CELL, "text-right tabular-nums")}>{landmark.visit_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function LandmarkLink({ landmark }: { landmark: AdminLandmarkRow }) {
  return (
    <Link
      href={`/admin/landmarks/${landmark.slug}`}
      className="min-w-0 flex-1 truncate font-medium hover:underline focus-visible:underline focus-visible:outline-none"
      data-testid="admin-landmark-open"
    >
      {landmark.name}
    </Link>
  );
}

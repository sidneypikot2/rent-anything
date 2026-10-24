"use client";

import { Button } from "@/components/ui/button";
import type { ToastTone } from "@/components/ui/toast";
import { isSeeding, useSeedArea, type AdminAreaRow } from "./use-admin-areas";

type SeedArea = Pick<AdminAreaRow, "slug" | "name" | "seed_status" | "seeded_at" | "seed_report">;

// "1 place to see", "3 places to see".
function placesLine(count: number) {
  return count === 1 ? "1 place to see" : `${count} places to see`;
}

export function seededAt(iso: string) {
  return new Date(iso).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// What the last run did, in one line: "3 places to see added, 7 given Wikidata's names".
export function seedCounts(area: SeedArea) {
  const { landmarks_added, enriched } = area.seed_report;
  return `${placesLine(landmarks_added ?? 0)} added, ${enriched ?? 0} given Wikidata's names`;
}

// The toast for a run that just ended.
export function seedOutcome(area: SeedArea): { message: string; tone: ToastTone } {
  if (area.seed_status === "failed")
    return { message: `Seeding ${area.name} stopped: ${area.seed_report.error ?? "something went wrong"}.`, tone: "danger" };
  return { message: `Seeded ${area.name}: ${seedCounts(area)}.`, tone: "default" };
}

// Seeds a destination from Wikidata (RAA-169): "Seed" the first time, "Seed again" after, and
// disabled while a run waits or runs. A refusal (already being seeded) goes to onProblem.
export function SeedButton({ area, onProblem }: { area: SeedArea; onProblem: (message: string) => void }) {
  const seed = useSeedArea();
  const label =
    area.seed_status === "queued"
      ? "Queued…"
      : area.seed_status === "running" || seed.isPending
        ? "Seeding…"
        : area.seed_status === "idle"
          ? "Seed"
          : "Seed again";

  return (
    <Button
      size="sm"
      variant="soft"
      disabled={isSeeding(area) || seed.isPending}
      onClick={() => seed.mutate(area.slug, { onError: (error) => onProblem(error.message) })}
      aria-label={`${label.replace("…", "")} ${area.name}`}
      data-testid="admin-destination-seed"
    >
      {label}
    </Button>
  );
}

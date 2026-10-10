"use client";

import { useRouter } from "next/navigation";

// Where a home page section would be when its fetch failed — most often the free-tier API
// waking up.
// "Try again" renders the page on the server again, which retries both fetches.
export function LoadFailed({ what }: { what: string }) {
  const router = useRouter();
  return (
    <p className="text-muted">
      Couldn&apos;t load {what}. Our server may be waking up.{" "}
      <button
        type="button"
        onClick={() => router.refresh()}
        className="font-semibold text-link underline underline-offset-2"
      >
        Try again
      </button>
    </p>
  );
}

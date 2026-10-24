"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { PageSheet } from "@/components/landing/page-sheet";
import { Button } from "@/components/ui/button";
import { DisplayTitle } from "@/components/ui/typography";

// Shown when a guest page can't load its data, most often while the free-tier API wakes
// up. The header and footer stay; "Try again" re-fetches the page. The error goes to Sentry
// (src/lib/sentry.ts): a boundary keeps it from reaching the browser's own error handler.
export default function GuestError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col pt-3 sm:pt-6">
      <PageSheet>
        <div className="mx-auto flex w-full max-w-page flex-1 flex-col items-start gap-4 px-gutter py-page-pad">
          <DisplayTitle>We couldn&apos;t load this page</DisplayTitle>
          <p className="max-w-prose text-muted">
            Our server may be waking up. Give it a few seconds and try again.
          </p>
          <Button onClick={() => retry()}>Try again</Button>
        </div>
      </PageSheet>
    </main>
  );
}

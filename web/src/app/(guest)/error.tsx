"use client";

import { Button } from "@/components/ui/button";
import { DisplayTitle } from "@/components/ui/typography";

// Shown when a guest page can't load its data, most often while the free-tier API wakes
// up. The header and footer stay; "Try again" re-fetches the page.
export default function GuestError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-start gap-4 px-4 py-16">
      <DisplayTitle>We couldn&apos;t load this page</DisplayTitle>
      <p className="max-w-prose text-muted">
        Our server may be waking up. Give it a few seconds and try again.
      </p>
      <Button onClick={() => retry()}>Try again</Button>
    </main>
  );
}

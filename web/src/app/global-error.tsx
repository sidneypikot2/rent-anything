"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import "./globals.css";

// Replaces the root layout when it, or anything without a closer error boundary, fails to
// render; reports the error to Sentry (src/lib/sentry.ts).
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col items-center justify-center gap-block bg-background px-gutter py-page-pad text-center text-foreground">
        <p className="text-sm font-semibold text-muted">{BRAND}</p>
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="max-w-md text-muted">Try again, or come back in a few minutes.</p>
        <Button onClick={() => retry()}>Try again</Button>
      </body>
    </html>
  );
}

import * as Sentry from "@sentry/nextjs";
import { SENTRY_OPTIONS } from "@/lib/sentry";

// Browser errors: uncaught exceptions and unhandled rejections. Render errors are caught by an
// error boundary first, so each boundary reports its own: app/global-error.tsx, (guest)/error.tsx.
Sentry.init(SENTRY_OPTIONS);

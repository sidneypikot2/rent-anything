import * as Sentry from "@sentry/nextjs";
import { SENTRY_OPTIONS } from "@/lib/sentry";

// Browser errors: uncaught exceptions and unhandled rejections; render errors come through
// app/global-error.tsx.
Sentry.init(SENTRY_OPTIONS);

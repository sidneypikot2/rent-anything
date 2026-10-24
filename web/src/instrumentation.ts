import * as Sentry from "@sentry/nextjs";
import { SENTRY_OPTIONS } from "@/lib/sentry";

// Server-side errors (Server Components, Route Handlers). There is no proxy, so no edge runtime.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") Sentry.init(SENTRY_OPTIONS);
}

export const onRequestError = Sentry.captureRequestError;

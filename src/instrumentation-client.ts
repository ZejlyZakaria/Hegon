// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://acae00f442d3d42c993909f862e4f600@o4511196534538240.ingest.de.sentry.io/4511196556361808",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,

  ignoreErrors: [
    // Supabase auth coordinates token refresh across tabs via the Web Locks API.
    // On mobile a navigation can preempt the lock → a benign "Lock was stolen"
    // AbortError. The auth call still succeeds, so this is noise, not a failure.
    "Lock was stolen by another request",
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

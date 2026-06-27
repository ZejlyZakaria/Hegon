import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const CSP = [
  "default-src 'self'",
  // Next.js App Router requires unsafe-inline for hydration scripts (no nonce without middleware)
  "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://image.tmdb.org https://crests.football-data.org https://cdn.thesportsdb.com https://r2.thesportsdb.com https://femvhonlpafdajyamvcu.supabase.co https://books.google.com https://lh3.googleusercontent.com https://covers.openlibrary.org",
  "font-src 'self'",
  "connect-src 'self' https://femvhonlpafdajyamvcu.supabase.co wss://femvhonlpafdajyamvcu.supabase.co https://vitals.vercel-insights.com https://va.vercel-scripts.com https://*.ingest.sentry.io https://*.ingest.de.sentry.io https://www.thesportsdb.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  // upgrade-insecure-requests breaks localhost dev (HTTP → HTTPS mismatch)
  ...(!isDev ? ["upgrade-insecure-requests"] : []),
].join("; ");

const nextConfig: NextConfig = {
  devIndicators: false,
  transpilePackages: ["swiper"],

  experimental: {
    // Re-enable the client Router Cache for visited segments. Next's default is
    // `dynamic: 0`, which re-fetches the RSC payload on every navigation — so the
    // route-level loading.tsx flashes even when switching back to an already-loaded
    // tab (Movies/TV/Animes). Caching visited segments for a few minutes makes
    // those switches instant; the first visit per route still shows the skeleton.
    // Trade-off: server-rendered content (e.g. sports pages) can be up to `dynamic`
    // seconds stale on back-navigation, which is fine for this app.
    staleTimes: { dynamic: 180, static: 300 },
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: CSP },
        ],
      },
    ];
  },

  images: {
    minimumCacheTTL: 2592000, // 30 days — posters/backdrops never change
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/t/p/**",
      },
      {
        // Football team crests from football-data.org API
        protocol: "https",
        hostname: "crests.football-data.org",
      },
      {
        // Tennis player photos + football legends from TheSportsDB
        protocol: "https",
        hostname: "cdn.thesportsdb.com",
      },
      {
        protocol: "https",
        hostname: "r2.thesportsdb.com",
      },
      {
        // Supabase storage (poster_url, backdrop_url, profile_url stored in DB)
        protocol: "https",
        hostname: "femvhonlpafdajyamvcu.supabase.co",
      },
      {
        // Google Books cover thumbnails
        protocol: "https",
        hostname: "books.google.com",
      },
      {
        // Open Library high-res covers (by ISBN) — primary book cover source
        protocol: "https",
        hostname: "covers.openlibrary.org",
      },
      {
        // Google OAuth profile avatars (lh3 = Google's image CDN for user photos)
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "hegon",

  project: "hegon",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { QueryProvider } from "@/shared/providers/QueryProvider";
import { TooltipProvider } from "@/shared/components/ui/tooltip";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});


export const metadata: Metadata = {
  title: "Hegon",
  description: "Your personal second brain.",
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" translate="no" suppressHydrationWarning>
      {/**
       * TRACEABILITY — 2026-08-18, explicit owner request (crash fix on iOS).
       *
       * `lang` said "fr" while every visible string in this app is English. Inside the Google app's
       * in-app browser on iOS, that mismatch is an invitation to auto-translate — and a translator
       * rewrites text nodes (wrapping them in <font>) under the tree React owns. React then unmounts
       * a node the DOM no longer holds and throws `NotFoundError: The object can not be found here.`
       * (DOMException 8) from removeChild. Sentry 2c94a302, /perso/watching/:id, caught by the route
       * error boundary — recovered, but the page died under the user.
       *
       * So `lang="en"` states the truth, and `translate="no"` asks translators to keep their hands
       * off. Nothing else in this file changes: no provider, no layout, no auth logic.
       */}
      {/**
       * TRACEABILITY — 2026-07-21, explicit owner request (image performance pass).
       *
       * The ONLY change to this file: two resource hints. No provider, no layout, no auth logic is
       * touched.
       *
       * Every poster and backdrop in the app comes from image.tmdb.org, and there was no hint of any
       * kind anywhere in the tree — so each cold navigation paid a full DNS + TCP + TLS handshake
       * before the first image byte could move (measured: first image at ~997ms on /movies). The
       * handshake now runs in parallel with the HTML instead of behind it.
       */}
      <head>
        <link rel="preconnect" href="https://image.tmdb.org" crossOrigin="" />
        <link rel="dns-prefetch" href="https://image.tmdb.org" />
      </head>
      <body className={`${inter.variable} antialiased overflow-hidden`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <QueryProvider>
            <TooltipProvider>
            {children}
            <Toaster
              position="bottom-right"
              theme="dark"
              toastOptions={{
                classNames: {
                  title: "!font-medium",
                  description: "!text-zinc-400",
                },
              }}
            />
            <Analytics debug={false} />
            </TooltipProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
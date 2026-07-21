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
    <html lang="fr" suppressHydrationWarning>
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
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { QueryProvider } from "@/shared/providers/QueryProvider";
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
      <body className={`${inter.variable} antialiased overflow-hidden`}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <QueryProvider>
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
            <Analytics />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { LogoIcon } from "@/components/icons";
import { SiteNav, StaticNav } from "@/components/SiteNav";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "One Journey | Ahmedabad and Gandhinagar", template: "%s | One Journey" },
  description:
    "One City, One Journey: plan trips across Metro, BRTS, AMTS, GSRTC and Gandhinagar city bus in Ahmedabad and Gandhinagar, and book one integrated ticket.",
};

export const viewport: Viewport = {
  themeColor: "#0B3D91",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[2000] focus:rounded-lg focus:bg-card focus:px-4 focus:py-2 focus:text-brand"
        >
          Skip to content
        </a>
        <header className="relative z-[1100] border-b border-line bg-card">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 rounded-lg text-brand" aria-label="One Journey home">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand text-on-brand">
                <LogoIcon className="h-5 w-5" />
              </span>
              <span className="text-lg font-bold tracking-tight">One Journey</span>
            </Link>
            <Suspense fallback={<StaticNav />}>
              <SiteNav />
            </Suspense>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
          {children}
        </main>
        <footer className="border-t border-line bg-card">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
            <p>One City, One Journey: Ahmedabad and Gandhinagar public transport.</p>
            <p>Timetables: GMRC, GSRTC, AMTS. Map: OpenStreetMap contributors. Weather: Open-Meteo</p>
          </div>
        </footer>
      </body>
    </html>
  );
}

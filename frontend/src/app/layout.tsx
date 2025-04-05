import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { MainNav } from "@/components/main-nav";
import { Toaster } from "@/components/ui/toaster";
import { PageBackground } from "@/components/page-background";
import { ScrollbarManager } from "@/components/scrollbar-manager";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "UFC Fighter Data API",
  description: "A comprehensive API for UFC fighter statistics and analytics",
  viewport: "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no",
};

function SiteHeader() {
  return (
    <header className="fixed top-6 left-0 right-0 z-50">
      <div className="mx-auto max-w-[90rem] px-4">
        <div className="rounded-full border border-[var(--nav-border)] bg-[var(--nav-bg)] backdrop-blur-md shadow-[var(--nav-shadow)]">
          <div className="flex h-14 items-center px-4">
            <MainNav />
            <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
              <div className="w-full flex-1 md:w-auto md:flex-none" />
              <div className="relative">
                <ThemeToggle />
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <style>{`
          html {
            background: var(--app-bg);
          }
          html, body {
            height: 100%;
            margin: 0;
            padding: 0;
            overflow-x: hidden;
          }
          @media (max-width: 640px) {
            html {
              font-size: 14px;
            }
          }
          body {
            min-height: 100vh;
            /* Always maintain padding to prevent layout shift */
            padding-right: 8px !important;
          }
          body.scrollbar-visible {
            overflow-y: scroll;
          }
          body.scrollbar-hidden {
            overflow-y: hidden;
          }
          #main-content {
            isolation: isolate;
            min-height: 100vh;
            position: relative;
            z-index: 1;
            /* Ensure main content also maintains padding */
            padding-right: 8px !important;
          }
          /* Custom scrollbar styles */
          ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
          ::-webkit-scrollbar-track {
            background: transparent;
          }
          ::-webkit-scrollbar-thumb {
            background: var(--border);
            border-radius: 4px;
          }
          ::-webkit-scrollbar-thumb:hover {
            background: var(--muted-foreground);
          }
          /* Prevent portals from affecting body overflow */
          [data-radix-popper-content-wrapper] {
            z-index: 50;
          }
          /* Override react-remove-scroll */
          [data-rmiz-modal-overlay],
          [data-rmiz-modal-content],
          [data-radix-popper-content-wrapper] {
            overflow: visible !important;
          }
          /* Force all portal elements to maintain padding */
          [data-radix-popper-content-wrapper] > div {
            padding-right: 8px !important;
          }
        `}</style>
      </head>
      <body className={`${inter.className} scrollbar-hidden`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <PageBackground />
          <SiteHeader />
          <main className="relative min-h-screen pt-24 pb-8">
            <div className="mx-auto max-w-[90rem] px-4">
              {children}
            </div>
          </main>
          <Toaster />
          <ScrollbarManager />
        </ThemeProvider>
      </body>
    </html>
  );
}

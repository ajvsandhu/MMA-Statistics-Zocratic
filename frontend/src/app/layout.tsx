import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { MainNav } from "@/components/main-nav";
import { Toaster } from "@/components/ui/toaster";
import { PageBackground } from "@/components/page-background";
import { ScrollbarManager } from "@/components/scrollbar-manager";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
};

export const metadata: Metadata = {
  metadataBase: new URL('https://www.zocraticmma.com'),
  title: "Zocratic MMA",
  description: "Master the art of fight analysis with advanced UFC fighter statistics, predictions, and performance metrics.",
  openGraph: {
    title: "Zocratic MMA",
    description: "Master the art of fight analysis with advanced UFC fighter statistics, predictions, and performance metrics.",
    type: "website",
    url: 'https://www.zocraticmma.com',
    siteName: "Zocratic MMA",
    locale: "en_US",
    images: [{
      url: "https://www.zocraticmma.com/og-image.jpg",
      width: 1200,
      height: 630,
      alt: "Zocratic MMA - Fight Analysis Platform"
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Zocratic MMA",
    description: "Master the art of fight analysis with advanced UFC fighter statistics, predictions, and performance metrics.",
    images: ["https://www.zocraticmma.com/og-image.jpg"],
  },
  other: {
    'msapplication-TileColor': '#000000',
    'theme-color': '#000000',
    'apple-mobile-web-app-capable': 'yes',
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black',
  }
};

function SiteHeader() {
  return (
    <header className="fixed top-6 left-0 right-0 z-50">
      <div className="mx-auto max-w-[90rem] px-4">
        <div className="rounded-full border border-[var(--nav-border)] bg-[var(--nav-bg)] backdrop-blur-md shadow-[var(--nav-shadow)]">
          <div className="flex h-14 items-center px-4">
            <MainNav />
            <div className="flex flex-1 items-center justify-end">
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
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>{`
          html, body {
            height: 100%;
            margin: 0;
            padding: 0;
          }
          body {
            min-height: 100vh;
          }
          #main-content {
            isolation: isolate;
            min-height: 100vh;
            position: relative;
            z-index: 1;
          }
        `}</style>
      </head>
      <body className={`${inter.className} scrollbar-hidden`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
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

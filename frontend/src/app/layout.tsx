import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme-provider";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { MainNav } from "@/components/main-nav";
import { Toaster } from "@/components/ui/toaster";
import { PageBackground } from "@/components/page-background";
import { PageTransitionsProvider } from "@/components/page-transitions-provider";
import { FooterVisibility } from "@/components/footer-visibility";
import { usePathname } from "next/navigation";

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
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/icon.png', sizes: '192x192' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180' },
    ],
  },
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
                <ThemeSwitcher />
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
  // Only show the footer if we're NOT on a fighter details page
  // This keeps the footer from overlapping the radar chart and stats
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const isFighterPage = pathname.startsWith('/fighters/') && pathname.split('/').length === 3;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                const theme = localStorage.getItem('zocratic-ui-theme') || 'dark';
                document.documentElement.classList.remove('light', 'dark', 'theme-teal', 'theme-purple', 'theme-fire', 'theme-huemint', 'theme-crimson');
                document.documentElement.classList.add(theme);
                document.documentElement.style.colorScheme = theme === 'dark' || theme.startsWith('theme-') ? 'dark' : 'light';
              } catch (e) {}
            })();
          `
        }} />
        <style>{`
          html {
            /* Ensure html takes full height for body min-height to work reliably */
            height: 100%; 
          }
          body {
            /* Removed height: 100% from combined rule */
            margin: 0;
            padding: 0;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
          }
          #main-content { /* This style seems unused based on current main tag */
            isolation: isolate;
            min-height: 100vh;
            position: relative;
            z-index: 1;
          }
        `}</style>
      </head>
      <body className={`${inter.className} min-h-screen flex flex-col overflow-y-auto overflow-x-hidden`}>
        {/* This layout ensures the footer always stays at the bottom, even if content is short. */}
        <ThemeProvider
          defaultTheme="dark"
          storageKey="zocratic-ui-theme"
        >
          <PageBackground />
          <SiteHeader />
          <main className="relative pt-28 flex-1">
            <div className="mx-auto max-w-[90rem] px-4">
              <PageTransitionsProvider>
                {children}
              </PageTransitionsProvider>
            </div>
          </main>
          <FooterVisibility />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}

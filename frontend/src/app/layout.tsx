import type { Metadata, Viewport } from "next";
import { Exo } from 'next/font/google'
import "./globals.css";
import { ThemeProvider } from "@/lib/theme-provider";
import { MainNav } from "@/components/main-nav";
import { Toaster } from "@/components/ui/toaster";
import { PageBackground } from "@/components/page-background";
import { PageTransitionsProvider } from "@/components/page-transitions-provider";
import { FooterVisibility } from "@/components/footer-visibility";
import { Providers } from "./providers";
import AntiGamblingModal from "@/components/anti-gambling-modal";

const exo = Exo({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  display: "swap",
})

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
};

export const metadata: Metadata = {
  metadataBase: new URL('https://zocraticmma.com'),
  title: "Zocratic MMA",
  description: "Master the art of fight analysis with advanced UFC fighter statistics, predictions, and performance metrics.",
  keywords: "UFC, MMA, fighter statistics, fight predictions, UFC analysis, fighter profiles, MMA data, UFC rankings, fight analysis, Zocratic MMA",
  authors: [{ name: "Zocratic MMA" }],
  creator: "Zocratic MMA",
  publisher: "Zocratic MMA",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
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
    url: 'https://zocraticmma.com',
    siteName: "Zocratic MMA",
    locale: "en_US",
    images: [{
      url: "https://zocraticmma.com/og-image.jpg",
      width: 1200,
      height: 630,
      alt: "Zocratic MMA - Fight Analysis Platform"
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Zocratic MMA",
    description: "Master the art of fight analysis with advanced UFC fighter statistics, predictions, and performance metrics.",
    images: ["https://zocraticmma.com/og-image.jpg"],
  },
  other: {
    'msapplication-TileColor': '#000000',
    'theme-color': '#000000',
    'apple-mobile-web-app-capable': 'yes',
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black',
    // Add structured data for the website
    'application/ld+json': JSON.stringify([
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "Zocratic MMA",
        "description": "Master the art of fight analysis with advanced UFC fighter statistics, predictions, and performance metrics.",
        "url": "https://zocraticmma.com",
        "potentialAction": {
          "@type": "SearchAction",
          "target": "https://zocraticmma.com/fighters?search={search_term_string}",
          "query-input": "required name=search_term_string"
        },
        "sameAs": [
          "https://zocraticmma.com"
        ]
      },
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "Zocratic MMA",
        "url": "https://zocraticmma.com",
        "logo": "https://zocraticmma.com/icon.png",
        "description": "Master the art of fight analysis with advanced UFC fighter statistics, predictions, and performance metrics.",
        "foundingDate": "2024",
        "sameAs": [
          "https://zocraticmma.com"
        ]
      }
    ])
  }
};

function SiteHeader() {
  return (
    <header className="fixed top-3 sm:top-6 left-0 right-0 z-50">
      <div className="mx-auto max-w-[90rem] px-2 sm:px-4">
        <div className="rounded-full border border-[var(--nav-border)] bg-[var(--nav-bg)] backdrop-blur-md shadow-[var(--nav-shadow)]">
          <div className="flex h-12 sm:h-14 items-center px-3 sm:px-4">
            <MainNav />
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
        {/* Google AdSense */}
        <script 
          async 
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6692102356476793"
          crossOrigin="anonymous"
        />
        <style>{`
          html {
            height: 100%; 
          }
          body {
            margin: 0;
            padding: 0;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
          }
          #main-content {
            isolation: isolate;
            min-height: 100vh;
            position: relative;
            z-index: 1;
          }
        `}</style>
      </head>
      <body className={`${exo.className} min-h-screen bg-background font-sans antialiased`}>
        <AntiGamblingModal />
        <Providers>
          <ThemeProvider
            defaultTheme="dark"
            storageKey="zocratic-ui-theme"
          >
            <PageBackground />
            <SiteHeader />
            <main className="relative pt-20 sm:pt-28 pb-40 sm:pb-48 md:pb-32 flex-1">
              <div className="mx-auto max-w-[90rem] px-4">
                <PageTransitionsProvider>
                  {children}
                </PageTransitionsProvider>
              </div>
            </main>
            <FooterVisibility />
            <Toaster />
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}

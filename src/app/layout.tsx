import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display, Spectral } from "next/font/google";
import Script from "next/script";
import { headers } from "next/headers";
import { isValidLang, DEFAULT_LANG } from "@/i18n";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
});

const spectral = Spectral({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-cormorant",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export const metadata: Metadata = {
  title: {
    template: "%s | Game of Trivia",
    default: "Game of Trivia",
  },
  description: "Test your knowledge across multiple categories",
  manifest: "/manifest.json",
  icons: {
    icon: "/logos/g_micro.png",
    apple: "/logos/g_micro.png",
  },
  appleWebApp: {
    capable: true,
    title: "Game of Trivia",
    statusBarStyle: "black-translucent",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const rawLang = headersList.get("x-lang") ?? DEFAULT_LANG;
  const lang = isValidLang(rawLang) ? rawLang : DEFAULT_LANG;

  return (
    <html lang={lang}>
      <body className={`${inter.className} ${playfair.variable} ${spectral.variable} antialiased bg-[#FCF5F6] text-slate-900`}>
        {children}
        <Script id="sw-register" strategy="afterInteractive">{`
          // Production only — the service worker caches /_next/static/* chunks
          // forever (correct for content-hashed prod builds), which would
          // otherwise pin stale Turbopack dev chunks across restarts.
          if (${process.env.NODE_ENV === "production"} && 'serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js');
            });
          } else if ('serviceWorker' in navigator) {
            // Dev: unregister any service worker left over from a prior
            // production build/run on this same origin.
            navigator.serviceWorker.getRegistrations().then(function(regs) {
              regs.forEach(function(r) { r.unregister(); });
            });
          }
        `}</Script>
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-5P2WPVT7RT" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-5P2WPVT7RT');
        `}</Script>
      </body>
    </html>
  );
}

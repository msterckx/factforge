import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export const metadata: Metadata = {
  title: "Game of Trivia",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} ${playfair.variable} antialiased bg-[#FCF5F6] text-slate-900`}>
        {children}
        <Script id="sw-register" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js');
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

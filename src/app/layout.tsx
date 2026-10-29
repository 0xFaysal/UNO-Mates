import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#022c22",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL : 'http://localhost:3000')),
  title: { default: 'UNO Mates — Play with your people', template: '%s · UNO Mates' },
  applicationName: 'UNO Mates',
  description: 'A private card table for 2–10 friends. Stack +2 and +4, choose your seat, and play on until everyone has a rank. No account needed.',
  keywords: ['UNO Mates', 'multiplayer card game', 'house rules', 'play with friends'],
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'UNO Mates',
  },
  openGraph: { title: 'UNO Mates', description: 'Your friends. Your house rules. Pull up a chair.', siteName: 'UNO Mates', type: 'website', images: [{ url: '/brand/uno-mates-logo.png', width: 512, height: 512, alt: 'UNO Mates playing-card logo' }] },
  twitter: { card: 'summary', title: 'UNO Mates', description: 'Your friends. Your house rules.', images: ['/brand/uno-mates-logo.png'] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 overflow-x-hidden selection:bg-yellow-400 selection:text-slate-950">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

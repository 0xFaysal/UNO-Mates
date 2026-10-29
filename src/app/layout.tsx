import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "UNO! Classic — Real-Time Multiplayer Card Game",
  description:
    "Play authentic classic UNO in real-time with 2 to 10 friends. Mobile-first, server-authoritative, full 108-card deck, and official classic rules.",
  keywords: ["UNO", "multiplayer", "card game", "real-time", "classic uno", "online uno"],
  authors: [{ name: "UNO Classic Multiplayer" }],
  icons: {
    icon: "/favicon.ico",
  },
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
        {children}
      </body>
    </html>
  );
}

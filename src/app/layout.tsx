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

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://uno-mates.vercel.app");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "UNO Mates — Play Multiplayer UNO Online Free with Friends",
    template: "%s · UNO Mates",
  },
  applicationName: "UNO Mates",
  description:
    "Play UNO online with friends! Free real-time multiplayer UNO card game for 2–10 players. No registration or download required. Stack +2 & +4, customize house rules, and pull up a chair with your mates.",
  keywords: [
    "UNO",
    "UNO Mates",
    "Multiplayer UNO",
    "Multiplayer UNO Mates",
    "UNO Online",
    "Play UNO Online",
    "Play UNO with Friends",
    "Free UNO Game",
    "UNO Card Game Online",
    "UNO Classic Online",
    "UNO Web Game",
    "Online Multiplayer Card Game",
    "UNO House Rules",
    "Stack +2 +4 UNO",
    "UNO 2 to 10 players",
    "Free Card Game with Friends",
  ],
  authors: [{ name: "Faysal Ahmed Fahim", url: "https://github.com/0xFaysal" }],
  creator: "Faysal Ahmed Fahim",
  publisher: "UNO Mates",
  category: "game",
  classification: "Multiplayer Online Card Game",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: "UNO Mates — Free Multiplayer UNO Online with Friends",
    description:
      "Play UNO online in real time with 2–10 friends. No sign-up, instant private rooms, custom house rules, and turn timers. Pull up a chair!",
    url: siteUrl,
    siteName: "UNO Mates",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/brand/uno-mates-logo.png",
        width: 512,
        height: 512,
        alt: "UNO Mates - Free Multiplayer UNO Online Card Game",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "UNO Mates — Free Multiplayer UNO Online with Friends",
    description:
      "Play UNO online with 2–10 friends. Instant private rooms, stacking rules & live multiplayer card action!",
    creator: "@FaysalAhmedFAHlM",
    images: ["/brand/uno-mates-logo.png"],
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "UNO Mates",
  },
};

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: "UNO Mates",
    alternateName: [
      "Multiplayer UNO",
      "UNO Online",
      "UNO Mates Card Game",
      "Play UNO with Friends",
      "Multiplayer UNO Mates",
    ],
    description:
      "Free multiplayer UNO online card game for 2 to 10 friends. Play in real time directly from your browser with no sign-up or app download required.",
    genre: ["Card Game", "Party Game", "Multiplayer Game", "Casual Game"],
    gamePlatform: ["Web Browser", "Desktop", "Mobile", "Tablet"],
    applicationCategory: "GameApplication",
    operatingSystem: "Any",
    url: siteUrl,
    playMode: "MultiPlayer",
    numberOfPlayers: {
      "@type": "QuantitativeValue",
      minValue: 2,
      maxValue: 10,
    },
    author: {
      "@type": "Person",
      name: "Faysal Ahmed Fahim",
      url: "https://github.com/0xFaysal",
      sameAs: [
        "https://bd.linkedin.com/in/faysal-ahmed-fahim01",
        "https://www.facebook.com/FaysalAhmedFAHlM/",
        "https://github.com/0xFaysal",
      ],
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
    image: `${siteUrl}/brand/uno-mates-logo.png`,
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "UNO Mates",
    alternateName: "Multiplayer UNO Mates",
    url: siteUrl,
    description:
      "Play multiplayer UNO card game online with your friends for free in any browser.",
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How do I play multiplayer UNO online on UNO Mates?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Simply create a private room on UNO Mates and share the 6-letter room code or link with your friends. Up to 10 players can join instantly from any device without creating an account or installing an app.",
        },
      },
      {
        "@type": "Question",
        name: "Is UNO Mates free to play?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes! UNO Mates is 100% free with no paywalls, subscriptions, or hidden fees. All house rules, computer bots, and multiplayer tables are available to everyone.",
        },
      },
      {
        "@type": "Question",
        name: "Can you stack Draw Two (+2) and Wild Draw Four (+4) cards in UNO Mates?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes, UNO Mates natively supports the popular house rule of stacking +2 and +4 cards, passing the accumulated penalty onto the next player until someone cannot respond.",
        },
      },
      {
        "@type": "Question",
        name: "How many players can play in a single UNO Mates game?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "UNO Mates supports anywhere from 2 to 10 players per table, with real-time seating, live turn clocks, and optional AI bots if you want to fill seats.",
        },
      },
    ],
  },
];

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
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 overflow-x-hidden selection:bg-yellow-400 selection:text-slate-950">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

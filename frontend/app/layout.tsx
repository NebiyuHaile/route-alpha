import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import { AuthProvider } from "../components/AuthProvider";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ),
  title: {
    default: "RouteAlpha | Production AI Inference Routing",
    template: "%s | RouteAlpha",
  },
  description:
    "RouteAlpha is an AI inference routing platform with live prompt testing, fallback-aware routing, and cost and latency observability for production teams.",
  applicationName: "RouteAlpha",
  authors: [{ name: "RouteAlpha" }],
  creator: "RouteAlpha",
  publisher: "RouteAlpha",
  keywords: [
    "RouteAlpha",
    "LLM routing",
    "model analytics",
    "inference dashboard",
    "AI observability",
    "OpenRouter",
    "Next.js",
    "FastAPI",
  ],
  openGraph: {
    title: "RouteAlpha | Production AI Inference Routing",
    description:
      "Route prompts by cost, speed, and quality while keeping every model decision observable.",
    type: "website",
    siteName: "RouteAlpha",
  },
  twitter: {
    card: "summary_large_image",
    title: "RouteAlpha | Production AI Inference Routing",
    description:
      "A polished routing layer, inference playground, and analytics workspace for AI product teams.",
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
      className={`${spaceGrotesk.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

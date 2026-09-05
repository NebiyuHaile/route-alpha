import type { Metadata } from "next";
import { AuthProvider } from "../components/AuthProvider";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  title: {
    default: "RouteAlpha",
    template: "%s | RouteAlpha",
  },
  description:
    "RouteAlpha is a routing dashboard and inference workspace for comparing model cost, latency, and usage patterns.",
  metadataBase: new URL(siteUrl),
  applicationName: "RouteAlpha",
  keywords: [
    "RouteAlpha",
    "LLM routing",
    "model analytics",
    "inference dashboard",
    "Next.js",
    "FastAPI",
  ],
  openGraph: {
    title: "RouteAlpha — Observable AI routing",
    description:
      "Route LLM requests with explicit cost, latency, and quality tradeoffs.",
    type: "website",
    url: siteUrl,
    siteName: "RouteAlpha",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

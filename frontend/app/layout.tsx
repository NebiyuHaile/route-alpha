import type { Metadata } from "next";
import { AuthProvider } from "../components/AuthProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "RouteAlpha",
    template: "%s | RouteAlpha",
  },
  description:
    "RouteAlpha is a routing dashboard and inference workspace for comparing model cost, latency, and usage patterns.",
  applicationName: "RouteAlpha",
  keywords: [
    "RouteAlpha",
    "LLM routing",
    "model analytics",
    "inference dashboard",
    "Next.js",
    "FastAPI",
  ],
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

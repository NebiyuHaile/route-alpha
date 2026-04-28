import type { Metadata } from "next";
import LandingPage from "../components/LandingPage";

export const metadata: Metadata = {
  title: "AI Routing Platform",
  description:
    "RouteAlpha helps teams route AI requests with clearer cost, latency, and quality tradeoffs.",
};

export default function Home() {
  return <LandingPage />;
}

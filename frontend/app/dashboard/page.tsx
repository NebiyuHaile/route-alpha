import type { Metadata } from "next";
import DashboardPage from "../../components/DashboardPage";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Monitor routing volume, cost, model usage, and latency across RouteAlpha requests.",
  robots: {
    index: false,
  },
};

export default function DashboardRoute() {
  return <DashboardPage />;
}

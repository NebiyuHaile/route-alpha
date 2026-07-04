import type { Metadata } from "next";
import ContactPage from "../../components/ContactPage";

export const metadata: Metadata = {
  title: "Contact & Demo Requests",
  description:
    "Request a RouteAlpha demo or tell us about the AI workloads you want to route by cost, speed, and quality.",
};

export default function ContactRoute() {
  return <ContactPage />;
}

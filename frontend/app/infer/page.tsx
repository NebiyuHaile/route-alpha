import type { Metadata } from "next";
import InferPage from "../../components/InferPage";

export const metadata: Metadata = {
  title: "Inference Playground",
  description:
    "Run prompts through RouteAlpha's routing layer and inspect the chosen route, model, latency, and estimated cost.",
  robots: {
    index: false,
  },
};

export default function InferRoute() {
  return <InferPage />;
}

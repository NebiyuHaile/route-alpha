"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Navbar from "./Navbar";

type SummaryData = {
  total_requests: number;
  average_latency_ms: number;
  total_estimated_cost_usd: number;
};

type RouteData = {
  route_key: string;
  count: number;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

const featureCards = [
  {
    title: "Smart routing",
    description:
      "Send each prompt to the right route based on prompt size, task type, and business priority instead of overpaying on every request.",
  },
  {
    title: "Live cost visibility",
    description:
      "Track estimated spend, latency, and model usage in one place so routing policy changes are backed by data, not guesswork.",
  },
  {
    title: "Operator workflow",
    description:
      "Test prompts in the playground, inspect route reasoning instantly, and hand the same signals to product, ops, and engineering.",
  },
];

const workflowSteps = [
  "A request arrives with a prompt, task type, and priority signal.",
  "RouteAlpha scores the request and selects the cheapest route that still matches the quality bar.",
  "The platform logs cost, latency, chosen model, and route reasoning for every run.",
  "Teams use the dashboard to tune policy and keep quality, speed, and spend in balance.",
];

const pricingPlans = [
  {
    name: "Starter",
    price: "$0",
    detail: "For demos, internal pilots, and routing experiments.",
    cta: "Try playground",
    href: "/infer",
    points: ["Live prompt testing", "Route reasoning", "Usage analytics"],
  },
  {
    name: "Growth",
    price: "$299",
    detail: "For teams that need consistent routing controls and visibility.",
    cta: "Open dashboard",
    href: "/dashboard",
    points: ["Cost and latency tracking", "Model breakdowns", "Recent request review"],
  },
  {
    name: "Enterprise",
    price: "Custom",
    detail: "For higher-volume AI products with stricter quality and governance needs.",
    cta: "Start platform tour",
    href: "#faq",
    points: ["Priority-based routing", "Observability workflows", "Policy customization"],
  },
];

const faqs = [
  {
    question: "What does RouteAlpha actually do?",
    answer:
      "RouteAlpha is an AI routing layer that decides which model path should handle a request, then logs the latency, model choice, cost estimate, and route reasoning behind that decision.",
  },
  {
    question: "Is this just a dashboard?",
    answer:
      "No. The dashboard is the observability layer. The product also includes a live inference workflow and routing logic that actively chooses between cheap, medium, and strong paths.",
  },
  {
    question: "Why would a startup team need this early?",
    answer:
      "Because AI spend compounds fast. Teams usually learn too late which prompts should have stayed on cheaper models and where quality routing actually matters.",
  },
];

function formatLatency(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} s`;
  }
  return `${value.toFixed(0)} ms`;
}

function formatCost(value: number) {
  return `$${value.toFixed(4)}`;
}

function getRouteMix(routes: RouteData[]) {
  if (!routes.length) return "No live traffic yet";

  const total = routes.reduce((sum, route) => sum + route.count, 0);
  const top = [...routes].sort((left, right) => right.count - left.count)[0];

  if (!top || total === 0) return "No live traffic yet";
  return `${top.route_key} leads with ${Math.round((top.count / total) * 100)}% of routed volume`;
}

export default function LandingPage() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "offline">("loading");

  useEffect(() => {
    let active = true;

    async function loadPreview() {
      try {
        const [summaryRes, routesRes] = await Promise.all([
          fetch(`${API_BASE_URL}/analytics/summary`, { cache: "no-store" }),
          fetch(`${API_BASE_URL}/analytics/routes`, { cache: "no-store" }),
        ]);

        if (!summaryRes.ok || !routesRes.ok) {
          throw new Error("Preview unavailable");
        }

        const [summaryData, routesData] = await Promise.all([
          summaryRes.json(),
          routesRes.json(),
        ]);

        if (!active) return;

        setSummary(summaryData);
        setRoutes(routesData);
        setStatus("ready");
      } catch {
        if (!active) return;
        setStatus("offline");
      }
    }

    loadPreview();

    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <Navbar />
      <main className="overflow-hidden text-slate-950">
        <section className="relative isolate">
          <div className="absolute inset-x-0 top-0 -z-10 h-[42rem] bg-[radial-gradient(circle_at_top_left,_rgba(15,118,110,0.24),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(245,158,11,0.18),_transparent_28%),linear-gradient(180deg,_rgba(255,255,255,0.7),_rgba(248,250,252,0.95))]" />
          <div className="mx-auto flex max-w-7xl flex-col gap-16 px-6 pb-16 pt-12 lg:px-8 lg:pb-24 lg:pt-20">
            <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700 shadow-sm shadow-emerald-100/70 backdrop-blur">
                  AI routing for real product teams
                </div>
                <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
                  Build faster AI products without routing every request to the most expensive model.
                </h1>
                <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
                  RouteAlpha helps teams balance cost, speed, and quality with a
                  routing layer, an operator playground, and analytics that make
                  every model decision visible.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/infer"
                    className="inline-flex h-12 items-center justify-center rounded-full bg-slate-950 px-6 text-sm font-semibold text-white shadow-[0_16px_40px_-18px_rgba(15,23,42,0.65)] hover:-translate-y-0.5 hover:bg-slate-800"
                  >
                    Try live inference
                  </Link>
                  <Link
                    href="/dashboard"
                    className="inline-flex h-12 items-center justify-center rounded-full border border-slate-300 bg-white/85 px-6 text-sm font-semibold text-slate-900 shadow-sm backdrop-blur hover:-translate-y-0.5 hover:border-slate-400 hover:bg-white"
                  >
                    Explore dashboard
                  </Link>
                </div>
                <div className="mt-10 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
                  <HeroStat label="Routing modes" value="Cheap, medium, strong" />
                  <HeroStat label="Operator tools" value="Playground + analytics" />
                  <HeroStat label="Decision signal" value="Cost, speed, quality" />
                </div>
              </div>

              <div className="relative">
                <div className="absolute -right-10 top-10 -z-10 h-40 w-40 rounded-full bg-amber-300/30 blur-3xl" />
                <div className="absolute -left-6 bottom-8 -z-10 h-52 w-52 rounded-full bg-teal-400/20 blur-3xl" />
                <div className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-[0_32px_90px_-38px_rgba(15,23,42,0.42)] backdrop-blur-xl">
                  <div className="rounded-[1.5rem] border border-slate-200 bg-slate-950 p-5 text-white">
                    <div className="flex items-center justify-between text-xs uppercase tracking-[0.24em] text-slate-400">
                      <span>Live routing preview</span>
                      <span>{status === "ready" ? "Connected" : "Fallback mode"}</span>
                    </div>
                    <div className="mt-6 grid grid-cols-2 gap-4">
                      <PreviewMetric
                        label="Requests"
                        value={
                          status === "ready" && summary
                            ? summary.total_requests.toLocaleString()
                            : "Demo"
                        }
                      />
                      <PreviewMetric
                        label="Avg latency"
                        value={
                          status === "ready" && summary
                            ? formatLatency(summary.average_latency_ms)
                            : "420 ms"
                        }
                      />
                      <PreviewMetric
                        label="Estimated cost"
                        value={
                          status === "ready" && summary
                            ? formatCost(summary.total_estimated_cost_usd)
                            : "$0.0342"
                        }
                      />
                      <PreviewMetric
                        label="Top route"
                        value={status === "ready" ? getRouteMix(routes) : "cheap leads 62%"}
                      />
                    </div>
                    <div className="mt-5 rounded-[1.35rem] border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-teal-200">
                        Routing insight
                      </p>
                      <p className="mt-3 text-lg font-semibold">
                        Shift short-form prompts to cheaper paths and keep stronger models reserved for reasoning-heavy work.
                      </p>
                      <p className="mt-3 text-sm leading-6 text-slate-300">
                        The platform keeps every request observable so teams can tune
                        policies instead of debating model choices in the dark.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 rounded-[2rem] border border-white/60 bg-white/65 p-6 shadow-[0_20px_70px_-40px_rgba(15,23,42,0.35)] backdrop-blur sm:grid-cols-3">
              <TrustLine label="Faster iteration" value="Live playground for prompt testing and route validation." />
              <TrustLine label="Operational clarity" value="Cost, latency, and model choice attached to every request." />
              <TrustLine label="Startup discipline" value="Spend less on low-risk prompts and reserve quality where it matters." />
            </div>
          </div>
        </section>

        <section id="platform" className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">
              Platform
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
              Everything a serious AI product homepage should point toward is already in the product.
            </h2>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {featureCards.map((feature) => (
              <div
                key={feature.title}
                className="rounded-[1.75rem] border border-slate-200 bg-white/85 p-6 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.24)]"
              >
                <div className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">
                  Built in
                </div>
                <h3 className="mt-5 text-2xl font-semibold text-slate-950">
                  {feature.title}
                </h3>
                <p className="mt-3 text-base leading-7 text-slate-600">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section id="workflow" className="bg-slate-950 py-20 text-white">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-200">
                  Workflow
                </p>
                <h2 className="mt-4 text-4xl font-semibold tracking-tight">
                  A better motion than “send everything to the biggest model.”
                </h2>
                <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
                  RouteAlpha makes routing policy feel like a product decision, not a hidden implementation detail. Teams can test, observe, and improve with the same system.
                </p>
              </div>
              <div className="space-y-4">
                {workflowSteps.map((step, index) => (
                  <div
                    key={step}
                    className="flex gap-4 rounded-[1.5rem] border border-white/10 bg-white/5 p-5"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-300 text-sm font-bold text-slate-950">
                      {index + 1}
                    </div>
                    <p className="pt-1 text-base leading-7 text-slate-200">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-700">
                Pricing
              </p>
              <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
                Designed to look and feel like a product company, not a side project.
              </h2>
            </div>
            <p className="max-w-xl text-base leading-7 text-slate-600">
              These plans are presented as product packaging for the site experience and give the homepage the completeness users expect from a startup-grade platform.
            </p>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            {pricingPlans.map((plan, index) => (
              <div
                key={plan.name}
                className={`rounded-[2rem] border p-6 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.28)] ${
                  index === 1
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-950"
                }`}
              >
                <p className={`text-sm font-semibold uppercase tracking-[0.2em] ${index === 1 ? "text-teal-200" : "text-slate-500"}`}>
                  {plan.name}
                </p>
                <div className="mt-5 text-4xl font-semibold">{plan.price}</div>
                <p className={`mt-3 text-sm leading-6 ${index === 1 ? "text-slate-300" : "text-slate-600"}`}>
                  {plan.detail}
                </p>
                <div className="mt-6 space-y-3">
                  {plan.points.map((point) => (
                    <div key={point} className="flex items-center gap-3 text-sm">
                      <span className={`h-2.5 w-2.5 rounded-full ${index === 1 ? "bg-teal-300" : "bg-amber-500"}`} />
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
                <Link
                  href={plan.href}
                  className={`mt-8 inline-flex h-11 items-center justify-center rounded-full px-5 text-sm font-semibold ${
                    index === 1
                      ? "bg-white text-slate-950 hover:bg-slate-100"
                      : "bg-slate-950 text-white hover:bg-slate-800"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section id="faq" className="bg-white/70 py-20">
          <div className="mx-auto max-w-5xl px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">
                FAQ
              </p>
              <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
                The details teams usually want before they trust the platform.
              </h2>
            </div>
            <div className="mt-10 space-y-4">
              {faqs.map((item) => (
                <details
                  key={item.question}
                  className="group rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-[0_12px_40px_-34px_rgba(15,23,42,0.32)]"
                >
                  <summary className="cursor-pointer list-none text-lg font-semibold text-slate-950">
                    {item.question}
                  </summary>
                  <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
          <div className="rounded-[2.25rem] border border-slate-950 bg-[linear-gradient(135deg,#0f172a,#134e4a)] p-8 text-white shadow-[0_30px_90px_-45px_rgba(15,23,42,0.75)] sm:p-12">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-200">
              Ready to ship
            </p>
            <h2 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight">
              Turn RouteAlpha into the kind of AI product site investors, customers, and teammates expect to see.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-200">
              The marketing surface is now connected to real product flows, so visitors can move straight from the story into the dashboard or inference playground.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="inline-flex h-12 items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-slate-950 hover:bg-slate-100"
              >
                Open dashboard
              </Link>
              <Link
                href="/infer"
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/30 bg-white/10 px-6 text-sm font-semibold text-white hover:bg-white/15"
              >
                Run a prompt
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.4rem] border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-900">{value}</p>
    </div>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.15rem] border border-white/10 bg-white/5 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold leading-6 text-white">{value}</p>
    </div>
  );
}

function TrustLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-950">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{value}</p>
    </div>
  );
}

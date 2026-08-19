"use client";

import { FormEvent, ReactNode, useState } from "react";
import Link from "next/link";
import { useAuth } from "../../components/AuthProvider";
import Navbar from "../../components/Navbar";
import RequireAuth from "../../components/RequireAuth";

type InferenceResult = {
  request_id: string;
  route_key: string;
  route_reason: string;
  resolved_route_key: string | null;
  fallback_used: boolean;
  fallback_reason: string | null;
  model_used: string;
  task_type: string | null;
  priority: string | null;
  estimated_input_tokens: number;
  estimated_output_tokens: number;
  estimated_cost_usd: number;
  response: string;
  latency_ms: number;
  semantic_category: string | null;
  semantic_similarity: number | null;
  pareto_score: number | null;
  candidate_scores: Record<string, Record<string, number>> | null;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

const PROMPT_PRESETS = [
  "Summarize the tradeoffs between GPT-4o mini and Gemini Flash Lite for customer support routing.",
  "Write a concise onboarding email for a new SaaS user with a friendly but professional tone.",
  "Explain how to optimize a slow SQL query and include a simple example.",
];

export default function InferPage() {
  const { authFetch } = useAuth();
  const [prompt, setPrompt] = useState("");
  const [taskType, setTaskType] = useState("general");
  const [priority, setPriority] = useState("balanced");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<InferenceResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setError("");
    setResult(null);
    setCopied(false);

    try {
      const response = await authFetch(`${API_BASE_URL}/infer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt,
          task_type: taskType,
          priority,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || "Failed to submit inference request.");
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setPrompt("");
    setTaskType("general");
    setPriority("balanced");
    setError("");
    setResult(null);
    setCopied(false);
  }

  async function copyResponse() {
    if (!result) return;

    await navigator.clipboard.writeText(result.response);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <>
      <Navbar />
      <RequireAuth>
        <main className="min-h-screen p-8 text-slate-900">
        <div className="mx-auto max-w-5xl space-y-8">
          <section className="rounded-[2rem] border border-white/70 bg-white/85 p-8 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.28)] backdrop-blur-sm">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-400">
                  Live Playground
                </p>
                <h1 className="mt-3 text-4xl font-bold tracking-tight">
                  Route prompts through the stack with a cleaner operator workflow.
                </h1>
                <p className="mt-3 text-base leading-7 text-slate-600">
                  Submit a prompt, test different priorities, and immediately inspect
                  the route, latency, model choice, and estimated cost.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 lg:max-w-md lg:justify-end">
                <MiniStat label="Mode" value="Realtime" />
                <MiniStat label="Routing" value="Rule-based" />
                <MiniStat label="Visibility" value="Cost + Latency" />
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.28)] backdrop-blur-sm">
            <div className="mb-5 flex flex-col gap-2">
              <h2 className="text-xl font-semibold">New Request</h2>
              <p className="text-sm text-slate-500">
                Start from a preset or write your own prompt to see how RouteAlpha
                chooses a model.
              </p>
            </div>

            <div className="mb-5 flex flex-wrap gap-3">
              {PROMPT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setPrompt(preset)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-left text-sm text-slate-600 hover:border-slate-300 hover:bg-white hover:text-slate-900"
                >
                  {preset}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium">Prompt</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Enter your prompt here..."
                  className="min-h-52 w-full rounded-2xl border border-slate-300 bg-white p-4 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium">Task Type</label>
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-white p-3 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="general">general</option>
                    <option value="education">education</option>
                    <option value="coding">coding</option>
                    <option value="reasoning">reasoning</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-white p-3 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="cheap">cheap</option>
                    <option value="balanced">balanced</option>
                    <option value="quality">quality</option>
                    <option value="fast">fast</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="submit"
                  disabled={loading || !prompt.trim()}
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Submitting..." : "Run Inference"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Reset
                </button>
              </div>
            </form>
          </section>

          {error && (
            <section className="rounded-[2rem] border border-red-200 bg-red-50/90 p-6 shadow-[0_20px_60px_-30px_rgba(239,68,68,0.22)]">
              <h2 className="mb-2 text-lg font-semibold text-red-600">Error</h2>
              <p className="text-red-600">{error}</p>
            </section>
          )}

          {result && (
            <section className="space-y-6 rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.28)] backdrop-blur-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-xl font-semibold">Inference Result</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Review the selected route, model, and response metadata for this run.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={resetForm}
                    className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-slate-900 hover:bg-slate-50"
                  >
                    Run Another Request
                  </button>

                  <Link
                    href="/dashboard"
                    className="rounded-2xl bg-slate-900 px-4 py-2 text-white hover:bg-slate-800"
                  >
                    View Dashboard
                  </Link>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-y border-slate-100 py-4 text-sm">
                <ResultBadge label="Selected" value={result.route_key} tone="blue" />
                <ResultBadge
                  label="Resolved"
                  value={result.resolved_route_key || result.route_key}
                  tone="slate"
                />
                {result.fallback_used ? (
                  <ResultBadge label="Fallback" value="Used" tone="amber" />
                ) : (
                  <ResultBadge label="Fallback" value="Not needed" tone="emerald" />
                )}
                {result.semantic_category && (
                  <ResultBadge
                    label="Semantic match"
                    value={`${result.semantic_category}${
                      result.semantic_similarity !== null
                        ? ` · ${Math.round(result.semantic_similarity * 100)}%`
                        : ""
                    }`}
                    tone="violet"
                  />
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
                <InfoCard label="Request ID" value={result.request_id} />
                <InfoCard label="Route Key" value={result.route_key} />
                <InfoCard label="Route Reason" value={result.route_reason} />
                <InfoCard label="Model Used" value={result.model_used} />
                <InfoCard label="Task Type" value={result.task_type || "-"} />
                <InfoCard label="Priority" value={result.priority || "-"} />
                <InfoCard
                  label="Estimated Input Tokens"
                  value={String(result.estimated_input_tokens)}
                />
                <InfoCard
                  label="Estimated Output Tokens"
                  value={String(result.estimated_output_tokens)}
                />
                <InfoCard
                  label="Estimated Cost"
                  value={`$${result.estimated_cost_usd.toFixed(6)}`}
                />
                <InfoCard
                  label="Latency"
                  value={`${result.latency_ms.toFixed(2)} ms`}
                />
                {result.pareto_score !== null && (
                  <InfoCard
                    label="Pareto Score"
                    value={result.pareto_score.toFixed(4)}
                  />
                )}
              </div>

              {result.fallback_used && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  <span className="font-semibold">Fallback completed: </span>
                  The primary route was unavailable, so RouteAlpha completed this request
                  using a backup route.
                </div>
              )}

              <section
                aria-labelledby="model-response-heading"
                className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80"
              >
                <div className="flex flex-col gap-3 border-b border-slate-200 bg-white/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Generated output
                    </p>
                    <h3 id="model-response-heading" className="mt-1 text-lg font-semibold text-slate-900">
                      Response
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={copyResponse}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                  >
                    {copied ? "Copied" : "Copy response"}
                  </button>
                </div>
                <div className="px-5 py-6 text-[1.02rem] leading-8 text-slate-700">
                  <MarkdownResponse content={result.response} />
                </div>
                <p aria-live="polite" className="sr-only">
                  {copied ? "Response copied to clipboard." : ""}
                </p>
              </section>
            </section>
          )}
        </div>
        </main>
      </RequireAuth>
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[148px] flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-none">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-[1.05rem] font-semibold leading-7 text-slate-900">
        {value}
      </p>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="break-all text-slate-900">{value}</p>
    </div>
  );
}

function ResultBadge({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "blue" | "slate" | "emerald" | "amber" | "violet";
}) {
  const toneClasses = {
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    slate: "border-slate-200 bg-slate-50 text-slate-700",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    violet: "border-violet-200 bg-violet-50 text-violet-800",
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 ${toneClasses[tone]}`}>
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

function MarkdownResponse({ content }: { content: string }) {
  const blocks: ReactNode[] = [];
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const language = line.slice(3).trim();
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push(
        <div key={`code-${index}`} className="my-5 overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
          {language && (
            <div className="border-b border-slate-800 px-4 py-2 text-xs font-medium uppercase tracking-wide text-slate-400">
              {language}
            </div>
          )}
          <pre className="overflow-x-auto p-4 text-sm leading-6 text-slate-100">
            <code>{codeLines.join("\n")}</code>
          </pre>
        </div>
      );
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      const headingClasses = {
        1: "mt-1 text-2xl font-bold tracking-tight text-slate-900",
        2: "mt-7 text-xl font-semibold text-slate-900",
        3: "mt-6 text-lg font-semibold text-slate-900",
      };
      const level = heading[1].length as 1 | 2 | 3;
      const HeadingTag = `h${level}` as "h1" | "h2" | "h3";
      blocks.push(
        <HeadingTag key={`heading-${index}`} className={headingClasses[level]}>
          {renderInlineMarkdown(heading[2])}
        </HeadingTag>
      );
      index += 1;
      continue;
    }

    const unordered = /^[-*+]\s+(.+)$/.exec(line);
    if (unordered) {
      const items: string[] = [];
      while (index < lines.length) {
        const item = /^[-*+]\s+(.+)$/.exec(lines[index]);
        if (!item) break;
        items.push(item[1]);
        index += 1;
      }
      blocks.push(
        <ul key={`unordered-${index}`} className="my-4 list-disc space-y-2 pl-6 marker:text-slate-400">
          {items.map((item, itemIndex) => <li key={itemIndex}>{renderInlineMarkdown(item)}</li>)}
        </ul>
      );
      continue;
    }

    const ordered = /^\d+\.\s+(.+)$/.exec(line);
    if (ordered) {
      const items: string[] = [];
      while (index < lines.length) {
        const item = /^\d+\.\s+(.+)$/.exec(lines[index]);
        if (!item) break;
        items.push(item[1]);
        index += 1;
      }
      blocks.push(
        <ol key={`ordered-${index}`} className="my-4 list-decimal space-y-3 pl-6 marker:font-semibold marker:text-slate-500">
          {items.map((item, itemIndex) => <li key={itemIndex}>{renderInlineMarkdown(item)}</li>)}
        </ol>
      );
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length && lines[index].trim()) {
      if (lines[index].startsWith("```") || /^(#{1,3})\s+/.test(lines[index]) || /^[-*+]\s+/.test(lines[index]) || /^\d+\.\s+/.test(lines[index])) {
        break;
      }
      paragraphLines.push(lines[index]);
      index += 1;
    }
    blocks.push(
      <p key={`paragraph-${index}`} className="mb-4 last:mb-0">
        {renderInlineMarkdown(paragraphLines.join(" "))}
      </p>
    );
  }

  return <>{blocks}</>;
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const segments = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);

  return segments.map((segment, index) => {
    if (segment.startsWith("**") && segment.endsWith("**")) {
      return <strong key={index} className="font-semibold text-slate-900">{segment.slice(2, -2)}</strong>;
    }
    if (segment.startsWith("`") && segment.endsWith("`")) {
      return <code key={index} className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[0.88em] text-slate-800">{segment.slice(1, -1)}</code>;
    }
    return segment;
  });
}

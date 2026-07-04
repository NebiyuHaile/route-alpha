"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useAuth } from "./AuthProvider";
import Navbar from "./Navbar";
import RequireAuth from "./RequireAuth";

type InferenceResult = {
  request_id: string;
  route_key: string;
  route_reason: string;
  model_used: string;
  task_type: string | null;
  priority: string | null;
  estimated_input_tokens: number;
  estimated_output_tokens: number;
  estimated_cost_usd: number;
  response: string;
  latency_ms: number;
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

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setLoading(true);
    setError("");
    setResult(null);

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
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500">
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
                <label htmlFor="infer-prompt" className="mb-2 block text-sm font-medium">
                  Prompt
                </label>
                <textarea
                  id="infer-prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Enter your prompt here..."
                  className="min-h-52 w-full rounded-2xl border border-slate-300 bg-white p-4 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="infer-task-type" className="mb-2 block text-sm font-medium">
                    Task Type
                  </label>
                  <select
                    id="infer-task-type"
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
                  <label htmlFor="infer-priority" className="mb-2 block text-sm font-medium">
                    Priority
                  </label>
                  <select
                    id="infer-priority"
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
                  className="inline-flex h-12 items-center justify-center rounded-full bg-slate-900 px-6 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Submitting..." : "Run Inference"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex h-12 items-center justify-center rounded-full border border-slate-300 bg-white px-6 text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"
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
                    className="inline-flex h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-5 text-sm font-medium text-slate-900 hover:border-slate-400 hover:bg-slate-50"
                  >
                    Run Another Request
                  </button>

                  <Link
                    href="/dashboard"
                    className="inline-flex h-11 items-center justify-center rounded-full bg-slate-900 px-5 text-sm font-medium text-white hover:bg-slate-800"
                  >
                    View Dashboard
                  </Link>
                </div>
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
              </div>

              <div>
                <h3 className="mb-2 text-lg font-semibold">Response</h3>
                <div className="whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-4 leading-7">
                  {result.response}
                </div>
              </div>
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
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
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

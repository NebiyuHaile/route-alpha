"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

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

export default function InferPage() {
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
      const response = await fetch(`${API_BASE_URL}/infer`, {
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
    <main className="min-h-screen bg-slate-50 text-slate-900 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold">RouteAlpha Inference</h1>
            <p className="text-slate-600 mt-2">
              Submit a prompt and see how RouteAlpha routes it.
            </p>
          </div>

          <Link
            href="/"
            className="px-4 py-2 rounded-xl bg-slate-900 text-white"
          >
            Back to Dashboard
          </Link>
        </div>

        <section className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-semibold mb-4">New Request</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter your prompt here..."
                className="w-full min-h-45 rounded-xl border border-slate-300 p-4 outline-none focus:ring-2 focus:ring-slate-400"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Task Type
                </label>
                <select
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:ring-2 focus:ring-slate-400"
                >
                  <option value="general">general</option>
                  <option value="education">education</option>
                  <option value="coding">coding</option>
                  <option value="reasoning">reasoning</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 p-3 outline-none focus:ring-2 focus:ring-slate-400"
                >
                  <option value="cheap">cheap</option>
                  <option value="balanced">balanced</option>
                  <option value="quality">quality</option>
                  <option value="fast">fast</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="px-5 py-3 rounded-xl bg-slate-900 text-white disabled:opacity-60"
            >
              {loading ? "Submitting..." : "Run Inference"}
            </button>
          </form>
        </section>

        {error && (
          <section className="rounded-2xl bg-white shadow-sm border border-red-200 p-6">
            <h2 className="text-lg font-semibold text-red-600 mb-2">Error</h2>
            <p className="text-red-600">{error}</p>
          </section>
        )}

        {result && (
            <section className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <h2 className="text-xl font-semibold">Inference Result</h2>

            <div className="flex gap-3">
                <button
                onClick={resetForm}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 hover:bg-slate-100 transition"
                >
                Run Another Request
                </button>

                <Link
                href="/"
                className="px-4 py-2 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition"
                >
                View Dashboard
                </Link>
            </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
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
            <h3 className="text-lg font-semibold mb-2">Response</h3>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 whitespace-pre-wrap leading-7">
                {result.response}
            </div>
            </div>
        </section>
        )}
      </div>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4 bg-slate-50">
      <p className="text-xs uppercase tracking-wide text-slate-500 mb-1">
        {label}
      </p>
      <p className="break-all">{value}</p>
    </div>
  );
}
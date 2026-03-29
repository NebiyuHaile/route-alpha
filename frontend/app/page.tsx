"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "../components/Navbar";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type SummaryData = {
  total_requests: number;
  average_latency_ms: number;
  total_estimated_cost_usd: number;
};

type RouteData = {
  route_key: string;
  count: number;
};

type ModelData = {
  model_used: string;
  count: number;
};

type CostData = {
  model_used: string;
  total_estimated_cost_usd: number;
};

type LatencyData = {
  model_used: string;
  average_latency_ms: number;
};

type RecentRequest = {
  request_id: string;
  task_type: string | null;
  priority: string | null;
  route_key: string;
  model_used: string;
  estimated_cost_usd: number;
  latency_ms: number;
  created_at: string | null;
};

type ChartRow = Record<string, string | number>;

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

function formatModelLabel(model: string) {
  if (model.includes("gemini-2.0-flash-lite-001")) return "gemini-flash-lite";
  if (model.includes("gpt-4o-mini")) return "gpt-4o-mini";
  return model;
}

function formatCost(value: number) {
  return `$${value.toFixed(6)}`;
}

function formatLatency(value: number) {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2)} s`;
  }
  return `${value.toFixed(2)} ms`;
}



function getRouteBadgeClass(route: string) {
  switch (route) {
    case "cheap":
      return "bg-slate-100 text-slate-700";
    case "medium":
      return "bg-blue-100 text-blue-700";
    case "strong":
      return "bg-slate-900 text-white";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function getPriorityBadgeClass(priority: string) {
  switch (priority) {
    case "cheap":
      return "bg-emerald-100 text-emerald-700";
    case "balanced":
      return "bg-blue-100 text-blue-700";
    case "quality":
      return "bg-purple-100 text-purple-700";
    case "fast":
      return "bg-amber-100 text-amber-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}


export default function Home() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [selectedRoute, setSelectedRoute] = useState("all");
  const [models, setModels] = useState<ModelData[]>([]);
  const [selectedModel, setSelectedModel] = useState("all");
  const [costs, setCosts] = useState<CostData[]>([]);
  const [latency, setLatency] = useState<LatencyData[]>([]);
  const [recentRequests, setRecentRequests] = useState<RecentRequest[]>([]);
  const [recentLimit, setRecentLimit] = useState(10);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const [
        summaryRes,
        routesRes,
        modelsRes,
        costsRes,
        latencyRes,
        recentRes,
      ] = await Promise.all([
        fetch(`${API_BASE_URL}/analytics/summary`, { cache: "no-store" }),
        fetch(`${API_BASE_URL}/analytics/routes`, { cache: "no-store" }),
        fetch(`${API_BASE_URL}/analytics/models`, { cache: "no-store" }),
        fetch(`${API_BASE_URL}/analytics/costs`, { cache: "no-store" }),
        fetch(`${API_BASE_URL}/analytics/latency`, { cache: "no-store" }),
        fetch(`${API_BASE_URL}/analytics/recent?limit=${recentLimit}`, {cache: "no-store",}),
      ]);

      if (
        !summaryRes.ok ||
        !routesRes.ok ||
        !modelsRes.ok ||
        !costsRes.ok ||
        !latencyRes.ok ||
        !recentRes.ok
      ) {
        throw new Error("Failed to load dashboard analytics.");
      }

      const summaryData = await summaryRes.json();
      const routesData = await routesRes.json();
      const modelsData = await modelsRes.json();
      const costsData = await costsRes.json();
      const latencyData = await latencyRes.json();
      const recentData = await recentRes.json();

      setSummary(summaryData);
      setRoutes(routesData);
      setModels(modelsData);
      setCosts(costsData);
      setLatency(latencyData);
      setRecentRequests(recentData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [recentLimit]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const formattedModels = models.map((item) => ({
    ...item,
    short_label: formatModelLabel(item.model_used),
    full_label: item.model_used,
  }));

  const formattedCosts = costs.map((item) => ({
    ...item,
    short_label: formatModelLabel(item.model_used),
    full_label: item.model_used,
  }));

  const formattedLatency = latency.map((item) => ({
    ...item,
    short_label: formatModelLabel(item.model_used),
    full_label: item.model_used,
  }));

  const filteredRecentRequests = recentRequests
    .filter((row) =>
      selectedRoute === "all" ? true : row.route_key === selectedRoute
    )
    .filter((row) =>
      selectedModel === "all"
        ? true
        : formatModelLabel(row.model_used) === selectedModel
    )
    .filter((row) => {
      const searchValue = searchTerm.toLowerCase();

      return (
        (row.task_type || "").toLowerCase().includes(searchValue) ||
        (row.priority || "").toLowerCase().includes(searchValue) ||
        row.route_key.toLowerCase().includes(searchValue) ||
        row.model_used.toLowerCase().includes(searchValue)
      );
    });

  if (loading) {
    return (
      <main className="min-h-screen p-8 bg-white text-black">
        <h1 className="text-3xl font-bold mb-4">RouteAlpha Dashboard</h1>
        <p>Loading analytics...</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen p-8 bg-white text-black">
        <h1 className="text-3xl font-bold mb-4">RouteAlpha Dashboard</h1>
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={() => loadDashboard(true)}
          className="px-4 py-2 rounded-lg bg-slate-900 text-white"
        >
          Retry
        </button>
      </main>
    );
  }

  return (
  <>
    <Navbar />
    <main className="min-h-screen bg-slate-50 text-slate-900 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
    <main className="min-h-screen bg-slate-50 text-slate-900 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold">RouteAlpha Dashboard</h1>
            <p className="text-slate-600 mt-2">
              Analytics overview for model routing, cost, and latency.
            </p>
          </div>
        </div>
          

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card
            title="Total Requests"
            value={summary?.total_requests?.toString() || "0"}
          />
          <Card
            title="Average Latency"
            value={formatLatency(summary?.average_latency_ms ?? 0)}
          />
          <Card
            title="Total Estimated Cost"
            value={formatCost(summary?.total_estimated_cost_usd ?? 0)}
          />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Route Breakdown">
            <SimpleBarChart data={routes} xKey="route_key" barKey="count" />
          </ChartCard>

          <ChartCard title="Model Breakdown">
            <SimpleBarChart
              data={formattedModels}
              xKey="short_label"
              barKey="count"
              tooltipLabelKey="full_label"
            />
          </ChartCard>

          <ChartCard title="Cost by Model">
            <SimpleBarChart
              data={formattedCosts}
              xKey="short_label"
              barKey="total_estimated_cost_usd"
              tooltipLabelKey="full_label"
            />
          </ChartCard>

          <ChartCard title="Average Latency by Model">
            <SimpleBarChart
              data={formattedLatency}
              xKey="short_label"
              barKey="average_latency_ms"
              tooltipLabelKey="full_label"
            />
          </ChartCard>
        </section>

        <section className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 mb-4">
            <h2 className="text-xl font-semibold">Recent Requests</h2>

            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium uppercase tracking-wide text-slate-800">
                  Route
                </label>
                <select
                  value={selectedRoute}
                  onChange={(e) => setSelectedRoute(e.target.value)}
                  className="h-10 rounded-lg border border-slate-300 px-3 text-sm bg-white min-w-30"
                >
                  <option value="all">all</option>
                  <option value="cheap">cheap</option>
                  <option value="medium">medium</option>
                  <option value="strong">strong</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium uppercase tracking-wide text-slate-800">
                  Model
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="h-10 rounded-lg border border-slate-300 px-3 text-sm bg-white min-w-40"
                >
                  <option value="all">all</option>
                  <option value="gemini-flash-lite">gemini-flash-lite</option>
                  <option value="gpt-4o-mini">gpt-4o-mini</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium uppercase tracking-wide text-slate-800">
                  Show
                </label>
                <select
                  value={recentLimit}
                  onChange={(e) => setRecentLimit(Number(e.target.value))}
                  className="h-10 rounded-lg border border-slate-300 px-3 text-sm bg-white min-w-22.5"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium uppercase tracking-wide text-slate-800">
                  Search
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="task, route, model..."
                  className="h-10 rounded-lg border border-slate-300 px-3 text-sm bg-white min-w-60"
                />
              </div>
            </div>
          </div>
            <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th className="py-3 pr-4">Task</th>
                  <th className="py-3 pr-4">Priority</th>
                  <th className="py-3 pr-4">Route</th>
                  <th className="py-3 pr-4">Model</th>
                  <th className="py-3 pr-4">Cost</th>
                  <th className="py-3 pr-4">Latency</th>
                  <th className="py-3 pr-4">Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecentRequests.map((row) => (
                  <tr key={row.request_id} className="border-b border-slate-100">
                    <td className="py-3 pr-4">{row.task_type || "-"}</td>
                    <td className="py-3 pr-4">
                      {row.priority ? (
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getPriorityBadgeClass(
                            row.priority
                          )}`}
                        >
                          {row.priority}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${getRouteBadgeClass(
                          row.route_key
                        )}`}
                      >
                        {row.route_key}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      {formatModelLabel(row.model_used)}
                    </td>
                    <td className="py-3 pr-4">
                      {formatCost(row.estimated_cost_usd)}
                    </td>
                    <td className="py-3 pr-4">
                      {formatLatency(row.latency_ms)}
                    </td>
                    <td className="py-3 pr-4">
                      {row.created_at
                        ? new Date(row.created_at).toLocaleString()
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
    </div>
    </main>
    </>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6">
      <p className="text-sm text-slate-500">{title}</p>
      <h2 className="text-3xl font-semibold mt-2">{value}</h2>
    </div>
  );
}

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6">
      <h2 className="text-xl font-semibold mb-4">{title}</h2>
      <div className="h-80">{children}</div>
    </div>
  );
}

function SimpleBarChart({
  data,
  xKey,
  barKey,
  tooltipLabelKey,
}: {
  data: ChartRow[];
  xKey: string;
  barKey: string;
  tooltipLabelKey?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey={xKey}
          angle={-15}
          textAnchor="end"
          interval={0}
          height={60}
        />
        <YAxis />
        <Tooltip
          formatter={(value) => [value, barKey]}
          labelFormatter={(_, payload) => {
            if (
              tooltipLabelKey &&
              payload &&
              payload.length > 0 &&
              payload[0].payload?.[tooltipLabelKey]
            ) {
              return payload[0].payload[tooltipLabelKey];
            }
            return _;
          }}
        />
        <Bar dataKey={barKey} />
      </BarChart>
    </ResponsiveContainer>
  );
}
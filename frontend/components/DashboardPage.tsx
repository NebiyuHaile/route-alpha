"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import Navbar from "./Navbar";
import RequireAuth from "./RequireAuth";
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
  fallback_requests?: number;
  fallback_rate_pct?: number;
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
  resolved_route_key?: string | null;
  fallback_used?: boolean;
  model_used: string;
  estimated_cost_usd: number;
  latency_ms: number;
  created_at: string | null;
};

type ChartRow = Record<string, string | number>;

type SortColumn =
  | "task_type"
  | "priority"
  | "route_key"
  | "model_used"
  | "estimated_cost_usd"
  | "latency_ms"
  | "created_at";

type SortDirection = "asc" | "desc";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

const DEFAULT_SORT = {
  column: "created_at" as SortColumn,
  direction: "desc" as SortDirection,
};

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

function formatMetricValue(metric: string, value: number) {
  switch (metric) {
    case "total_estimated_cost_usd":
      return formatCost(value);
    case "average_latency_ms":
      return formatLatency(value);
    case "count":
      return value.toLocaleString();
    default:
      return value.toLocaleString(undefined, {
        maximumFractionDigits: 2,
      });
  }
}

function getMetricLabel(metric: string) {
  switch (metric) {
    case "total_estimated_cost_usd":
      return "Estimated cost";
    case "average_latency_ms":
      return "Average latency";
    case "count":
      return "Requests";
    default:
      return metric
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
  }
}

function formatChartInsightLabel(label: string) {
  return label.replace(/-/g, " ");
}

function getResolvedRouteLabel(row: RecentRequest) {
  return row.resolved_route_key || row.route_key;
}

function getFallbackBadgeClass(fallbackUsed: boolean) {
  return fallbackUsed
    ? "border border-amber-200 bg-amber-50 text-amber-700"
    : "border border-emerald-200 bg-emerald-50 text-emerald-700";
}

function getRouteBadgeClass(route: string) {
  switch (route) {
    case "cheap":
      return "border border-slate-200 bg-slate-100 text-slate-700";
    case "medium":
      return "border border-blue-200 bg-blue-50 text-blue-700";
    case "strong":
      return "border border-slate-900 bg-slate-900 text-white";
    default:
      return "border border-slate-200 bg-slate-100 text-slate-700";
  }
}

function getPriorityBadgeClass(priority: string) {
  switch (priority) {
    case "cheap":
      return "border border-emerald-200 bg-emerald-50 text-emerald-700";
    case "balanced":
      return "border border-blue-200 bg-blue-50 text-blue-700";
    case "quality":
      return "border border-violet-200 bg-violet-50 text-violet-700";
    case "fast":
      return "border border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border border-slate-200 bg-slate-100 text-slate-700";
  }
}

function getSortValue(row: RecentRequest, column: SortColumn) {
  switch (column) {
    case "task_type":
      return row.task_type ?? "";
    case "priority":
      return row.priority ?? "";
    case "route_key":
      return row.route_key;
    case "model_used":
      return formatModelLabel(row.model_used);
    case "estimated_cost_usd":
      return row.estimated_cost_usd;
    case "latency_ms":
      return row.latency_ms;
    case "created_at":
      return row.created_at ? new Date(row.created_at).getTime() : 0;
  }
}

function compareRecentRequests(
  left: RecentRequest,
  right: RecentRequest,
  column: SortColumn,
  direction: SortDirection
) {
  const leftValue = getSortValue(left, column);
  const rightValue = getSortValue(right, column);

  let result = 0;

  if (typeof leftValue === "number" && typeof rightValue === "number") {
    result = leftValue - rightValue;
  } else {
    result = String(leftValue).localeCompare(String(rightValue), undefined, {
      sensitivity: "base",
      numeric: true,
    });
  }

  return direction === "asc" ? result : -result;
}


export default function Home() {
  const { authFetch, isAuthenticated, isReady } = useAuth();
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
  const [sortColumn, setSortColumn] = useState<SortColumn>(DEFAULT_SORT.column);
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    DEFAULT_SORT.direction
  );
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recentLoading, setRecentLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh || hasLoadedOnce) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setRecentLoading(true);
      setError("");

      const [
        summaryRes,
        routesRes,
        modelsRes,
        costsRes,
        latencyRes,
        recentRes,
      ] = await Promise.all([
        authFetch(`${API_BASE_URL}/analytics/summary`, { cache: "no-store" }),
        authFetch(`${API_BASE_URL}/analytics/routes`, { cache: "no-store" }),
        authFetch(`${API_BASE_URL}/analytics/models`, { cache: "no-store" }),
        authFetch(`${API_BASE_URL}/analytics/costs`, { cache: "no-store" }),
        authFetch(`${API_BASE_URL}/analytics/latency`, { cache: "no-store" }),
        authFetch(`${API_BASE_URL}/analytics/recent?limit=${recentLimit}`, {
          cache: "no-store",
        }),
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
      setHasLoadedOnce(true);
      setLoading(false);
      setRecentLoading(false);
      setRefreshing(false);
    }
  }, [authFetch, hasLoadedOnce, recentLimit]);

  useEffect(() => {
    if (isReady && isAuthenticated) {
      loadDashboard();
    }
  }, [isAuthenticated, isReady, loadDashboard]);

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

  const topRoute = [...routes].sort((left, right) => right.count - left.count)[0];
  const mostUsedModel = [...models].sort((left, right) => right.count - left.count)[0];
  const fastestModel = [...latency].sort(
    (left, right) => left.average_latency_ms - right.average_latency_ms
  )[0];
  const fallbackRequests = summary?.fallback_requests ?? 0;
  const fallbackRate = summary?.fallback_rate_pct ?? 0;

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
      const searchValue = searchTerm.toLowerCase().trim();

      return (
        (row.task_type || "").toLowerCase().includes(searchValue) ||
        (row.priority || "").toLowerCase().includes(searchValue) ||
        row.route_key.toLowerCase().includes(searchValue) ||
        getResolvedRouteLabel(row).toLowerCase().includes(searchValue) ||
        (row.fallback_used ? "fallback" : "primary").includes(searchValue) ||
        row.model_used.toLowerCase().includes(searchValue)
      );
    })
    .sort((left, right) =>
      compareRecentRequests(left, right, sortColumn, sortDirection)
    );

  const hasAnyRequests = recentRequests.length > 0;
  const hasActiveFilters =
    selectedRoute !== "all" || selectedModel !== "all" || searchTerm.trim() !== "";

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortColumn(column);
    setSortDirection(column === "created_at" ? "desc" : "asc");
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
          <div className="mx-auto max-w-7xl space-y-8">
            <div>
              <h1 className="text-4xl font-bold">RouteAlpha Dashboard</h1>
              <p className="mt-2 text-slate-600">
                Analytics overview for model routing, cost, and latency.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="space-y-3">
                <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
                <div className="h-10 w-72 animate-pulse rounded bg-slate-200" />
                <div className="h-4 w-56 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          </div>
        </main>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
          <div className="mx-auto max-w-7xl space-y-8">
            <div>
              <h1 className="text-4xl font-bold">RouteAlpha Dashboard</h1>
              <p className="mt-2 text-slate-600">
                Analytics overview for model routing, cost, and latency.
              </p>
            </div>
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
              <p className="mb-4 text-red-700">{error}</p>
              <button
                onClick={() => loadDashboard(true)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-700"
              >
                Retry
              </button>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <RequireAuth>
        <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
          <div className="mx-auto max-w-7xl space-y-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl font-bold">RouteAlpha Dashboard</h1>
              <p className="mt-2 text-slate-600">
                Analytics overview for model routing, cost, and latency.
              </p>
            </div>

            <button
              onClick={() => loadDashboard(true)}
              disabled={refreshing}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {refreshing ? "Refreshing..." : "Refresh dashboard"}
            </button>
          </div>

          <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
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

          <section className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <InsightCard
              eyebrow="Most Active Route"
              title={topRoute ? formatChartInsightLabel(topRoute.route_key) : "No data yet"}
              detail={
                topRoute
                  ? `${topRoute.count.toLocaleString()} routed requests recorded`
                  : "Requests will populate this signal once traffic reaches the dashboard."
              }
            />
            <InsightCard
              eyebrow="Most Used Model"
              title={
                mostUsedModel
                  ? formatModelLabel(mostUsedModel.model_used)
                  : "No data yet"
              }
              detail={
                mostUsedModel
                  ? `${mostUsedModel.count.toLocaleString()} requests selected this model`
                  : "Model usage insights appear after the first completed request."
              }
            />
            <InsightCard
              eyebrow="Fastest Average"
              title={
                fastestModel
                  ? formatModelLabel(fastestModel.model_used)
                  : "No data yet"
              }
              detail={
                fastestModel
                  ? `${formatLatency(fastestModel.average_latency_ms)} average response time`
                  : "Latency rankings appear once recent inference data is available."
              }
            />
            <InsightCard
              eyebrow="Fallback Activity"
              title={fallbackRequests ? `${fallbackRequests.toLocaleString()} reroutes` : "No reroutes yet"}
              detail={
                fallbackRequests
                  ? `${fallbackRate.toFixed(2)}% of requests resolved on a fallback route instead of the primary pick.`
                  : "Requests are currently resolving on their primary route without needing a backup path."
              }
            />
          </section>

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="text-xl font-semibold">Recent Requests</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Sorted by newest request by default. Click any column header to
                  reorder the table.
                </p>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="recent-route-filter" className="text-xs font-medium uppercase tracking-wide text-slate-800">
                    Route
                  </label>
                  <select
                    id="recent-route-filter"
                    value={selectedRoute}
                    onChange={(e) => setSelectedRoute(e.target.value)}
                    className="h-10 min-w-32 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value="all">all</option>
                    <option value="cheap">cheap</option>
                    <option value="medium">medium</option>
                    <option value="strong">strong</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="recent-model-filter" className="text-xs font-medium uppercase tracking-wide text-slate-800">
                    Model
                  </label>
                  <select
                    id="recent-model-filter"
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="h-10 min-w-40 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value="all">all</option>
                    <option value="gemini-flash-lite">gemini-flash-lite</option>
                    <option value="gpt-4o-mini">gpt-4o-mini</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="recent-limit" className="text-xs font-medium uppercase tracking-wide text-slate-800">
                    Show
                  </label>
                  <select
                    id="recent-limit"
                    value={recentLimit}
                    onChange={(e) => setRecentLimit(Number(e.target.value))}
                    className="h-10 min-w-24 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="recent-search" className="text-xs font-medium uppercase tracking-wide text-slate-800">
                    Search
                  </label>
                  <input
                    id="recent-search"
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="task, route, model..."
                    className="h-10 min-w-60 rounded-lg border border-slate-300 bg-white px-3 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-y-2 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <SortableHeader
                      label="Task"
                      column="task_type"
                      activeColumn={sortColumn}
                      direction={sortDirection}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Priority"
                      column="priority"
                      activeColumn={sortColumn}
                      direction={sortDirection}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Route"
                      column="route_key"
                      activeColumn={sortColumn}
                      direction={sortDirection}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Model"
                      column="model_used"
                      activeColumn={sortColumn}
                      direction={sortDirection}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Cost"
                      column="estimated_cost_usd"
                      activeColumn={sortColumn}
                      direction={sortDirection}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Latency"
                      column="latency_ms"
                      activeColumn={sortColumn}
                      direction={sortDirection}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Created"
                      column="created_at"
                      activeColumn={sortColumn}
                      direction={sortDirection}
                      onSort={handleSort}
                    />
                  </tr>
                </thead>
                <tbody>
                  {recentLoading ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-10 text-center text-slate-500"
                      >
                        Loading recent requests...
                      </td>
                    </tr>
                  ) : !hasAnyRequests ? (
                    <tr>
                      <td colSpan={7} className="py-4">
                        <EmptyStateCard
                          title="No requests yet"
                          description="The database does not have any requests yet. Once inference runs start coming in, they will show up here."
                        />
                      </td>
                    </tr>
                  ) : filteredRecentRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-4">
                        <EmptyStateCard
                          title="No matching requests"
                          description={
                            hasActiveFilters
                              ? "No requests match the current search or filter combination."
                              : "No requests are available for the current table view."
                          }
                        />
                      </td>
                    </tr>
                  ) : (
                    filteredRecentRequests.map((row) => (
                      <tr key={row.request_id} className="rounded-2xl shadow-sm">
                        <td className="rounded-l-2xl border border-r-0 border-slate-200 bg-white px-4 py-4 align-middle">
                          <div className="font-medium text-slate-900">
                            {row.task_type || "-"}
                          </div>
                        </td>

                        <td className="border border-l-0 border-r-0 border-slate-200 bg-white px-4 py-4 align-middle">
                          {row.priority ? (
                            <span
                              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getPriorityBadgeClass(
                                row.priority
                              )}`}
                            >
                              {row.priority}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        <td className="border border-l-0 border-r-0 border-slate-200 bg-white px-4 py-4 align-middle">
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getRouteBadgeClass(
                                  row.route_key
                                )}`}
                              >
                                {row.route_key}
                              </span>
                              <span
                                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getFallbackBadgeClass(
                                  Boolean(row.fallback_used)
                                )}`}
                              >
                                {row.fallback_used ? "Fallback" : "Primary"}
                              </span>
                            </div>
                            {row.fallback_used && row.resolved_route_key ? (
                              <p className="text-xs text-slate-500">
                                Resolved on{" "}
                                <span className="font-medium text-slate-700">
                                  {row.resolved_route_key}
                                </span>
                              </p>
                            ) : null}
                          </div>
                        </td>

                        <td className="border border-l-0 border-r-0 border-slate-200 bg-white px-4 py-4 align-middle text-slate-700">
                          {formatModelLabel(row.model_used)}
                        </td>

                        <td className="border border-l-0 border-r-0 border-slate-200 bg-white px-4 py-4 align-middle font-medium text-slate-900">
                          {formatCost(row.estimated_cost_usd)}
                        </td>

                        <td className="border border-l-0 border-r-0 border-slate-200 bg-white px-4 py-4 align-middle text-slate-700">
                          {formatLatency(row.latency_ms)}
                        </td>

                        <td className="rounded-r-2xl border border-l-0 border-slate-200 bg-white px-4 py-4 align-middle text-slate-500">
                          {row.created_at
                            ? new Date(row.created_at).toLocaleString()
                            : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
          </div>
        </main>
      </RequireAuth>
    </>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-[0_16px_50px_-24px_rgba(15,23,42,0.24)] backdrop-blur-sm">
      <p className="text-sm text-slate-500">{title}</p>
      <h2 className="mt-2 text-3xl font-semibold">{value}</h2>
    </div>
  );
}

function InsightCard({
  eyebrow,
  title,
  detail,
}: {
  eyebrow: string;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200/80 bg-linear-to-br from-white to-slate-50 p-5 shadow-[0_12px_36px_-28px_rgba(15,23,42,0.35)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
        {eyebrow}
      </p>
      <h3 className="mt-3 text-xl font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{detail}</p>
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
    <div className="rounded-3xl border border-white/70 bg-white/85 p-6 shadow-[0_16px_50px_-24px_rgba(15,23,42,0.24)] backdrop-blur-sm">
      <h2 className="mb-4 text-xl font-semibold">{title}</h2>
      <div className="h-80">{children}</div>
    </div>
  );
}

function EmptyStateCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
        {description}
      </p>
    </div>
  );
}

function SortableHeader({
  label,
  column,
  activeColumn,
  direction,
  onSort,
}: {
  label: string;
  column: SortColumn;
  activeColumn: SortColumn;
  direction: SortDirection;
  onSort: (column: SortColumn) => void;
}) {
  const isActive = activeColumn === column;
  const indicator = isActive ? (direction === "asc" ? "▲" : "▼") : "↕";

  return (
    <th className="px-4 py-3 font-medium">
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-2 transition ${
          isActive ? "text-slate-900" : "text-slate-500 hover:text-slate-700"
        }`}
      >
        <span>{label}</span>
        <span className="text-[10px]">{indicator}</span>
      </button>
    </th>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  metricKey,
  tooltipLabelKey,
}: {
  active?: boolean;
  payload?: Array<{
    value?: number | string;
    color?: string;
    payload?: ChartRow;
  }>;
  label?: string | number;
  metricKey: string;
  tooltipLabelKey?: string;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const dataPoint = payload[0];
  const rawValue = dataPoint.value;
  const numericValue =
    typeof rawValue === "number" ? rawValue : Number(rawValue ?? 0);

  const title =
    tooltipLabelKey && dataPoint.payload?.[tooltipLabelKey]
      ? String(dataPoint.payload[tooltipLabelKey])
      : String(label ?? "");

  return (
    <div className="min-w-56 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-xl shadow-slate-200/70 backdrop-blur-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        Model
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{title}</p>
      <div className="mt-3 flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: dataPoint.color ?? "#0f172a" }}
          />
          <span className="text-xs font-medium text-slate-500">
            {getMetricLabel(metricKey)}
          </span>
        </div>
        <span className="text-sm font-semibold text-slate-900">
          {formatMetricValue(metricKey, numericValue)}
        </span>
      </div>
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
        <CartesianGrid stroke="#cbd5e1" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey={xKey}
          angle={-15}
          textAnchor="end"
          interval={0}
          height={60}
          tick={{ fill: "#64748b", fontSize: 12 }}
          tickLine={false}
          axisLine={{ stroke: "#cbd5e1" }}
        />
        <YAxis
          tick={{ fill: "#64748b", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: "#e2e8f0", fillOpacity: 0.45 }}
          content={
            <ChartTooltip
              metricKey={barKey}
              tooltipLabelKey={tooltipLabelKey}
            />
          }
        />
        <Bar
          dataKey={barKey}
          fill="#0f172a"
          radius={[12, 12, 0, 0]}
          activeBar={{
            fill: "#1d4ed8",
            stroke: "#dbeafe",
            strokeWidth: 2,
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

"use client";

import { useEffect, useState } from "react";
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

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";


export default function Home() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [models, setModels] = useState<ModelData[]>([]);
  const [costs, setCosts] = useState<CostData[]>([]);
  const [latency, setLatency] = useState<LatencyData[]>([]);
  const [recentRequests, setRecentRequests] = useState<RecentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      try {
        const [
          summaryRes,
          routesRes,
          modelsRes,
          costsRes,
          latencyRes,
          recentRes,
        ] = await Promise.all([
          fetch(`${API_BASE_URL}/analytics/summary`),
          fetch(`${API_BASE_URL}/analytics/routes`),
          fetch(`${API_BASE_URL}/analytics/models`),
          fetch(`${API_BASE_URL}/analytics/costs`),
          fetch(`${API_BASE_URL}/analytics/latency`),
          fetch(`${API_BASE_URL}/analytics/recent`),
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
      }
    }

    loadDashboard();
  }, []);

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
        <p className="text-red-600">{error}</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold">RouteAlpha Dashboard</h1>
          <p className="text-slate-600 mt-2">
            Analytics overview for model routing, cost, and latency.
          </p>
        </div>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card
            title="Total Requests"
            value={summary?.total_requests?.toString() || "0"}
          />
          <Card
            title="Average Latency"
            value={`${summary?.average_latency_ms ?? 0} ms`}
          />
          <Card
            title="Total Estimated Cost"
            value={`$${summary?.total_estimated_cost_usd ?? 0}`}
          />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Route Breakdown">
            <SimpleBarChart
              data={routes}
              xKey="route_key"
              barKey="count"
            />
          </ChartCard>

          <ChartCard title="Model Breakdown">
            <SimpleBarChart
              data={models}
              xKey="model_used"
              barKey="count"
            />
          </ChartCard>

          <ChartCard title="Cost by Model">
            <SimpleBarChart
              data={costs}
              xKey="model_used"
              barKey="total_estimated_cost_usd"
            />
          </ChartCard>

          <ChartCard title="Average Latency by Model">
            <SimpleBarChart
              data={latency}
              xKey="model_used"
              barKey="average_latency_ms"
            />
          </ChartCard>

          <section className="rounded-2xl bg-white shadow-sm border border-slate-200 p-6">
              <h2 className="text-xl font-semibold mb-4">Recent Requests</h2>

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
                    {recentRequests.map((row) => (
                      <tr key={row.request_id} className="border-b border-slate-100">
                        <td className="py-3 pr-4">{row.task_type || "-"}</td>
                        <td className="py-3 pr-4">{row.priority || "-"}</td>
                        <td className="py-3 pr-4">{row.route_key}</td>
                        <td className="py-3 pr-4 break-all">{row.model_used}</td>
                        <td className="py-3 pr-4">${row.estimated_cost_usd}</td>
                        <td className="py-3 pr-4">{row.latency_ms} ms</td>
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
        </section>
      </div>
    </main>
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
}: {
  data: Record<string, string | number>[];
  xKey: string;
  barKey: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xKey} hide={false} />
        <YAxis />
        <Tooltip />
        <Bar dataKey={barKey} />
      </BarChart>
    </ResponsiveContainer>
  );
}
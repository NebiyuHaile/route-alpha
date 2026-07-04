"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "./Navbar";
import { useAuth } from "./AuthProvider";

type Mode = "login" | "register";

export default function AuthPage() {
  return (
    <Suspense fallback={<AuthPageShell />}>
      <AuthPageContent />
    </Suspense>
  );
}

function AuthPageContent() {
  const [mode, setMode] = useState<Mode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { isAuthenticated, isReady, login, register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/dashboard";

  useEffect(() => {
    if (isReady && isAuthenticated) {
      router.replace(nextPath);
    }
  }, [isAuthenticated, isReady, nextPath, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register({
          full_name: fullName,
          email,
          company,
          password,
        });
      }
      router.replace(nextPath);
    } catch (authError) {
      setError(
        authError instanceof Error ? authError.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen px-6 py-10 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(30,41,59,0.94))] p-8 text-white shadow-[0_30px_90px_-45px_rgba(15,23,42,0.82)]">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-200">
              Account Access
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight">
              Sign in to the operator side of RouteAlpha.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-200">
              Create an account to access the protected dashboard and inference
              workflow, or sign back in to continue tuning routing decisions.
            </p>

            <div className="mt-8 grid gap-4">
              <InfoCard
                title="Protected analytics"
                detail="Dashboard analytics and inference requests are protected by authenticated API access."
              />
              <InfoCard
                title="Persistent session"
                detail="Your session survives refreshes and the app restores it automatically."
              />
              <InfoCard
                title="Built to grow"
                detail="Account-level history, admin views, and team features are on the roadmap."
              />
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/70 bg-white/88 p-8 shadow-[0_24px_80px_-42px_rgba(15,23,42,0.32)] backdrop-blur-sm">
            <div className="inline-flex rounded-full border border-slate-200 bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  mode === "login"
                    ? "bg-slate-950 text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setMode("register")}
                className={`rounded-full px-4 py-2 text-sm font-medium ${
                  mode === "register"
                    ? "bg-slate-950 text-white"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Create account
              </button>
            </div>

            <div className="mt-6">
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
                {mode === "login" ? "Welcome back" : "Create your account"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {mode === "login"
                  ? "Sign in to keep working with your protected product workspace."
                  : "Create an account to access the dashboard and inference playground."}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              {mode === "register" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full name">
                    <input
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                      placeholder="Jordan Lee"
                      required
                    />
                  </Field>
                  <Field label="Company">
                    <input
                      value={company}
                      onChange={(event) => setCompany(event.target.value)}
                      className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                      placeholder="RouteAlpha"
                    />
                  </Field>
                </div>
              ) : null}

              <Field label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                  placeholder="you@company.com"
                  required
                />
              </Field>

              <Field label="Password">
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                />
              </Field>

              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex h-12 items-center justify-center rounded-full bg-slate-950 px-6 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading
                    ? mode === "login"
                      ? "Signing in..."
                      : "Creating account..."
                    : mode === "login"
                      ? "Sign in"
                      : "Create account"}
                </button>
                <Link
                  href="/"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-50"
                >
                  Back to home
                </Link>
              </div>
            </form>
          </section>
        </div>
      </main>
    </>
  );
}

function AuthPageShell() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen px-6 py-10 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(30,41,59,0.94))] p-8 text-white shadow-[0_30px_90px_-45px_rgba(15,23,42,0.82)]">
            <div className="h-4 w-40 animate-pulse rounded bg-white/20" />
            <div className="mt-5 h-24 max-w-xl animate-pulse rounded-3xl bg-white/12" />
            <div className="mt-8 grid gap-4">
              <div className="h-24 animate-pulse rounded-[1.4rem] bg-white/8" />
              <div className="h-24 animate-pulse rounded-[1.4rem] bg-white/8" />
              <div className="h-24 animate-pulse rounded-[1.4rem] bg-white/8" />
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/70 bg-white/88 p-8 shadow-[0_24px_80px_-42px_rgba(15,23,42,0.32)] backdrop-blur-sm">
            <div className="h-11 w-48 animate-pulse rounded-full bg-slate-100" />
            <div className="mt-6 h-20 max-w-md animate-pulse rounded-3xl bg-slate-100" />
            <div className="mt-8 space-y-5">
              <div className="h-12 animate-pulse rounded-2xl bg-slate-100" />
              <div className="h-12 animate-pulse rounded-2xl bg-slate-100" />
              <div className="h-12 w-44 animate-pulse rounded-full bg-slate-200" />
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-800">{label}</span>
      {children}
    </label>
  );
}

function InfoCard({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-[1.4rem] border border-white/10 bg-white/8 p-5">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-200">{detail}</p>
    </div>
  );
}

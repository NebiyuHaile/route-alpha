"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import Navbar from "./Navbar";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

const teamSizes = ["1-5", "6-20", "21-50", "51-200", "200+"];

const outcomes = [
  "Route support and ops prompts by cost and speed",
  "Add observability to an AI feature before launch",
  "Compare model quality across different task types",
  "Build a smarter internal AI platform for my team",
];

export default function ContactPage() {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    company: "",
    team_size: teamSizes[1],
    use_case: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/contact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.detail || "Failed to submit contact request.");
      }

      const data = await response.json();
      const statusMessage = data.email_sent
        ? data.message || "Contact request submitted successfully."
        : `${data.message || "Contact request submitted successfully."} ${data.email_status || ""}`.trim();

      setSuccessMessage(statusMessage);
      setForm({
        full_name: "",
        email: "",
        company: "",
        team_size: teamSizes[1],
        use_case: "",
        message: "",
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen px-6 py-10 text-slate-950 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[2rem] border border-white/70 bg-[linear-gradient(180deg,rgba(15,23,42,0.97),rgba(15,118,110,0.92))] p-8 text-white shadow-[0_30px_90px_-45px_rgba(15,23,42,0.8)]">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-200">
              Contact
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight">
              Tell us about your AI workload and we'll show you what smarter routing saves.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-200">
              Use this page to request a demo, describe your AI workflow, or tell us
              what kind of routing and observability support your team needs next.
            </p>

            <div className="mt-8 grid gap-4">
              <ContactHighlight
                title="Best for startup teams"
                detail="Tell us what you are building, how big the team is, and which routing decisions matter most to you."
              />
              <ContactHighlight
                title="A real person reads this"
                detail="Every request goes straight to the team and we follow up by email."
              />
              <ContactHighlight
                title="Demos with your data"
                detail="We can walk through the dashboard and playground using prompts from your actual use case."
              />
            </div>

            <div className="mt-10 rounded-[1.5rem] border border-white/10 bg-white/8 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-200">
                Common outcomes
              </p>
              <div className="mt-4 space-y-3">
                {outcomes.map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <span className="mt-2 h-2.5 w-2.5 rounded-full bg-amber-300" />
                    <p className="text-sm leading-6 text-slate-200">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-white/70 bg-white/88 p-8 shadow-[0_24px_80px_-42px_rgba(15,23,42,0.32)] backdrop-blur-sm">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-amber-700">
                Demo request
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                Tell us what kind of AI workload you want to route.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Share a bit of context so we can make the demo relevant to your stack and routing goals.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name">
                  <input
                    value={form.full_name}
                    onChange={(event) => updateField("full_name", event.target.value)}
                    className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                    placeholder="Jordan Lee"
                    required
                  />
                </Field>
                <Field label="Work email">
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) => updateField("email", event.target.value)}
                    className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                    placeholder="jordan@company.com"
                    required
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Company">
                  <input
                    value={form.company}
                    onChange={(event) => updateField("company", event.target.value)}
                    className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                    placeholder="Acme AI"
                  />
                </Field>
                <Field label="Team size">
                  <select
                    value={form.team_size}
                    onChange={(event) => updateField("team_size", event.target.value)}
                    className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                  >
                    {teamSizes.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Use case">
                <textarea
                  value={form.use_case}
                  onChange={(event) => updateField("use_case", event.target.value)}
                  className="min-h-36 w-full rounded-2xl border border-slate-300 bg-white p-4 outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                  placeholder="We want to route customer support, internal ops, and reasoning-heavy analysis prompts differently..."
                  required
                />
              </Field>

              <Field label="Message">
                <textarea
                  value={form.message}
                  onChange={(event) => updateField("message", event.target.value)}
                  className="min-h-28 w-full rounded-2xl border border-slate-300 bg-white p-4 outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                  placeholder="Anything else about your timeline, budget sensitivity, model stack, or routing goals?"
                />
              </Field>

              {error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              {successMessage ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {successMessage}
                </div>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex h-12 items-center justify-center rounded-full bg-slate-950 px-6 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "Submitting..." : "Request demo"}
                </button>
                <Link
                  href="/infer"
                  className="inline-flex h-12 items-center justify-center rounded-full border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-50"
                >
                  Try the product first
                </Link>
              </div>
            </form>
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

function ContactHighlight({
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

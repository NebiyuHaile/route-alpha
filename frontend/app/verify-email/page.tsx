"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "../../components/Navbar";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

function getVerificationToken() {
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  return fragment.get("token");
}

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [message, setMessage] = useState("Verifying your RouteAlpha account…");

  useEffect(() => {
    const token = getVerificationToken();
    if (!token) {
      setStatus("error");
      setMessage("This verification link is missing its token.");
      return;
    }

    // Remove the secret from browser history before sending it to the API.
    window.history.replaceState(null, "", window.location.pathname);
    fetch(`${API_BASE_URL}/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.detail || "Unable to verify this email address.");
        setStatus("success");
        setMessage(data?.message || "Email verified. You can now sign in.");
      })
      .catch((error) => {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Unable to verify this email address.");
      });
  }, []);

  return (
    <>
      <Navbar />
      <main className="min-h-screen px-6 py-16 lg:px-8">
        <section className="mx-auto max-w-xl rounded-[2rem] border border-slate-200 bg-white/90 p-8 text-center shadow-[0_24px_80px_-42px_rgba(15,23,42,0.32)]">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-teal-700">Account security</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            {status === "success" ? "Your email is verified" : status === "error" ? "Verification unavailable" : "Verifying email"}
          </h1>
          <p className={`mt-4 text-sm leading-6 ${status === "error" ? "text-red-700" : "text-slate-600"}`}>{message}</p>
          <Link href="/auth" className="mt-7 inline-flex h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800">
            Go to sign in
          </Link>
        </section>
      </main>
    </>
  );
}

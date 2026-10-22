"use client";

import { FormEvent, useEffect, useState } from "react";
import Navbar from "../../../components/Navbar";
import RequireAuth from "../../../components/RequireAuth";
import { useAuth } from "../../../components/AuthProvider";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

type SetupResponse = { secret: string; provisioning_uri: string };
type EnableResponse = { two_factor_enabled: boolean; recovery_codes: string[] };

export default function SecuritySettingsPage() {
  const { authFetch, user } = useAuth();
  const [setup, setSetup] = useState<SetupResponse | null>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setTwoFactorEnabled(Boolean(user?.two_factor_enabled));
  }, [user?.two_factor_enabled]);

  async function beginSetup() {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await authFetch(`${API_BASE_URL}/auth/2fa/setup`, { method: "POST" });
      const data = (await response.json().catch(() => null)) as EnableResponse | null;
      if (!response.ok) throw new Error(data?.detail || "Unable to begin 2FA setup.");
      setSetup(data as SetupResponse);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to begin 2FA setup.");
    } finally {
      setLoading(false);
    }
  }

  async function enableTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await authFetch(`${API_BASE_URL}/auth/2fa/enable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp_code: otpCode }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.detail || "Unable to enable two-factor authentication.");
      setSetup(null);
      setOtpCode("");
      setTwoFactorEnabled(true);
      setRecoveryCodes(data?.recovery_codes || []);
      setMessage("Two-factor authentication is enabled. You will need a code at your next sign-in.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to enable two-factor authentication.");
    } finally {
      setLoading(false);
    }
  }

  async function disableTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await authFetch(`${API_BASE_URL}/auth/2fa/disable`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePassword, otp_code: disableCode }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.detail || "Unable to disable two-factor authentication.");
      setTwoFactorEnabled(false);
      setRecoveryCodes([]);
      setDisablePassword("");
      setDisableCode("");
      setMessage("Two-factor authentication is disabled. Your active sessions have been signed out for safety.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to disable two-factor authentication.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <RequireAuth>
      <Navbar />
      <main className="min-h-screen px-6 py-12 lg:px-8">
        <section className="mx-auto max-w-3xl rounded-[2rem] border border-slate-200 bg-white/90 p-8 shadow-[0_24px_80px_-42px_rgba(15,23,42,0.32)]">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-teal-700">Security settings</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">Protect your RouteAlpha account</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">Signed in as {user?.email}. Add an authenticator app to require a time-based code whenever you sign in.</p>

          {message ? <p className="mt-6 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">{message}</p> : null}
          {error ? <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

          {twoFactorEnabled ? (
            <div className="mt-7 rounded-2xl border border-teal-200 bg-teal-50 p-5">
              <h2 className="font-semibold text-teal-950">Authenticator app enabled</h2>
              <p className="mt-2 text-sm leading-6 text-teal-800">Your account requires a current code from your authenticator app at sign-in.</p>
              {recoveryCodes.length ? (
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
                  <p className="text-sm font-semibold">Save these recovery codes now</p>
                  <p className="mt-1 text-sm leading-6">Each code works once if you lose access to your authenticator app. They will not be shown again.</p>
                  <code className="mt-3 block whitespace-pre-wrap break-all rounded-lg bg-white px-3 py-2 text-sm">{recoveryCodes.join("\n")}</code>
                </div>
              ) : null}
              <details className="mt-5 text-sm text-teal-950">
                <summary className="cursor-pointer font-semibold">Disable two-factor authentication</summary>
                <form onSubmit={disableTwoFactor} className="mt-4 grid gap-3">
                  <input type="password" autoComplete="current-password" value={disablePassword} onChange={(event) => setDisablePassword(event.target.value)} placeholder="Current password" required className="h-11 rounded-xl border border-teal-200 bg-white px-4 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" />
                  <input inputMode="text" autoComplete="one-time-code" value={disableCode} onChange={(event) => setDisableCode(event.target.value.replace(/\s/g, ""))} placeholder="Authenticator or recovery code" required className="h-11 rounded-xl border border-teal-200 bg-white px-4 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" />
                  <button type="submit" disabled={loading} className="justify-self-start text-sm font-semibold text-red-700 underline underline-offset-2 disabled:opacity-60">Disable 2FA</button>
                </form>
              </details>
            </div>
          ) : !setup ? (
            <div className="mt-7 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="font-semibold text-slate-950">Set up two-factor authentication</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Use Google Authenticator, 1Password, Authy, or another TOTP-compatible authenticator app.</p>
              <button type="button" onClick={beginSetup} disabled={loading} className="mt-5 inline-flex h-11 items-center rounded-full bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
                {loading ? "Preparing…" : "Set up authenticator app"}
              </button>
            </div>
          ) : (
            <div className="mt-7 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <h2 className="font-semibold text-slate-950">Add this account in your authenticator app</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Choose manual entry, then enter the secret below. Keep it private; anyone with it can generate sign-in codes.</p>
              <code className="mt-4 block break-all rounded-xl bg-slate-950 px-4 py-3 text-sm text-teal-200">{setup.secret}</code>
              <details className="mt-4 text-sm text-slate-600">
                <summary className="cursor-pointer font-medium">Show setup URI</summary>
                <code className="mt-2 block break-all text-xs">{setup.provisioning_uri}</code>
              </details>
              <form onSubmit={enableTwoFactor} className="mt-5 flex flex-col gap-3 sm:flex-row">
                <input inputMode="numeric" autoComplete="one-time-code" value={otpCode} onChange={(event) => setOtpCode(event.target.value.replace(/\s/g, ""))} placeholder="Enter 6-digit code" maxLength={8} required className="h-11 rounded-xl border border-slate-300 bg-white px-4 outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100" />
                <button type="submit" disabled={loading} className="inline-flex h-11 items-center justify-center rounded-full bg-slate-950 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">Enable 2FA</button>
              </form>
            </div>
          )}
        </section>
      </main>
    </RequireAuth>
  );
}

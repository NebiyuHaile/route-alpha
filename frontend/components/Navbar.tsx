"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  const linkClass = (href: string) =>
    `inline-flex h-10 items-center rounded-full px-4 text-sm font-medium transition ${
      pathname === href
        ? "bg-slate-900 text-white shadow-sm shadow-slate-300"
        : "text-slate-600 hover:bg-white hover:text-slate-900"
    }`;

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/60 bg-white/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
        <Link href="/" className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white shadow-sm shadow-slate-300">
            RA
          </span>
          <span>
            <span className="block text-base font-semibold text-slate-900">
              RouteAlpha
            </span>
            <span className="block text-xs uppercase tracking-[0.24em] text-slate-400">
              AI Routing Platform
            </span>
          </span>
        </Link>

        <div className="flex w-full flex-col gap-3 lg:w-auto lg:flex-row lg:items-center">
          {isHome ? (
            <div className="flex flex-wrap items-center gap-2 rounded-full border border-slate-200/80 bg-slate-100/80 p-1">
              <Link href="#platform" className="inline-flex h-10 items-center rounded-full px-4 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-900">
                Platform
              </Link>
              <Link href="#workflow" className="inline-flex h-10 items-center rounded-full px-4 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-900">
                Workflow
              </Link>
              <Link href="#pricing" className="inline-flex h-10 items-center rounded-full px-4 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-900">
                Pricing
              </Link>
              <Link href="#faq" className="inline-flex h-10 items-center rounded-full px-4 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-900">
                FAQ
              </Link>
              <Link href="/contact" className="inline-flex h-10 items-center rounded-full px-4 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-900">
                Contact
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 rounded-full border border-slate-200/80 bg-slate-100/80 p-1">
              <Link href="/" className={linkClass("/")}>
                Home
              </Link>
              <Link href="/dashboard" className={linkClass("/dashboard")}>
                Dashboard
              </Link>
              <Link href="/infer" className={linkClass("/infer")}>
                Inference
              </Link>
              <Link href="/contact" className={linkClass("/contact")}>
                Contact
              </Link>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Link
              href="/contact"
              className="inline-flex h-10 items-center justify-center rounded-full border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 hover:border-slate-400 hover:bg-slate-50"
            >
              Book demo
            </Link>
            <Link
              href="/infer"
              className="inline-flex h-10 items-center justify-center rounded-full bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800"
            >
              Run prompt
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  const linkClass = (href: string) =>
    `inline-flex h-10 items-center rounded-full px-4 text-sm font-medium transition ${
      pathname === href
        ? "bg-slate-900 text-white shadow-sm shadow-slate-300"
        : "text-slate-600 hover:bg-white hover:text-slate-900"
    }`;

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/60 bg-white/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-sm font-bold text-white shadow-sm shadow-slate-300">
            RA
          </span>
          <span>
            <span className="block text-base font-semibold text-slate-900">
              RouteAlpha
            </span>
            <span className="block text-xs uppercase tracking-[0.24em] text-slate-400">
              Routing Command Center
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-100/80 p-1">
          <Link href="/" className={linkClass("/")}>
            Dashboard
          </Link>
          <Link href="/infer" className={linkClass("/infer")}>
            Inference
          </Link>
        </div>
      </div>
    </nav>
  );
}

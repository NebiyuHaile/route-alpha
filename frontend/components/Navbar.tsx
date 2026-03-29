"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();

  const linkClass = (href: string) =>
    `px-4 py-2 rounded-lg text-sm font-medium transition ${
      pathname === href
        ? "bg-slate-900 text-white"
        : "text-slate-700 hover:bg-slate-100"
    }`;

  return (
    <nav className="w-full border-b border-slate-200 bg-white">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-slate-900">
          RouteAlpha
        </Link>

        <div className="flex items-center gap-2">
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
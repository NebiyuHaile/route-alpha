"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "./AuthProvider";

const homeLinks = [
  { href: "#platform", label: "Platform" },
  { href: "#workflow", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

const productLinks = [
  { href: "/", label: "Overview" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/infer", label: "Playground" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const { isAuthenticated, isReady, logout, user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const links = isHome ? homeLinks : productLinks;

  const closeMenu = () => setMenuOpen(false);
  const linkClass = (href: string) =>
    `inline-flex h-10 items-center rounded-xl px-3 text-sm font-medium transition ${
      pathname === href
        ? "bg-slate-900 text-white shadow-sm"
        : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
    }`;

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 lg:px-8">
        <Link href="/" onClick={closeMenu} className="flex shrink-0 items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-950 text-sm font-bold tracking-tight text-white shadow-lg shadow-slate-900/15">RA</span>
          <span>
            <span className="block text-sm font-semibold tracking-tight text-slate-950">RouteAlpha</span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">AI control plane</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {links.map((link) => <Link key={link.href} href={link.href} className={linkClass(link.href)}>{link.label}</Link>)}
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          {isReady && isAuthenticated ? (
            <>
              <span className="max-w-40 truncate rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">{user?.full_name || user?.email}</span>
              <button type="button" onClick={logout} className="inline-flex h-10 items-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">Sign out</button>
            </>
          ) : (
            <>
              <Link href="/contact" className="inline-flex h-10 items-center rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">Book demo</Link>
              <Link href="/auth" className="inline-flex h-10 items-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white shadow-lg shadow-slate-900/15 hover:bg-slate-800">Sign in</Link>
            </>
          )}
        </div>

        <button type="button" aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen((current) => !current)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 lg:hidden">
          <span className="sr-only">{menuOpen ? "Close navigation" : "Open navigation"}</span>
          <span className="text-lg leading-none">{menuOpen ? "×" : "☰"}</span>
        </button>
      </div>

      {menuOpen ? (
        <div id="mobile-navigation" className="border-t border-slate-200 bg-white px-5 py-4 shadow-xl lg:hidden">
          <div className="mx-auto grid max-w-7xl gap-1">
            {links.map((link) => <Link key={link.href} href={link.href} onClick={closeMenu} className={linkClass(link.href)}>{link.label}</Link>)}
            <div className="my-2 border-t border-slate-100" />
            {isReady && isAuthenticated ? (
              <>
                <span className="px-3 py-2 text-sm font-medium text-slate-600">Signed in as {user?.full_name || user?.email}</span>
                <button type="button" onClick={() => { logout(); closeMenu(); }} className="inline-flex h-10 items-center rounded-xl bg-slate-950 px-3 text-left text-sm font-semibold text-white">Sign out</button>
              </>
            ) : (
              <>
                <Link href="/auth" onClick={closeMenu} className="inline-flex h-10 items-center rounded-xl bg-slate-950 px-3 text-sm font-semibold text-white">Sign in</Link>
                <Link href="/contact" onClick={closeMenu} className="inline-flex h-10 items-center rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">Book demo</Link>
              </>
            )}
          </div>
        </div>
      ) : null}
    </nav>
  );
}

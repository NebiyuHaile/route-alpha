import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "../components/Navbar";

export const metadata: Metadata = {
  title: "Page Not Found",
  description: "The page you are looking for does not exist.",
};

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main className="flex min-h-[70vh] items-center px-6 py-16 lg:px-8">
        <div className="mx-auto max-w-2xl rounded-[2rem] border border-white/70 bg-white/85 p-10 text-center shadow-[0_24px_80px_-42px_rgba(15,23,42,0.32)] backdrop-blur-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">
            404
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
            This page does not exist.
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            The link may be outdated or the page may have moved. Head back to
            the homepage or jump straight into the product.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/"
              className="inline-flex h-12 items-center justify-center rounded-full bg-slate-950 px-6 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Back to home
            </Link>
            <Link
              href="/contact"
              className="inline-flex h-12 items-center justify-center rounded-full border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-900 hover:border-slate-400 hover:bg-slate-50"
            >
              Contact us
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}

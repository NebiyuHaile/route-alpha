import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "../../components/Navbar";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How RouteAlpha collects, uses, and protects your information.",
};

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main className="px-6 py-12 lg:px-8">
        <article className="mx-auto max-w-3xl rounded-[2rem] border border-white/70 bg-white/85 p-8 shadow-[0_24px_80px_-42px_rgba(15,23,42,0.32)] backdrop-blur-sm sm:p-12">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">
            Legal
          </p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-slate-500">Last updated: July 4, 2026</p>

          <div className="mt-8 space-y-8 text-base leading-7 text-slate-600">
            <section>
              <h2 className="text-xl font-semibold text-slate-950">
                Information we collect
              </h2>
              <p className="mt-3">
                When you create an account, we collect your name, email address,
                optional company name, and a securely hashed password. When you
                submit a contact or demo request, we collect the details you
                provide in the form, including your name, email, company, team
                size, and message. When you use the inference playground, we log
                the prompts you submit along with routing metadata such as the
                selected model, latency, and estimated cost so the dashboard can
                show your usage.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-950">
                How we use your information
              </h2>
              <p className="mt-3">
                We use this information to operate the service, respond to your
                requests, secure accounts, and understand how the platform is
                used so we can improve routing quality. We do not sell your
                personal information.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-950">
                Third-party processing
              </h2>
              <p className="mt-3">
                Prompts submitted to the inference playground are forwarded to
                third-party model providers through OpenRouter in order to
                generate responses. Do not submit sensitive personal information
                in prompts.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-950">
                Data retention and deletion
              </h2>
              <p className="mt-3">
                We retain account data and request logs while your account is
                active. You can request deletion of your account and associated
                data at any time via the{" "}
                <Link href="/contact" className="font-medium text-teal-700 underline hover:text-teal-800">
                  contact page
                </Link>
                , and we will action the request within 30 days.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-950">
                Cookies and local storage
              </h2>
              <p className="mt-3">
                We use browser local storage to keep you signed in. We do not
                use advertising cookies or cross-site trackers.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-slate-950">Contact</h2>
              <p className="mt-3">
                Questions about this policy? Reach us through the{" "}
                <Link href="/contact" className="font-medium text-teal-700 underline hover:text-teal-800">
                  contact page
                </Link>
                .
              </p>
            </section>
          </div>
        </article>
      </main>
    </>
  );
}

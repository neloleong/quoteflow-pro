import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
            QuoteFlow Pro
          </p>

          <h1 className="text-5xl font-bold leading-tight">
            Quotation, Report, Invoice and Receipt SaaS System
          </h1>

          <p className="mt-6 text-lg leading-8 text-slate-300">
            A business document workflow platform for SMEs, consultants,
            testing companies, agencies and professional service providers.
          </p>

          <div className="mt-8 flex gap-4">
            <Link
              href="/dashboard"
              className="rounded-xl bg-white px-6 py-3 font-semibold text-slate-950 hover:bg-slate-200"
            >
              Enter Demo Dashboard
            </Link>

            <Link
              href="/quotations"
              className="rounded-xl border border-white/30 px-6 py-3 font-semibold text-white hover:bg-white/10"
            >
              Create Quotation
            </Link>
          </div>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-4">
          {[
            "Quotation",
            "Project",
            "Invoice",
            "Receipt",
          ].map((title) => (
            <div
              key={title}
              className="rounded-2xl border border-white/10 bg-white/5 p-6"
            >
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-slate-400">
                Manage {title.toLowerCase()} workflow in one SaaS platform.
              </p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
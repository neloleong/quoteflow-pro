import AppShell from "@/components/AppShell";

const stats = [
  { label: "This Month Quotations", value: "0" },
  { label: "Active Projects", value: "0" },
  { label: "Issued Invoices", value: "0" },
  { label: "Outstanding Amount", value: "MOP 0.00" },
];

export default function DashboardPage() {
  return (
    <AppShell>
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="mt-2 text-slate-500">
          Overview of quotations, projects, invoices and receipts.
        </p>

        <div className="mt-8 grid gap-6 md:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <p className="text-sm text-slate-500">{stat.label}</p>
              <p className="mt-3 text-3xl font-bold text-slate-900">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            SaaS MVP Workflow
          </h2>
          <p className="mt-3 text-slate-600">
            Client → Quotation → Project → Invoice → Payment → Receipt
          </p>
        </div>
      </div>
    </AppShell>
  );
}
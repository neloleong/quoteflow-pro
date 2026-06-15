import AppShell from "@/components/AppShell";

export default function ProjectsPage() {
  return (
    <AppShell>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Projects</h1>
          <p className="mt-2 text-slate-500">
            Track jobs converted from accepted quotations.
          </p>
        </div>

        <button className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700">
          New Project
        </button>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-slate-500">No projects yet.</p>
      </div>
    </AppShell>
  );
}
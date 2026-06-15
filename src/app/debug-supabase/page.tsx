"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase/client";

type DebugResult = {
  tableName: string;
  count: number | null;
  error: string;
};

export default function DebugSupabasePage() {
  const supabase = useMemo(() => createClient(), []);
  const [results, setResults] = useState<DebugResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    runDebug();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function getCount(tableName: string): Promise<DebugResult> {
    const { count, error } = await supabase
      .from(tableName)
      .select("*", { count: "exact", head: true });

    return {
      tableName,
      count: count ?? 0,
      error: error ? JSON.stringify(error) : "",
    };
  }

  async function runDebug() {
    try {
      setLoading(true);

      const tableNames = [
        "companies",
        "customers",
        "vendors",
        "test_categories",
        "test_items",
        "customer_food_samples",
        "quotations",
        "quotation_items",
        "invoices",
        "invoice_items",
        "receipts",
        "receipt_items",
        "document_counters",
      ];

      const debugResults = await Promise.all(
        tableNames.map((tableName) => getCount(tableName))
      );

      setResults(debugResults);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Supabase Debug
            </h1>
            <p className="mt-2 text-slate-500">
              Check whether frontend can read Supabase tables.
            </p>
          </div>

          <button
            onClick={runDebug}
            disabled={loading}
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Checking..." : "Run Debug"}
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="border border-slate-200 px-4 py-3 text-left">
                  Table
                </th>
                <th className="border border-slate-200 px-4 py-3 text-left">
                  Count from Frontend
                </th>
                <th className="border border-slate-200 px-4 py-3 text-left">
                  Error
                </th>
              </tr>
            </thead>

            <tbody>
              {results.map((result) => (
                <tr key={result.tableName}>
                  <td className="border border-slate-200 px-4 py-3 font-semibold">
                    {result.tableName}
                  </td>
                  <td className="border border-slate-200 px-4 py-3">
                    {result.count}
                  </td>
                  <td className="border border-slate-200 px-4 py-3 text-red-600">
                    {result.error || "-"}
                  </td>
                </tr>
              ))}

              {!loading && results.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="border border-slate-200 px-4 py-8 text-center text-slate-500"
                  >
                    No debug result.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase/client";

type SampleRecordRow = {
  id: string;
  record_no: string | null;
  quotation_id: string | null;
  quotation_no: string | null;
  customer_name: string | null;
  project_name: string | null;
  received_date: string | null;
  received_by: string | null;
  test_start_date: string | null;
  test_end_date: string | null;
  status: string | null;
  remarks: string | null;
  created_at: string | null;
  sample_record_samples?: { id: string }[];
  sample_record_items?: { id: string }[];
};

function normalizeStatus(status?: string | null) {
  const value = (status || "draft").toLowerCase();

  if (value === "received") return "Received";
  if (value === "testing") return "Testing";
  if (value === "completed") return "Completed";
  if (value === "cancelled") return "Cancelled";

  return "Draft";
}

function statusClass(status?: string | null) {
  const value = (status || "draft").toLowerCase();

  if (value === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (value === "testing") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (value === "received") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (value === "cancelled") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return value.slice(0, 10);
}

export default function SampleRecordsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [records, setRecords] = useState<SampleRecordRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [keyword, setKeyword] = useState("");

  async function loadRecords() {
    setLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("sample_records")
      .select(
        `
        id,
        record_no,
        quotation_id,
        quotation_no,
        customer_name,
        project_name,
        received_date,
        received_by,
        test_start_date,
        test_end_date,
        status,
        remarks,
        created_at,
        sample_record_samples(id),
        sample_record_items(id)
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Load sample records error:", error);
      setErrorMessage(error.message || "Failed to load sample records.");
      setRecords([]);
    } else {
      setRecords((data || []) as SampleRecordRow[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredRecords = useMemo(() => {
    const q = keyword.trim().toLowerCase();

    if (!q) return records;

    return records.filter((record) => {
      const text = [
        record.record_no,
        record.quotation_no,
        record.customer_name,
        record.project_name,
        record.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(q);
    });
  }, [keyword, records]);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              收樣檢測記錄
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              根據 Quotation 生成樣品與檢測項目的 matrix 記錄，之後可接
              Report / Invoice / Receipt 進度。
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/dashboard"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Back Home
            </Link>

            <Link
              href="/sample-records/new"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              + New Sample Record
            </Link>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Search record no., quotation no., customer, project..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500 md:max-w-md"
            />

            <button
              type="button"
              onClick={loadRecords}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Refresh
            </button>
          </div>
        </div>

        {errorMessage ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">Record No.</th>
                  <th className="whitespace-nowrap px-4 py-3">Quotation</th>
                  <th className="whitespace-nowrap px-4 py-3">Customer</th>
                  <th className="whitespace-nowrap px-4 py-3">Project</th>
                  <th className="whitespace-nowrap px-4 py-3">Received</th>
                  <th className="whitespace-nowrap px-4 py-3">Samples</th>
                  <th className="whitespace-nowrap px-4 py-3">Test Items</th>
                  <th className="whitespace-nowrap px-4 py-3">Status</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-10 text-center text-slate-500"
                    >
                      Loading sample records...
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-10 text-center text-slate-500"
                    >
                      No sample records found.
                    </td>
                  </tr>
                ) : (
                  filteredRecords.map((record) => {
                    const sampleCount =
                      record.sample_record_samples?.length || 0;
                    const itemCount = record.sample_record_items?.length || 0;

                    return (
                      <tr
                        key={record.id}
                        className="border-t border-slate-100 hover:bg-slate-50"
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                          {record.record_no || "-"}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {record.quotation_id ? (
                            <Link
                              href={`/quotations/${record.quotation_id}`}
                              className="font-medium text-blue-700 hover:underline"
                            >
                              {record.quotation_no || "Open Quotation"}
                            </Link>
                          ) : (
                            record.quotation_no || "-"
                          )}
                        </td>

                        <td className="px-4 py-3 text-slate-700">
                          {record.customer_name || "-"}
                        </td>

                        <td className="px-4 py-3 text-slate-700">
                          {record.project_name || "-"}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {formatDate(record.received_date)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {sampleCount}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                          {itemCount}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(
                              record.status
                            )}`}
                          >
                            {normalizeStatus(record.status)}
                          </span>
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <Link
                            href={`/sample-records/${record.id}`}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
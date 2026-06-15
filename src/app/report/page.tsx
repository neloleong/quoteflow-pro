"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase/client";

const EMIT_COMPANY_ID = "11111111-1111-1111-1111-111111111111";

type Report = {
  id: string;
  report_no: string | null;
  report_date: string | null;
  customer_name: string | null;
  sample_name: string | null;
  status: string | null;
  created_at: string | null;
};

function formatDateText(dateValue: string | null) {
  if (!dateValue) {
    return "-";
  }

  const [year, month, day] = dateValue.split("-");

  if (!year || !month || !day) {
    return dateValue;
  }

  return `${year} / ${month} / ${day}`;
}

function formatCreatedAt(createdAt: string | null) {
  if (!createdAt) {
    return "-";
  }

  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return createdAt;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${year} / ${month} / ${day} ${hour}:${minute}`;
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (error instanceof Error) {
    return error.message || fallbackMessage;
  }

  if (typeof error === "object" && error !== null) {
    const errorObject = error as {
      code?: string;
      message?: string;
      details?: string;
      hint?: string;
    };

    if (errorObject.message) {
      return errorObject.message;
    }

    if (errorObject.details) {
      return errorObject.details;
    }

    if (errorObject.hint) {
      return errorObject.hint;
    }

    if (errorObject.code) {
      return `Database error code: ${errorObject.code}`;
    }

    const jsonText = JSON.stringify(errorObject);

    if (jsonText && jsonText !== "{}") {
      return jsonText;
    }
  }

  return fallbackMessage;
}

export default function ReportPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [hasMounted, setHasMounted] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!hasMounted) {
      return;
    }

    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMounted]);

  async function loadReports() {
    try {
      setLoading(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("reports")
        .select(
          "id,report_no,report_date,customer_name,sample_name,status,created_at"
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setReports((data ?? []) as Report[]);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Failed to load reports."));
    } finally {
      setLoading(false);
    }
  }

  async function deleteReport(reportId: string, reportNo: string | null) {
    const confirmed = window.confirm(
      `確定要刪除報告 ${reportNo || ""} 嗎？\n\n刪除後此報告將不會在列表顯示。`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingReportId(reportId);
      setErrorMessage("");

      const deletedAt = new Date().toISOString();

      const { error: reportError } = await supabase
        .from("reports")
        .update({
          deleted_at: deletedAt,
          updated_at: deletedAt,
        })
        .eq("id", reportId);

      if (reportError) {
        throw reportError;
      }

      await loadReports();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Failed to delete report."));
    } finally {
      setDeletingReportId(null);
    }
  }

  const filteredReports = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    return reports.filter((report) => {
      const matchedStatus =
        statusFilter === "all" || report.status === statusFilter;

      if (!matchedStatus) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const searchableText = [
        report.report_no,
        report.customer_name,
        report.sample_name,
        report.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(keyword);
    });
  }, [reports, searchText, statusFilter]);

  const draftCount = useMemo(() => {
    return reports.filter((report) => report.status === "draft").length;
  }, [reports]);

  const issuedCount = useMemo(() => {
    return reports.filter((report) => report.status === "issued").length;
  }, [reports]);

  const cancelledCount = useMemo(() => {
    return reports.filter((report) => report.status === "cancelled").length;
  }, [reports]);

  if (!hasMounted) {
    return (
      <AppShell>
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm text-slate-500">Loading reports...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Reports</h1>
            <p className="mt-2 text-slate-500">
              Manage testing reports, sample information, and test result
              records.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={loadReports}
              disabled={!hasMounted || loading}
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>

            <button
              onClick={() => router.push("/report/new")}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700"
            >
              New Report
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="mb-6 grid gap-4 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total Reports</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {reports.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Draft Reports</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {draftCount}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Issued Reports</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {issuedCount}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Cancelled</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {cancelledCount}
            </p>
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
            <div>
              <label className="text-sm font-medium text-slate-700">
                Search
              </label>
              <input
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search report no, customer, sample name..."
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="issued">Issued</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="border border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Report No.
                  </th>
                  <th className="border border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Date
                  </th>
                  <th className="border border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Customer
                  </th>
                  <th className="border border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Sample Name
                  </th>
                  <th className="border border-slate-200 px-4 py-3 text-center font-semibold text-slate-700">
                    Status
                  </th>
                  <th className="border border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Created At
                  </th>
                  <th className="border border-slate-200 px-4 py-3 text-center font-semibold text-slate-700">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td
                      colSpan={7}
                      className="border border-slate-200 px-4 py-10 text-center text-slate-500"
                    >
                      Loading report records...
                    </td>
                  </tr>
                )}

                {!loading && filteredReports.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="border border-slate-200 px-4 py-10 text-center text-slate-500"
                    >
                      No report records found.
                    </td>
                  </tr>
                )}

                {!loading &&
                  filteredReports.map((report) => (
                    <tr key={report.id} className="hover:bg-slate-50">
                      <td className="border border-slate-200 px-4 py-3 font-semibold text-slate-900">
                        {report.report_no || "-"}
                      </td>

                      <td className="border border-slate-200 px-4 py-3 text-slate-700">
                        {formatDateText(report.report_date)}
                      </td>

                      <td className="border border-slate-200 px-4 py-3 font-semibold text-slate-900">
                        {report.customer_name || "-"}
                      </td>

                      <td className="border border-slate-200 px-4 py-3 text-slate-700">
                        {report.sample_name || "-"}
                      </td>

                      <td className="border border-slate-200 px-4 py-3 text-center">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {report.status || "draft"}
                        </span>
                      </td>

                      <td className="border border-slate-200 px-4 py-3 text-slate-700">
                        {formatCreatedAt(report.created_at)}
                      </td>

                      <td className="border border-slate-200 px-4 py-3 text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => router.push(`/report/${report.id}`)}
                            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                          >
                            View
                          </button>

                          <button
                            onClick={() =>
                              deleteReport(report.id, report.report_no)
                            }
                            disabled={deletingReportId === report.id}
                            className="rounded-lg border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingReportId === report.id
                              ? "Deleting..."
                              : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
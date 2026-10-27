"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase/client";

type Quotation = {
  id: string;
  quotation_no: string | null;
  quotation_date: string | null;
  to_customer_name: string | null;
  attention_to: string | null;
  project_name: string | null;
  project_description: string | null;
  total_amount: number | null;
  currency: string | null;
  status: string | null;
  created_at: string | null;
};

type ErrorDetail = {
  name?: string;
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
  stack?: string;
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

function getErrorDetail(error: unknown): ErrorDetail {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (typeof error === "object" && error !== null) {
    const errorObject = error as ErrorDetail;

    return {
      name: errorObject.name,
      message: errorObject.message,
      code: errorObject.code,
      details: errorObject.details,
      hint: errorObject.hint,
      stack: errorObject.stack,
    };
  }

  return {
    message: String(error || ""),
  };
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  const errorDetail = getErrorDetail(error);

  const message = errorDetail.message || "";
  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("networkerror") ||
    lowerMessage.includes("failed to fetch") ||
    lowerMessage.includes("fetch resource")
  ) {
    return [
      "無法連接 Supabase，所以暫時讀不到 Quotation 記錄。",
      "請先確認 .env.local 的 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 是否正確，並用 http://localhost:3000 開啟。",
      "如果仍然失敗，請檢查 VPN、防火牆、瀏覽器插件或網絡是否阻止 Supabase。",
    ].join(" ");
  }

  if (errorDetail.message) {
    return errorDetail.message;
  }

  if (errorDetail.details) {
    return errorDetail.details;
  }

  if (errorDetail.hint) {
    return errorDetail.hint;
  }

  if (errorDetail.code) {
    return `Database error code: ${errorDetail.code}`;
  }

  if (typeof error === "object" && error !== null) {
    const jsonText = JSON.stringify(error);

    if (jsonText && jsonText !== "{}") {
      return jsonText;
    }
  }

  return fallbackMessage;
}

function buildDebugMessage(error: unknown) {
  const errorDetail = getErrorDetail(error);

  const debugInfo = {
    error: {
      name: errorDetail.name || "",
      message: errorDetail.message || "",
      code: errorDetail.code || "",
      details: errorDetail.details || "",
      hint: errorDetail.hint || "",
      stack: errorDetail.stack || "",
    },
    environment: {
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      hasSupabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      hasSupabaseAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      browserOnline:
        typeof navigator !== "undefined" ? navigator.onLine : "unknown",
      currentUrl:
        typeof window !== "undefined" ? window.location.href : "unknown",
    },
  };

  return JSON.stringify(debugInfo, null, 2);
}

export default function QuotationsListPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [hasMounted, setHasMounted] = useState(false);

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [loading, setLoading] = useState(false);
  const [deletingQuotationId, setDeletingQuotationId] = useState<string | null>(
    null
  );

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [debugMessage, setDebugMessage] = useState("");

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!hasMounted) {
      return;
    }

    loadQuotations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMounted]);

  async function loadQuotations() {
    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");
      setDebugMessage("");

      const { data, error } = await supabase
        .from("quotations")
        .select(
          "id,quotation_no,quotation_date,to_customer_name,attention_to,project_name,project_description,total_amount,currency,status,created_at"
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setQuotations((data ?? []) as Quotation[]);
    } catch (error: unknown) {
      const debugText = buildDebugMessage(error);

      console.error("Load quotations error detail:", debugText);

      setErrorMessage(getErrorMessage(error, "Failed to load quotations."));
      setDebugMessage(debugText);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteQuotation(quotation: Quotation) {
    const quotationLabel = quotation.quotation_no || quotation.id;

    const confirmed = window.confirm(
      `確認刪除這張 Quotation 嗎？\n\n${quotationLabel}\n\n刪除後列表不會再顯示，但資料會以 soft delete 方式保留。`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingQuotationId(quotation.id);
      setErrorMessage("");
      setSuccessMessage("");
      setDebugMessage("");

      const deletedAt = new Date().toISOString();

      const { error: quotationItemsError } = await supabase
        .from("quotation_items")
        .update({
          deleted_at: deletedAt,
          updated_at: deletedAt,
        })
        .eq("quotation_id", quotation.id)
        .is("deleted_at", null);

      if (quotationItemsError) {
        throw quotationItemsError;
      }

      const { error: quotationError } = await supabase
        .from("quotations")
        .update({
          deleted_at: deletedAt,
          updated_at: deletedAt,
        })
        .eq("id", quotation.id)
        .is("deleted_at", null);

      if (quotationError) {
        throw quotationError;
      }

      setQuotations((currentQuotations) =>
        currentQuotations.filter(
          (currentQuotation) => currentQuotation.id !== quotation.id
        )
      );

      setSuccessMessage(`Quotation deleted: ${quotationLabel}`);
    } catch (error: unknown) {
      const debugText = buildDebugMessage(error);

      console.error("Delete quotation error detail:", debugText);

      setErrorMessage(getErrorMessage(error, "Failed to delete quotation."));
      setDebugMessage(debugText);
    } finally {
      setDeletingQuotationId(null);
    }
  }

  const filteredQuotations = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    return quotations.filter((quotation) => {
      const matchedStatus =
        statusFilter === "all" || quotation.status === statusFilter;

      if (!matchedStatus) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const searchableText = [
        quotation.quotation_no,
        quotation.to_customer_name,
        quotation.attention_to,
        quotation.project_name,
        quotation.project_description,
        quotation.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(keyword);
    });
  }, [quotations, searchText, statusFilter]);

  const totalAmount = useMemo(() => {
    return filteredQuotations.reduce(
      (sum, quotation) => sum + Number(quotation.total_amount || 0),
      0
    );
  }, [filteredQuotations]);

  const draftCount = useMemo(() => {
    return quotations.filter((quotation) => quotation.status === "draft")
      .length;
  }, [quotations]);

  const issuedCount = useMemo(() => {
    return quotations.filter((quotation) => quotation.status === "issued")
      .length;
  }, [quotations]);

  const acceptedCount = useMemo(() => {
    return quotations.filter((quotation) => quotation.status === "accepted")
      .length;
  }, [quotations]);

  const cancelledCount = useMemo(() => {
    return quotations.filter((quotation) => quotation.status === "cancelled")
      .length;
  }, [quotations]);

  if (!hasMounted) {
    return (
      <AppShell>
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm text-slate-500">Loading quotations...</p>
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
            <h1 className="text-3xl font-bold text-slate-900">Quotations</h1>
            <p className="mt-2 text-slate-500">
              View saved quotation records and manage quotation documents.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={loadQuotations}
              disabled={!hasMounted || loading}
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>

            <button
              onClick={() => router.push("/quotations")}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Create Quotation
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            <p className="font-semibold">Failed to load quotation records</p>
            <p className="mt-2 whitespace-pre-line">{errorMessage}</p>

            {debugMessage && (
              <details className="mt-4 rounded-xl border border-red-200 bg-white p-4 text-xs text-slate-700">
                <summary className="cursor-pointer font-semibold text-red-700">
                  Show technical debug information
                </summary>
                <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words">
                  {debugMessage}
                </pre>
              </details>
            )}
          </div>
        )}

        {successMessage && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-700">
            {successMessage}
          </div>
        )}

        <div className="mb-6 grid gap-4 lg:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total Quotations</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {quotations.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Draft Quotations</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {draftCount}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Issued Quotations</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {issuedCount}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Accepted</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {acceptedCount}
            </p>
          </div>

          <div className="hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Filtered Amount</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              MOP {totalAmount.toLocaleString()}
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
                placeholder="Search quotation no, customer, project, attention..."
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
                <option value="accepted">Accepted</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1150px] border-collapse text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="border border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Quotation No.
                  </th>
                  <th className="border border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Date
                  </th>
                  <th className="border border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Customer
                  </th>
                  <th className="border border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Project
                  </th>
                  <th className="border border-slate-200 px-4 py-3 text-right font-semibold text-slate-700">
                    Total
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
                      colSpan={8}
                      className="border border-slate-200 px-4 py-10 text-center text-slate-500"
                    >
                      Loading quotation records...
                    </td>
                  </tr>
                )}

                {!loading && filteredQuotations.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="border border-slate-200 px-4 py-10 text-center text-slate-500"
                    >
                      No quotation records found.
                    </td>
                  </tr>
                )}

                {!loading &&
                  filteredQuotations.map((quotation) => (
                    <tr key={quotation.id} className="hover:bg-slate-50">
                      <td className="border border-slate-200 px-4 py-3 font-semibold text-slate-900">
                        {quotation.quotation_no || "-"}
                      </td>

                      <td className="border border-slate-200 px-4 py-3 text-slate-700">
                        {formatDateText(quotation.quotation_date)}
                      </td>

                      <td className="border border-slate-200 px-4 py-3 text-slate-900">
                        <p className="font-semibold">
                          {quotation.to_customer_name || "-"}
                        </p>

                        {quotation.attention_to && (
                          <p className="mt-1 text-xs text-slate-500">
                            {quotation.attention_to}
                          </p>
                        )}
                      </td>

                      <td className="border border-slate-200 px-4 py-3 text-slate-900">
                        <p className="font-semibold">
                          {quotation.project_name || "-"}
                        </p>

                        {quotation.project_description && (
                          <p className="mt-1 text-xs text-slate-500">
                            {quotation.project_description}
                          </p>
                        )}
                      </td>

                      <td className="border border-slate-200 px-4 py-3 text-right font-semibold text-slate-900">
                        {quotation.currency || "MOP"}{" "}
                        {Number(quotation.total_amount || 0).toLocaleString()}
                      </td>

                      <td className="border border-slate-200 px-4 py-3 text-center">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {quotation.status || "draft"}
                        </span>
                      </td>

                      <td className="border border-slate-200 px-4 py-3 text-slate-700">
                        {formatCreatedAt(quotation.created_at)}
                      </td>

                      <td className="border border-slate-200 px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() =>
                              router.push(`/quotations/${quotation.id}`)
                            }
                            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                          >
                            View
                          </button>

                          <button
                            onClick={() => handleDeleteQuotation(quotation)}
                            disabled={deletingQuotationId === quotation.id}
                            className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingQuotationId === quotation.id
                              ? "Deleting"
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

        <div className="mt-4 text-sm text-slate-500">
          Filtered total: MOP {totalAmount.toLocaleString()} / Cancelled:{" "}
          {cancelledCount}
        </div>
      </div>
    </AppShell>
  );
}
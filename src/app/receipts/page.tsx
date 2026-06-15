"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase/client";

type Receipt = {
  id: string;
  receipt_no: string;
  receipt_date: string | null;
  customer_name: string | null;
  invoice_no: string | null;
  project_name: string | null;
  amount_received: number | null;
  currency: string | null;
  payment_method: string | null;
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

export default function ReceiptsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [hasMounted, setHasMounted] = useState(false);

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [loading, setLoading] = useState(false);
  const [deletingReceiptId, setDeletingReceiptId] = useState<string | null>(
    null
  );

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!hasMounted) {
      return;
    }

    loadReceipts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMounted]);

  async function loadReceipts() {
    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const { data, error } = await supabase
        .from("receipts")
        .select(
          "id,receipt_no,receipt_date,customer_name,invoice_no,project_name,amount_received,currency,payment_method,status,created_at"
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setReceipts((data ?? []) as Receipt[]);
    } catch (error) {
      console.error("Load receipts error:", error);
      setErrorMessage(getErrorMessage(error, "Failed to load receipts."));
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteReceipt(receipt: Receipt) {
    const receiptLabel = receipt.receipt_no || receipt.id;

    const confirmed = window.confirm(
      `確認刪除這張 Receipt 嗎？\n\n${receiptLabel}\n\n刪除後列表不會再顯示，但資料會以 soft delete 方式保留。`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingReceiptId(receipt.id);
      setErrorMessage("");
      setSuccessMessage("");

      const deletedAt = new Date().toISOString();

      const { error: receiptItemsError } = await supabase
        .from("receipt_items")
        .update({
          deleted_at: deletedAt,
          updated_at: deletedAt,
        })
        .eq("receipt_id", receipt.id)
        .is("deleted_at", null);

      if (receiptItemsError) {
        throw receiptItemsError;
      }

      const { error: receiptError } = await supabase
        .from("receipts")
        .update({
          deleted_at: deletedAt,
          updated_at: deletedAt,
        })
        .eq("id", receipt.id)
        .is("deleted_at", null);

      if (receiptError) {
        throw receiptError;
      }

      setReceipts((currentReceipts) =>
        currentReceipts.filter(
          (currentReceipt) => currentReceipt.id !== receipt.id
        )
      );

      setSuccessMessage(`Receipt deleted: ${receiptLabel}`);
    } catch (error) {
      console.error("Delete receipt error:", error);
      setErrorMessage(getErrorMessage(error, "Failed to delete receipt."));
    } finally {
      setDeletingReceiptId(null);
    }
  }

  const filteredReceipts = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    return receipts.filter((receipt) => {
      const matchedStatus =
        statusFilter === "all" || receipt.status === statusFilter;

      if (!matchedStatus) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const searchableText = [
        receipt.receipt_no,
        receipt.invoice_no,
        receipt.customer_name,
        receipt.project_name,
        receipt.payment_method,
        receipt.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(keyword);
    });
  }, [receipts, searchText, statusFilter]);

  const totalAmount = useMemo(() => {
    return filteredReceipts.reduce(
      (sum, receipt) => sum + Number(receipt.amount_received || 0),
      0
    );
  }, [filteredReceipts]);

  const draftCount = useMemo(() => {
    return receipts.filter((receipt) => receipt.status === "draft").length;
  }, [receipts]);

  const issuedCount = useMemo(() => {
    return receipts.filter((receipt) => receipt.status === "issued").length;
  }, [receipts]);

  const cancelledCount = useMemo(() => {
    return receipts.filter((receipt) => receipt.status === "cancelled").length;
  }, [receipts]);

  if (!hasMounted) {
    return (
      <AppShell>
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm text-slate-500">Loading receipts...</p>
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
            <h1 className="text-3xl font-bold text-slate-900">Receipts</h1>
            <p className="mt-2 text-slate-500">
              View receipts generated from invoices and manage payment records.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={loadReceipts}
              disabled={!hasMounted || loading}
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>

            <button
              onClick={() => router.push("/invoices")}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Create from Invoice
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-700">
            {successMessage}
          </div>
        )}

        <div className="mb-6 grid gap-4 lg:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total Receipts</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {receipts.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Draft Receipts</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {draftCount}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Issued Receipts</p>
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
                placeholder="Search receipt no, invoice no, customer, project..."
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
            <table className="w-full min-w-[1120px] border-collapse text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="border border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Receipt No.
                  </th>
                  <th className="border border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Date
                  </th>
                  <th className="border border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Customer
                  </th>
                  <th className="border border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Invoice No.
                  </th>
                  <th className="border border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                    Project
                  </th>
                  <th className="border border-slate-200 px-4 py-3 text-right font-semibold text-slate-700">
                    Amount
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
                      colSpan={9}
                      className="border border-slate-200 px-4 py-10 text-center text-slate-500"
                    >
                      Loading receipt records...
                    </td>
                  </tr>
                )}

                {!loading && filteredReceipts.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="border border-slate-200 px-4 py-10 text-center text-slate-500"
                    >
                      No receipt records found.
                    </td>
                  </tr>
                )}

                {!loading &&
                  filteredReceipts.map((receipt) => (
                    <tr key={receipt.id} className="hover:bg-slate-50">
                      <td className="border border-slate-200 px-4 py-3 font-semibold text-slate-900">
                        {receipt.receipt_no}
                      </td>

                      <td className="border border-slate-200 px-4 py-3 text-slate-700">
                        {formatDateText(receipt.receipt_date)}
                      </td>

                      <td className="border border-slate-200 px-4 py-3 font-semibold text-slate-900">
                        {receipt.customer_name || "-"}
                      </td>

                      <td className="border border-slate-200 px-4 py-3 text-slate-700">
                        {receipt.invoice_no || "-"}
                      </td>

                      <td className="border border-slate-200 px-4 py-3 text-slate-700">
                        {receipt.project_name || "-"}
                      </td>

                      <td className="border border-slate-200 px-4 py-3 text-right font-semibold text-slate-900">
                        {receipt.currency || "MOP"}{" "}
                        {Number(receipt.amount_received || 0).toLocaleString()}
                      </td>

                      <td className="border border-slate-200 px-4 py-3 text-center">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {receipt.status || "draft"}
                        </span>
                      </td>

                      <td className="border border-slate-200 px-4 py-3 text-slate-700">
                        {formatCreatedAt(receipt.created_at)}
                      </td>

                      <td className="border border-slate-200 px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() =>
                              router.push(`/receipts/${receipt.id}`)
                            }
                            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                          >
                            View
                          </button>

                          <button
                            onClick={() => handleDeleteReceipt(receipt)}
                            disabled={deletingReceiptId === receipt.id}
                            className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingReceiptId === receipt.id
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
          Filtered total: MOP {totalAmount.toLocaleString()}
        </div>
      </div>
    </AppShell>
  );
}
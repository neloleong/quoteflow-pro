"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase/client";

type Invoice = {
  id: string;
  invoice_no: string;
  invoice_date: string | null;
  customer_name: string | null;
  project_name: string | null;
  project_description: string | null;
  total_amount: number | null;
  currency: string | null;
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

export default function InvoicesPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [loading, setLoading] = useState(true);
  const [deletingInvoiceId, setDeletingInvoiceId] = useState<string | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadInvoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadInvoices() {
    try {
      setLoading(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("invoices")
        .select(
          "id,invoice_no,invoice_date,customer_name,project_name,project_description,total_amount,currency,status,created_at"
        )
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setInvoices((data ?? []) as Invoice[]);
    } catch (error) {
      console.error("Load invoices error:", error);
      setErrorMessage(getErrorMessage(error, "Failed to load invoices."));
    } finally {
      setLoading(false);
    }
  }

  async function deleteInvoice(invoiceId: string, invoiceNo: string) {
    const confirmed = window.confirm(
      `確定要刪除 Invoice ${invoiceNo || ""} 嗎？\n\n刪除後此 Invoice 將不會在列表顯示。`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingInvoiceId(invoiceId);
      setErrorMessage("");

      const deletedAt = new Date().toISOString();

      const { error } = await supabase
        .from("invoices")
        .update({
          deleted_at: deletedAt,
          updated_at: deletedAt,
        })
        .eq("id", invoiceId);

      if (error) {
        throw error;
      }

      await loadInvoices();
    } catch (error) {
      console.error("Delete invoice error:", error);
      setErrorMessage(getErrorMessage(error, "Failed to delete invoice."));
    } finally {
      setDeletingInvoiceId(null);
    }
  }

  const filteredInvoices = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    return invoices.filter((invoice) => {
      const matchedStatus =
        statusFilter === "all" || invoice.status === statusFilter;

      if (!matchedStatus) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const searchableText = [
        invoice.invoice_no,
        invoice.customer_name,
        invoice.project_name,
        invoice.project_description,
        invoice.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(keyword);
    });
  }, [invoices, searchText, statusFilter]);

  const totalAmount = useMemo(() => {
    return filteredInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.total_amount || 0),
      0
    );
  }, [filteredInvoices]);

  const draftCount = useMemo(() => {
    return invoices.filter((invoice) => invoice.status === "draft").length;
  }, [invoices]);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Invoices</h1>
            <p className="mt-2 text-slate-500">
              View generated invoices and open invoice details.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={loadInvoices}
              disabled={loading}
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Refresh
            </button>

            <button
              onClick={() => router.push("/quotations/list")}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Generate from Quotation
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="mb-6 grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Total Invoices</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {invoices.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Draft Invoices</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">
              {draftCount}
            </p>
          </div>

          <div className="hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Filtered Total Amount</p>
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
                placeholder="Search invoice no, customer, project..."
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
                <option value="paid">Paid</option>
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
                    Invoice No.
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
                      Loading invoice records...
                    </td>
                  </tr>
                )}

                {!loading && filteredInvoices.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="border border-slate-200 px-4 py-10 text-center text-slate-500"
                    >
                      No invoice records found.
                    </td>
                  </tr>
                )}

                {!loading &&
                  filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-slate-50">
                      <td className="border border-slate-200 px-4 py-3 font-semibold text-slate-900">
                        {invoice.invoice_no}
                      </td>

                      <td className="border border-slate-200 px-4 py-3 text-slate-700">
                        {formatDateText(invoice.invoice_date)}
                      </td>

                      <td className="border border-slate-200 px-4 py-3 font-semibold text-slate-900">
                        {invoice.customer_name || "-"}
                      </td>

                      <td className="border border-slate-200 px-4 py-3 text-slate-700">
                        <div className="font-semibold text-slate-900">
                          {invoice.project_name || "-"}
                        </div>
                        <div className="max-w-[360px] truncate text-xs text-slate-500">
                          {invoice.project_description || ""}
                        </div>
                      </td>

                      <td className="border border-slate-200 px-4 py-3 text-right font-semibold text-slate-900">
                        {invoice.currency || "MOP"} {" "}
                        {Number(invoice.total_amount || 0).toLocaleString()}
                      </td>

                      <td className="border border-slate-200 px-4 py-3 text-center">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {invoice.status || "draft"}
                        </span>
                      </td>

                      <td className="border border-slate-200 px-4 py-3 text-slate-700">
                        {formatCreatedAt(invoice.created_at)}
                      </td>

                      <td className="border border-slate-200 px-4 py-3 text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => router.push(`/invoices/${invoice.id}`)}
                            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                          >
                            View
                          </button>

                          <button
                            onClick={() =>
                              deleteInvoice(invoice.id, invoice.invoice_no)
                            }
                            disabled={deletingInvoiceId === invoice.id}
                            className="rounded-lg border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {deletingInvoiceId === invoice.id
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

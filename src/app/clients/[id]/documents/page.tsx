"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase/client";

const EMIT_COMPANY_ID =
  "11111111-1111-1111-1111-111111111111";

type DocumentTab =
  | "quotations"
  | "reports"
  | "invoices"
  | "receipts";

type Customer = {
  id: string;
  company_id: string;
  customer_name: string;
  contact_person: string | null;
  phone: string | null;
  fax: string | null;
  email: string | null;
  address: string | null;
  customer_type: string | null;
  remarks: string | null;
  is_active: boolean;
};

type Quotation = {
  id: string;
  company_id: string | null;
  customer_id: string | null;
  quotation_no: string | null;
  quotation_date: string | null;
  to_customer_name: string | null;
  project_name: string | null;
  project_description: string | null;
  total_amount: number | null;
  currency: string | null;
  status: string | null;
  created_at: string | null;
};

type Report = {
  id: string;
  company_id: string | null;
  customer_id: string | null;
  report_no: string | null;
  report_date: string | null;
  customer_name: string | null;
  source_quotation_no: string | null;
  sample_name: string | null;
  sample_description: string | null;
  status: string | null;
  created_at: string | null;
};

type Invoice = {
  id: string;
  company_id: string | null;
  customer_id: string | null;
  invoice_no: string | null;
  invoice_date: string | null;
  customer_name: string | null;
  project_name: string | null;
  project_description: string | null;
  total_amount: number | null;
  currency: string | null;
  status: string | null;
  created_at: string | null;
};

type Receipt = {
  id: string;
  company_id: string | null;
  customer_id: string | null;
  receipt_no: string | null;
  receipt_date: string | null;
  customer_name: string | null;
  invoice_no: string | null;
  project_name: string | null;
  project_description: string | null;
  amount_received: number | null;
  currency: string | null;
  payment_method: string | null;
  status: string | null;
  created_at: string | null;
};

function getErrorMessage(
  error: unknown,
  fallbackMessage: string
) {
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

function formatDateText(dateValue: string | null) {
  if (!dateValue) {
    return "-";
  }

  const dateText = String(dateValue).slice(0, 10);
  const [year, month, day] = dateText.split("-");

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
  const month = String(date.getMonth() + 1).padStart(
    2,
    "0"
  );
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(
    2,
    "0"
  );

  return `${year} / ${month} / ${day} ${hour}:${minute}`;
}

function formatAmount(
  currency: string | null,
  amount: number | null
) {
  return `${currency || "MOP"} ${Number(
    amount || 0
  ).toLocaleString("en-US")}`;
}

function getStatusClassName(status: string | null) {
  switch (status) {
    case "issued":
    case "accepted":
    case "paid":
      return "bg-emerald-100 text-emerald-700";

    case "cancelled":
      return "bg-red-100 text-red-700";

    case "draft":
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function mergeRecordsById<T extends { id: string }>(
  firstRecords: T[],
  secondRecords: T[]
) {
  const recordMap = new Map<string, T>();

  firstRecords.forEach((record) => {
    recordMap.set(record.id, record);
  });

  secondRecords.forEach((record) => {
    if (!recordMap.has(record.id)) {
      recordMap.set(record.id, record);
    }
  });

  return Array.from(recordMap.values()).sort(
    (firstRecord, secondRecord) => {
      const firstCreatedAt =
        "created_at" in firstRecord
          ? String(firstRecord.created_at || "")
          : "";

      const secondCreatedAt =
        "created_at" in secondRecord
          ? String(secondRecord.created_at || "")
          : "";

      return secondCreatedAt.localeCompare(firstCreatedAt);
    }
  );
}

export default function CustomerDocumentsPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const customerId =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : "";

  const [customer, setCustomer] =
    useState<Customer | null>(null);

  const [quotations, setQuotations] = useState<
    Quotation[]
  >([]);

  const [reports, setReports] = useState<Report[]>([]);

  const [invoices, setInvoices] = useState<Invoice[]>(
    []
  );

  const [receipts, setReceipts] = useState<Receipt[]>(
    []
  );

  const [activeTab, setActiveTab] =
    useState<DocumentTab>("quotations");

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] =
    useState("all");

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    if (!customerId) {
      return;
    }

    loadCustomerDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  async function loadCustomerDocuments() {
    try {
      setLoading(true);
      setErrorMessage("");

      const {
        data: customerData,
        error: customerError,
      } = await supabase
        .from("customers")
        .select(
          "id,company_id,customer_name,contact_person,phone,fax,email,address,customer_type,remarks,is_active"
        )
        .eq("id", customerId)
        .eq("company_id", EMIT_COMPANY_ID)
        .maybeSingle();

      if (customerError) {
        throw customerError;
      }

      if (!customerData) {
        throw new Error("找不到這個客戶。");
      }

      const loadedCustomer =
        customerData as Customer;

      setCustomer(loadedCustomer);

      const quotationFields =
        "id,company_id,customer_id,quotation_no,quotation_date,to_customer_name,project_name,project_description,total_amount,currency,status,created_at";

      const reportFields =
        "id,company_id,customer_id,report_no,report_date,customer_name,source_quotation_no,sample_name,sample_description,status,created_at";

      const invoiceFields =
        "id,company_id,customer_id,invoice_no,invoice_date,customer_name,project_name,project_description,total_amount,currency,status,created_at";

      const receiptFields =
        "id,company_id,customer_id,receipt_no,receipt_date,customer_name,invoice_no,project_name,project_description,amount_received,currency,payment_method,status,created_at";

      const [
        quotationsByCustomerIdResult,
        quotationsByCustomerNameResult,
        reportsByCustomerIdResult,
        reportsByCustomerNameResult,
        invoicesByCustomerIdResult,
        invoicesByCustomerNameResult,
        receiptsByCustomerIdResult,
        receiptsByCustomerNameResult,
      ] = await Promise.all([
        supabase
          .from("quotations")
          .select(quotationFields)
          .eq("company_id", EMIT_COMPANY_ID)
          .eq("customer_id", customerId)
          .is("deleted_at", null)
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("quotations")
          .select(quotationFields)
          .eq("company_id", EMIT_COMPANY_ID)
          .is("customer_id", null)
          .eq(
            "to_customer_name",
            loadedCustomer.customer_name
          )
          .is("deleted_at", null)
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("reports")
          .select(reportFields)
          .eq("company_id", EMIT_COMPANY_ID)
          .eq("customer_id", customerId)
          .is("deleted_at", null)
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("reports")
          .select(reportFields)
          .eq("company_id", EMIT_COMPANY_ID)
          .is("customer_id", null)
          .eq(
            "customer_name",
            loadedCustomer.customer_name
          )
          .is("deleted_at", null)
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("invoices")
          .select(invoiceFields)
          .eq("company_id", EMIT_COMPANY_ID)
          .eq("customer_id", customerId)
          .is("deleted_at", null)
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("invoices")
          .select(invoiceFields)
          .eq("company_id", EMIT_COMPANY_ID)
          .is("customer_id", null)
          .eq(
            "customer_name",
            loadedCustomer.customer_name
          )
          .is("deleted_at", null)
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("receipts")
          .select(receiptFields)
          .eq("company_id", EMIT_COMPANY_ID)
          .eq("customer_id", customerId)
          .is("deleted_at", null)
          .order("created_at", {
            ascending: false,
          }),

        supabase
          .from("receipts")
          .select(receiptFields)
          .eq("company_id", EMIT_COMPANY_ID)
          .is("customer_id", null)
          .eq(
            "customer_name",
            loadedCustomer.customer_name
          )
          .is("deleted_at", null)
          .order("created_at", {
            ascending: false,
          }),
      ]);

      const queryErrors = [
        quotationsByCustomerIdResult.error,
        quotationsByCustomerNameResult.error,
        reportsByCustomerIdResult.error,
        reportsByCustomerNameResult.error,
        invoicesByCustomerIdResult.error,
        invoicesByCustomerNameResult.error,
        receiptsByCustomerIdResult.error,
        receiptsByCustomerNameResult.error,
      ].filter(Boolean);

      if (queryErrors.length > 0) {
        throw queryErrors[0];
      }

      const quotationsByCustomerId =
        Array.isArray(
          quotationsByCustomerIdResult.data
        )
          ? (quotationsByCustomerIdResult.data as unknown as Quotation[])
          : [];

      const quotationsByCustomerName =
        Array.isArray(
          quotationsByCustomerNameResult.data
        )
          ? (quotationsByCustomerNameResult.data as unknown as Quotation[])
          : [];

      const reportsByCustomerId =
        Array.isArray(reportsByCustomerIdResult.data)
          ? (reportsByCustomerIdResult.data as unknown as Report[])
          : [];

      const reportsByCustomerName =
        Array.isArray(
          reportsByCustomerNameResult.data
        )
          ? (reportsByCustomerNameResult.data as unknown as Report[])
          : [];

      const invoicesByCustomerId =
        Array.isArray(
          invoicesByCustomerIdResult.data
        )
          ? (invoicesByCustomerIdResult.data as unknown as Invoice[])
          : [];

      const invoicesByCustomerName =
        Array.isArray(
          invoicesByCustomerNameResult.data
        )
          ? (invoicesByCustomerNameResult.data as unknown as Invoice[])
          : [];

      const receiptsByCustomerId =
        Array.isArray(
          receiptsByCustomerIdResult.data
        )
          ? (receiptsByCustomerIdResult.data as unknown as Receipt[])
          : [];

      const receiptsByCustomerName =
        Array.isArray(
          receiptsByCustomerNameResult.data
        )
          ? (receiptsByCustomerNameResult.data as unknown as Receipt[])
          : [];

      setQuotations(
        mergeRecordsById(
          quotationsByCustomerId,
          quotationsByCustomerName
        )
      );

      setReports(
        mergeRecordsById(
          reportsByCustomerId,
          reportsByCustomerName
        )
      );

      setInvoices(
        mergeRecordsById(
          invoicesByCustomerId,
          invoicesByCustomerName
        )
      );

      setReceipts(
        mergeRecordsById(
          receiptsByCustomerId,
          receiptsByCustomerName
        )
      );
    } catch (error) {
      console.error(
        "Load customer documents error:",
        error
      );

      setErrorMessage(
        getErrorMessage(
          error,
          "Failed to load customer documents."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  function handleChangeTab(nextTab: DocumentTab) {
    setActiveTab(nextTab);
    setSearchText("");
    setStatusFilter("all");
  }

  const filteredQuotations = useMemo(() => {
    const keyword = searchText
      .trim()
      .toLowerCase();

    return quotations.filter((quotation) => {
      const matchedStatus =
        statusFilter === "all" ||
        quotation.status === statusFilter;

      if (!matchedStatus) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const searchableText = [
        quotation.quotation_no,
        quotation.to_customer_name,
        quotation.project_name,
        quotation.project_description,
        quotation.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(keyword);
    });
  }, [
    quotations,
    searchText,
    statusFilter,
  ]);

  const filteredReports = useMemo(() => {
    const keyword = searchText
      .trim()
      .toLowerCase();

    return reports.filter((report) => {
      const matchedStatus =
        statusFilter === "all" ||
        report.status === statusFilter;

      if (!matchedStatus) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const searchableText = [
        report.report_no,
        report.source_quotation_no,
        report.sample_name,
        report.sample_description,
        report.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(keyword);
    });
  }, [reports, searchText, statusFilter]);

  const filteredInvoices = useMemo(() => {
    const keyword = searchText
      .trim()
      .toLowerCase();

    return invoices.filter((invoice) => {
      const matchedStatus =
        statusFilter === "all" ||
        invoice.status === statusFilter;

      if (!matchedStatus) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const searchableText = [
        invoice.invoice_no,
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

  const filteredReceipts = useMemo(() => {
    const keyword = searchText
      .trim()
      .toLowerCase();

    return receipts.filter((receipt) => {
      const matchedStatus =
        statusFilter === "all" ||
        receipt.status === statusFilter;

      if (!matchedStatus) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const searchableText = [
        receipt.receipt_no,
        receipt.invoice_no,
        receipt.project_name,
        receipt.project_description,
        receipt.payment_method,
        receipt.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(keyword);
    });
  }, [receipts, searchText, statusFilter]);

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
            Loading customer documents...
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl min-w-0">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <button
              onClick={() => router.push("/clients")}
              className="mb-3 text-sm font-semibold text-slate-500 hover:text-slate-900"
            >
              ← Back to Clients
            </button>

            <h1 className="text-3xl font-bold text-slate-900">
              Client Documents 客戶文件
            </h1>

            <p className="mt-2 text-slate-500">
              集中查看這個客戶的 Quotation、Report、Invoice 及 Receipt。
            </p>
          </div>

          <button
            onClick={loadCustomerDocuments}
            disabled={loading}
            className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Refresh
          </button>
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {customer && (
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="break-words text-2xl font-bold text-slate-900">
                    {customer.customer_name}
                  </h2>

                  <span
                    className={
                      customer.is_active
                        ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700"
                        : "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500"
                    }
                  >
                    {customer.is_active
                      ? "Active"
                      : "Disabled"}
                  </span>
                </div>

                {customer.address && (
                  <p className="mt-2 max-w-2xl break-words text-sm text-slate-500">
                    {customer.address}
                  </p>
                )}
              </div>

              <div className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                <p>
                  <span className="font-semibold text-slate-700">
                    ATTN:
                  </span>{" "}
                  <span className="text-slate-500">
                    {customer.contact_person || "-"}
                  </span>
                </p>

                <p>
                  <span className="font-semibold text-slate-700">
                    Phone:
                  </span>{" "}
                  <span className="text-slate-500">
                    {customer.phone || "-"}
                  </span>
                </p>

                <p>
                  <span className="font-semibold text-slate-700">
                    Email:
                  </span>{" "}
                  <span className="break-all text-slate-500">
                    {customer.email || "-"}
                  </span>
                </p>

                <p>
                  <span className="font-semibold text-slate-700">
                    Type:
                  </span>{" "}
                  <span className="text-slate-500">
                    {customer.customer_type || "-"}
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <button
            onClick={() =>
              handleChangeTab("quotations")
            }
            className={[
              "rounded-2xl border p-5 text-left shadow-sm transition",
              activeTab === "quotations"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-900 hover:border-slate-400",
            ].join(" ")}
          >
            <p
              className={
                activeTab === "quotations"
                  ? "text-sm text-slate-300"
                  : "text-sm text-slate-500"
              }
            >
              Quotations
            </p>

            <p className="mt-2 text-3xl font-bold">
              {quotations.length}
            </p>
          </button>

          <button
            onClick={() =>
              handleChangeTab("reports")
            }
            className={[
              "rounded-2xl border p-5 text-left shadow-sm transition",
              activeTab === "reports"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-900 hover:border-slate-400",
            ].join(" ")}
          >
            <p
              className={
                activeTab === "reports"
                  ? "text-sm text-slate-300"
                  : "text-sm text-slate-500"
              }
            >
              Reports
            </p>

            <p className="mt-2 text-3xl font-bold">
              {reports.length}
            </p>
          </button>

          <button
            onClick={() =>
              handleChangeTab("invoices")
            }
            className={[
              "rounded-2xl border p-5 text-left shadow-sm transition",
              activeTab === "invoices"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-900 hover:border-slate-400",
            ].join(" ")}
          >
            <p
              className={
                activeTab === "invoices"
                  ? "text-sm text-slate-300"
                  : "text-sm text-slate-500"
              }
            >
              Invoices
            </p>

            <p className="mt-2 text-3xl font-bold">
              {invoices.length}
            </p>
          </button>

          <button
            onClick={() =>
              handleChangeTab("receipts")
            }
            className={[
              "rounded-2xl border p-5 text-left shadow-sm transition",
              activeTab === "receipts"
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-200 bg-white text-slate-900 hover:border-slate-400",
            ].join(" ")}
          >
            <p
              className={
                activeTab === "receipts"
                  ? "text-sm text-slate-300"
                  : "text-sm text-slate-500"
              }
            >
              Receipts
            </p>

            <p className="mt-2 text-3xl font-bold">
              {receipts.length}
            </p>
          </button>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
            <div>
              <label className="text-sm font-medium text-slate-700">
                Search
              </label>

              <input
                value={searchText}
                onChange={(event) =>
                  setSearchText(event.target.value)
                }
                placeholder={`Search ${activeTab}...`}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Status
              </label>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
              >
                <option value="all">
                  All Status
                </option>

                <option value="draft">
                  Draft
                </option>

                <option value="issued">
                  Issued
                </option>

                <option value="accepted">
                  Accepted
                </option>

                <option value="paid">
                  Paid
                </option>

                <option value="cancelled">
                  Cancelled
                </option>
              </select>
            </div>
          </div>
        </div>

        {activeTab === "quotations" && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] border-collapse text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="border border-slate-200 px-4 py-3 text-left">
                      Quotation No.
                    </th>

                    <th className="border border-slate-200 px-4 py-3 text-left">
                      Date
                    </th>

                    <th className="border border-slate-200 px-4 py-3 text-left">
                      Project
                    </th>

                    <th className="border border-slate-200 px-4 py-3 text-right">
                      Total
                    </th>

                    <th className="border border-slate-200 px-4 py-3 text-center">
                      Status
                    </th>

                    <th className="border border-slate-200 px-4 py-3 text-left">
                      Created At
                    </th>

                    <th className="border border-slate-200 px-4 py-3 text-center">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredQuotations.map(
                    (quotation) => (
                      <tr key={quotation.id}>
                        <td className="border border-slate-200 px-4 py-3 font-semibold text-slate-900">
                          {quotation.quotation_no ||
                            "-"}
                        </td>

                        <td className="border border-slate-200 px-4 py-3">
                          {formatDateText(
                            quotation.quotation_date
                          )}
                        </td>

                        <td className="border border-slate-200 px-4 py-3">
                          <p className="font-semibold text-slate-900">
                            {quotation.project_name ||
                              "-"}
                          </p>

                          {quotation.project_description && (
                            <p className="mt-1 max-w-[420px] truncate text-xs text-slate-500">
                              {
                                quotation.project_description
                              }
                            </p>
                          )}
                        </td>

                        <td className="border border-slate-200 px-4 py-3 text-right font-semibold">
                          {formatAmount(
                            quotation.currency,
                            quotation.total_amount
                          )}
                        </td>

                        <td className="border border-slate-200 px-4 py-3 text-center">
                          <span
                            className={[
                              "rounded-full px-3 py-1 text-xs font-semibold",
                              getStatusClassName(
                                quotation.status
                              ),
                            ].join(" ")}
                          >
                            {quotation.status ||
                              "draft"}
                          </span>
                        </td>

                        <td className="border border-slate-200 px-4 py-3">
                          {formatCreatedAt(
                            quotation.created_at
                          )}
                        </td>

                        <td className="border border-slate-200 px-4 py-3 text-center">
                          <button
                            onClick={() =>
                              router.push(
                                `/quotations/${quotation.id}`
                              )
                            }
                            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    )
                  )}

                  {filteredQuotations.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="border border-slate-200 px-4 py-10 text-center text-slate-500"
                      >
                        No quotation records found
                        for this client.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "reports" && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] border-collapse text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="border border-slate-200 px-4 py-3 text-left">
                      Report No.
                    </th>

                    <th className="border border-slate-200 px-4 py-3 text-left">
                      Date
                    </th>

                    <th className="border border-slate-200 px-4 py-3 text-left">
                      Source Quotation
                    </th>

                    <th className="border border-slate-200 px-4 py-3 text-left">
                      Sample
                    </th>

                    <th className="border border-slate-200 px-4 py-3 text-center">
                      Status
                    </th>

                    <th className="border border-slate-200 px-4 py-3 text-left">
                      Created At
                    </th>

                    <th className="border border-slate-200 px-4 py-3 text-center">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredReports.map((report) => (
                    <tr key={report.id}>
                      <td className="border border-slate-200 px-4 py-3 font-semibold text-slate-900">
                        {report.report_no || "-"}
                      </td>

                      <td className="border border-slate-200 px-4 py-3">
                        {formatDateText(
                          report.report_date
                        )}
                      </td>

                      <td className="border border-slate-200 px-4 py-3">
                        {report.source_quotation_no ||
                          "-"}
                      </td>

                      <td className="border border-slate-200 px-4 py-3">
                        <p className="font-semibold text-slate-900">
                          {report.sample_name || "-"}
                        </p>

                        {report.sample_description && (
                          <p className="mt-1 max-w-[360px] truncate text-xs text-slate-500">
                            {
                              report.sample_description
                            }
                          </p>
                        )}
                      </td>

                      <td className="border border-slate-200 px-4 py-3 text-center">
                        <span
                          className={[
                            "rounded-full px-3 py-1 text-xs font-semibold",
                            getStatusClassName(
                              report.status
                            ),
                          ].join(" ")}
                        >
                          {report.status || "draft"}
                        </span>
                      </td>

                      <td className="border border-slate-200 px-4 py-3">
                        {formatCreatedAt(
                          report.created_at
                        )}
                      </td>

                      <td className="border border-slate-200 px-4 py-3 text-center">
                        <button
                          onClick={() =>
                            router.push(
                              `/report/${report.id}`
                            )
                          }
                          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}

                  {filteredReports.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="border border-slate-200 px-4 py-10 text-center text-slate-500"
                      >
                        No report records found for
                        this client.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "invoices" && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] border-collapse text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="border border-slate-200 px-4 py-3 text-left">
                      Invoice No.
                    </th>

                    <th className="border border-slate-200 px-4 py-3 text-left">
                      Date
                    </th>

                    <th className="border border-slate-200 px-4 py-3 text-left">
                      Project
                    </th>

                    <th className="border border-slate-200 px-4 py-3 text-right">
                      Total
                    </th>

                    <th className="border border-slate-200 px-4 py-3 text-center">
                      Status
                    </th>

                    <th className="border border-slate-200 px-4 py-3 text-left">
                      Created At
                    </th>

                    <th className="border border-slate-200 px-4 py-3 text-center">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredInvoices.map(
                    (invoice) => (
                      <tr key={invoice.id}>
                        <td className="border border-slate-200 px-4 py-3 font-semibold text-slate-900">
                          {invoice.invoice_no || "-"}
                        </td>

                        <td className="border border-slate-200 px-4 py-3">
                          {formatDateText(
                            invoice.invoice_date
                          )}
                        </td>

                        <td className="border border-slate-200 px-4 py-3">
                          <p className="font-semibold text-slate-900">
                            {invoice.project_name ||
                              "-"}
                          </p>

                          {invoice.project_description && (
                            <p className="mt-1 max-w-[420px] truncate text-xs text-slate-500">
                              {
                                invoice.project_description
                              }
                            </p>
                          )}
                        </td>

                        <td className="border border-slate-200 px-4 py-3 text-right font-semibold">
                          {formatAmount(
                            invoice.currency,
                            invoice.total_amount
                          )}
                        </td>

                        <td className="border border-slate-200 px-4 py-3 text-center">
                          <span
                            className={[
                              "rounded-full px-3 py-1 text-xs font-semibold",
                              getStatusClassName(
                                invoice.status
                              ),
                            ].join(" ")}
                          >
                            {invoice.status || "draft"}
                          </span>
                        </td>

                        <td className="border border-slate-200 px-4 py-3">
                          {formatCreatedAt(
                            invoice.created_at
                          )}
                        </td>

                        <td className="border border-slate-200 px-4 py-3 text-center">
                          <button
                            onClick={() =>
                              router.push(
                                `/invoices/${invoice.id}`
                              )
                            }
                            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    )
                  )}

                  {filteredInvoices.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="border border-slate-200 px-4 py-10 text-center text-slate-500"
                      >
                        No invoice records found
                        for this client.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "receipts" && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] border-collapse text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="border border-slate-200 px-4 py-3 text-left">
                      Receipt No.
                    </th>

                    <th className="border border-slate-200 px-4 py-3 text-left">
                      Date
                    </th>

                    <th className="border border-slate-200 px-4 py-3 text-left">
                      Invoice No.
                    </th>

                    <th className="border border-slate-200 px-4 py-3 text-left">
                      Project
                    </th>

                    <th className="border border-slate-200 px-4 py-3 text-right">
                      Amount
                    </th>

                    <th className="border border-slate-200 px-4 py-3 text-left">
                      Payment
                    </th>

                    <th className="border border-slate-200 px-4 py-3 text-center">
                      Status
                    </th>

                    <th className="border border-slate-200 px-4 py-3 text-center">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredReceipts.map(
                    (receipt) => (
                      <tr key={receipt.id}>
                        <td className="border border-slate-200 px-4 py-3 font-semibold text-slate-900">
                          {receipt.receipt_no || "-"}
                        </td>

                        <td className="border border-slate-200 px-4 py-3">
                          {formatDateText(
                            receipt.receipt_date
                          )}
                        </td>

                        <td className="border border-slate-200 px-4 py-3">
                          {receipt.invoice_no || "-"}
                        </td>

                        <td className="border border-slate-200 px-4 py-3">
                          <p className="font-semibold text-slate-900">
                            {receipt.project_name ||
                              "-"}
                          </p>

                          {receipt.project_description && (
                            <p className="mt-1 max-w-[360px] truncate text-xs text-slate-500">
                              {
                                receipt.project_description
                              }
                            </p>
                          )}
                        </td>

                        <td className="border border-slate-200 px-4 py-3 text-right font-semibold">
                          {formatAmount(
                            receipt.currency,
                            receipt.amount_received
                          )}
                        </td>

                        <td className="border border-slate-200 px-4 py-3">
                          {receipt.payment_method ||
                            "-"}
                        </td>

                        <td className="border border-slate-200 px-4 py-3 text-center">
                          <span
                            className={[
                              "rounded-full px-3 py-1 text-xs font-semibold",
                              getStatusClassName(
                                receipt.status
                              ),
                            ].join(" ")}
                          >
                            {receipt.status || "draft"}
                          </span>
                        </td>

                        <td className="border border-slate-200 px-4 py-3 text-center">
                          <button
                            onClick={() =>
                              router.push(
                                `/receipts/${receipt.id}`
                              )
                            }
                            className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    )
                  )}

                  {filteredReceipts.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="border border-slate-200 px-4 py-10 text-center text-slate-500"
                      >
                        No receipt records found for
                        this client.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase/client";

const EMIT_COMPANY_ID = "11111111-1111-1111-1111-111111111111";

type Report = {
  id: string;
  company_id: string | null;
  customer_id: string | null;
  source_quotation_id: string | null;
  source_quotation_no: string | null;
  report_no: string | null;
  report_date: string | null;
  customer_name: string | null;
  sample_name: string | null;
  status: string | null;
  created_at: string | null;
};

type ExistingInvoice = {
  id: string;
  invoice_no: string;
  quotation_id: string | null;
  created_at: string | null;
};

type SourceQuotation = {
  id: string;
  company_id: string | null;
  customer_id: string | null;
  quotation_no: string | null;
  quotation_date: string | null;
  to_customer_name: string | null;
  project_name: string | null;
  project_description: string | null;
  subtotal: number | null;
  discount_amount: number | null;
  total_amount: number | null;
  currency: string | null;
};

type SourceQuotationItem = {
  id: string;
  quotation_id: string;
  test_item_id: string | null;
  sample_no: number | null;
  sample_name: string | null;
  test_category_name: string | null;
  item_no: number | null;
  description: string | null;
  quantity: number | null;
  unit: string | null;
  customer_unit_price_mop_snapshot: number | null;
  customer_total_price_mop_snapshot: number | null;
  sort_order: number | null;
};

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
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${year} / ${month} / ${day} ${hour}:${minute}`;
}

function generateInvoiceNo() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const random = String(Math.floor(Math.random() * 900) + 100);

  return `EMIT-INV${yy}${mm}${dd}-${random}`;
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

function isDuplicateDatabaseError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

function getQuotationItemNo(
  item: SourceQuotationItem,
  itemIndex: number
) {
  const itemNo = Number(
    item.sample_no || item.item_no || itemIndex + 1
  );

  if (Number.isNaN(itemNo) || itemNo <= 0) {
    return itemIndex + 1;
  }

  return itemNo;
}

function getQuotationItemQuantity(item: SourceQuotationItem) {
  const quantity = Number(item.quantity || 1);

  if (Number.isNaN(quantity) || quantity <= 0) {
    return 1;
  }

  return quantity;
}

function getQuotationItemUnitPrice(item: SourceQuotationItem) {
  const unitPrice = Number(
    item.customer_unit_price_mop_snapshot || 0
  );

  if (Number.isNaN(unitPrice) || unitPrice < 0) {
    return 0;
  }

  return unitPrice;
}

function getQuotationItemTotal(item: SourceQuotationItem) {
  const savedTotal = Number(
    item.customer_total_price_mop_snapshot || 0
  );

  if (!Number.isNaN(savedTotal) && savedTotal > 0) {
    return savedTotal;
  }

  return (
    getQuotationItemUnitPrice(item) *
    getQuotationItemQuantity(item)
  );
}

export default function ReportPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [hasMounted, setHasMounted] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);

  const [invoicesByQuotationId, setInvoicesByQuotationId] = useState<
    Record<string, ExistingInvoice>
  >({});

  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [deletingReportId, setDeletingReportId] = useState<
    string | null
  >(null);

  const [creatingInvoiceReportId, setCreatingInvoiceReportId] =
    useState<string | null>(null);

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
      setSuccessMessage("");

      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      const loadedReports: Report[] = Array.isArray(data)
        ? (data as unknown as Report[])
        : [];

      setReports(loadedReports);

      const sourceQuotationIds = Array.from(
        new Set(
          loadedReports
            .map((report) => report.source_quotation_id)
            .filter(
              (quotationId): quotationId is string =>
                typeof quotationId === "string" &&
                quotationId.trim() !== ""
            )
        )
      );

      if (sourceQuotationIds.length === 0) {
        setInvoicesByQuotationId({});
        return;
      }

      const { data: invoiceData, error: invoiceError } =
        await supabase
          .from("invoices")
          .select("*")
          .in("quotation_id", sourceQuotationIds)
          .is("deleted_at", null)
          .order("created_at", { ascending: false });

      if (invoiceError) {
        throw invoiceError;
      }

      const nextInvoiceMap: Record<string, ExistingInvoice> = {};

      const invoiceList: ExistingInvoice[] = Array.isArray(
        invoiceData
      )
        ? (invoiceData as unknown as ExistingInvoice[])
        : [];

      invoiceList.forEach((invoice) => {
        if (!invoice.quotation_id) {
          return;
        }

        if (!nextInvoiceMap[invoice.quotation_id]) {
          nextInvoiceMap[invoice.quotation_id] = invoice;
        }
      });

      setInvoicesByQuotationId(nextInvoiceMap);
    } catch (error) {
      console.error("Load reports error:", error);

      setErrorMessage(
        getErrorMessage(error, "Failed to load reports.")
      );
    } finally {
      setLoading(false);
    }
  }

  function getReportInvoice(report: Report) {
    if (!report.source_quotation_id) {
      return null;
    }

    return (
      invoicesByQuotationId[report.source_quotation_id] || null
    );
  }

  async function handleCreateInvoice(report: Report) {
    if (!report.source_quotation_id) {
      setErrorMessage(
        `Report ${
          report.report_no || ""
        } 沒有來源 Quotation，暫時不能建立 Invoice。`
      );
      return;
    }

    const currentInvoice = getReportInvoice(report);

    if (currentInvoice) {
      router.push(`/invoices/${currentInvoice.id}`);
      return;
    }

    try {
      setCreatingInvoiceReportId(report.id);
      setErrorMessage("");
      setSuccessMessage("");

      const quotationId = report.source_quotation_id;

      const {
        data: existingInvoiceData,
        error: existingInvoiceError,
      } = await supabase
        .from("invoices")
        .select("*")
        .eq("quotation_id", quotationId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingInvoiceError) {
        throw existingInvoiceError;
      }

      if (existingInvoiceData) {
        const existingInvoice =
          existingInvoiceData as ExistingInvoice;

        setInvoicesByQuotationId((currentInvoices) => ({
          ...currentInvoices,
          [quotationId]: existingInvoice,
        }));

        setSuccessMessage(
          `此報告的 Invoice 已經存在：${existingInvoice.invoice_no}`
        );

        router.push(`/invoices/${existingInvoice.id}`);
        return;
      }

      const { data: quotationData, error: quotationError } =
        await supabase
          .from("quotations")
          .select("*")
          .eq("id", quotationId)
          .is("deleted_at", null)
          .maybeSingle();

      if (quotationError) {
        throw quotationError;
      }

      if (!quotationData) {
        throw new Error(
          `找不到來源 Quotation：${
            report.source_quotation_no || quotationId
          }`
        );
      }

      const {
        data: quotationItemsData,
        error: quotationItemsError,
      } = await supabase
        .from("quotation_items")
        .select("*")
        .eq("quotation_id", quotationId)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true });

      if (quotationItemsError) {
        throw quotationItemsError;
      }

      const quotation = quotationData as SourceQuotation;

      const quotationItems: SourceQuotationItem[] = Array.isArray(
        quotationItemsData
      )
        ? (quotationItemsData as unknown as SourceQuotationItem[])
        : [];

      if (quotationItems.length === 0) {
        throw new Error(
          `Quotation ${
            quotation.quotation_no || quotation.id
          } 沒有檢測項目，不能建立 Invoice。`
        );
      }

      let createdInvoice: ExistingInvoice | null = null;
      let lastInvoiceInsertError: unknown = null;

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const invoiceNo = generateInvoiceNo();

        const {
          data: createdInvoiceData,
          error: invoiceInsertError,
        } = await supabase
          .from("invoices")
          .insert({
            company_id:
              quotation.company_id ||
              report.company_id ||
              EMIT_COMPANY_ID,

            quotation_id: quotation.id,

            customer_id:
              quotation.customer_id ||
              report.customer_id ||
              null,

            invoice_no: invoiceNo,
            invoice_date: new Date().toISOString().slice(0, 10),

            customer_name:
              quotation.to_customer_name ||
              report.customer_name ||
              "",

            project_name:
              quotation.project_name || "Food Testing",

            project_description:
              quotation.project_description ||
              report.sample_name ||
              `為${
                quotation.to_customer_name ||
                report.customer_name ||
                "客戶"
              }提供樣品檢測服務`,

            subtotal: Number(quotation.subtotal || 0),

            discount_amount: Number(
              quotation.discount_amount || 0
            ),

            total_amount: Number(quotation.total_amount || 0),
            currency: quotation.currency || "MOP",
            status: "draft",
          })
          .select("id,invoice_no,quotation_id,created_at")
          .single();

        if (!invoiceInsertError && createdInvoiceData) {
          createdInvoice =
            createdInvoiceData as ExistingInvoice;
          break;
        }

        lastInvoiceInsertError = invoiceInsertError;

        if (!isDuplicateDatabaseError(invoiceInsertError)) {
          throw invoiceInsertError;
        }

        const {
          data: invoiceAfterDuplicate,
          error: invoiceAfterDuplicateError,
        } = await supabase
          .from("invoices")
          .select("*")
          .eq("quotation_id", quotationId)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (invoiceAfterDuplicateError) {
          throw invoiceAfterDuplicateError;
        }

        if (invoiceAfterDuplicate) {
          const foundInvoice =
            invoiceAfterDuplicate as ExistingInvoice;

          setInvoicesByQuotationId((currentInvoices) => ({
            ...currentInvoices,
            [quotationId]: foundInvoice,
          }));

          setSuccessMessage(
            `Invoice 已經存在：${foundInvoice.invoice_no}`
          );

          router.push(`/invoices/${foundInvoice.id}`);
          return;
        }
      }

      if (!createdInvoice) {
        throw (
          lastInvoiceInsertError ||
          new Error("Failed to create invoice.")
        );
      }

      const invoiceItemPayload = quotationItems.map(
        (item, itemIndex) => {
          const itemNo = getQuotationItemNo(item, itemIndex);
          const quantity = getQuotationItemQuantity(item);
          const unitPrice = getQuotationItemUnitPrice(item);
          const totalAmount = getQuotationItemTotal(item);

          return {
            company_id:
              quotation.company_id ||
              report.company_id ||
              EMIT_COMPANY_ID,

            invoice_id: createdInvoice!.id,

            item_no: itemNo,

            item_name:
              item.sample_name ||
              report.sample_name ||
              `Item ${itemNo}`,

            description: item.description || "",
            unit_price: unitPrice,
            quantity,
            total_amount: totalAmount,

            sort_order: Number(
              item.sort_order || itemIndex + 1
            ),
          };
        }
      );

      if (invoiceItemPayload.length === 0) {
        throw new Error(
          "This quotation has no invoice items to insert."
        );
      }

      const { error: invoiceItemsError } = await supabase
        .from("invoice_items")
        .insert(invoiceItemPayload);

      if (invoiceItemsError) {
        const deletedAt = new Date().toISOString();

        await supabase
          .from("invoices")
          .update({
            deleted_at: deletedAt,
            updated_at: deletedAt,
            status: "cancelled",
          })
          .eq("id", createdInvoice.id);

        throw invoiceItemsError;
      }

      setInvoicesByQuotationId((currentInvoices) => ({
        ...currentInvoices,
        [quotationId]: createdInvoice!,
      }));

      setSuccessMessage(
        `Invoice 建立成功：${createdInvoice.invoice_no}`
      );

      router.push(`/invoices/${createdInvoice.id}`);
    } catch (error) {
      console.error(
        "Create invoice from report error:",
        error
      );

      setErrorMessage(
        getErrorMessage(error, "Failed to create invoice.")
      );
    } finally {
      setCreatingInvoiceReportId(null);
    }
  }

  async function deleteReport(
    reportId: string,
    reportNo: string | null
  ) {
    const selectedReport = reports.find(
      (report) => report.id === reportId
    );

    const selectedInvoice = selectedReport
      ? getReportInvoice(selectedReport)
      : null;

    const invoiceWarning = selectedInvoice
      ? `\n\n注意：此 Report 已經建立 Invoice ${selectedInvoice.invoice_no}。刪除 Report 不會自動刪除 Invoice。`
      : "";

    const confirmed = window.confirm(
      `確定要刪除報告 ${
        reportNo || ""
      } 嗎？\n\n刪除後此報告將不會在列表顯示。${invoiceWarning}`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingReportId(reportId);
      setErrorMessage("");
      setSuccessMessage("");

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
      console.error("Delete report error:", error);

      setErrorMessage(
        getErrorMessage(error, "Failed to delete report.")
      );
    } finally {
      setDeletingReportId(null);
    }
  }

  const filteredReports = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

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

      const invoice = report.source_quotation_id
        ? invoicesByQuotationId[report.source_quotation_id]
        : null;

      const searchableText = [
        report.report_no,
        report.source_quotation_no,
        report.customer_name,
        report.sample_name,
        report.status,
        invoice?.invoice_no,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(keyword);
    });
  }, [
    reports,
    searchText,
    statusFilter,
    invoicesByQuotationId,
  ]);

  const draftCount = useMemo(() => {
    return reports.filter(
      (report) => report.status === "draft"
    ).length;
  }, [reports]);

  const issuedCount = useMemo(() => {
    return reports.filter(
      (report) => report.status === "issued"
    ).length;
  }, [reports]);

  const cancelledCount = useMemo(() => {
    return reports.filter(
      (report) => report.status === "cancelled"
    ).length;
  }, [reports]);

  if (!hasMounted) {
    return (
      <AppShell>
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm text-slate-500">
              Loading reports...
            </p>
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
            <h1 className="text-3xl font-bold text-slate-900">
              Reports
            </h1>

            <p className="mt-2 text-slate-500">
              Manage testing reports, sample information, test
              result records, and Invoice status.
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

        {successMessage && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-700">
            {successMessage}
          </div>
        )}

        <div className="mb-6 grid gap-4 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Total Reports
            </p>

            <p className="mt-2 text-2xl font-bold text-slate-900">
              {reports.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Draft Reports
            </p>

            <p className="mt-2 text-2xl font-bold text-slate-900">
              {draftCount}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Issued Reports
            </p>

            <p className="mt-2 text-2xl font-bold text-slate-900">
              {issuedCount}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Cancelled
            </p>

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
                onChange={(event) =>
                  setSearchText(event.target.value)
                }
                placeholder="Search report no, invoice no, customer, sample name..."
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
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="issued">Issued</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="max-w-full overflow-x-auto">
            <table className="w-full min-w-[1080px] table-fixed border-collapse text-sm">
              <colgroup>
                <col className="w-[13%]" />
                <col className="w-[10%]" />
                <col className="w-[16%]" />
                <col className="w-[16%]" />
                <col className="w-[9%]" />
                <col className="w-[13%]" />
                <col className="w-[23%]" />
              </colgroup>

              <thead className="bg-slate-100">
                <tr>
                  <th className="border border-slate-200 px-3 py-3 text-left font-semibold text-slate-700">
                    Report No.
                  </th>

                  <th className="border border-slate-200 px-3 py-3 text-left font-semibold text-slate-700">
                    Date
                  </th>

                  <th className="border border-slate-200 px-3 py-3 text-left font-semibold text-slate-700">
                    Customer
                  </th>

                  <th className="border border-slate-200 px-3 py-3 text-left font-semibold text-slate-700">
                    Sample Name
                  </th>

                  <th className="border border-slate-200 px-3 py-3 text-center font-semibold text-slate-700">
                    Status
                  </th>

                  <th className="border border-slate-200 px-3 py-3 text-left font-semibold text-slate-700">
                    Created At
                  </th>

                  <th className="border border-slate-200 px-3 py-3 text-center font-semibold text-slate-700">
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

                {!loading &&
                  filteredReports.length === 0 && (
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
                  filteredReports.map((report) => {
                    const invoice = getReportInvoice(report);

                    const isCreatingInvoice =
                      creatingInvoiceReportId === report.id;

                    const isDeleting =
                      deletingReportId === report.id;

                    const hasSourceQuotation = Boolean(
                      report.source_quotation_id
                    );

                    return (
                      <tr
                        key={report.id}
                        className="hover:bg-slate-50"
                      >
                        <td className="truncate border border-slate-200 px-3 py-3 font-semibold text-slate-900">
                          {report.report_no || "-"}
                        </td>

                        <td className="border border-slate-200 px-3 py-3 text-slate-700">
                          {formatDateText(report.report_date)}
                        </td>

                        <td className="truncate border border-slate-200 px-3 py-3 font-semibold text-slate-900">
                          {report.customer_name || "-"}
                        </td>

                        <td className="truncate border border-slate-200 px-3 py-3 text-slate-700">
                          {report.sample_name || "-"}
                        </td>

                        <td className="border border-slate-200 px-2 py-3 text-center">
                          <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700">
                            {report.status || "draft"}
                          </span>
                        </td>

                        <td className="border border-slate-200 px-3 py-3 text-xs leading-5 text-slate-700">
                          {formatCreatedAt(report.created_at)}
                        </td>

                        <td className="border border-slate-200 px-2 py-3">
                          <div className="mx-auto grid w-full max-w-[230px] gap-2">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() =>
                                  router.push(
                                    `/report/${report.id}`
                                  )
                                }
                                className="whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-700"
                              >
                                View
                              </button>

                              <button
                                onClick={() =>
                                  deleteReport(
                                    report.id,
                                    report.report_no
                                  )
                                }
                                disabled={
                                  isDeleting ||
                                  isCreatingInvoice
                                }
                                className="whitespace-nowrap rounded-lg border border-red-200 px-3 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {isDeleting
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            </div>

                            <div className="flex items-center justify-center gap-2">
                              {invoice ? (
                                <>
                                  <span className="whitespace-nowrap rounded-full bg-emerald-100 px-2.5 py-1.5 text-[10px] font-semibold text-emerald-700">
                                    已開
                                  </span>

                                  <button
                                    onClick={() =>
                                      router.push(
                                        `/invoices/${invoice.id}`
                                      )
                                    }
                                    className="whitespace-nowrap rounded-lg border border-emerald-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50"
                                  >
                                    View Invoice
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span className="whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-1.5 text-[10px] font-semibold text-amber-700">
                                    未開
                                  </span>

                                  <button
                                    onClick={() =>
                                      handleCreateInvoice(report)
                                    }
                                    disabled={
                                      isCreatingInvoice ||
                                      !hasSourceQuotation
                                    }
                                    title={
                                      hasSourceQuotation
                                        ? "Create Invoice from source quotation"
                                        : "This report has no source quotation"
                                    }
                                    className="whitespace-nowrap rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                                  >
                                    {isCreatingInvoice
                                      ? "Creating..."
                                      : hasSourceQuotation
                                        ? "Create Invoice"
                                        : "No Source"}
                                  </button>
                                </>
                              )}
                            </div>

                            {invoice && (
                              <p
                                title={invoice.invoice_no}
                                className="truncate text-center text-[10px] text-slate-500"
                              >
                                {invoice.invoice_no}
                              </p>
                            )}

                            {!invoice &&
                              report.source_quotation_no && (
                                <p
                                  title={
                                    report.source_quotation_no
                                  }
                                  className="truncate text-center text-[10px] text-slate-500"
                                >
                                  Source:{" "}
                                  {report.source_quotation_no}
                                </p>
                              )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
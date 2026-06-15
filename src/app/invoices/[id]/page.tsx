"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase/client";

const EMIT_LOGO_SRC = "/images/emit-logo.png";
const EMIT_SIGNATURE_STAMP_SRC = "/images/emit-signature-stamp.png";

type Invoice = {
  id: string;
  company_id: string;
  quotation_id: string | null;
  customer_id: string | null;
  invoice_no: string;
  invoice_date: string;
  customer_name: string | null;
  project_name: string | null;
  project_description: string | null;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  currency: string;
  status: string;
};

type InvoiceItem = {
  id: string;
  invoice_id: string;
  sample_no?: number | null;
  sample_name?: string | null;
  item_no: number | null;
  item_name: string | null;
  description: string | null;
  unit_price: number | null;
  unit_price_mop?: number | null;
  quantity: number | null;
  total_amount: number | null;
  total_price?: number | null;
  sort_order: number | null;
};

type GroupedInvoiceItem = {
  itemNo: number;
  itemName: string;
  items: InvoiceItem[];
  totalAmount: number;
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

  return `${day}/${month}/${year}`;
}

function getTodayDateValue() {
  return new Date().toISOString().slice(0, 10);
}

function buildReceiptNo(attempt: number) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const timeCode = String(now.getTime()).slice(-6);

  if (attempt === 0) {
    return `RCT-${year}${month}-${timeCode}`;
  }

  return `RCT-${year}${month}-${timeCode}-${attempt + 1}`;
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

function isDuplicateError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

function splitProjectDescription(projectDescription: string | null) {
  return String(projectDescription || "")
    .split(/[、,\n\r]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getInvoiceItemNo(item: InvoiceItem, index: number) {
  const itemNo = Number(item.sample_no || item.item_no || index + 1);

  if (Number.isNaN(itemNo) || itemNo <= 0) {
    return index + 1;
  }

  return itemNo;
}

function getInvoiceItemName(
  invoice: Invoice | null,
  item: InvoiceItem,
  itemNo: number
) {
  const directName =
    item.sample_name?.trim() || item.item_name?.trim() || "";

  if (directName) {
    return directName;
  }

  const projectItems = splitProjectDescription(
    invoice?.project_description || ""
  );

  return projectItems[itemNo - 1] || `Item ${itemNo}`;
}

function getInvoiceItemUnitPrice(item: InvoiceItem) {
  const unitPrice = Number(item.unit_price ?? item.unit_price_mop ?? 0);

  if (Number.isNaN(unitPrice) || unitPrice < 0) {
    return 0;
  }

  return unitPrice;
}

function getInvoiceItemQuantity(item: InvoiceItem) {
  const quantity = Number(item.quantity || 1);

  if (Number.isNaN(quantity) || quantity <= 0) {
    return 1;
  }

  return quantity;
}

function getInvoiceItemTotalAmount(item: InvoiceItem) {
  const savedTotal = Number(item.total_amount ?? item.total_price ?? 0);

  if (!Number.isNaN(savedTotal) && savedTotal > 0) {
    return savedTotal;
  }

  return getInvoiceItemUnitPrice(item) * getInvoiceItemQuantity(item);
}

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const invoiceId = Array.isArray(params.id)
    ? params.id[0]
    : typeof params.id === "string"
      ? params.id
      : "";

  const [hasMounted, setHasMounted] = useState(false);

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [creatingReceipt, setCreatingReceipt] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!hasMounted || !invoiceId) {
      return;
    }

    loadInvoiceDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMounted, invoiceId]);

  async function loadInvoiceDetail() {
    try {
      setLoading(true);
      setErrorMessage("");

      const { data: invoiceData, error: invoiceError } = await supabase
        .from("invoices")
        .select("*")
        .eq("id", invoiceId)
        .is("deleted_at", null)
        .maybeSingle();

      if (invoiceError) {
        throw invoiceError;
      }

      if (!invoiceData) {
        setInvoice(null);
        setItems([]);
        return;
      }

      const { data: invoiceItemsData, error: invoiceItemsError } =
        await supabase
          .from("invoice_items")
          .select("*")
          .eq("invoice_id", invoiceId)
          .is("deleted_at", null)
          .order("sort_order", { ascending: true });

      if (invoiceItemsError) {
        throw invoiceItemsError;
      }

      setInvoice(invoiceData as Invoice);
      setItems((invoiceItemsData ?? []) as InvoiceItem[]);
    } catch (error) {
      console.error("Load invoice detail error:", error);
      setErrorMessage(getErrorMessage(error, "Failed to load invoice detail."));
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateReceipt() {
    if (!invoice) {
      return;
    }

    try {
      setCreatingReceipt(true);
      setErrorMessage("");

      const { data: existingReceipt, error: existingReceiptError } =
        await supabase
          .from("receipts")
          .select("id")
          .eq("invoice_id", invoice.id)
          .is("deleted_at", null)
          .maybeSingle();

      if (existingReceiptError) {
        throw existingReceiptError;
      }

      if (existingReceipt?.id) {
        router.push(`/receipts/${existingReceipt.id}`);
        return;
      }

      let createdReceiptId = "";
      let lastError: unknown = null;

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const receiptNo = buildReceiptNo(attempt);

        const { data: createdReceipt, error: createReceiptError } =
          await supabase
            .from("receipts")
            .insert({
              company_id: invoice.company_id,
              invoice_id: invoice.id,
              customer_id: invoice.customer_id,
              receipt_no: receiptNo,
              receipt_date: getTodayDateValue(),
              customer_name: invoice.customer_name || "",
              invoice_no: invoice.invoice_no,
              project_name: invoice.project_name || "",
              project_description: invoice.project_description || "",
              amount_received: Number(invoice.total_amount || 0),
              currency: invoice.currency || "MOP",
              payment_method: "",
              payment_reference: "",
              received_by: "",
              remarks: "",
              status: "draft",
            })
            .select("id")
            .single();

        if (!createReceiptError && createdReceipt?.id) {
          createdReceiptId = createdReceipt.id;
          break;
        }

        lastError = createReceiptError;

        if (!isDuplicateError(createReceiptError)) {
          break;
        }
      }

      if (!createdReceiptId) {
        throw new Error(
          getErrorMessage(lastError, "Failed to create receipt.")
        );
      }

      if (items.length > 0) {
        const receiptItemsPayload = items.map((item, index) => {
          const itemNo = getInvoiceItemNo(item, index);
          const itemName = getInvoiceItemName(invoice, item, itemNo);

          return {
            company_id: invoice.company_id,
            receipt_id: createdReceiptId,
            invoice_item_id: item.id,
            item_no: itemNo,
            item_name: itemName,
            description: item.description || "",
            unit_price: getInvoiceItemUnitPrice(item),
            quantity: getInvoiceItemQuantity(item),
            total_amount: getInvoiceItemTotalAmount(item),
            sort_order: Number(item.sort_order || index + 1),
          };
        });

        const { error: receiptItemsError } = await supabase
          .from("receipt_items")
          .insert(receiptItemsPayload);

        if (receiptItemsError) {
          const deletedAt = new Date().toISOString();

          await supabase
            .from("receipts")
            .update({
              deleted_at: deletedAt,
              updated_at: deletedAt,
            })
            .eq("id", createdReceiptId);

          throw receiptItemsError;
        }
      }

      router.push(`/receipts/${createdReceiptId}`);
    } catch (error) {
      console.error("Create receipt error:", error);
      setErrorMessage(getErrorMessage(error, "Failed to create receipt."));
    } finally {
      setCreatingReceipt(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  function handleDownloadPdf() {
    if (!invoiceId) {
      setErrorMessage("Cannot find invoice id for PDF generation.");
      return;
    }

    setErrorMessage("");
    setGeneratingPdf(true);

    window.location.href = `/api/invoices/${encodeURIComponent(
      String(invoiceId)
    )}/pdf`;

    setTimeout(() => {
      setGeneratingPdf(false);
    }, 1200);
  }

  const groupedItems = useMemo<GroupedInvoiceItem[]>(() => {
    const groupMap = new Map<number, GroupedInvoiceItem>();

    items.forEach((item, index) => {
      const itemNo = getInvoiceItemNo(item, index);
      const itemName = getInvoiceItemName(invoice, item, itemNo);
      const itemTotalAmount = getInvoiceItemTotalAmount(item);
      const existingGroup = groupMap.get(itemNo);

      if (existingGroup) {
        existingGroup.items.push(item);
        existingGroup.totalAmount += itemTotalAmount;
      } else {
        groupMap.set(itemNo, {
          itemNo,
          itemName,
          items: [item],
          totalAmount: itemTotalAmount,
        });
      }
    });

    return Array.from(groupMap.values()).sort(
      (a, b) => a.itemNo - b.itemNo
    );
  }, [invoice, items]);

  if (!hasMounted) {
    return (
      <AppShell>
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
            Loading invoice detail...
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <style>{`
        @media print {
          body {
            background: #ffffff !important;
          }

          .print-hidden {
            display: none !important;
          }

          .print-layout {
            display: block !important;
          }

          .document-print-area {
            border: none !important;
            box-shadow: none !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: none !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-6xl">
        <div className="print-hidden mb-8 flex items-center justify-between">
          <div>
            <button
              onClick={() => router.push("/invoices")}
              className="mb-3 text-sm font-semibold text-slate-500 hover:text-slate-900"
            >
              ← Back to Invoices
            </button>

            <h1 className="text-3xl font-bold text-slate-900">
              Invoice Detail
            </h1>

            <p className="mt-2 text-slate-500">
              Review generated invoice from quotation.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={loadInvoiceDetail}
              disabled={loading}
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Refresh
            </button>

            {invoice?.quotation_id && (
              <button
                onClick={() =>
                  router.push(`/quotations/${invoice.quotation_id}`)
                }
                className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Source Quotation
              </button>
            )}

            <button
              onClick={handlePrint}
              disabled={loading || !invoice}
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Print
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={loading || generatingPdf || !invoice}
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generatingPdf ? "Generating..." : "Generate PDF"}
            </button>

            <button
              onClick={handleCreateReceipt}
              disabled={loading || creatingReceipt || !invoice}
              className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creatingReceipt ? "Creating..." : "Create Receipt"}
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="print-hidden mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
            Loading invoice detail...
          </div>
        )}

        {!loading && !invoice && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
            Invoice not found.
          </div>
        )}

        {!loading && invoice && (
          <div className="print-layout grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="document-print-area rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="border-b border-slate-200 pb-6">
                <div className="w-[320px]">
                  <Image
                    src={EMIT_LOGO_SRC}
                    alt="EMIT Logo"
                    width={320}
                    height={78}
                    priority
                    className="h-[78px] w-[320px] object-contain object-left"
                  />
                </div>

                <h2 className="mt-6 text-center text-3xl font-bold tracking-wide text-slate-900">
                  INVOICE
                </h2>
              </div>

              <div className="mt-6 text-sm leading-7 text-slate-700">
                <p>澳門美副將大馬路萬基工業大廈 3樓A座</p>
                <p>
                  TEL: (853) 2875 1742 &nbsp;&nbsp; FAX: (853) 2835 5613
                  &nbsp;&nbsp; E-MAIL: finance01@emit.com.mo
                </p>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-8 text-sm">
                <div className="space-y-3">
                  <div className="grid grid-cols-[130px_1fr] gap-3">
                    <p className="font-semibold text-slate-700">Customer:</p>
                    <p className="text-slate-900">
                      {invoice.customer_name || "-"}
                    </p>
                  </div>

                  <div className="grid grid-cols-[130px_1fr] gap-3">
                    <p className="font-semibold text-slate-700">
                      Project Name:
                    </p>
                    <p className="text-slate-900">
                      {invoice.project_name || "-"}
                    </p>
                  </div>

                  <div className="grid grid-cols-[130px_1fr] gap-3">
                    <p className="font-semibold text-slate-700">Project:</p>
                    <p className="text-slate-900">
                      {invoice.project_description || "-"}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-[130px_1fr] gap-3">
                    <p className="font-semibold text-slate-700">Invoice No:</p>
                    <p className="text-slate-900">{invoice.invoice_no}</p>
                  </div>

                  <div className="grid grid-cols-[130px_1fr] gap-3">
                    <p className="font-semibold text-slate-700">Date:</p>
                    <p className="text-slate-900">
                      {formatDateText(invoice.invoice_date)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 overflow-hidden rounded-xl border border-slate-300">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="w-16 border border-slate-300 px-4 py-3 text-center align-middle font-semibold text-slate-700">
                        Item
                        <br />
                        事項
                      </th>
                      <th className="w-56 border border-slate-300 px-4 py-3 text-center align-middle font-semibold text-slate-700">
                        Name
                        <br />
                        名稱
                      </th>
                      <th className="border border-slate-300 px-4 py-3 text-center align-middle font-semibold text-slate-700">
                        Description
                        <br />
                        描述
                      </th>
                      <th className="w-32 border border-slate-300 px-4 py-3 text-center align-middle font-semibold text-slate-700">
                        Unit Price
                        <br />
                        單價
                      </th>
                      <th className="w-24 border border-slate-300 px-4 py-3 text-center align-middle font-semibold text-slate-700">
                        Qty.
                        <br />
                        數量
                      </th>
                      <th className="w-36 border border-slate-300 px-4 py-3 text-center align-middle font-semibold text-slate-700">
                        Total
                        <br />
                        總價
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {groupedItems.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="border border-slate-300 px-4 py-10 text-center align-middle text-slate-500"
                        >
                          No invoice items.
                        </td>
                      </tr>
                    )}

                    {groupedItems.map((group) =>
                      group.items.map((item, itemIndex) => (
                        <tr key={item.id}>
                          {itemIndex === 0 && (
                            <>
                              <td
                                rowSpan={group.items.length}
                                className="border border-slate-300 px-4 py-3 text-center align-middle text-slate-900"
                              >
                                {group.itemNo}
                              </td>

                              <td
                                rowSpan={group.items.length}
                                className="border border-slate-300 px-4 py-3 text-center align-middle font-semibold text-slate-900"
                              >
                                {group.itemName}
                              </td>
                            </>
                          )}

                          <td className="border border-slate-300 px-4 py-3 text-center align-middle text-slate-900">
                            {item.description || "-"}
                          </td>

                          <td className="border border-slate-300 px-4 py-3 text-center align-middle text-slate-900">
                            {getInvoiceItemUnitPrice(item).toLocaleString()}
                          </td>

                          <td className="border border-slate-300 px-4 py-3 text-center align-middle text-slate-900">
                            {getInvoiceItemQuantity(item).toLocaleString()}
                          </td>

                          <td className="border border-slate-300 px-4 py-3 text-center align-middle font-semibold text-slate-900">
                            {invoice.currency}{" "}
                            {getInvoiceItemTotalAmount(item).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}

                    <tr className="bg-slate-50">
                      <td
                        colSpan={5}
                        className="border border-slate-300 px-4 py-3 text-right align-middle font-bold text-slate-900"
                      >
                        Invoice Total / 發票總額：
                      </td>
                      <td className="border border-slate-300 px-4 py-3 text-center align-middle font-bold text-slate-900">
                        {invoice.currency}{" "}
                        {Number(invoice.total_amount || 0).toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-12 grid grid-cols-[320px_1fr] gap-12">
                <div>
                  <p className="font-semibold text-slate-900">
                    環科監控檢測有限公司
                  </p>

                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    EMIT Environment Monitoring Inspection and Testing Co.
                    Ltd.
                  </p>

                  <div className="mt-4 w-[260px]">
                    <Image
                      src={EMIT_SIGNATURE_STAMP_SRC}
                      alt="EMIT Company Chop and Authorized Signature"
                      width={260}
                      height={105}
                      className="h-[105px] w-[260px] object-contain object-left"
                    />
                  </div>

                  <div className="mt-4 border-b border-slate-400" />

                  <p className="mt-3 text-sm text-slate-500">
                    Authorized Signature
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-700">
                  <p className="font-semibold text-slate-900">Bank Details:</p>
                  <p>Make all checks payable to: 環科監控檢測有限公司</p>
                  <p>Payable by check or Electronic Transfer</p>
                  <p>Receiving Bank: BANCO TAI FUNG (大豐銀行)</p>
                  <p>Beneficiary Account No: MOP: 201-1-09950-1</p>
                  <p>Beneficiary Account Name: 環科監控檢測有限公司</p>
                  <p>Swift Code: TFBLMOMX</p>
                </div>
              </div>
            </div>

            <div className="print-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900">
                Invoice Information
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Review invoice details and create receipt.
              </p>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Invoice Date
                  </label>
                  <input
                    value={formatDateText(invoice.invoice_date)}
                    readOnly
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Invoice No
                  </label>
                  <input
                    value={invoice.invoice_no}
                    readOnly
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Customer
                  </label>
                  <input
                    value={invoice.customer_name || ""}
                    readOnly
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Total Amount
                  </label>
                  <input
                    value={`${invoice.currency} ${Number(
                      invoice.total_amount || 0
                    ).toLocaleString()}`}
                    readOnly
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold outline-none"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Status
                  </label>
                  <input
                    value={invoice.status}
                    readOnly
                    className="mt-2 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none"
                  />
                </div>

                <button
                  onClick={handleCreateReceipt}
                  disabled={loading || creatingReceipt || !invoice}
                  className="w-full rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creatingReceipt ? "Creating..." : "Create Receipt"}
                </button>

                {invoice.quotation_id && (
                  <button
                    onClick={() =>
                      router.push(`/quotations/${invoice.quotation_id}`)
                    }
                    className="w-full rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Source Quotation
                  </button>
                )}

                <button
                  onClick={loadInvoiceDetail}
                  disabled={loading}
                  className="w-full rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Refresh
                </button>

                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-6 text-blue-800">
                  This invoice was generated from quotation. After creating a
                  receipt, the payment record will be handled in Receipt Detail.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
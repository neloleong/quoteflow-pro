"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase/client";

const EMIT_LOGO_SRC = "/images/emit-logo.png";
const EMIT_SIGNATURE_STAMP_SRC = "/images/emit-signature-stamp.png";

type Receipt = {
  id: string;
  company_id: string;
  invoice_id: string | null;
  customer_id: string | null;
  receipt_no: string;
  receipt_date: string | null;
  customer_name: string | null;
  invoice_no: string | null;
  project_name: string | null;
  project_description: string | null;
  amount_received: number | null;
  currency: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  received_by: string | null;
  remarks: string | null;
  status: string | null;
};

type ReceiptItem = {
  id: string;
  receipt_id: string;
  invoice_item_id: string | null;
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

type GroupedReceiptItem = {
  itemNo: number;
  itemName: string;
  items: ReceiptItem[];
  totalAmount: number;
};

type ReceiptForm = {
  receipt_date: string;
  amount_received: string;
  payment_method: string;
  payment_reference: string;
  received_by: string;
  remarks: string;
  status: string;
};

function getTodayDateValue() {
  return new Date().toISOString().slice(0, 10);
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

  return `${day}/${month}/${year}`;
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

function isDuplicateKeyError(error: unknown) {
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

function getReceiptItemNo(item: ReceiptItem, index: number) {
  const itemNo = Number(item.sample_no || item.item_no || index + 1);

  if (Number.isNaN(itemNo) || itemNo <= 0) {
    return index + 1;
  }

  return itemNo;
}

function getInvoiceItemNo(item: InvoiceItem, index: number) {
  const itemNo = Number(item.sample_no || item.item_no || index + 1);

  if (Number.isNaN(itemNo) || itemNo <= 0) {
    return index + 1;
  }

  return itemNo;
}

function getReceiptItemName(
  receipt: Receipt | null,
  item: ReceiptItem,
  itemNo: number
) {
  const directName =
    item.sample_name?.trim() || item.item_name?.trim() || "";

  if (directName) {
    return directName;
  }

  const projectItems = splitProjectDescription(
    receipt?.project_description || ""
  );

  return projectItems[itemNo - 1] || `Item ${itemNo}`;
}

function getInvoiceItemName(
  receipt: Receipt,
  item: InvoiceItem,
  itemNo: number
) {
  const directName =
    item.sample_name?.trim() || item.item_name?.trim() || "";

  if (directName) {
    return directName;
  }

  const projectItems = splitProjectDescription(receipt.project_description);

  return projectItems[itemNo - 1] || `Item ${itemNo}`;
}

function getReceiptItemUnitPrice(item: ReceiptItem) {
  const unitPrice = Number(item.unit_price ?? item.unit_price_mop ?? 0);

  if (Number.isNaN(unitPrice) || unitPrice < 0) {
    return 0;
  }

  return unitPrice;
}

function getInvoiceItemUnitPrice(item: InvoiceItem) {
  const unitPrice = Number(item.unit_price ?? item.unit_price_mop ?? 0);

  if (Number.isNaN(unitPrice) || unitPrice < 0) {
    return 0;
  }

  return unitPrice;
}

function getReceiptItemQuantity(item: ReceiptItem) {
  const quantity = Number(item.quantity || 1);

  if (Number.isNaN(quantity) || quantity <= 0) {
    return 1;
  }

  return quantity;
}

function getInvoiceItemQuantity(item: InvoiceItem) {
  const quantity = Number(item.quantity || 1);

  if (Number.isNaN(quantity) || quantity <= 0) {
    return 1;
  }

  return quantity;
}

function getReceiptItemTotalAmount(item: ReceiptItem) {
  const savedTotal = Number(item.total_amount ?? item.total_price ?? 0);

  if (!Number.isNaN(savedTotal) && savedTotal > 0) {
    return savedTotal;
  }

  return getReceiptItemUnitPrice(item) * getReceiptItemQuantity(item);
}

function getInvoiceItemTotalAmount(item: InvoiceItem) {
  const savedTotal = Number(item.total_amount ?? item.total_price ?? 0);

  if (!Number.isNaN(savedTotal) && savedTotal > 0) {
    return savedTotal;
  }

  return getInvoiceItemUnitPrice(item) * getInvoiceItemQuantity(item);
}

export default function ReceiptDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const receiptId = Array.isArray(params.id)
    ? params.id[0]
    : typeof params.id === "string"
      ? params.id
      : "";

  const [hasMounted, setHasMounted] = useState(false);

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([]);

  const [form, setForm] = useState<ReceiptForm>({
    receipt_date: "",
    amount_received: "0",
    payment_method: "",
    payment_reference: "",
    received_by: "",
    remarks: "",
    status: "draft",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    setHasMounted(true);

    setForm((currentForm) => ({
      ...currentForm,
      receipt_date: currentForm.receipt_date || getTodayDateValue(),
    }));
  }, []);

  useEffect(() => {
    if (!hasMounted || !receiptId) {
      return;
    }

    loadReceiptDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMounted, receiptId]);

  async function loadReceiptItems(currentReceiptId: string) {
    const { data, error } = await supabase
      .from("receipt_items")
      .select("*")
      .eq("receipt_id", currentReceiptId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true });

    if (error) {
      throw error;
    }

    return (data ?? []) as ReceiptItem[];
  }

  async function syncInvoiceItemsToReceipt(currentReceipt: Receipt) {
    if (!currentReceipt.invoice_id) {
      return loadReceiptItems(currentReceipt.id);
    }

    const existingReceiptItems = await loadReceiptItems(currentReceipt.id);

    const existingInvoiceItemIds = new Set(
      existingReceiptItems
        .map((item) => item.invoice_item_id)
        .filter((invoiceItemId): invoiceItemId is string =>
          Boolean(invoiceItemId)
        )
    );

    const { data: invoiceItemsData, error: invoiceItemsError } = await supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", currentReceipt.invoice_id)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true });

    if (invoiceItemsError) {
      throw invoiceItemsError;
    }

    const invoiceItems = (invoiceItemsData ?? []) as InvoiceItem[];

    if (invoiceItems.length === 0) {
      return existingReceiptItems;
    }

    const receiptItemsPayload = invoiceItems
      .filter((item) => !existingInvoiceItemIds.has(item.id))
      .map((item, index) => {
        const itemNo = getInvoiceItemNo(item, index);
        const itemName = getInvoiceItemName(currentReceipt, item, itemNo);

        return {
          company_id: currentReceipt.company_id,
          receipt_id: currentReceipt.id,
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

    if (receiptItemsPayload.length === 0) {
      return existingReceiptItems;
    }

    const { error: insertError } = await supabase
      .from("receipt_items")
      .insert(receiptItemsPayload);

    if (insertError) {
      if (isDuplicateKeyError(insertError)) {
        return loadReceiptItems(currentReceipt.id);
      }

      throw insertError;
    }

    return loadReceiptItems(currentReceipt.id);
  }

  async function loadReceiptDetail() {
    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const { data: receiptData, error: receiptError } = await supabase
        .from("receipts")
        .select("*")
        .eq("id", receiptId)
        .is("deleted_at", null)
        .maybeSingle();

      if (receiptError) {
        throw receiptError;
      }

      if (!receiptData) {
        setReceipt(null);
        setReceiptItems([]);
        return;
      }

      const currentReceipt = receiptData as Receipt;
      let currentReceiptItems = await loadReceiptItems(currentReceipt.id);

      if (currentReceiptItems.length === 0 && currentReceipt.invoice_id) {
        currentReceiptItems = await syncInvoiceItemsToReceipt(currentReceipt);

        if (currentReceiptItems.length > 0) {
          setSuccessMessage(
            "Receipt items have been synced from the source invoice."
          );
        }
      }

      setReceipt(currentReceipt);
      setReceiptItems(currentReceiptItems);

      setForm({
        receipt_date: currentReceipt.receipt_date || getTodayDateValue(),
        amount_received: String(Number(currentReceipt.amount_received || 0)),
        payment_method: currentReceipt.payment_method || "",
        payment_reference: currentReceipt.payment_reference || "",
        received_by: currentReceipt.received_by || "",
        remarks: currentReceipt.remarks || "",
        status: currentReceipt.status || "draft",
      });
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, "Failed to load receipt detail.")
      );
    } finally {
      setLoading(false);
    }
  }

  function updateForm<K extends keyof ReceiptForm>(
    field: K,
    value: ReceiptForm[K]
  ) {
    setForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  async function saveReceipt() {
    if (!receipt) {
      return;
    }

    try {
      setSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      const amountReceived = Number(form.amount_received || 0);

      if (Number.isNaN(amountReceived) || amountReceived < 0) {
        setErrorMessage("Amount received must be a valid number.");
        return;
      }

      const { data, error } = await supabase
        .from("receipts")
        .update({
          receipt_date: form.receipt_date || getTodayDateValue(),
          amount_received: amountReceived,
          payment_method: form.payment_method.trim(),
          payment_reference: form.payment_reference.trim(),
          received_by: form.received_by.trim(),
          remarks: form.remarks.trim(),
          status: form.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", receipt.id)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      const updatedReceipt = data as Receipt;
      setReceipt(updatedReceipt);

      if (form.status === "issued" && updatedReceipt.invoice_id) {
        const { error: invoiceUpdateError } = await supabase
          .from("invoices")
          .update({
            status: "paid",
            updated_at: new Date().toISOString(),
          })
          .eq("id", updatedReceipt.invoice_id)
          .is("deleted_at", null);

        if (invoiceUpdateError) {
          throw invoiceUpdateError;
        }
      }

      setSuccessMessage("Receipt saved successfully.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Failed to save receipt."));
    } finally {
      setSaving(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  function handleDownloadPdf() {
    if (!receiptId) {
      setErrorMessage("Cannot find receipt id for PDF generation.");
      return;
    }

    setErrorMessage("");
    setGeneratingPdf(true);

    window.location.href = `/api/receipts/${encodeURIComponent(
      String(receiptId)
    )}/pdf`;

    setTimeout(() => {
      setGeneratingPdf(false);
    }, 1200);
  }

  const groupedItems = useMemo<GroupedReceiptItem[]>(() => {
    const groupMap = new Map<number, GroupedReceiptItem>();

    receiptItems.forEach((item, index) => {
      const itemNo = getReceiptItemNo(item, index);
      const itemName = getReceiptItemName(receipt, item, itemNo);
      const itemTotalAmount = getReceiptItemTotalAmount(item);
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
  }, [receipt, receiptItems]);

  const itemTotalAmount = useMemo(() => {
    return receiptItems.reduce((sum, item) => {
      return sum + getReceiptItemTotalAmount(item);
    }, 0);
  }, [receiptItems]);

  const projectDisplayText = useMemo(() => {
    const projectDescription = receipt?.project_description?.trim();

    if (projectDescription && projectDescription !== "-") {
      return projectDescription;
    }

    const itemNames = Array.from(
      new Set(
        receiptItems
          .map((item, index) => {
            const itemNo = getReceiptItemNo(item, index);
            return getReceiptItemName(receipt, item, itemNo).trim();
          })
          .filter(Boolean)
      )
    );

    if (itemNames.length > 0) {
      return itemNames.join("、");
    }

    return "-";
  }, [receipt, receiptItems]);

  if (!hasMounted) {
    return (
      <AppShell>
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
            Loading receipt detail...
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
              onClick={() => router.push("/receipts")}
              className="mb-3 text-sm font-semibold text-slate-500 hover:text-slate-900"
            >
              ← Back to Receipts
            </button>

            <h1 className="text-3xl font-bold text-slate-900">
              Receipt Detail
            </h1>

            <p className="mt-2 text-slate-500">
              Review receipt, invoice content and payment information.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={loadReceiptDetail}
              disabled={loading}
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Refresh
            </button>

            {receipt?.invoice_id && (
              <button
                onClick={() => router.push(`/invoices/${receipt.invoice_id}`)}
                className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Source Invoice
              </button>
            )}

            <button
              onClick={handlePrint}
              disabled={loading || !receipt}
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Print
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={loading || generatingPdf || !receipt}
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generatingPdf ? "Generating..." : "Generate PDF"}
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="print-hidden mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="print-hidden mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-700">
            {successMessage}
          </div>
        )}

        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
            Loading receipt detail...
          </div>
        )}

        {!loading && !receipt && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
            Receipt not found.
          </div>
        )}

        {!loading && receipt && (
          <div className="print-layout grid gap-6 lg:grid-cols-[1fr_360px]">
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
                  RECEIPT
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
                      {receipt.customer_name || "-"}
                    </p>
                  </div>

                  <div className="grid grid-cols-[130px_1fr] gap-3">
                    <p className="font-semibold text-slate-700">Invoice No:</p>
                    <p className="text-slate-900">
                      {receipt.invoice_no || "-"}
                    </p>
                  </div>

                  <div className="grid grid-cols-[130px_1fr] gap-3">
                    <p className="font-semibold text-slate-700">
                      Project Name:
                    </p>
                    <p className="text-slate-900">
                      {receipt.project_name || "-"}
                    </p>
                  </div>

                  <div className="grid grid-cols-[130px_1fr] gap-3">
                    <p className="font-semibold text-slate-700">Project:</p>
                    <p className="text-slate-900">{projectDisplayText}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-[130px_1fr] gap-3">
                    <p className="font-semibold text-slate-700">Receipt No:</p>
                    <p className="text-slate-900">{receipt.receipt_no}</p>
                  </div>

                  <div className="grid grid-cols-[130px_1fr] gap-3">
                    <p className="font-semibold text-slate-700">Date:</p>
                    <p className="text-slate-900">
                      {formatDateText(form.receipt_date)}
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
                          No receipt items found. Click Refresh to sync from
                          the source invoice.
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
                            {getReceiptItemUnitPrice(item).toLocaleString()}
                          </td>

                          <td className="border border-slate-300 px-4 py-3 text-center align-middle text-slate-900">
                            {getReceiptItemQuantity(item).toLocaleString()}
                          </td>

                          <td className="border border-slate-300 px-4 py-3 text-center align-middle font-semibold text-slate-900">
                            {receipt.currency || "MOP"}{" "}
                            {getReceiptItemTotalAmount(item).toLocaleString()}
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
                        {receipt.currency || "MOP"}{" "}
                        {Number(itemTotalAmount || 0).toLocaleString()}
                      </td>
                    </tr>

                    <tr className="bg-emerald-50">
                      <td
                        colSpan={5}
                        className="border border-slate-300 px-4 py-3 text-right align-middle font-bold text-emerald-900"
                      >
                        Amount Received / 已收款項：
                      </td>
                      <td className="border border-slate-300 px-4 py-3 text-center align-middle font-bold text-emerald-900">
                        {receipt.currency || "MOP"}{" "}
                        {Number(form.amount_received || 0).toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-8 overflow-hidden rounded-xl border border-slate-300">
                <table className="w-full border-collapse text-sm">
                  <tbody>
                    <tr>
                      <td className="w-56 border border-slate-300 bg-slate-100 px-4 py-3 font-semibold text-slate-700">
                        Payment Method
                      </td>
                      <td className="border border-slate-300 px-4 py-3 text-slate-900">
                        {form.payment_method || "-"}
                      </td>
                    </tr>

                    <tr>
                      <td className="border border-slate-300 bg-slate-100 px-4 py-3 font-semibold text-slate-700">
                        Payment Reference
                      </td>
                      <td className="border border-slate-300 px-4 py-3 text-slate-900">
                        {form.payment_reference || "-"}
                      </td>
                    </tr>

                    <tr>
                      <td className="border border-slate-300 bg-slate-100 px-4 py-3 font-semibold text-slate-700">
                        Received By
                      </td>
                      <td className="border border-slate-300 px-4 py-3 text-slate-900">
                        {form.received_by || "-"}
                      </td>
                    </tr>

                    <tr>
                      <td className="border border-slate-300 bg-slate-100 px-4 py-3 font-semibold text-slate-700">
                        Remarks
                      </td>
                      <td className="border border-slate-300 px-4 py-3 text-slate-900">
                        {form.remarks || "-"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-12">
                <div className="w-[320px]">
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
              </div>
            </div>

            <div className="print-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900">
                Payment Information
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Edit payment details before issuing the receipt.
              </p>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Receipt Date
                  </label>
                  <input
                    type="date"
                    value={form.receipt_date}
                    onChange={(event) =>
                      updateForm("receipt_date", event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Amount Received
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.amount_received}
                    onChange={(event) =>
                      updateForm("amount_received", event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Payment Method
                  </label>
                  <select
                    value={form.payment_method}
                    onChange={(event) =>
                      updateForm("payment_method", event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                  >
                    <option value="">Select method</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Cash">Cash</option>
                    <option value="Online Payment">Online Payment</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Payment Reference
                  </label>
                  <input
                    value={form.payment_reference}
                    onChange={(event) =>
                      updateForm("payment_reference", event.target.value)
                    }
                    placeholder="Bank transfer ref, cheque no..."
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Received By
                  </label>
                  <input
                    value={form.received_by}
                    onChange={(event) =>
                      updateForm("received_by", event.target.value)
                    }
                    placeholder="Staff name"
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Status
                  </label>
                  <select
                    value={form.status}
                    onChange={(event) =>
                      updateForm("status", event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                  >
                    <option value="draft">Draft</option>
                    <option value="issued">Issued</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Remarks
                  </label>
                  <textarea
                    value={form.remarks}
                    onChange={(event) =>
                      updateForm("remarks", event.target.value)
                    }
                    rows={4}
                    placeholder="Optional internal or receipt remarks..."
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                  />
                </div>

                <button
                  onClick={saveReceipt}
                  disabled={saving}
                  className="w-full rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Save Receipt"}
                </button>

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-800">
                  When status is changed to <strong>Issued</strong>, the source
                  invoice status will be updated to <strong>paid</strong>.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
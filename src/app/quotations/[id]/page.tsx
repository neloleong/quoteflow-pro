"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase/client";

const EMIT_COMPANY_ID = "11111111-1111-1111-1111-111111111111";

const EMIT_LOGO_SRC = "/images/emit-logo.png";
const EMIT_SIGNATURE_STAMP_SRC = "/images/emit-signature-stamp.png";

type Quotation = {
  id: string;
  company_id: string;
  customer_id: string;
  quotation_no: string;
  quotation_date: string | null;
  to_customer_name: string | null;
  attention_to: string | null;
  from_company_name: string | null;
  from_tel: string | null;
  from_fax: string | null;
  from_email: string | null;
  project_name: string | null;
  project_description: string | null;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  currency: string | null;
  notes: string | null;
  status: string;
};

type QuotationItem = {
  id: string;
  quotation_id: string;
  test_item_id: string | null;
  sample_no: number | null;
  sample_name: string | null;
  test_category_name: string | null;
  item_no: number | null;
  description: string | null;
  quantity: number;
  unit: string | null;
  lab_price_rmb_snapshot: number | null;
  customer_unit_price_mop_snapshot: number;
  customer_total_price_mop_snapshot: number;
  sort_order: number;

  source_group_id?: string | null;
  source_group_code?: string | null;
  source_group_name?: string | null;
  source_group_sort_order?: number | null;
};

type ExistingInvoice = {
  id: string;
  invoice_no: string;
};

type GroupedQuotationItem = {
  itemNo: number;
  sampleName: string;
  items: QuotationItem[];
  sampleTotal: number;
};

type FlatQuotationRow = {
  rowKey: string;
  itemNo: number;
  sampleName: string;
  testCategoryName: string;
  description: string;
  unitPrice: number;
  quantity: number;
  total: number;
};

type QuotationEditForm = {
  quotation_no: string;
  quotation_date: string;
  to_customer_name: string;
  attention_to: string;
  from_company_name: string;
  from_tel: string;
  from_fax: string;
  from_email: string;
  project_name: string;
  project_description: string;
  subtotal: string;
  discount_amount: string;
  total_amount: string;
  currency: string;
  notes: string;
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

function createEditFormFromQuotation(quotation: Quotation): QuotationEditForm {
  return {
    quotation_no: quotation.quotation_no || "",
    quotation_date: quotation.quotation_date || "",
    to_customer_name: quotation.to_customer_name || "",
    attention_to: quotation.attention_to || "",
    from_company_name: quotation.from_company_name || "",
    from_tel: quotation.from_tel || "",
    from_fax: quotation.from_fax || "",
    from_email: quotation.from_email || "",
    project_name: quotation.project_name || "",
    project_description: quotation.project_description || "",
    subtotal: String(Number(quotation.subtotal || 0)),
    discount_amount: String(Number(quotation.discount_amount || 0)),
    total_amount: String(Number(quotation.total_amount || 0)),
    currency: quotation.currency || "MOP",
    notes: quotation.notes || "",
  };
}

function createEmptyEditForm(): QuotationEditForm {
  return {
    quotation_no: "",
    quotation_date: "",
    to_customer_name: "",
    attention_to: "",
    from_company_name: "",
    from_tel: "",
    from_fax: "",
    from_email: "",
    project_name: "",
    project_description: "",
    subtotal: "0",
    discount_amount: "0",
    total_amount: "0",
    currency: "MOP",
    notes: "",
  };
}

function parseAmountText(value: string) {
  const parsedValue = Number(value);

  if (Number.isNaN(parsedValue)) {
    return 0;
  }

  return parsedValue;
}

function getSafePdfFileName(fileName: string) {
  return fileName.replace(/[\\/:*?"<>|]+/g, "-");
}

function normalizeQuotationText(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

function isKnownPackageCategory(value: string | null | undefined) {
  const normalizedValue = normalizeQuotationText(value);

  return (
    normalizedValue === "營養標籤" ||
    normalizedValue === "营养标签" ||
    normalizedValue === "nutritionlabel"
  );
}

function getQuotationItemUnitPrice(item: QuotationItem) {
  return Number(item.customer_unit_price_mop_snapshot || 0);
}

function getQuotationItemQuantity(item: QuotationItem) {
  const quantity = Number(item.quantity || 1);

  if (Number.isNaN(quantity) || quantity <= 0) {
    return 1;
  }

  return quantity;
}

function getQuotationItemTotal(item: QuotationItem) {
  const savedTotal = Number(item.customer_total_price_mop_snapshot || 0);

  if (!Number.isNaN(savedTotal) && savedTotal > 0) {
    return savedTotal;
  }

  return getQuotationItemUnitPrice(item) * getQuotationItemQuantity(item);
}

function getQuotationItemPriceGroupKey(item: QuotationItem) {
  if (item.source_group_id) {
    return `group-id-${item.source_group_id}`;
  }

  if (item.source_group_code) {
    return `group-code-${item.source_group_code}`;
  }

  if (item.source_group_name) {
    return `group-name-${item.source_group_name}`;
  }

  if (isKnownPackageCategory(item.test_category_name)) {
    return `known-package-${normalizeQuotationText(item.test_category_name)}`;
  }

  return `single-${item.id}`;
}

function getQuotationItemGroupLabel(item: QuotationItem) {
  return item.source_group_name || item.test_category_name || "-";
}

function getQuotationItemGroupSubText(item: QuotationItem) {
  return item.source_group_code || "";
}

function getQuotationItemPriceGroupInfo(
  items: QuotationItem[],
  itemIndex: number
) {
  const item = items[itemIndex];
  const priceGroupKey = getQuotationItemPriceGroupKey(item);

  let startIndex = itemIndex;

  while (
    startIndex > 0 &&
    getQuotationItemPriceGroupKey(items[startIndex - 1]) === priceGroupKey
  ) {
    startIndex -= 1;
  }

  let endIndex = itemIndex;

  while (
    endIndex + 1 < items.length &&
    getQuotationItemPriceGroupKey(items[endIndex + 1]) === priceGroupKey
  ) {
    endIndex += 1;
  }

  const priceGroupItems = items.slice(startIndex, endIndex + 1);

  return {
    priceGroupKey,
    startIndex,
    endIndex,
    rowSpan: priceGroupItems.length,
    indexInGroup: itemIndex - startIndex,
    isFirstRow: itemIndex === startIndex,
    priceGroupItems,
  };
}

function getQuotationPriceGroupUnitPrice(items: QuotationItem[]) {
  return items.reduce((sum, item) => {
    return sum + getQuotationItemUnitPrice(item);
  }, 0);
}

function getQuotationPriceGroupQuantity(items: QuotationItem[]) {
  const pricedItem =
    items.find((item) => getQuotationItemUnitPrice(item) > 0) || items[0];

  if (!pricedItem) {
    return 1;
  }

  return getQuotationItemQuantity(pricedItem);
}

function getQuotationPriceGroupTotal(items: QuotationItem[]) {
  return items.reduce((sum, item) => {
    return sum + getQuotationItemTotal(item);
  }, 0);
}

function sortQuotationItemsForDisplay(items: QuotationItem[]) {
  return [...items].sort((itemA, itemB) => {
    const sortOrderA = Number(itemA.sort_order || 0);
    const sortOrderB = Number(itemB.sort_order || 0);

    if (sortOrderA !== sortOrderB) {
      return sortOrderA - sortOrderB;
    }

    const groupSortOrderA = Number(itemA.source_group_sort_order || 0);
    const groupSortOrderB = Number(itemB.source_group_sort_order || 0);

    if (groupSortOrderA !== groupSortOrderB) {
      return groupSortOrderA - groupSortOrderB;
    }

    return itemA.id.localeCompare(itemB.id);
  });
}

function injectPdfSafeColorStyle(clonedDocument: Document) {
  const style = clonedDocument.createElement("style");

  style.innerHTML = `
    [data-pdf-root="true"],
    [data-pdf-root="true"] * {
      color: #0f172a !important;
      background-color: #ffffff !important;
      border-color: #cbd5e1 !important;
      box-shadow: none !important;
      text-shadow: none !important;
    }

    [data-pdf-root="true"] thead,
    [data-pdf-root="true"] th {
      background-color: #f1f5f9 !important;
      color: #334155 !important;
    }

    [data-pdf-root="true"] tr.bg-slate-50,
    [data-pdf-root="true"] .bg-slate-50,
    [data-pdf-root="true"] .bg-slate-100 {
      background-color: #f8fafc !important;
    }

    [data-pdf-root="true"] .text-slate-500,
    [data-pdf-root="true"] .text-slate-600,
    [data-pdf-root="true"] .text-slate-700 {
      color: #475569 !important;
    }

    [data-pdf-root="true"] .text-slate-900 {
      color: #0f172a !important;
    }

    [data-pdf-root="true"] table,
    [data-pdf-root="true"] th,
    [data-pdf-root="true"] td {
      border-color: #cbd5e1 !important;
    }

    [data-pdf-root="true"] .pdf-quotation-table {
      table-layout: fixed !important;
      width: 100% !important;
      border-collapse: collapse !important;
    }

    [data-pdf-root="true"] .pdf-quotation-table thead {
      display: table-header-group !important;
    }

    [data-pdf-root="true"] .pdf-quotation-table tr {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }

    [data-pdf-root="true"] .pdf-quotation-table th,
    [data-pdf-root="true"] .pdf-quotation-table td {
      font-size: 11px !important;
      line-height: 1.45 !important;
      vertical-align: middle !important;
      word-break: normal !important;
      overflow-wrap: anywhere !important;
      white-space: normal !important;
      padding: 8px 6px !important;
    }

    [data-pdf-root="true"] .pdf-keep-section {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
  `;

  clonedDocument.head.appendChild(style);
}

export default function QuotationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const documentRef = useRef<HTMLDivElement | null>(null);

  const quotationId = Array.isArray(params.id)
    ? params.id[0]
    : params.id || "";

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [existingInvoice, setExistingInvoice] =
    useState<ExistingInvoice | null>(null);

  const [editForm, setEditForm] = useState<QuotationEditForm>(
    createEmptyEditForm()
  );

  const [hasMounted, setHasMounted] = useState(false);

  const [loading, setLoading] = useState(true);
  const [savingQuotation, setSavingQuotation] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!quotationId) {
      return;
    }

    loadQuotationDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotationId]);

  async function loadQuotationDetail() {
    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const { data: quotationData, error: quotationError } = await supabase
        .from("quotations")
        .select("*")
        .eq("id", quotationId)
        .is("deleted_at", null)
        .maybeSingle();

      if (quotationError) {
        throw quotationError;
      }

      if (!quotationData) {
        throw new Error(`Quotation not found. quotationId=${quotationId}`);
      }

      const { data: quotationItemsData, error: quotationItemsError } =
        await supabase
          .from("quotation_items")
          .select("*")
          .eq("quotation_id", quotationId)
          .is("deleted_at", null)
          .order("sort_order", { ascending: true });

      if (quotationItemsError) {
        throw quotationItemsError;
      }

      const { data: invoiceData, error: invoiceError } = await supabase
        .from("invoices")
        .select("id,invoice_no")
        .eq("quotation_id", quotationId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (invoiceError) {
        throw invoiceError;
      }

      const loadedQuotation = quotationData as Quotation;

      setQuotation(loadedQuotation);
      setEditForm(createEditFormFromQuotation(loadedQuotation));
      setItems((quotationItemsData ?? []) as QuotationItem[]);
      setExistingInvoice((invoiceData as ExistingInvoice | null) ?? null);
      setIsEditing(false);
    } catch (error) {
      console.error("Load quotation detail error:", error);
      setErrorMessage(
        getErrorMessage(error, "Failed to load quotation detail.")
      );
    } finally {
      setLoading(false);
    }
  }

  const previewQuotation = useMemo<Quotation | null>(() => {
    if (!quotation) {
      return null;
    }

    if (!isEditing) {
      return quotation;
    }

    return {
      ...quotation,
      quotation_no: editForm.quotation_no,
      quotation_date: editForm.quotation_date || null,
      to_customer_name: editForm.to_customer_name || null,
      attention_to: editForm.attention_to || null,
      from_company_name: editForm.from_company_name || null,
      from_tel: editForm.from_tel || null,
      from_fax: editForm.from_fax || null,
      from_email: editForm.from_email || null,
      project_name: editForm.project_name || null,
      project_description: editForm.project_description || null,
      subtotal: parseAmountText(editForm.subtotal),
      discount_amount: parseAmountText(editForm.discount_amount),
      total_amount: parseAmountText(editForm.total_amount),
      currency: editForm.currency || "MOP",
      notes: editForm.notes || null,
    };
  }, [quotation, isEditing, editForm]);

  const groupedItems = useMemo<GroupedQuotationItem[]>(() => {
    const groupMap = new Map<number, GroupedQuotationItem>();

    sortQuotationItemsForDisplay(items).forEach((item, index) => {
      const itemNo = Number(item.sample_no || item.item_no || index + 1);
      const sampleName = item.sample_name || `Item ${itemNo}`;
      const existingGroup = groupMap.get(itemNo);

      if (existingGroup) {
        existingGroup.items.push(item);
        existingGroup.sampleTotal += getQuotationItemTotal(item);
      } else {
        groupMap.set(itemNo, {
          itemNo,
          sampleName,
          items: [item],
          sampleTotal: getQuotationItemTotal(item),
        });
      }
    });

    return Array.from(groupMap.values()).sort((a, b) => a.itemNo - b.itemNo);
  }, [items]);

  const flatQuotationRows = useMemo<FlatQuotationRow[]>(() => {
    return groupedItems.flatMap((group) =>
      group.items.map((item, itemIndex) => ({
        rowKey: `${group.itemNo}-${item.id}-${itemIndex}`,
        itemNo: group.itemNo,
        sampleName: group.sampleName,
        testCategoryName: item.test_category_name || "-",
        description: item.description || "-",
        unitPrice: getQuotationItemUnitPrice(item),
        quantity: getQuotationItemQuantity(item),
        total: getQuotationItemTotal(item),
      }))
    );
  }, [groupedItems]);

  function updateEditForm(field: keyof QuotationEditForm, value: string) {
    setEditForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  }

  function handleStartEdit() {
    if (!quotationId) {
      return;
    }

    const targetUrl = `/quotations?editQuotationId=${encodeURIComponent(
      quotationId
    )}&editReload=${Date.now()}`;

    window.location.href = targetUrl;
  }

  function handleCancelEdit() {
    if (quotation) {
      setEditForm(createEditFormFromQuotation(quotation));
    }

    setErrorMessage("");
    setSuccessMessage("");
    setIsEditing(false);
  }

  async function handleSaveQuotation() {
    if (!quotation) {
      setErrorMessage("Quotation not found.");
      return;
    }

    try {
      setSavingQuotation(true);
      setErrorMessage("");
      setSuccessMessage("");

      const cleanedQuotationNo = editForm.quotation_no.trim();
      const cleanedCustomerName = editForm.to_customer_name.trim();

      if (!cleanedQuotationNo) {
        throw new Error("Quotation No. cannot be empty.");
      }

      if (!cleanedCustomerName) {
        throw new Error("Customer cannot be empty.");
      }

      const updatePayload = {
        quotation_no: cleanedQuotationNo,
        quotation_date: editForm.quotation_date || null,
        to_customer_name: cleanedCustomerName,
        attention_to: editForm.attention_to.trim() || null,
        from_company_name: editForm.from_company_name.trim() || null,
        from_tel: editForm.from_tel.trim() || null,
        from_fax: editForm.from_fax.trim() || null,
        from_email: editForm.from_email.trim() || null,
        project_name: editForm.project_name.trim() || null,
        project_description: editForm.project_description.trim() || null,
        subtotal: parseAmountText(editForm.subtotal),
        discount_amount: parseAmountText(editForm.discount_amount),
        total_amount: parseAmountText(editForm.total_amount),
        currency: editForm.currency.trim() || "MOP",
        notes: editForm.notes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from("quotations")
        .update(updatePayload)
        .eq("id", quotation.id)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      const updatedQuotation = data as Quotation;

      setQuotation(updatedQuotation);
      setEditForm(createEditFormFromQuotation(updatedQuotation));
      setIsEditing(false);
      setSuccessMessage("Quotation updated successfully.");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Failed to update quotation."));
    } finally {
      setSavingQuotation(false);
    }
  }

  async function handleGenerateInvoice() {
    if (!quotation) {
      setErrorMessage("Quotation not found.");
      return;
    }

    if (isEditing) {
      setErrorMessage(
        "Please save or cancel your changes before generating invoice."
      );
      return;
    }

    if (items.length === 0) {
      setErrorMessage("This quotation has no items.");
      return;
    }

    try {
      setGeneratingInvoice(true);
      setErrorMessage("");
      setSuccessMessage("");

      const { data: existingInvoiceData, error: existingInvoiceError } =
        await supabase
          .from("invoices")
          .select("id,invoice_no")
          .eq("quotation_id", quotation.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

      if (existingInvoiceError) {
        throw existingInvoiceError;
      }

      if (existingInvoiceData) {
        setExistingInvoice(existingInvoiceData as ExistingInvoice);
        setSuccessMessage(
          `This quotation already has invoice: ${existingInvoiceData.invoice_no}`
        );
        router.push(`/invoices/${existingInvoiceData.id}`);
        return;
      }

      let invoiceData: ExistingInvoice | null = null;
      let lastInvoiceInsertError: unknown = null;

      for (let attempt = 0; attempt < 5; attempt += 1) {
        const invoiceNo = generateInvoiceNo();

        const { data, error } = await supabase
          .from("invoices")
          .insert({
            company_id: quotation.company_id || EMIT_COMPANY_ID,
            quotation_id: quotation.id,
            customer_id: quotation.customer_id,
            invoice_no: invoiceNo,
            invoice_date: new Date().toISOString().slice(0, 10),
            customer_name: quotation.to_customer_name,
            project_name: quotation.project_name || "Food Testing",
            project_description:
              quotation.project_description ||
              `為${quotation.to_customer_name || "客戶"}提供樣品檢測服務`,
            subtotal: Number(quotation.subtotal || 0),
            discount_amount: Number(quotation.discount_amount || 0),
            total_amount: Number(quotation.total_amount || 0),
            currency: quotation.currency || "MOP",
            status: "draft",
          })
          .select("id,invoice_no")
          .single();

        if (!error && data) {
          invoiceData = data as ExistingInvoice;
          break;
        }

        lastInvoiceInsertError = error;

        const isDuplicateInvoiceNo =
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "23505";

        if (!isDuplicateInvoiceNo) {
          throw error;
        }
      }

      if (!invoiceData) {
        throw lastInvoiceInsertError || new Error("Failed to create invoice.");
      }

      const invoiceItemPayload = items.map((item, index) => ({
        company_id: quotation.company_id || EMIT_COMPANY_ID,
        invoice_id: invoiceData.id,
        item_no: Number(item.sample_no || item.item_no || index + 1),
        item_name: item.sample_name || `Item ${index + 1}`,
        description: item.description || "",
        unit_price: Number(item.customer_unit_price_mop_snapshot || 0),
        quantity: Number(item.quantity || 1),
        total_amount: Number(item.customer_total_price_mop_snapshot || 0),
        sort_order: Number(item.sort_order || index + 1),
      }));

      if (invoiceItemPayload.length === 0) {
        throw new Error("This quotation has no invoice items to insert.");
      }

      const { error: invoiceItemsError } = await supabase
        .from("invoice_items")
        .insert(invoiceItemPayload);

      if (invoiceItemsError) {
        await supabase
          .from("invoices")
          .update({
            deleted_at: new Date().toISOString(),
            status: "cancelled",
          })
          .eq("id", invoiceData.id);

        throw invoiceItemsError;
      }

      setExistingInvoice(invoiceData);
      setSuccessMessage(`Invoice draft generated: ${invoiceData.invoice_no}`);
      router.push(`/invoices/${invoiceData.id}`);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Failed to generate invoice."));
    } finally {
      setGeneratingInvoice(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  function handleDownloadPdf() {
    if (!quotationId || !previewQuotation) {
      setErrorMessage("Cannot find quotation for PDF generation.");
      return;
    }

    try {
      setGeneratingPdf(true);
      setErrorMessage("");

      const safeFileName = getSafePdfFileName(
        previewQuotation.quotation_no || "EMIT-quotation"
      );

      if (!safeFileName) {
        throw new Error("Quotation file name is invalid.");
      }

      window.location.href = `/api/quotations/${encodeURIComponent(
        String(quotationId)
      )}/pdf`;

      window.setTimeout(() => {
        setGeneratingPdf(false);
      }, 1500);
    } catch (error) {
      setGeneratingPdf(false);
      setErrorMessage(getErrorMessage(error, "Failed to generate PDF."));
    }
  }

  if (!hasMounted) {
    return (
      <AppShell>
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
            Loading quotation detail...
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

          .document-print-area {
            border: none !important;
            box-shadow: none !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: none !important;
          }
        }

        .pdf-quotation-table {
          table-layout: fixed;
          width: 100%;
          border-collapse: collapse;
        }

        .pdf-quotation-table thead {
          display: table-header-group;
        }

        .pdf-quotation-table tr {
          break-inside: avoid;
          page-break-inside: avoid;
        }

        .pdf-quotation-table th,
        .pdf-quotation-table td {
          white-space: normal;
          word-break: normal;
          overflow-wrap: anywhere;
          vertical-align: middle;
          line-height: 1.45;
        }

        .pdf-keep-row {
          break-inside: avoid;
          page-break-inside: avoid;
        }

        .pdf-keep-section {
          break-inside: avoid;
          page-break-inside: avoid;
        }

        .pdf-quotation-table tbody {
          break-inside: auto;
          page-break-inside: auto;
        }

        .pdf-quotation-table tr {
          break-inside: avoid;
          page-break-inside: avoid;
        }
      `}</style>

      <div className="mx-auto max-w-7xl">
        <div className="print-hidden mb-8 flex items-center justify-between">
          <div>
            <button
              onClick={() => router.push("/quotations/list")}
              className="mb-3 text-sm font-semibold text-slate-500 hover:text-slate-900"
            >
              ← Back to Quotations
            </button>

            <h1 className="text-3xl font-bold text-slate-900">
              Quotation Detail
            </h1>

            <p className="mt-2 text-slate-500">
              Review saved quotation and generate downstream documents.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={loadQuotationDetail}
              disabled={loading || savingQuotation}
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Refresh
            </button>

            <button
              onClick={handleStartEdit}
              disabled={loading || !quotation}
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Edit in Quotations
            </button>

            <button
              onClick={handlePrint}
              disabled={loading || !previewQuotation}
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Print
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={loading || generatingPdf || !previewQuotation}
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generatingPdf ? "Generating..." : "Generate PDF"}
            </button>

            {isEditing && (
              <>
                <button
                  onClick={handleCancelEdit}
                  disabled={savingQuotation}
                  className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  onClick={handleSaveQuotation}
                  disabled={savingQuotation}
                  className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingQuotation ? "Saving..." : "Save Changes"}
                </button>
              </>
            )}

            <button
              onClick={handleGenerateInvoice}
              disabled={
                loading ||
                generatingInvoice ||
                !!existingInvoice ||
                isEditing ||
                savingQuotation
              }
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generatingInvoice ? "Generating..." : "Generate Invoice"}
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

        {existingInvoice && (
          <div className="print-hidden mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-700">
            Invoice generated:{" "}
            <span className="font-bold">{existingInvoice.invoice_no}</span>
          </div>
        )}

        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
            Loading quotation detail...
          </div>
        )}

        {!loading && !previewQuotation && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
            Quotation not found.
          </div>
        )}

        {!loading && previewQuotation && (
          <>
            <div className="print-hidden mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="grid gap-6 lg:grid-cols-3">
                <div>
                  <p className="text-sm text-slate-500">Quotation No.</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {previewQuotation.quotation_no}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-500">Date</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {formatDateText(previewQuotation.quotation_date)}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-500">Customer</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {previewQuotation.to_customer_name || "-"}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-500">Attention</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {previewQuotation.attention_to || "-"}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-500">Currency</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {previewQuotation.currency || "MOP"}
                  </p>
                </div>

                <div>
                  <p className="text-sm text-slate-500">Total</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">
                    {previewQuotation.currency || "MOP"}{" "}
                    {Number(
                      previewQuotation.total_amount || 0
                    ).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="mt-6 border-t border-slate-200 pt-6">
                <p className="text-sm text-slate-500">Project</p>
                <p className="mt-1 font-semibold text-slate-900">
                  {previewQuotation.project_name || "-"}
                </p>

                <p className="mt-4 text-sm text-slate-500">檢測食品描述</p>
                <p className="mt-1 font-semibold text-slate-900">
                  {previewQuotation.project_description || "-"}
                </p>
              </div>
            </div>

            <div
              ref={documentRef}
              data-pdf-root="true"
              className="document-print-area rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
            >
              <div className="pdf-keep-section border-b border-slate-200 pb-6">
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
                  QUOTATION
                </h2>
              </div>

              <div className="pdf-keep-section mt-6 text-sm leading-7 text-slate-700">
                <p>澳門美副將大馬路萬基工業大廈 3樓A座</p>
                <p>
                  TEL: {previewQuotation.from_tel || "(853) 2875 1742"}{" "}
                  &nbsp;&nbsp; FAX:{" "}
                  {previewQuotation.from_fax || "(853) 2852 0536"} &nbsp;&nbsp;
                  E-MAIL: {previewQuotation.from_email || "am01@emit.com.mo"}
                </p>
              </div>

              <div className="pdf-keep-section mt-8 grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="grid grid-cols-[100px_1fr] gap-4">
                    <p className="font-semibold text-slate-700">TO:</p>
                    <p className="text-slate-900">
                      {previewQuotation.to_customer_name || "-"}
                    </p>
                  </div>

                  <div className="grid grid-cols-[100px_1fr] gap-4">
                    <p className="font-semibold text-slate-700">ATTN:</p>
                    <p className="text-slate-900">
                      {previewQuotation.attention_to || "-"}
                    </p>
                  </div>

                  <div className="grid grid-cols-[100px_1fr] gap-4">
                    <p className="font-semibold text-slate-700">DATE:</p>
                    <p className="text-slate-900">
                      {formatDateText(previewQuotation.quotation_date)}
                    </p>
                  </div>

                  <div className="grid grid-cols-[100px_1fr] gap-4">
                    <p className="font-semibold text-slate-700">NO.:</p>
                    <p className="text-slate-900">
                      {previewQuotation.quotation_no}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-[100px_1fr] gap-4">
                    <p className="font-semibold text-slate-700">FROM:</p>
                    <p className="text-slate-900">
                      {previewQuotation.from_company_name || "EMIT"}
                    </p>
                  </div>

                  <div className="grid grid-cols-[100px_1fr] gap-4">
                    <p className="font-semibold text-slate-700">TEL:</p>
                    <p className="text-slate-900">
                      {previewQuotation.from_tel || "+853 2875 1742"}
                    </p>
                  </div>

                  <div className="grid grid-cols-[100px_1fr] gap-4">
                    <p className="font-semibold text-slate-700">FAX:</p>
                    <p className="text-slate-900">
                      {previewQuotation.from_fax || "+853 2852 0536"}
                    </p>
                  </div>

                  <div className="grid grid-cols-[100px_1fr] gap-4">
                    <p className="font-semibold text-slate-700">EMAIL:</p>
                    <p className="text-slate-900">
                      {previewQuotation.from_email || "am01@emit.com.mo"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pdf-keep-section mt-8 grid grid-cols-[160px_1fr] gap-4 border-t border-slate-200 pt-6">
                <p className="font-semibold text-slate-700">Project 項目</p>
                <p className="text-slate-900">
                  {previewQuotation.project_name || "-"}
                </p>

                <p className="font-semibold text-slate-700">檢測食品描述</p>
                <p className="text-slate-900">
                  {previewQuotation.project_description || "-"}
                </p>
              </div>

              <div className="mt-8 overflow-hidden rounded-xl border border-slate-300">
                <table className="pdf-quotation-table w-full border-collapse text-[12px]">
                  <colgroup>
                    <col style={{ width: "7%" }} />
                    <col style={{ width: "18%" }} />
                    <col style={{ width: "23%" }} />
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "13%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "15%" }} />
                  </colgroup>

                  <thead className="bg-slate-100">
                    <tr>
                      <th className="border border-slate-300 px-2 py-3 text-center align-middle font-semibold text-slate-700">
                        Item
                      </th>
                      <th className="border border-slate-300 px-2 py-3 text-center align-middle font-semibold text-slate-700">
                        檢測食品描述
                      </th>
                      <th className="border border-slate-300 px-2 py-3 text-center align-middle font-semibold text-slate-700">
                        Description 描述
                      </th>
                      <th className="border border-slate-300 px-2 py-3 text-center align-middle font-semibold text-slate-700">
                        檢測項目
                      </th>
                      <th className="border border-slate-300 px-2 py-3 text-center align-middle font-semibold text-slate-700">
                        Unit Price
                      </th>
                      <th className="border border-slate-300 px-2 py-3 text-center align-middle font-semibold text-slate-700">
                        Qty
                      </th>
                      <th className="border border-slate-300 px-2 py-3 text-center align-middle font-semibold text-slate-700">
                        Total
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {flatQuotationRows.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="border border-slate-300 px-4 py-10 text-center align-middle text-slate-500"
                        >
                          No quotation items.
                        </td>
                      </tr>
                    )}

                    {groupedItems.map((group) =>
                      group.items.map((item, itemIndex) => {
                        const priceGroupInfo =
                          getQuotationItemPriceGroupInfo(
                            group.items,
                            itemIndex
                          );

                        const priceGroupUnitPrice =
                          getQuotationPriceGroupUnitPrice(
                            priceGroupInfo.priceGroupItems
                          );

                        const priceGroupQuantity =
                          getQuotationPriceGroupQuantity(
                            priceGroupInfo.priceGroupItems
                          );

                        const priceGroupTotal =
                          getQuotationPriceGroupTotal(
                            priceGroupInfo.priceGroupItems
                          );

                        return (
                          <tr
                            key={`${group.itemNo}-${item.id}-${itemIndex}`}
                            className="pdf-keep-row"
                          >
                            {itemIndex === 0 && (
                              <>
                                <td
                                  rowSpan={group.items.length}
                                  className="border border-slate-300 px-2 py-3 text-center align-middle text-slate-900"
                                >
                                  {group.itemNo}
                                </td>

                                <td
                                  rowSpan={group.items.length}
                                  className="border border-slate-300 px-2 py-3 text-center align-middle font-semibold text-slate-900"
                                >
                                  {group.sampleName}
                                </td>
                              </>
                            )}

                            {priceGroupInfo.isFirstRow && (
                              <td
                                rowSpan={priceGroupInfo.rowSpan}
                                className="border border-slate-300 px-2 py-3 text-center align-middle text-slate-900"
                              >
                                <div className="font-semibold">
                                  {getQuotationItemGroupLabel(item)}
                                </div>

                                {getQuotationItemGroupSubText(item) && (
                                  <div className="mt-1 text-[10px] text-emerald-700">
                                    {getQuotationItemGroupSubText(item)}
                                  </div>
                                )}
                              </td>
                            )}

                            <td className="border border-slate-300 px-2 py-3 text-center align-middle text-slate-900">
                              {item.description || "-"}
                            </td>

                            {priceGroupInfo.isFirstRow && (
                              <>
                                <td
                                  rowSpan={priceGroupInfo.rowSpan}
                                  className="border border-slate-300 px-2 py-3 text-center align-middle text-slate-900"
                                >
                                  {previewQuotation.currency || "MOP"}{" "}
                                  {priceGroupUnitPrice.toLocaleString()}
                                </td>

                                <td
                                  rowSpan={priceGroupInfo.rowSpan}
                                  className="border border-slate-300 px-2 py-3 text-center align-middle text-slate-900"
                                >
                                  {priceGroupQuantity.toLocaleString()}
                                </td>

                                <td
                                  rowSpan={priceGroupInfo.rowSpan}
                                  className="border border-slate-300 px-2 py-3 text-center align-middle text-slate-900"
                                >
                                  {priceGroupTotal.toLocaleString()}
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })
                    )}

                    <tr className="bg-slate-50 pdf-keep-row">
                      <td
                        colSpan={6}
                        className="border border-slate-300 px-4 py-3 text-center align-middle font-bold text-slate-900"
                      >
                        Total 總價({previewQuotation.currency || "MOP"})：
                      </td>
                      <td className="border border-slate-300 px-4 py-3 text-center align-middle font-bold text-slate-900">
                        {Number(
                          previewQuotation.total_amount || 0
                        ).toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="pdf-keep-section mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
                <h3 className="font-semibold text-slate-900">Notes:</h3>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">
                  {(previewQuotation.notes || "")
                    .split("\n")
                    .filter(Boolean)
                    .map((note, index) => (
                      <li key={`${note}-${index}`}>{note}</li>
                    ))}
                </ol>
              </div>

              <div className="mt-8 space-y-5 text-sm leading-7 text-slate-700">
                <p>
                  Dear {previewQuotation.attention_to || "Client"}, this
                  quotation has been developed based on information provided.
                </p>

                <p>
                  Acceptance of this quotation is required within 90 days from
                  date of issue.
                </p>

                <p>Yours Sincerely,</p>

                <div className="pdf-keep-section grid grid-cols-[1fr_520px] gap-12 pt-2">
                  <div>
                    <p className="font-semibold text-slate-900">
                      For and on behalf of
                    </p>
                    <p className="font-semibold text-slate-900">
                      EMIT Environment Monitoring Inspection and Testing Co.
                      Ltd.
                    </p>

                    <div className="mt-3 w-[260px]">
                      <Image
                        src={EMIT_SIGNATURE_STAMP_SRC}
                        alt="EMIT Company Chop and Authorized Signature"
                        width={260}
                        height={105}
                        className="h-[105px] w-[260px] object-contain object-left"
                      />
                    </div>

                    <p className="mt-4 text-sm text-slate-500">
                      Company Chop and Authorized Signature
                    </p>
                  </div>

                  <div className="pt-[31px]">
                    <p className="font-semibold text-slate-900">
                      Name of Signatory:
                    </p>

                    <div className="mt-16 border-b border-slate-400" />

                    <p className="mt-3 text-sm text-slate-500">Signature</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
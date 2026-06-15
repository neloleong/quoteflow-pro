"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase/client";

type Report = {
  id: string;
  company_id: string | null;
  customer_id: string | null;
  source_quotation_id: string | null;
  source_quotation_no: string | null;
  report_no: string | null;
  report_date: string | null;
  customer_name: string | null;
  customer_address: string | null;
  sample_name: string | null;
  sample_description: string | null;
  received_date: string | null;
  test_start_date: string | null;
  test_end_date: string | null;
  test_items_summary: string | null;
  remarks: string | null;
  prepared_by: string | null;
  reviewed_by: string | null;
  authorized_signatory: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ReportItem = {
  id: string;
  report_id: string;
  source_quotation_item_id: string | null;
  source_test_item_id: string | null;
  item_name: string | null;
  test_method: string | null;
  result_value: string | null;
  unit: string | null;
  sort_order: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type ReportItemEditableField =
  | "item_name"
  | "test_method"
  | "result_value"
  | "unit";

type ReportContentPage = {
  id: string;
  pageNumber: number;
  isFirstContentPage: boolean;
  isLastContentPage: boolean;
  resultItems: ReportItem[];
};

const REPORT_CONTACT_LINE =
  "地址: 澳門美副將大馬路48號萬基工業大廈3樓A座  |  郵箱：admin01@emit.com.mo  |  電話：+853 2875 1742  |  傳真：+853 2852 0536";

const REPORT_COVER_TOP_BAR_SRC = "/images/report-cover-topbar.png";
const REPORT_FOOTER_CONTACT_BAR_SRC = "/images/report-cover-contact-bar.png";
const REPORT_COVER_LOGO_SRC = "/images/report-cover-logo.png";
const REPORT_LOGO_ICON_SRC = "/images/report-cover-logo-icon.png";
const REPORT_LOGO_TEXT_SRC = "/images/report-cover-logo-text.png";

const REPORT_SIGNATURE_PREPARED_SRC = "/images/report-signature-prepared.png";
const REPORT_SIGNATURE_REVIEWED_SRC = "/images/report-signature-reviewed.png";
const REPORT_SIGNATURE_AUTHORIZED_SRC =
  "/images/report-signature-authorized.png";

const REPORT_WATERMARK_ORIGINAL_SRC =
  "/images/report-watermark-original-v2.png?v=20260605";

const FIRST_RESULT_PAGE_ITEM_LIMIT = 7;
const CONTINUATION_RESULT_PAGE_ITEM_LIMIT = 12;

function formatDateDash(dateValue: string | null) {
  if (!dateValue) {
    return "-";
  }

  const dateText = String(dateValue).slice(0, 10);
  const [year, month, day] = dateText.split("-");

  if (!year || !month || !day) {
    return dateValue;
  }

  return `${year}-${month}-${day}`;
}

function formatTestDateRange(
  startDate: string | null,
  endDate: string | null,
  reportDate?: string | null
) {
  const finalEndDate = endDate || reportDate || null;

  if (!startDate && !finalEndDate) {
    return "-";
  }

  if (startDate && !finalEndDate) {
    return formatDateDash(startDate);
  }

  if (!startDate && finalEndDate) {
    return formatDateDash(finalEndDate);
  }

  return `${formatDateDash(startDate)} 至 ${formatDateDash(finalEndDate)}`;
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

function normalizeReportText(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

function buildReportItemUniqueKey(item: ReportItem) {
  const sourceTestItemId = normalizeReportText(item.source_test_item_id);

  if (sourceTestItemId) {
    return `source-test-item:${sourceTestItemId}`;
  }

  const itemName = normalizeReportText(item.item_name);
  const testMethod = normalizeReportText(item.test_method);

  return `item-method:${itemName}|${testMethod}`;
}

function buildUniqueReportItems(reportItems: ReportItem[]) {
  const uniqueMap = new Map<string, ReportItem>();

  reportItems.forEach((item) => {
    const uniqueKey = buildReportItemUniqueKey(item);
    const existingItem = uniqueMap.get(uniqueKey);

    if (!existingItem) {
      uniqueMap.set(uniqueKey, { ...item });
      return;
    }

    uniqueMap.set(uniqueKey, {
      ...existingItem,
      item_name: existingItem.item_name || item.item_name,
      test_method: existingItem.test_method || item.test_method,
      result_value: existingItem.result_value || item.result_value,
      unit: existingItem.unit || item.unit,
      sort_order:
        existingItem.sort_order !== null && existingItem.sort_order !== undefined
          ? existingItem.sort_order
          : item.sort_order,
    });
  });

  return Array.from(uniqueMap.values()).sort((itemA, itemB) => {
    const sortOrderA = Number(itemA.sort_order || 0);
    const sortOrderB = Number(itemB.sort_order || 0);

    if (sortOrderA !== sortOrderB) {
      return sortOrderA - sortOrderB;
    }

    return String(itemA.item_name || "").localeCompare(
      String(itemB.item_name || "")
    );
  });
}

function splitSummaryItems(summaryText: string | null | undefined) {
  return String(summaryText || "")
    .split(/[、,\n\r]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function dedupeTextList(items: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  items.forEach((item) => {
    const key = normalizeReportText(item);

    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(item);
  });

  return result;
}

function buildDisplayTestItemsSummary(
  report: Report | null,
  uniqueItems: ReportItem[]
) {
  const uniqueItemNames = dedupeTextList(
    uniqueItems
      .map((item) => item.item_name || "")
      .map((itemName) => itemName.trim())
      .filter(Boolean)
  );

  if (uniqueItemNames.length > 0) {
    return uniqueItemNames.join("、");
  }

  const summaryItems = dedupeTextList(
    splitSummaryItems(report?.test_items_summary || "")
  );

  if (summaryItems.length > 0) {
    return summaryItems.join("、");
  }

  return "-";
}

function buildReportContentPages(reportItems: ReportItem[]) {
  if (reportItems.length <= FIRST_RESULT_PAGE_ITEM_LIMIT) {
    return [
      {
        id: "report-content-page-2",
        pageNumber: 2,
        isFirstContentPage: true,
        isLastContentPage: true,
        resultItems: reportItems,
      },
    ];
  }

  const pages: ReportContentPage[] = [];

  pages.push({
    id: "report-content-page-2",
    pageNumber: 2,
    isFirstContentPage: true,
    isLastContentPage: false,
    resultItems: reportItems.slice(0, FIRST_RESULT_PAGE_ITEM_LIMIT),
  });

  let cursor = FIRST_RESULT_PAGE_ITEM_LIMIT;
  let pageNumber = 3;

  while (cursor < reportItems.length) {
    const pageItems = reportItems.slice(
      cursor,
      cursor + CONTINUATION_RESULT_PAGE_ITEM_LIMIT
    );

    pages.push({
      id: `report-content-page-${pageNumber}`,
      pageNumber,
      isFirstContentPage: false,
      isLastContentPage: false,
      resultItems: pageItems,
    });

    cursor += CONTINUATION_RESULT_PAGE_ITEM_LIMIT;
    pageNumber += 1;
  }

  return pages.map((page, index, allPages) => ({
    ...page,
    isLastContentPage: index === allPages.length - 1,
  }));
}

function ReportFooterBar() {
  return (
    <div className="report-footer-bar px-[19px] pb-[18px]">
      <p className="sr-only">{REPORT_CONTACT_LINE}</p>
      <Image
        src={REPORT_FOOTER_CONTACT_BAR_SRC}
        alt="Report footer contact bar"
        width={1200}
        height={34}
        priority
        className="h-[24px] w-full object-fill"
      />
    </div>
  );
}

function ReportWatermark() {
  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <Image
        src={REPORT_WATERMARK_ORIGINAL_SRC}
        alt="Original watermark"
        width={1374}
        height={1145}
        priority
        unoptimized
        className="absolute left-1/2 top-[53%] w-[560px] -translate-x-1/2 -translate-y-1/2 object-contain opacity-100"
      />
    </div>
  );
}

function ReportContentHeader({
  report,
  pageNumber,
  totalReportPages,
}: {
  report: Report;
  pageNumber: number;
  totalReportPages: number;
}) {
  return (
    <div className="relative z-10">
      <div className="flex items-end gap-[8px]">
        <Image
          src={REPORT_LOGO_ICON_SRC}
          alt="EMIT logo icon"
          width={70}
          height={70}
          priority
          className="h-[58px] w-[58px] object-contain"
        />

        <Image
          src={REPORT_LOGO_TEXT_SRC}
          alt="EMIT logo text"
          width={345}
          height={60}
          priority
          className="mb-[3px] h-auto w-[300px] object-contain"
        />
      </div>

      <h2 className="emit-report-title-font mt-[8px] text-[28px] font-bold tracking-[0.45em]">
        檢 測 報 告
      </h2>

      <div className="mt-[15px] text-[13px] leading-[1.8]">
        <div className="grid grid-cols-[82px_135px_48px_118px_48px_120px] items-center gap-x-3">
          <p className="font-bold">報告編號：</p>
          <p>{report.report_no || "-"}</p>

          <p className="font-bold">日期：</p>
          <p>{formatDateDash(report.report_date)}</p>

          <p className="font-bold">頁碼：</p>
          <p>
            第 {pageNumber} 頁 共 {totalReportPages} 頁
          </p>
        </div>
      </div>
    </div>
  );
}

function ReportBasicInformationBlock({
  report,
  remarks,
  testItemsSummary,
}: {
  report: Report;
  remarks: string;
  testItemsSummary: string;
}) {
  return (
    <>
      <div className="grid grid-cols-[92px_1fr] gap-x-3">
        <p className="font-bold">委託單位：</p>
        <p>{report.customer_name || "-"}</p>

        <p className="font-bold">地　　址：</p>
        <p>{report.customer_address || "-"}</p>
      </div>

      <p className="pt-3">
        本報告是基於採取的申報名稱為 “
        <span className="font-bold">{report.sample_name || "-"}</span>”
        的樣品所做的檢測。
      </p>

      <div className="grid grid-cols-[92px_1fr] gap-x-3 pt-3">
        <p className="font-bold">備註：</p>
        <p>{remarks || "-"}</p>
      </div>

      <div className="grid grid-cols-[92px_1fr] gap-x-3 pt-3">
        <p className="font-bold">樣品描述：</p>
        <p>{report.sample_description || "-"}</p>

        <p className="font-bold">收樣日期：</p>
        <p>{formatDateDash(report.received_date)}</p>

        <p className="font-bold">檢測日期：</p>
        <p>
          {formatTestDateRange(
            report.test_start_date,
            report.test_end_date,
            report.report_date
          )}
        </p>

        <p className="font-bold">檢測項目：</p>
        <p>{testItemsSummary || "-"}</p>
      </div>
    </>
  );
}

function ReportResultTable({
  resultItems,
  showEmptyMessage,
}: {
  resultItems: ReportItem[];
  showEmptyMessage: boolean;
}) {
  return (
    <table className="report-result-table text-[13px]">
      <thead>
        <tr>
          <th className="w-[28%] px-3 py-2">檢測項目</th>
          <th className="w-[31%] border border-black px-3 py-2 text-center font-bold">
            檢測方法
          </th>
          <th className="w-[23%] border border-black px-3 py-2 text-center font-bold">
            結果數據
          </th>
          <th className="w-[18%] border border-black px-3 py-2 text-center font-bold">
            單　位
          </th>
        </tr>
      </thead>

      <tbody>
        {showEmptyMessage && resultItems.length === 0 && (
          <tr>
            <td
              colSpan={4}
              className="border border-black px-3 py-6 text-center"
            >
              No report items.
            </td>
          </tr>
        )}

        {resultItems.map((item) => (
          <tr key={item.id}>
            <td className="px-3 py-2">{item.item_name || "-"}</td>
            <td className="border border-black px-3 py-2 text-center">
              {item.test_method || "-"}
            </td>
            <td className="border border-black px-3 py-2 text-center">
              {item.result_value || "-"}
            </td>
            <td className="border border-black px-3 py-2 text-center">
              {item.unit || "-"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ReportSignatureBlock({
  preparedBy,
  reviewedBy,
  authorizedSignatory,
}: {
  preparedBy: string;
  reviewedBy: string;
  authorizedSignatory: string;
}) {
  function SignatureSlot({
    label,
    name,
    imageSrc,
    imageAlt,
  }: {
    label: string;
    name: string;
    imageSrc: string;
    imageAlt: string;
  }) {
    return (
      <div className="flex flex-col items-center text-center">
        <div className="flex h-[82px] w-[220px] items-end justify-center pb-[6px]">
          <Image
            src={imageSrc}
            alt={imageAlt}
            width={180}
            height={82}
            className="max-h-[70px] w-auto object-contain"
          />
        </div>

        <div className="h-[1px] w-[220px] bg-black" />

        <p className="mt-[8px] text-[15px] font-bold">{label}</p>

        {name && <p className="mt-[3px] text-[12px]">{name}</p>}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-8 pt-10">
      <SignatureSlot
        label="編製人："
        name={preparedBy}
        imageSrc={REPORT_SIGNATURE_PREPARED_SRC}
        imageAlt="Prepared by signature"
      />

      <SignatureSlot
        label="審核人："
        name={reviewedBy}
        imageSrc={REPORT_SIGNATURE_REVIEWED_SRC}
        imageAlt="Reviewed by signature"
      />

      <SignatureSlot
        label="授權簽署人："
        name={authorizedSignatory}
        imageSrc={REPORT_SIGNATURE_AUTHORIZED_SRC}
        imageAlt="Authorized signatory signature"
      />
    </div>
  );
}

export default function ReportDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const reportId = Array.isArray(params.id) ? params.id[0] : params.id || "";

  const [hasMounted, setHasMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const [report, setReport] = useState<Report | null>(null);
  const [items, setItems] = useState<ReportItem[]>([]);

  const [status, setStatus] = useState("draft");
  const [remarks, setRemarks] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [reviewedBy, setReviewedBy] = useState("");
  const [authorizedSignatory, setAuthorizedSignatory] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const uniqueItems = useMemo(() => buildUniqueReportItems(items), [items]);

  const displayTestItemsSummary = useMemo(
    () => buildDisplayTestItemsSummary(report, uniqueItems),
    [report, uniqueItems]
  );

  const contentPages = useMemo(
    () => buildReportContentPages(uniqueItems),
    [uniqueItems]
  );

  const totalReportPages = 1 + contentPages.length;

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!hasMounted || !reportId) {
      return;
    }

    loadReportDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMounted, reportId]);

  async function loadReportDetail() {
    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const { data: reportData, error: reportError } = await supabase
        .from("reports")
        .select("*")
        .eq("id", reportId)
        .is("deleted_at", null)
        .maybeSingle();

      if (reportError) {
        throw reportError;
      }

      if (!reportData) {
        throw new Error(`Report not found. reportId=${reportId}`);
      }

      const { data: reportItemsData, error: reportItemsError } = await supabase
        .from("report_items")
        .select("*")
        .eq("report_id", reportId)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true });

      if (reportItemsError) {
        throw reportItemsError;
      }

      const loadedReport = reportData as Report;
      const loadedItems = (reportItemsData ?? []) as ReportItem[];

      setReport(loadedReport);
      setItems(loadedItems);

      setStatus(loadedReport.status || "draft");
      setRemarks(loadedReport.remarks || "");
      setPreparedBy(loadedReport.prepared_by || "");
      setReviewedBy(loadedReport.reviewed_by || "");
      setAuthorizedSignatory(loadedReport.authorized_signatory || "");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Failed to load report detail."));
    } finally {
      setLoading(false);
    }
  }

  function updateUniqueItem(
    targetItem: ReportItem,
    field: ReportItemEditableField,
    value: string
  ) {
    const targetKey = buildReportItemUniqueKey(targetItem);

    setItems((currentItems) =>
      currentItems.map((item) => {
        if (buildReportItemUniqueKey(item) !== targetKey) {
          return item;
        }

        return {
          ...item,
          [field]: value,
        };
      })
    );
  }

  async function saveReportDetail() {
    if (!report) {
      setErrorMessage("Report not found.");
      return;
    }

    try {
      setSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      const { error: reportUpdateError } = await supabase
        .from("reports")
        .update({
          status,
          remarks: remarks.trim() || null,
          prepared_by: preparedBy.trim() || null,
          reviewed_by: reviewedBy.trim() || null,
          authorized_signatory: authorizedSignatory.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", report.id);

      if (reportUpdateError) {
        throw reportUpdateError;
      }

      for (const item of items) {
        const { error: itemUpdateError } = await supabase
          .from("report_items")
          .update({
            item_name: item.item_name?.trim() || null,
            test_method: item.test_method?.trim() || null,
            result_value: item.result_value?.trim() || null,
            unit: item.unit?.trim() || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id);

        if (itemUpdateError) {
          throw itemUpdateError;
        }
      }

      setSuccessMessage("Report updated successfully.");
      await loadReportDetail();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Failed to save report."));
    } finally {
      setSaving(false);
    }
  }

  function printReport() {
    window.print();
  }

  function generateReportPdf() {
    if (!reportId) {
      setErrorMessage("Cannot find report id for PDF generation.");
      return;
    }

    setErrorMessage("");
    setGeneratingPdf(true);

    window.location.href = `/api/report/${encodeURIComponent(
      String(reportId)
    )}/pdf`;

    setTimeout(() => {
      setGeneratingPdf(false);
    }, 1200);
  }

  if (!hasMounted) {
    return (
      <AppShell>
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm text-slate-500">Loading report...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <style jsx global>{`
        @font-face {
          font-family: "EMITReportBody";
          src: url("/fonts/emit-report-body.ttf") format("truetype");
          font-weight: 400;
          font-style: normal;
          font-display: swap;
        }

        @font-face {
          font-family: "EMITReportBody";
          src: url("/fonts/emit-report-body-bold.ttf") format("truetype");
          font-weight: 700;
          font-style: normal;
          font-display: swap;
        }

        @font-face {
          font-family: "EMITReportTitle";
          src: url("/fonts/emit-report-title.ttf") format("truetype");
          font-weight: 700;
          font-style: normal;
          font-display: swap;
        }

        .emit-report-font {
          font-family: "EMITReportBody", "Microsoft JhengHei",
            "Microsoft YaHei", "PingFang TC", "Arial", sans-serif;
        }

        .emit-report-title-font {
          font-family: "EMITReportTitle", "EMITReportBody",
            "Microsoft JhengHei", "Microsoft YaHei", "PingFang TC", serif;
        }

        .report-sheet {
          position: relative;
          width: 794px;
          min-height: 1123px;
        }

        .report-result-table-block {
          break-inside: avoid;
          page-break-inside: avoid;
        }

        .report-result-table {
          width: 100%;
          border-collapse: collapse !important;
          table-layout: fixed;
          border: 1.2px solid #000 !important;
        }

        .report-result-table th,
        .report-result-table td {
          border: 1.2px solid #000 !important;
          color: #000 !important;
        }

        .report-result-table th {
          font-weight: 700;
          text-align: center;
        }

        .report-result-table td {
          text-align: center;
        }

        @page {
          size: A4;
          margin: 0;
        }

        @media print {
          html,
          body {
            width: 210mm;
            min-height: 297mm;
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          aside,
          .report-actions,
          .report-side-panel,
          .no-print {
            display: none !important;
          }

          main {
            margin-left: 0 !important;
            padding: 0 !important;
          }

          .print-area {
            width: 210mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .report-sheet {
            width: 210mm !important;
            min-height: 297mm !important;
            box-shadow: none !important;
            border: none !important;
            margin: 0 auto !important;
            page-break-after: always;
            break-after: page;
          }

          .report-sheet:last-child {
            page-break-after: auto;
            break-after: auto;
          }

          .report-cover-top-bar img,
          .report-footer-bar img {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-7xl">
        <div className="report-actions mb-8 flex items-center justify-between">
          <div>
            <button
              onClick={() => router.push("/report")}
              className="mb-3 text-sm font-semibold text-slate-500 hover:text-slate-900"
            >
              ← Back to Reports
            </button>

            <h1 className="text-3xl font-bold text-slate-900">
              Report Detail
            </h1>

            <p className="mt-2 text-slate-500">
              Review testing report, update result values, and print formal
              report.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={loadReportDetail}
              disabled={loading || saving}
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Refresh
            </button>

            <button
              onClick={saveReportDetail}
              disabled={loading || saving || !report}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>

            <button
              onClick={printReport}
              disabled={loading || !report}
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Print
            </button>

            <button
              onClick={generateReportPdf}
              disabled={loading || generatingPdf || !report}
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generatingPdf ? "Generating..." : "Generate PDF"}
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="report-actions mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="report-actions mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-700">
            {successMessage}
          </div>
        )}

        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
            Loading report detail...
          </div>
        )}

        {!loading && !report && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
            Report not found.
          </div>
        )}

        {!loading && report && (
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <div className="print-area space-y-8">
              <section className="report-sheet emit-report-font mx-auto flex flex-col overflow-hidden bg-white text-[14px] leading-[1.75] text-black shadow-sm">
                <div className="report-cover-top-bar h-[32px] w-full shrink-0">
                  <Image
                    src={REPORT_COVER_TOP_BAR_SRC}
                    alt="Report cover top bar"
                    width={1200}
                    height={48}
                    priority
                    className="h-[32px] w-full object-cover"
                  />
                </div>

                <div className="flex-1 px-[58px] pb-[24px] pt-[42px]">
                  <div className="flex justify-center">
                    <Image
                      src={REPORT_COVER_LOGO_SRC}
                      alt="EMIT report cover logo"
                      width={420}
                      height={216}
                      priority
                      className="h-[11.11cm] w-[5.71cm] object-contain"
                    />
                  </div>

                  <div className="mx-auto mt-[80px] w-[430px] text-[17px] leading-[2.15]">
                    <h3 className="emit-report-title-font mb-[20px] text-center text-[50px] font-bold">
                      檢測報告
                    </h3>

                    <div className="space-y-[18px]">
                      <div className="grid grid-cols-[115px_1fr] gap-x-5">
                        <p className="font-bold">報告編號：</p>
                        <p>{report.report_no || "-"}</p>
                      </div>

                      <div className="grid grid-cols-[115px_1fr] gap-x-5">
                        <p className="font-bold">樣品名稱：</p>
                        <p>{report.sample_name || "-"}</p>
                      </div>

                      <div className="grid grid-cols-[115px_1fr] gap-x-5">
                        <p className="font-bold">委託單位：</p>
                        <p>{report.customer_name || "-"}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <ReportFooterBar />
              </section>

              {contentPages.map((contentPage) => (
                <section
                  key={contentPage.id}
                  className="report-sheet emit-report-font mx-auto flex flex-col overflow-hidden bg-white text-[14px] leading-[1.72] text-black shadow-sm"
                >
                  <div className="relative flex flex-1 flex-col px-[58px] pb-[16px] pt-[36px]">
                    <ReportWatermark />

                    <ReportContentHeader
                      report={report}
                      pageNumber={contentPage.pageNumber}
                      totalReportPages={totalReportPages}
                    />

                    <div className="relative z-10 mt-[32px] space-y-3 text-[14px] leading-[1.85]">
                      {contentPage.isFirstContentPage && (
                        <ReportBasicInformationBlock
                          report={report}
                          remarks={remarks}
                          testItemsSummary={displayTestItemsSummary}
                        />
                      )}

                      <div
                        className={
                          contentPage.isFirstContentPage
                            ? "report-result-table-block pt-3"
                            : "report-result-table-block pt-1"
                        }
                      >
                        <p className="mb-2 font-bold">
                          {contentPage.isFirstContentPage
                            ? "檢測結果："
                            : "檢測結果（續）："}
                        </p>

                        <ReportResultTable
                          resultItems={contentPage.resultItems}
                          showEmptyMessage={uniqueItems.length === 0}
                        />
                      </div>

                      {contentPage.isLastContentPage && (
                        <>
                          <p className="pt-5 text-center font-bold">
                            * * * 本報告結束 * * *
                          </p>
                        </>
                      )}
                    </div>

                    {contentPage.isLastContentPage && (
                      <div className="relative z-10 mt-auto">
                        <ReportSignatureBlock
                          preparedBy={preparedBy}
                          reviewedBy={reviewedBy}
                          authorizedSignatory={authorizedSignatory}
                        />

                        <div className="mt-7 text-[11px] leading-5">
                          <p>
                            聲明：本報告的檢驗結果僅與被檢測的樣品有關，除非另行說明。
                          </p>
                          <p>
                            未經本公司書面同意，不得部分複印本報告，完整複印除外。
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <ReportFooterBar />
                </section>
              ))}

              <section className="no-print rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-5 text-lg font-bold text-slate-900">
                  Edit Result Items
                </h2>

                <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-6 text-blue-800">
                  此處已按「檢測項目 + 檢測方法」去重顯示。修改其中一項時，系統會同步更新相同檢測項目的重複資料列，避免正式報告重複顯示三次。
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] border-collapse text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="border border-slate-200 px-3 py-3 text-left font-semibold text-slate-700">
                          檢測項目
                        </th>
                        <th className="border border-slate-200 px-3 py-3 text-left font-semibold text-slate-700">
                          檢測方法
                        </th>
                        <th className="border border-slate-200 px-3 py-3 text-left font-semibold text-slate-700">
                          結果數據
                        </th>
                        <th className="border border-slate-200 px-3 py-3 text-left font-semibold text-slate-700">
                          單位
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {uniqueItems.length === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="border border-slate-200 px-3 py-6 text-center text-slate-500"
                          >
                            No report items.
                          </td>
                        </tr>
                      )}

                      {uniqueItems.map((item) => (
                        <tr key={buildReportItemUniqueKey(item)}>
                          <td className="border border-slate-200 px-3 py-3">
                            <input
                              value={item.item_name || ""}
                              onChange={(event) =>
                                updateUniqueItem(
                                  item,
                                  "item_name",
                                  event.target.value
                                )
                              }
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                            />
                          </td>

                          <td className="border border-slate-200 px-3 py-3">
                            <input
                              value={item.test_method || ""}
                              onChange={(event) =>
                                updateUniqueItem(
                                  item,
                                  "test_method",
                                  event.target.value
                                )
                              }
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                            />
                          </td>

                          <td className="border border-slate-200 px-3 py-3">
                            <input
                              value={item.result_value || ""}
                              onChange={(event) =>
                                updateUniqueItem(
                                  item,
                                  "result_value",
                                  event.target.value
                                )
                              }
                              placeholder="例如：＜ 10 / 未檢出"
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                            />
                          </td>

                          <td className="border border-slate-200 px-3 py-3">
                            <input
                              value={item.unit || ""}
                              onChange={(event) =>
                                updateUniqueItem(
                                  item,
                                  "unit",
                                  event.target.value
                                )
                              }
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <aside className="report-side-panel space-y-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-5 text-lg font-bold text-slate-900">
                  Report Information
                </h2>

                <div className="space-y-4 text-sm">
                  <p>
                    <span className="font-semibold text-slate-900">
                      Report No.:
                    </span>{" "}
                    {report.report_no || "-"}
                  </p>

                  <p>
                    <span className="font-semibold text-slate-900">
                      Customer:
                    </span>{" "}
                    {report.customer_name || "-"}
                  </p>

                  <p>
                    <span className="font-semibold text-slate-900">
                      Sample:
                    </span>{" "}
                    {report.sample_name || "-"}
                  </p>

                  <p>
                    <span className="font-semibold text-slate-900">
                      Source Quotation:
                    </span>{" "}
                    {report.source_quotation_no || "-"}
                  </p>

                  <p>
                    <span className="font-semibold text-slate-900">
                      Original Item Rows:
                    </span>{" "}
                    {items.length}
                  </p>

                  <p>
                    <span className="font-semibold text-slate-900">
                      Displayed Unique Items:
                    </span>{" "}
                    {uniqueItems.length}
                  </p>

                  <p>
                    <span className="font-semibold text-slate-900">
                      Total Pages:
                    </span>{" "}
                    {totalReportPages}
                  </p>
                </div>

                <div className="mt-5">
                  <label className="text-sm font-medium text-slate-700">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                  >
                    <option value="draft">Draft</option>
                    <option value="issued">Issued</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-5 text-lg font-bold text-slate-900">
                  Signatory / Remarks
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      Prepared By / 編製人
                    </label>
                    <input
                      value={preparedBy}
                      onChange={(event) => setPreparedBy(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      Reviewed By / 審核人
                    </label>
                    <input
                      value={reviewedBy}
                      onChange={(event) => setReviewedBy(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      Authorized Signatory / 授權簽署人
                    </label>
                    <input
                      value={authorizedSignatory}
                      onChange={(event) =>
                        setAuthorizedSignatory(event.target.value)
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      Remarks / 備註
                    </label>
                    <textarea
                      value={remarks}
                      onChange={(event) => setRemarks(event.target.value)}
                      rows={5}
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                    />
                  </div>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </AppShell>
  );
}
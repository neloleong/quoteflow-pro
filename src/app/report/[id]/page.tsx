"use client";

import Image from "next/image";
import {
  type ChangeEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
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
  report_page_start: number | string | null;
  report_total_pages: number | string | null;
};

type ReportItem = {
  id: string;
  report_id: string;
  source_quotation_item_id: string | null;
  source_test_item_id: string | null;
  item_name: string | null;
  test_method: string | null;
  result_value: string | null;
  result_exponent: string | null;
  unit: string | null;
  sort_order: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type ReportItemEditableField =
  | "item_name"
  | "test_method"
  | "result_value"
  | "result_exponent"
  | "unit";

type ReportContentPage = {
  id: string;
  contentPageIndex: number;
  isFirstContentPage: boolean;
  isLastContentPage: boolean;
  resultItems: ReportItem[];
};

type ReportImage = {
  id: string;
  company_id: string | null;
  report_id: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  file_size: number | null;
  caption: string | null;
  sort_order: number | null;
  created_at: string | null;
  updated_at: string | null;
  signed_url: string;
};

type ReportImagePage = {
  id: string;
  imagePageIndex: number;
  images: ReportImage[];
};

const REPORT_CONTACT_LINE =
  "地址: 澳門美副將大馬路48號萬基工業大廈3樓A座  |  郵箱：admin01@emit.com.mo  |  電話：+853 2875 1742  |  傳真：+853 2852 0536";

const REPORT_COVER_TOP_BAR_SRC =
  "/images/report-cover-topbar.png";

const REPORT_FOOTER_CONTACT_BAR_SRC =
  "/images/report-cover-contact-bar.png";

const REPORT_COVER_LOGO_SRC =
  "/images/report-cover-logo.png";

const REPORT_LOGO_ICON_SRC =
  "/images/report-cover-logo-icon.png";

const REPORT_LOGO_TEXT_SRC =
  "/images/report-cover-logo-text.png";

const REPORT_SIGNATURE_PREPARED_SRC =
  "/images/report-signature-prepared.png";

const REPORT_SIGNATURE_REVIEWED_SRC =
  "/images/report-signature-reviewed.png";

const REPORT_SIGNATURE_AUTHORIZED_SRC =
  "/images/report-signature-authorized.png";

const REPORT_WATERMARK_ORIGINAL_SRC =
  "/images/report-watermark-original-v2.png?v=20260605";

const FIRST_RESULT_PAGE_ITEM_LIMIT = 7;
const CONTINUATION_RESULT_PAGE_ITEM_LIMIT = 12;

const REPORT_IMAGES_BUCKET = "report-images";
const REPORT_IMAGES_PER_PAGE = 2;

const MAX_REPORT_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_REPORT_IMAGE_DIMENSION = 2400;

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

  return `${formatDateDash(startDate)} 至 ${formatDateDash(
    finalEndDate
  )}`;
}

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

function parsePositiveIntegerOrNull(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();

  if (!text) {
    return null;
  }

  const parsedValue = Number.parseInt(text, 10);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return parsedValue;
}

function parsePositiveInteger(
  value: unknown,
  fallback: number
) {
  return parsePositiveIntegerOrNull(value) ?? fallback;
}

function normalizeReportText(
  value: string | null | undefined
) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

function buildReportItemUniqueKey(item: ReportItem) {
  const sourceTestItemId = normalizeReportText(
    item.source_test_item_id
  );

  if (sourceTestItemId) {
    return `source-test-item:${sourceTestItemId}`;
  }

  const itemName = normalizeReportText(item.item_name);
  const testMethod = normalizeReportText(item.test_method);

  return `item-method:${itemName}|${testMethod}`;
}

function buildUniqueReportItems(
  reportItems: ReportItem[]
) {
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
      test_method:
        existingItem.test_method || item.test_method,
      result_value:
        existingItem.result_value || item.result_value,
      result_exponent:
        existingItem.result_exponent ||
        item.result_exponent,
      unit: existingItem.unit || item.unit,
      sort_order:
        existingItem.sort_order !== null &&
        existingItem.sort_order !== undefined
          ? existingItem.sort_order
          : item.sort_order,
    });
  });

  return Array.from(uniqueMap.values()).sort(
    (itemA, itemB) => {
      const sortOrderA = Number(itemA.sort_order || 0);
      const sortOrderB = Number(itemB.sort_order || 0);

      if (sortOrderA !== sortOrderB) {
        return sortOrderA - sortOrderB;
      }

      return String(itemA.item_name || "").localeCompare(
        String(itemB.item_name || "")
      );
    }
  );
}

function splitSummaryItems(
  summaryText: string | null | undefined
) {
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

function buildReportContentPages(
  reportItems: ReportItem[]
) {
  if (
    reportItems.length <= FIRST_RESULT_PAGE_ITEM_LIMIT
  ) {
    return [
      {
        id: "report-content-page-1",
        contentPageIndex: 0,
        isFirstContentPage: true,
        isLastContentPage: true,
        resultItems: reportItems,
      },
    ];
  }

  const pages: ReportContentPage[] = [];

  pages.push({
    id: "report-content-page-1",
    contentPageIndex: 0,
    isFirstContentPage: true,
    isLastContentPage: false,
    resultItems: reportItems.slice(
      0,
      FIRST_RESULT_PAGE_ITEM_LIMIT
    ),
  });

  let cursor = FIRST_RESULT_PAGE_ITEM_LIMIT;
  let contentPageIndex = 1;

  while (cursor < reportItems.length) {
    const pageItems = reportItems.slice(
      cursor,
      cursor + CONTINUATION_RESULT_PAGE_ITEM_LIMIT
    );

    pages.push({
      id: `report-content-page-${contentPageIndex + 1}`,
      contentPageIndex,
      isFirstContentPage: false,
      isLastContentPage: false,
      resultItems: pageItems,
    });

    cursor += CONTINUATION_RESULT_PAGE_ITEM_LIMIT;
    contentPageIndex += 1;
  }

  return pages.map((page, index, allPages) => ({
    ...page,
    isLastContentPage: index === allPages.length - 1,
  }));
}

function buildReportImagePages(
  reportImages: ReportImage[]
) {
  const pages: ReportImagePage[] = [];

  for (
    let imageIndex = 0;
    imageIndex < reportImages.length;
    imageIndex += REPORT_IMAGES_PER_PAGE
  ) {
    const imagePageIndex = Math.floor(
      imageIndex / REPORT_IMAGES_PER_PAGE
    );

    pages.push({
      id: `report-image-page-${imagePageIndex + 1}`,
      imagePageIndex,
      images: reportImages.slice(
        imageIndex,
        imageIndex + REPORT_IMAGES_PER_PAGE
      ),
    });
  }

  return pages;
}

function sanitizeStorageFileName(fileName: string) {
  const normalizedName = String(
    fileName || "report-image"
  )
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalizedName || "report-image";
}

function buildConvertedPngName(fileName: string) {
  const sourceName = sanitizeStorageFileName(fileName);
  const nameWithoutExtension = sourceName.replace(
    /\.[^.]+$/i,
    ""
  );

  return `${nameWithoutExtension || "report-image"}.png`;
}

async function convertImageFileToPng(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = document.createElement("img");

    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();

      image.onerror = () =>
        reject(
          new Error(`Failed to read image: ${file.name}`)
        );

      image.src = objectUrl;
    });

    const sourceWidth =
      image.naturalWidth || image.width;

    const sourceHeight =
      image.naturalHeight || image.height;

    if (sourceWidth <= 0 || sourceHeight <= 0) {
      throw new Error(
        `Invalid image dimensions: ${file.name}`
      );
    }

    const scale = Math.min(
      1,
      MAX_REPORT_IMAGE_DIMENSION / sourceWidth,
      MAX_REPORT_IMAGE_DIMENSION / sourceHeight
    );

    const outputWidth = Math.max(
      1,
      Math.round(sourceWidth * scale)
    );

    const outputHeight = Math.max(
      1,
      Math.round(sourceHeight * scale)
    );

    const canvas = document.createElement("canvas");

    canvas.width = outputWidth;
    canvas.height = outputHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error(
        "Cannot create image conversion canvas."
      );
    }

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, outputWidth, outputHeight);

    context.drawImage(
      image,
      0,
      0,
      outputWidth,
      outputHeight
    );

    const pngBlob = await new Promise<Blob>(
      (resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(
                new Error(
                  `Failed to convert image: ${file.name}`
                )
              );

              return;
            }

            resolve(blob);
          },
          "image/png"
        );
      }
    );

    return new File(
      [pngBlob],
      buildConvertedPngName(file.name),
      {
        type: "image/png",
        lastModified: Date.now(),
      }
    );
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function formatResultValueWithExponent(
  resultValue: string | null,
  resultExponent: string | null
) {
  const cleanValue = String(resultValue || "").trim();
  const cleanExponent = String(
    resultExponent || ""
  ).trim();

  if (!cleanValue && !cleanExponent) {
    return "-";
  }

  if (!cleanValue || cleanValue === "-") {
    return "-";
  }

  if (!cleanExponent) {
    return cleanValue;
  }

  if (/([×xX*])\s*10/.test(cleanValue)) {
    return cleanValue;
  }

  const superscriptMap: Record<string, string> = {
    "0": "⁰",
    "1": "¹",
    "2": "²",
    "3": "³",
    "4": "⁴",
    "5": "⁵",
    "6": "⁶",
    "7": "⁷",
    "8": "⁸",
    "9": "⁹",
    "-": "⁻",
    "+": "⁺",
    "⁰": "⁰",
    "¹": "¹",
    "²": "²",
    "³": "³",
    "⁴": "⁴",
    "⁵": "⁵",
    "⁶": "⁶",
    "⁷": "⁷",
    "⁸": "⁸",
    "⁹": "⁹",
    "⁻": "⁻",
    "⁺": "⁺",
  };

  const exponentText = cleanExponent
    .replace(/[×xX*]\s*10/i, "")
    .replace(/^10\^?/i, "")
    .replace(/^\^/, "")
    .split("")
    .map(
      (character) =>
        superscriptMap[character] || character
    )
    .join("");

  return `${cleanValue}×10${exponentText}`;
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
        <span className="font-bold">
          {report.sample_name || "-"}
        </span>
        ” 的樣品所做的檢測。
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
          <th className="w-[28%] border border-black px-3 py-2 text-center font-bold">
            檢測項目
          </th>

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
            <td className="border border-black px-3 py-2 text-center">
              {item.item_name || "-"}
            </td>

            <td className="border border-black px-3 py-2 text-center">
              {item.test_method || "-"}
            </td>

            <td className="border border-black px-3 py-2 text-center">
              {formatResultValueWithExponent(
                item.result_value,
                item.result_exponent
              )}
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

        <p className="mt-[8px] text-[15px] font-bold">
          {label}
        </p>

        {name && (
          <p className="mt-[3px] text-[12px]">{name}</p>
        )}
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

function ReportImagesBlock({
  reportImages,
  startIndex,
}: {
  reportImages: ReportImage[];
  startIndex: number;
}) {
  return (
    <div className="space-y-5">
      {reportImages.map((reportImage, imageIndex) => {
        const displayImageNumber =
          startIndex + imageIndex + 1;

        return (
          <figure
            key={reportImage.id}
            className="flex min-h-[300px] flex-col rounded-lg border border-black bg-white p-3"
          >
            <div className="flex min-h-[245px] flex-1 items-center justify-center overflow-hidden">
              {reportImage.signed_url ? (
                <img
                  src={reportImage.signed_url}
                  alt={`圖${displayImageNumber}`}
                  className="report-photo-image max-h-[275px] max-w-full object-contain"
                />
              ) : (
                <div className="flex h-[245px] w-full items-center justify-center bg-slate-50 text-sm text-slate-500">
                  Image preview unavailable.
                </div>
              )}
            </div>

            <figcaption className="mt-3 border-t border-slate-300 pt-2 text-center text-[13px] font-bold leading-5">
              圖{displayImageNumber}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

export default function ReportDetailPage() {
  const params = useParams();
  const router = useRouter();

  const supabase = useMemo(() => createClient(), []);

  const rawReportId = params?.id as
    | string
    | string[]
    | undefined;

  const reportId = Array.isArray(rawReportId)
    ? rawReportId[0] || ""
    : rawReportId || "";

  const [hasMounted, setHasMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [generatingPdf, setGeneratingPdf] =
    useState(false);

  const [uploadingImages, setUploadingImages] =
    useState(false);

  const [deletingImageId, setDeletingImageId] =
    useState<string | null>(null);

  const [report, setReport] = useState<Report | null>(
    null
  );

  const [items, setItems] = useState<ReportItem[]>([]);

  const [reportImages, setReportImages] = useState<
    ReportImage[]
  >([]);

  const [reportNo, setReportNo] = useState("");
  const [reportDate, setReportDate] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] =
    useState("");
  const [sampleName, setSampleName] = useState("");
  const [sampleDescription, setSampleDescription] =
    useState("");
  const [receivedDate, setReceivedDate] = useState("");
  const [testStartDate, setTestStartDate] = useState("");
  const [testEndDate, setTestEndDate] = useState("");
  const [sourceQuotationNo, setSourceQuotationNo] =
    useState("");

  const [reportPageStart, setReportPageStart] =
    useState("1");

  const [reportTotalPages, setReportTotalPages] =
    useState("");

  const [status, setStatus] = useState("draft");
  const [remarks, setRemarks] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [reviewedBy, setReviewedBy] = useState("");

  const [
    authorizedSignatory,
    setAuthorizedSignatory,
  ] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  const uniqueItems = useMemo(
    () => buildUniqueReportItems(items),
    [items]
  );

  const liveReport = useMemo(() => {
    if (!report) {
      return null;
    }

    return {
      ...report,
      report_no: reportNo,
      report_date: reportDate,
      customer_name: customerName,
      customer_address: customerAddress,
      sample_name: sampleName,
      sample_description: sampleDescription,
      received_date: receivedDate,
      test_start_date: testStartDate,
      test_end_date: testEndDate,
      source_quotation_no: sourceQuotationNo,
      status,
      remarks,
      prepared_by: preparedBy,
      reviewed_by: reviewedBy,
      authorized_signatory: authorizedSignatory,
      report_page_start: reportPageStart,
      report_total_pages: reportTotalPages,
    } as Report;
  }, [
    report,
    reportNo,
    reportDate,
    customerName,
    customerAddress,
    sampleName,
    sampleDescription,
    receivedDate,
    testStartDate,
    testEndDate,
    sourceQuotationNo,
    status,
    remarks,
    preparedBy,
    reviewedBy,
    authorizedSignatory,
    reportPageStart,
    reportTotalPages,
  ]);

  const displayTestItemsSummary = useMemo(
    () =>
      buildDisplayTestItemsSummary(liveReport, uniqueItems),
    [liveReport, uniqueItems]
  );

  const contentPages = useMemo(
    () => buildReportContentPages(uniqueItems),
    [uniqueItems]
  );

  const imagePages = useMemo(
    () => buildReportImagePages(reportImages),
    [reportImages]
  );

  const signaturePageCount =
    reportImages.length > 0 ? 1 : 0;

  const autoReportBodyPageCount = Math.max(
    contentPages.length +
      imagePages.length +
      signaturePageCount,
    1
  );

  const pdfPhysicalPageCount =
    autoReportBodyPageCount + 1;

  const displayReportPageStart = useMemo(
    () => parsePositiveInteger(reportPageStart, 1),
    [reportPageStart]
  );

  const displayReportTotalPages = useMemo(() => {
    return (
      parsePositiveIntegerOrNull(reportTotalPages) ||
      autoReportBodyPageCount
    );
  }, [reportTotalPages, autoReportBodyPageCount]);

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

  async function loadReportImages(
    targetReportId: string
  ) {
    const {
      data: reportImagesData,
      error: reportImagesError,
    } = await supabase
      .from("report_images")
      .select(
        "id,company_id,report_id,file_name,file_path,mime_type,file_size,caption,sort_order,created_at,updated_at"
      )
      .eq("report_id", targetReportId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (reportImagesError) {
      throw reportImagesError;
    }

    const loadedImages = Array.isArray(reportImagesData)
      ? (reportImagesData as unknown as Omit<
          ReportImage,
          "signed_url"
        >[])
      : [];

    const imagesWithSignedUrls = await Promise.all(
      loadedImages.map(async (reportImage, imageIndex) => {
        const {
          data: signedUrlData,
          error: signedUrlError,
        } = await supabase.storage
          .from(REPORT_IMAGES_BUCKET)
          .createSignedUrl(reportImage.file_path, 60 * 60);

        return {
          ...reportImage,
          sort_order:
            reportImage.sort_order ?? imageIndex + 1,
          signed_url:
            signedUrlError || !signedUrlData?.signedUrl
              ? ""
              : signedUrlData.signedUrl,
        } as ReportImage;
      })
    );

    setReportImages(imagesWithSignedUrls);
  }

  async function handleUploadReportImages(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const selectedFiles = Array.from(
      event.target.files || []
    );

    event.target.value = "";

    if (!report || !reportId) {
      setErrorMessage("Report not found.");
      return;
    }

    if (selectedFiles.length === 0) {
      return;
    }

    try {
      setUploadingImages(true);
      setErrorMessage("");
      setSuccessMessage("");

      const allowedMimeTypes = new Set([
        "image/jpeg",
        "image/png",
        "image/webp",
      ]);

      let nextSortOrder =
        reportImages.reduce((highestOrder, reportImage) => {
          return Math.max(
            highestOrder,
            Number(reportImage.sort_order || 0)
          );
        }, 0) + 1;

      for (const originalFile of selectedFiles) {
        if (!allowedMimeTypes.has(originalFile.type)) {
          throw new Error(
            `${originalFile.name}: only JPG, PNG and WEBP images are supported.`
          );
        }

        if (
          originalFile.size > MAX_REPORT_IMAGE_SIZE
        ) {
          throw new Error(
            `${originalFile.name}: image size cannot exceed 10MB.`
          );
        }

        const uploadFile =
          await convertImageFileToPng(originalFile);

        if (uploadFile.size > MAX_REPORT_IMAGE_SIZE) {
          throw new Error(
            `${uploadFile.name}: converted image size cannot exceed 10MB.`
          );
        }

        const uniqueToken =
          typeof crypto !== "undefined" &&
          "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()
                .toString(36)
                .slice(2)}`;

        const safeFileName =
          sanitizeStorageFileName(uploadFile.name);

        const filePath = `${reportId}/${Date.now()}-${uniqueToken}-${safeFileName}`;

        const { error: uploadError } =
          await supabase.storage
            .from(REPORT_IMAGES_BUCKET)
            .upload(filePath, uploadFile, {
              cacheControl: "3600",
              contentType: "image/png",
              upsert: false,
            });

        if (uploadError) {
          throw uploadError;
        }

        const { error: imageInsertError } =
          await supabase.from("report_images").insert({
            company_id: report.company_id,
            report_id: reportId,
            file_name: uploadFile.name,
            file_path: filePath,
            mime_type: "image/png",
            file_size: uploadFile.size,
            caption: null,
            sort_order: nextSortOrder,
            updated_at: new Date().toISOString(),
          });

        if (imageInsertError) {
          await supabase.storage
            .from(REPORT_IMAGES_BUCKET)
            .remove([filePath]);

          throw imageInsertError;
        }

        nextSortOrder += 1;
      }

      await loadReportImages(reportId);

      setSuccessMessage(
        `${selectedFiles.length} image(s) uploaded successfully.`
      );
    } catch (error) {
      setErrorMessage(
        getErrorMessage(
          error,
          "Failed to upload report images."
        )
      );
    } finally {
      setUploadingImages(false);
    }
  }

  function updateReportImageCaption(
    imageId: string,
    caption: string
  ) {
    setReportImages((currentImages) =>
      currentImages.map((reportImage) =>
        reportImage.id === imageId
          ? {
              ...reportImage,
              caption,
            }
          : reportImage
      )
    );
  }

  function moveReportImage(
    imageId: string,
    direction: "up" | "down"
  ) {
    setReportImages((currentImages) => {
      const orderedImages = [...currentImages].sort(
        (imageA, imageB) =>
          Number(imageA.sort_order || 0) -
          Number(imageB.sort_order || 0)
      );

      const currentIndex = orderedImages.findIndex(
        (reportImage) => reportImage.id === imageId
      );

      if (currentIndex < 0) {
        return currentImages;
      }

      const targetIndex =
        direction === "up"
          ? currentIndex - 1
          : currentIndex + 1;

      if (
        targetIndex < 0 ||
        targetIndex >= orderedImages.length
      ) {
        return currentImages;
      }

      const currentImage = orderedImages[currentIndex];
      const targetImage = orderedImages[targetIndex];

      orderedImages[currentIndex] = targetImage;
      orderedImages[targetIndex] = currentImage;

      return orderedImages.map(
        (reportImage, imageIndex) => ({
          ...reportImage,
          sort_order: imageIndex + 1,
        })
      );
    });
  }

  async function deleteReportImage(
    reportImage: ReportImage
  ) {
    const confirmed = window.confirm(
      `確認刪除圖${reportImages.findIndex(
        (item) => item.id === reportImage.id
      ) + 1}嗎？`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingImageId(reportImage.id);
      setErrorMessage("");
      setSuccessMessage("");

      const deletedAt = new Date().toISOString();

      const { error: imageDeleteError } = await supabase
        .from("report_images")
        .update({
          deleted_at: deletedAt,
          updated_at: deletedAt,
        })
        .eq("id", reportImage.id)
        .eq("report_id", reportId);

      if (imageDeleteError) {
        throw imageDeleteError;
      }

      const { error: storageDeleteError } =
        await supabase.storage
          .from(REPORT_IMAGES_BUCKET)
          .remove([reportImage.file_path]);

      if (storageDeleteError) {
        console.warn(
          "Report image storage remove warning:",
          storageDeleteError
        );
      }

      await loadReportImages(reportId);

      setSuccessMessage("Report image deleted.");
    } catch (error) {
      setErrorMessage(
        getErrorMessage(
          error,
          "Failed to delete report image."
        )
      );
    } finally {
      setDeletingImageId(null);
    }
  }

  async function loadReportDetail() {
    try {
      setLoading(true);
      setErrorMessage("");
      setSuccessMessage("");

      const { data: reportData, error: reportError } =
        await supabase
          .from("reports")
          .select("*")
          .eq("id", reportId)
          .is("deleted_at", null)
          .maybeSingle();

      if (reportError) {
        throw reportError;
      }

      if (!reportData) {
        throw new Error(
          `Report not found. reportId=${reportId}`
        );
      }

      const {
        data: reportItemsData,
        error: reportItemsError,
      } = await supabase
        .from("report_items")
        .select("*")
        .eq("report_id", reportId)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (reportItemsError) {
        throw reportItemsError;
      }

      const loadedReport = reportData as Report;
      const loadedItems =
        (reportItemsData ?? []) as ReportItem[];

      setReport(loadedReport);
      setItems(loadedItems);

      await loadReportImages(reportId);

      setReportNo(loadedReport.report_no || "");

      setReportDate(
        loadedReport.report_date
          ? String(loadedReport.report_date).slice(0, 10)
          : ""
      );

      setCustomerName(loadedReport.customer_name || "");

      setCustomerAddress(
        loadedReport.customer_address || ""
      );

      setSampleName(loadedReport.sample_name || "");

      setSampleDescription(
        loadedReport.sample_description || ""
      );

      setReceivedDate(
        loadedReport.received_date
          ? String(loadedReport.received_date).slice(
              0,
              10
            )
          : ""
      );

      setTestStartDate(
        loadedReport.test_start_date
          ? String(loadedReport.test_start_date).slice(
              0,
              10
            )
          : ""
      );

      setTestEndDate(
        loadedReport.test_end_date
          ? String(loadedReport.test_end_date).slice(
              0,
              10
            )
          : ""
      );

      setSourceQuotationNo(
        loadedReport.source_quotation_no || ""
      );

      setReportPageStart(
        loadedReport.report_page_start
          ? String(loadedReport.report_page_start)
          : "1"
      );

      setReportTotalPages(
        loadedReport.report_total_pages
          ? String(loadedReport.report_total_pages)
          : ""
      );

      setStatus(loadedReport.status || "draft");
      setRemarks(loadedReport.remarks || "");
      setPreparedBy(loadedReport.prepared_by || "");
      setReviewedBy(loadedReport.reviewed_by || "");

      setAuthorizedSignatory(
        loadedReport.authorized_signatory || ""
      );
    } catch (error) {
      setErrorMessage(
        getErrorMessage(
          error,
          "Failed to load report detail."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  function updateUniqueItem(
    targetItem: ReportItem,
    field: ReportItemEditableField,
    value: string
  ) {
    const targetKey =
      buildReportItemUniqueKey(targetItem);

    setItems((currentItems) =>
      currentItems.map((item) => {
        if (
          buildReportItemUniqueKey(item) !== targetKey
        ) {
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

      const cleanReportNo = reportNo.trim();
      const cleanCustomerName = customerName.trim();
      const cleanCustomerAddress =
        customerAddress.trim();
      const cleanSampleName = sampleName.trim();

      const cleanSampleDescription =
        sampleDescription.trim();

      const cleanSourceQuotationNo =
        sourceQuotationNo.trim();

      if (!cleanReportNo) {
        throw new Error(
          "Report No. cannot be empty."
        );
      }

      if (!cleanCustomerName) {
        throw new Error(
          "Customer cannot be empty."
        );
      }

      if (!cleanSampleName) {
        throw new Error("Sample cannot be empty.");
      }

      const savedReportPageStart =
        parsePositiveInteger(reportPageStart, 1);

      const savedReportTotalPages =
        reportTotalPages.trim() === ""
          ? null
          : parsePositiveInteger(
              reportTotalPages,
              autoReportBodyPageCount
            );

      const { error: reportUpdateError } =
        await supabase
          .from("reports")
          .update({
            report_no: cleanReportNo,
            report_date: reportDate || null,
            customer_name: cleanCustomerName,
            customer_address:
              cleanCustomerAddress || null,
            sample_name: cleanSampleName,
            sample_description:
              cleanSampleDescription || cleanSampleName,
            received_date: receivedDate || null,
            test_start_date: testStartDate || null,
            test_end_date: testEndDate || null,
            source_quotation_no:
              cleanSourceQuotationNo || null,
            status,
            remarks: remarks.trim() || null,
            prepared_by: preparedBy.trim() || null,
            reviewed_by: reviewedBy.trim() || null,
            authorized_signatory:
              authorizedSignatory.trim() || null,
            report_page_start: savedReportPageStart,
            report_total_pages: savedReportTotalPages,
            updated_at: new Date().toISOString(),
          })
          .eq("id", report.id);

      if (reportUpdateError) {
        throw reportUpdateError;
      }

      for (const item of items) {
        const { error: itemUpdateError } =
          await supabase
            .from("report_items")
            .update({
              item_name:
                item.item_name?.trim() || null,
              test_method:
                item.test_method?.trim() || null,
              result_value:
                item.result_value?.trim() || null,
              result_exponent:
                item.result_exponent?.trim() || null,
              unit: item.unit?.trim() || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id);

        if (itemUpdateError) {
          throw itemUpdateError;
        }
      }

      for (
        let imageIndex = 0;
        imageIndex < reportImages.length;
        imageIndex += 1
      ) {
        const reportImage = reportImages[imageIndex];

        const { error: imageUpdateError } =
          await supabase
            .from("report_images")
            .update({
              caption:
                reportImage.caption?.trim() || null,
              sort_order: imageIndex + 1,
              updated_at: new Date().toISOString(),
            })
            .eq("id", reportImage.id)
            .eq("report_id", report.id);

        if (imageUpdateError) {
          throw imageUpdateError;
        }
      }

      setSuccessMessage(
        "Report updated successfully."
      );

      await loadReportDetail();
    } catch (error) {
      setErrorMessage(
        getErrorMessage(
          error,
          "Failed to save report."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  function printReport() {
    window.print();
  }

  function generateReportPdf() {
    if (!reportId) {
      setErrorMessage(
        "Cannot find report id for PDF generation."
      );

      return;
    }

    setErrorMessage("");
    setGeneratingPdf(true);

    const query = new URLSearchParams();

    query.set(
      "reportPageStart",
      String(displayReportPageStart)
    );

    query.set(
      "reportTotalPages",
      String(displayReportTotalPages)
    );

    window.open(
      `/api/report/${encodeURIComponent(
        String(reportId)
      )}/pdf?${query.toString()}`,
      "_blank",
      "noopener,noreferrer"
    );

    setTimeout(() => {
      setGeneratingPdf(false);
    }, 1200);
  }

  if (!hasMounted) {
    return (
      <AppShell>
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm text-slate-500">
              Loading report...
            </p>
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
          src: url("/fonts/emit-report-body.ttf")
            format("truetype");
          font-weight: 400;
          font-style: normal;
          font-display: swap;
        }

        @font-face {
          font-family: "EMITReportBody";
          src: url("/fonts/emit-report-body-bold.ttf")
            format("truetype");
          font-weight: 700;
          font-style: normal;
          font-display: swap;
        }

        @font-face {
          font-family: "EMITReportTitle";
          src: url("/fonts/emit-report-title.ttf")
            format("truetype");
          font-weight: 700;
          font-style: normal;
          font-display: swap;
        }

        .emit-report-font {
          font-family: "EMITReportBody",
            "Microsoft JhengHei", "Microsoft YaHei",
            "PingFang TC", "Arial", sans-serif;
        }

        .emit-report-title-font {
          font-family: "EMITReportTitle",
            "EMITReportBody", "Microsoft JhengHei",
            "Microsoft YaHei", "PingFang TC", serif;
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

        .report-photo-image {
          display: block;
          max-width: 100%;
          height: auto;
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
        <div className="report-actions mb-8 flex items-center justify-between gap-5">
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
              Review testing report, update report
              information and testing results, then print
              formal report.
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
              disabled={
                loading || generatingPdf || !report
              }
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generatingPdf
                ? "Generating..."
                : "Generate PDF"}
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

        {!loading && report && liveReport && (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
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
                        <p className="font-bold">
                          報告編號：
                        </p>

                        <p>{liveReport.report_no || "-"}</p>
                      </div>

                      <div className="grid grid-cols-[115px_1fr] gap-x-5">
                        <p className="font-bold">
                          樣品名稱：
                        </p>

                        <p>{liveReport.sample_name || "-"}</p>
                      </div>

                      <div className="grid grid-cols-[115px_1fr] gap-x-5">
                        <p className="font-bold">
                          委託單位：
                        </p>

                        <p>
                          {liveReport.customer_name || "-"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <ReportFooterBar />
              </section>

              {contentPages.map((contentPage) => {
                const displayPageNumber =
                  displayReportPageStart +
                  contentPage.contentPageIndex;

                return (
                  <section
                    key={contentPage.id}
                    className="report-sheet emit-report-font mx-auto flex flex-col overflow-hidden bg-white text-[14px] leading-[1.72] text-black shadow-sm"
                  >
                    <div className="relative flex flex-1 flex-col px-[58px] pb-[16px] pt-[36px]">
                      <ReportWatermark />

                      <ReportContentHeader
                        report={liveReport}
                        pageNumber={displayPageNumber}
                        totalReportPages={
                          displayReportTotalPages
                        }
                      />

                      <div className="relative z-10 mt-[32px] space-y-3 text-[14px] leading-[1.85]">
                        {contentPage.isFirstContentPage && (
                          <ReportBasicInformationBlock
                            report={liveReport}
                            remarks={remarks}
                            testItemsSummary={
                              displayTestItemsSummary
                            }
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
                            resultItems={
                              contentPage.resultItems
                            }
                            showEmptyMessage={
                              uniqueItems.length === 0
                            }
                          />
                        </div>

                        {contentPage.isLastContentPage &&
                          reportImages.length === 0 && (
                            <p className="pt-5 text-center font-bold">
                              * * * 本報告結束 * * *
                            </p>
                          )}
                      </div>

                      {contentPage.isLastContentPage &&
                        reportImages.length === 0 && (
                          <div className="relative z-10 mt-auto">
                            <ReportSignatureBlock
                              preparedBy={preparedBy}
                              reviewedBy={reviewedBy}
                              authorizedSignatory={
                                authorizedSignatory
                              }
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
                );
              })}

              {imagePages.map((imagePage) => {
                const displayPageNumber =
                  displayReportPageStart +
                  contentPages.length +
                  imagePage.imagePageIndex;

                return (
                  <section
                    key={imagePage.id}
                    className="report-sheet emit-report-font mx-auto flex flex-col overflow-hidden bg-white text-[14px] leading-[1.72] text-black shadow-sm"
                  >
                    <div className="relative flex flex-1 flex-col px-[58px] pb-[16px] pt-[36px]">
                      <ReportWatermark />

                      <ReportContentHeader
                        report={liveReport}
                        pageNumber={displayPageNumber}
                        totalReportPages={
                          displayReportTotalPages
                        }
                      />

                      <div className="relative z-10 mt-[28px]">
                        <p className="mb-4 font-bold">
                          圖片記錄：
                        </p>

                        <ReportImagesBlock
                          reportImages={imagePage.images}
                          startIndex={
                            imagePage.imagePageIndex *
                            REPORT_IMAGES_PER_PAGE
                          }
                        />
                      </div>
                    </div>

                    <ReportFooterBar />
                  </section>
                );
              })}

              {reportImages.length > 0 && (
                <section className="report-sheet emit-report-font mx-auto flex flex-col overflow-hidden bg-white text-[14px] leading-[1.72] text-black shadow-sm">
                  <div className="relative flex flex-1 flex-col px-[58px] pb-[16px] pt-[36px]">
                    <ReportWatermark />

                    <ReportContentHeader
                      report={liveReport}
                      pageNumber={
                        displayReportPageStart +
                        contentPages.length +
                        imagePages.length
                      }
                      totalReportPages={
                        displayReportTotalPages
                      }
                    />

                    <div className="relative z-10 mt-[60px] text-center">
                      <p className="text-[16px] font-bold">
                        * * * 本報告結束 * * *
                      </p>
                    </div>

                    <div className="relative z-10 mt-auto">
                      <ReportSignatureBlock
                        preparedBy={preparedBy}
                        reviewedBy={reviewedBy}
                        authorizedSignatory={
                          authorizedSignatory
                        }
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
                  </div>

                  <ReportFooterBar />
                </section>
              )}

              <section className="no-print rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-5 text-lg font-bold text-slate-900">
                  Edit Result Items
                </h2>

                <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs leading-6 text-blue-800">
                  此處已按「檢測項目 +
                  檢測方法」去重顯示。修改其中一項時，系統會同步更新相同檢測項目的重複資料列，避免正式報告重複顯示三次。
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1050px] border-collapse text-sm">
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
                          次方數
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
                            colSpan={5}
                            className="border border-slate-200 px-3 py-6 text-center text-slate-500"
                          >
                            No report items.
                          </td>
                        </tr>
                      )}

                      {uniqueItems.map((item) => (
                        <tr
                          key={buildReportItemUniqueKey(
                            item
                          )}
                        >
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
                              value={
                                item.test_method || ""
                              }
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
                              value={
                                item.result_value || ""
                              }
                              onChange={(event) =>
                                updateUniqueItem(
                                  item,
                                  "result_value",
                                  event.target.value
                                )
                              }
                              placeholder="例如：2.6 / ＜ 10 / 未檢出"
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                            />
                          </td>

                          <td className="border border-slate-200 px-3 py-3">
                            <input
                              value={
                                item.result_exponent || ""
                              }
                              onChange={(event) =>
                                updateUniqueItem(
                                  item,
                                  "result_exponent",
                                  event.target.value
                                )
                              }
                              placeholder="例如：2 / 10² / 10^2"
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

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      Report No.
                    </label>

                    <input
                      value={reportNo}
                      onChange={(event) =>
                        setReportNo(event.target.value)
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      Report Date
                    </label>

                    <input
                      type="date"
                      value={reportDate}
                      onChange={(event) =>
                        setReportDate(event.target.value)
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      Customer
                    </label>

                    <input
                      value={customerName}
                      onChange={(event) =>
                        setCustomerName(event.target.value)
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      Customer Address
                    </label>

                    <textarea
                      value={customerAddress}
                      onChange={(event) =>
                        setCustomerAddress(
                          event.target.value
                        )
                      }
                      rows={3}
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      Sample
                    </label>

                    <input
                      value={sampleName}
                      onChange={(event) =>
                        setSampleName(event.target.value)
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      Sample Description
                    </label>

                    <textarea
                      value={sampleDescription}
                      onChange={(event) =>
                        setSampleDescription(
                          event.target.value
                        )
                      }
                      rows={3}
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      Received Date / 收樣日期
                    </label>

                    <input
                      type="date"
                      value={receivedDate}
                      onChange={(event) =>
                        setReceivedDate(event.target.value)
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      Test Start Date / 檢測開始日期
                    </label>

                    <input
                      type="date"
                      value={testStartDate}
                      onChange={(event) =>
                        setTestStartDate(
                          event.target.value
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      Test End Date / 檢測結束日期
                    </label>

                    <input
                      type="date"
                      value={testEndDate}
                      onChange={(event) =>
                        setTestEndDate(event.target.value)
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      Source Quotation
                    </label>

                    <input
                      value={sourceQuotationNo}
                      onChange={(event) =>
                        setSourceQuotationNo(
                          event.target.value
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                    />
                  </div>

                  <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                    <p>
                      <span className="font-semibold text-slate-900">
                        Original Item Rows:
                      </span>{" "}
                      {items.length}
                    </p>

                    <p className="mt-2">
                      <span className="font-semibold text-slate-900">
                        Displayed Unique Items:
                      </span>{" "}
                      {uniqueItems.length}
                    </p>

                    <p className="mt-2">
                      <span className="font-semibold text-slate-900">
                        Report Images:
                      </span>{" "}
                      {reportImages.length}
                    </p>

                    <p className="mt-2">
                      <span className="font-semibold text-slate-900">
                        Image Pages:
                      </span>{" "}
                      {imagePages.length}
                    </p>

                    <p className="mt-2">
                      <span className="font-semibold text-slate-900">
                        PDF Physical Pages:
                      </span>{" "}
                      {pdfPhysicalPageCount}
                    </p>

                    <p className="mt-2">
                      <span className="font-semibold text-slate-900">
                        Auto Report Pages:
                      </span>{" "}
                      {autoReportBodyPageCount}
                    </p>

                    <div className="mt-4 space-y-3">
                      <div>
                        <label className="text-sm font-medium text-slate-700">
                          Report Page Start /
                          正文起始頁碼
                        </label>

                        <input
                          type="number"
                          min={1}
                          value={reportPageStart}
                          onChange={(event) =>
                            setReportPageStart(
                              event.target.value
                            )
                          }
                          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-900"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-slate-700">
                          Report Total Pages /
                          正文總頁數
                        </label>

                        <input
                          type="number"
                          min={1}
                          value={reportTotalPages}
                          onChange={(event) =>
                            setReportTotalPages(
                              event.target.value
                            )
                          }
                          placeholder={String(
                            autoReportBodyPageCount
                          )}
                          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-900"
                        />
                      </div>

                      <div className="rounded-lg bg-white px-3 py-2 text-xs leading-5 text-slate-600">
                        Preview: 第{" "}
                        {displayReportPageStart} 頁 共{" "}
                        {displayReportTotalPages} 頁
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      Status
                    </label>

                    <select
                      value={status}
                      onChange={(event) =>
                        setStatus(event.target.value)
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                    >
                      <option value="draft">Draft</option>
                      <option value="issued">Issued</option>
                      <option value="cancelled">
                        Cancelled
                      </option>
                    </select>
                  </div>
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
                      onChange={(event) =>
                        setPreparedBy(event.target.value)
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      Reviewed By / 審核人
                    </label>

                    <input
                      value={reviewedBy}
                      onChange={(event) =>
                        setReviewedBy(event.target.value)
                      }
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700">
                      Authorized Signatory /
                      授權簽署人
                    </label>

                    <input
                      value={authorizedSignatory}
                      onChange={(event) =>
                        setAuthorizedSignatory(
                          event.target.value
                        )
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
                      onChange={(event) =>
                        setRemarks(event.target.value)
                      }
                      rows={5}
                      className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Report Images / 報告圖片
                    </h2>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      支援 JPG、PNG、WEBP，每張最多
                      10MB。系統會統一轉為標準 PNG，
                      確保正式 PDF 顯示圖片。
                    </p>
                  </div>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {reportImages.length}
                  </span>
                </div>

                <label className="mt-5 flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-700 hover:border-slate-500 hover:bg-slate-100">
                  {uploadingImages
                    ? "Converting and uploading..."
                    : "Upload Images / 上載圖片"}

                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    disabled={
                      uploadingImages ||
                      saving ||
                      loading ||
                      !report
                    }
                    onChange={handleUploadReportImages}
                    className="hidden"
                  />
                </label>

                {reportImages.length === 0 ? (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    尚未加入報告圖片。
                  </div>
                ) : (
                  <div className="mt-5 space-y-4">
                    {reportImages.map(
                      (reportImage, imageIndex) => (
                        <div
                          key={reportImage.id}
                          className="overflow-hidden rounded-xl border border-slate-200"
                        >
                          <div className="flex h-[180px] items-center justify-center bg-slate-50 p-3">
                            {reportImage.signed_url ? (
                              <img
                                src={
                                  reportImage.signed_url
                                }
                                alt={`圖${imageIndex + 1}`}
                                className="max-h-full max-w-full object-contain"
                              />
                            ) : (
                              <p className="text-xs text-slate-500">
                                Image preview unavailable.
                              </p>
                            )}
                          </div>

                          <div className="space-y-3 p-4">
                            <div>
                              <p className="text-sm font-bold text-slate-900">
                                圖{imageIndex + 1}
                              </p>

                              <p className="mt-1 text-[11px] text-slate-500">
                                {reportImage.mime_type ||
                                  "image"}

                                {reportImage.file_size
                                  ? ` · ${(
                                      reportImage.file_size /
                                      1024 /
                                      1024
                                    ).toFixed(2)} MB`
                                  : ""}
                              </p>
                            </div>

                            <div>
                              <label className="text-xs font-medium text-slate-700">
                                Internal Note /
                                內部圖片備註
                              </label>

                              <textarea
                                value={
                                  reportImage.caption || ""
                                }
                                onChange={(event) =>
                                  updateReportImageCaption(
                                    reportImage.id,
                                    event.target.value
                                  )
                                }
                                rows={2}
                                placeholder="此備註不會顯示於正式報告"
                                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                              />
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  moveReportImage(
                                    reportImage.id,
                                    "up"
                                  )
                                }
                                disabled={imageIndex === 0}
                                className="rounded-lg border border-slate-300 px-2 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                ↑ Up
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  moveReportImage(
                                    reportImage.id,
                                    "down"
                                  )
                                }
                                disabled={
                                  imageIndex ===
                                  reportImages.length - 1
                                }
                                className="rounded-lg border border-slate-300 px-2 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                ↓ Down
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  deleteReportImage(
                                    reportImage
                                  )
                                }
                                disabled={
                                  deletingImageId ===
                                  reportImage.id
                                }
                                className="rounded-lg border border-red-200 px-2 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {deletingImageId ===
                                reportImage.id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}

                <div className="mt-4 rounded-xl bg-blue-50 p-4 text-xs leading-5 text-blue-800">
                  正式報告只會顯示「圖1、圖2」，
                  不會顯示原始檔案名稱。排序後請按頁面上方
                  Save。
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </AppShell>
  );
}
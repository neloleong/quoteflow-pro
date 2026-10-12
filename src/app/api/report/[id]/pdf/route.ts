import { NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";

import { createRequire } from "module";

import fs from "fs";

import path from "path";

type Content = any;

type TableCell = any;

type TDocumentDefinitions = any;

type AnyRecord = Record<string, any>;

const nodeRequire = createRequire(import.meta.url);

const PdfPrinter: any = nodeRequire("pdfmake");

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

const REPORT_CONTACT_LINE =

  "地址: 澳門美副將大馬路48號萬基工業大廈3樓A座  |  郵箱：admin01\@emit.com.mo  |  電話：+853 2875 1742  |  傳真：+853 2852 0536";

const FIRST_RESULT_PAGE_ITEM_LIMIT = 7;

const CONTINUATION_RESULT_PAGE_ITEM_LIMIT = 12;

const REPORT_IMAGES_BUCKET = "report-images";

const REPORT_IMAGES_PER_PAGE = 2;

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

  report_page_start?: number | string | null;

  report_total_pages?: number | string | null;

  page_start?: number | string | null;

  page_total?: number | string | null;

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

};

type LoadedReportImage = ReportImage & {

  dataUrl: string | null;

};

type ReportImagePage = {

  id: string;

  imagePageIndex: number;

  images: LoadedReportImage[];

};

type PageNumberSettings = {

  reportPageStart: number;

  reportTotalPagesOverride: number | null;

};

function getSupabaseClient() {

  const supabaseUrl =

    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabaseKey =

    process.env.SUPABASE_SERVICE_ROLE_KEY ||

    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {

    throw new Error(

      "Missing Supabase environment variables. Please check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY."

    );

  }

  return createClient(supabaseUrl, supabaseKey, {

    auth: {

      persistSession: false,

      autoRefreshToken: false,

    },

  });

}

function getValidFilePath(filePath: string) {

  if (!filePath) {

    return "";

  }

  const fullPath = path.isAbsolute(filePath)

    ? filePath

    : path.resolve(process.cwd(), filePath);

  if (!fs.existsSync(fullPath)) {

    return "";

  }

  const stat = fs.statSync(fullPath);

  if (!stat.isFile() || stat.size <= 0) {

    return "";

  }

  return fullPath;

}

function firstExistingPath(paths: string[]) {

  for (const itemPath of paths) {

    const validPath = getValidFilePath(itemPath);

    if (validPath) {

      return validPath;

    }

  }

  return "";

}

function getPdfFonts() {

  const regularFontPath = firstExistingPath([

    process.env.PDF_FONT_REGULAR_PATH || "",

    "public/fonts/msyh.ttf",

    "public/fonts/emit-report-body.ttf",

    "public/fonts/upcl.ttf",

    "public/fonts/NotoSansTC-Regular.ttf",

  ]);

  const boldFontPath = firstExistingPath([

    process.env.PDF_FONT_BOLD_PATH || "",

    "public/fonts/msyhbd.ttf",

    "public/fonts/msyh.ttf",

    "public/fonts/emit-report-body-bold.ttf",

    "public/fonts/NotoSansTC-Bold.ttf",

  ]);

  if (!regularFontPath) {

    throw new Error(

      "PDF font not found. Please make sure public/fonts/msyh.ttf exists and is not 0 bytes."

    );

  }

  return {

    EMITFont: {

      normal: regularFontPath,

      bold: boldFontPath || regularFontPath,

      italics: regularFontPath,

      bolditalics: boldFontPath || regularFontPath,

    },

  };

}

function imageDataUrl(

  relativePath: string

): string | null {

  const fullPath = path.resolve(

    process.cwd(),

    relativePath

  );

  if (!fs.existsSync(fullPath)) {

    return null;

  }

  const stat = fs.statSync(fullPath);

  if (!stat.isFile() || stat.size <= 0) {

    return null;

  }

  const imageBuffer = fs.readFileSync(fullPath);

  const detectedMimeType =

    detectImageMimeType(imageBuffer);

  if (!detectedMimeType) {

    return null;

  }

  return bufferToImageDataUrl(

    imageBuffer,

    detectedMimeType

  );

}

function detectImageMimeType(

  imageBuffer: Buffer,

  fallbackMimeType?: string | null

): "image/png" | "image/jpeg" | null {

  if (

    imageBuffer.length >= 8 &&

    imageBuffer[0] === 0x89 &&

    imageBuffer[1] === 0x50 &&

    imageBuffer[2] === 0x4e &&

    imageBuffer[3] === 0x47 &&

    imageBuffer[4] === 0x0d &&

    imageBuffer[5] === 0x0a &&

    imageBuffer[6] === 0x1a &&

    imageBuffer[7] === 0x0a

  ) {

    return "image/png";

  }

  if (

    imageBuffer.length >= 3 &&

    imageBuffer[0] === 0xff &&

    imageBuffer[1] === 0xd8 &&

    imageBuffer[2] === 0xff

  ) {

    return "image/jpeg";

  }

  const normalizedFallback = String(

    fallbackMimeType || ""

  )

    .trim()

    .toLowerCase();

  if (normalizedFallback === "image/png") {

    return "image/png";

  }

  if (

    normalizedFallback === "image/jpeg" ||

    normalizedFallback === "image/jpg"

  ) {

    return "image/jpeg";

  }

  return null;

}

function bufferToImageDataUrl(

  imageBuffer: Buffer,

  mimeType: "image/png" | "image/jpeg"

) {

  return `data:${mimeType};base64,${imageBuffer.toString(

    "base64"

  )}`;

}

async function downloadStorageImageBuffer(

  supabase: any,

  filePath: string

): Promise<Buffer> {

  const {

    data: downloadedBlob,

    error: downloadError,

  } = await supabase.storage

    .from(REPORT_IMAGES_BUCKET)

    .download(filePath);

  if (!downloadError && downloadedBlob) {

    const imageArrayBuffer =

      await downloadedBlob.arrayBuffer();

    const imageBuffer = Buffer.from(imageArrayBuffer);

    if (imageBuffer.length > 0) {

      return imageBuffer;

    }

  }

  const {

    data: signedUrlData,

    error: signedUrlError,

  } = await supabase.storage

    .from(REPORT_IMAGES_BUCKET)

    .createSignedUrl(filePath, 120);

  if (signedUrlError || !signedUrlData?.signedUrl) {

    throw new Error(

      downloadError?.message ||

        signedUrlError?.message ||

        `Cannot download report image: ${filePath}`

    );

  }

  const imageResponse = await fetch(

    signedUrlData.signedUrl,

    {

      method: "GET",

      cache: "no-store",

    }

  );

  if (!imageResponse.ok) {

    throw new Error(

      `Failed to fetch report image. Status=${imageResponse.status}, path=${filePath}`

    );

  }

  const imageArrayBuffer =

    await imageResponse.arrayBuffer();

  const imageBuffer = Buffer.from(imageArrayBuffer);

  if (imageBuffer.length <= 0) {

    throw new Error(

      `Downloaded report image is empty: ${filePath}`

    );

  }

  return imageBuffer;

}

function formatDateDash(

  dateValue: string | null | undefined

) {

  if (!dateValue) {

    return "-";

  }

  const dateText = String(dateValue).slice(0, 10);

  const [year, month, day] = dateText.split("-");

  if (!year || !month || !day) {

    return String(dateValue);

  }

  return `${year}-${month}-${day}`;

}

function formatTestDateRange(

  startDate: string | null | undefined,

  endDate: string | null | undefined,

  reportDate?: string | null | undefined

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

function safeFileName(value: string) {

  return value

    .replace(/[\\/:*?"<>|]/g, "-")

    .replace(/\s+/g, "-")

    .trim();

}

function safeAsciiFileName(value: string) {

  const cleaned = value

    .replace(/[^\x20-\x7E]/g, "")

    .replace(/[\\/:*?"<>|]/g, "-")

    .replace(/\s+/g, "-")

    .replace(/-+/g, "-")

    .trim();

  return cleaned || "report";

}

function normalizeReportText(

  value: string | null | undefined

) {

  return String(value || "")

    .trim()

    .replace(/\s+/g, "")

    .toLowerCase();

}

function parsePositiveInteger(value: unknown) {

  if (value === null || value === undefined) {

    return null;

  }

  const text = String(value).trim();

  if (!text) {

    return null;

  }

  const parsed = Number.parseInt(text, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {

    return null;

  }

  return parsed;

}

function getSearchParamInteger(

  searchParams: URLSearchParams,

  keys: string[]

): number | null {

  for (const key of keys) {

    const parsed = parsePositiveInteger(

      searchParams.get(key)

    );

    if (parsed !== null) {

      return parsed;

    }

  }

  return null;

}

function getReportFieldInteger(

  report: Report,

  keys: string[]

) {

  const row = report as AnyRecord;

  for (const key of keys) {

    const parsed = parsePositiveInteger(row[key]);

    if (parsed !== null) {

      return parsed;

    }

  }

  return null;

}

function getPageNumberSettings(

  request: Request,

  report: Report

): PageNumberSettings {

  const url = new URL(request.url);

  const searchParams = url.searchParams;

  const queryStartPage = getSearchParamInteger(

    searchParams,

    [

      "reportPageStart",

      "pageStart",

      "startPage",

      "firstPage",

    ]

  );

  const queryTotalPages = getSearchParamInteger(

    searchParams,

    [

      "reportTotalPages",

      "totalReportPages",

      "pageTotal",

      "totalPages",

    ]

  );

  const savedStartPage = getReportFieldInteger(

    report,

    ["report_page_start", "page_start"]

  );

  const savedTotalPages = getReportFieldInteger(

    report,

    ["report_total_pages", "page_total"]

  );

  return {

    reportPageStart:

      queryStartPage || savedStartPage || 1,

    reportTotalPagesOverride:

      queryTotalPages || savedTotalPages || null,

  };

}

function buildReportItemUniqueKey(item: ReportItem) {

  const sourceTestItemId = normalizeReportText(

    item.source_test_item_id

  );

  if (sourceTestItemId) {

    return `source-test-item:${sourceTestItemId}`;

  }

  const itemName = normalizeReportText(item.item_name);

  const testMethod = normalizeReportText(

    item.test_method

  );

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

// Render scientific notation as pdfmake rich text instead of using
// Unicode superscript characters (which may be absent in the PDF font).
type ResultPdfText = string | Array<{ text: string; sup?: boolean }>;

function formatResultValueWithExponent(
  resultValue: string | null | undefined,
  resultExponent: string | null | undefined
): ResultPdfText {
  const cleanValue = String(resultValue ?? "").trim();
  const cleanExponent = String(resultExponent ?? "").trim();

  if (!cleanValue || cleanValue === "-") return "-";

  // Superscripts may already be embedded in result_value. Normalize them
  // to ordinary digits, then let pdfmake position the exponent above 10.
  const superscriptToAscii: Record<string, string> = {
    "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
    "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
    "⁻": "-", "⁺": "+",
  };
  const normalizeExponent = (raw: string): string =>
    raw
      .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]/g, (char) => superscriptToAscii[char] || char)
      .replace(/^\s*(?:[×xX*]\s*)?10\s*\^?\s*/i, "")
      .replace(/^\s*\^/, "")
      .trim();

  const notationInValue = cleanValue.match(
    /^(.*?[×xX*]\s*10)\s*(?:\^\s*([+-]?\d+)|([⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+))$/
  );

  if (notationInValue) {
    const exponent = normalizeExponent(notationInValue[2] || notationInValue[3]);
    return [
      { text: notationInValue[1].replace(/[xX*]/g, "×") },
      { text: exponent, sup: true },
    ];
  }

  if (!cleanExponent) return cleanValue;

  const exponent = normalizeExponent(cleanExponent);
  if (!exponent) return cleanValue;

  const baseText = /[×xX*]\s*10\s*$/.test(cleanValue)
    ? cleanValue.replace(/[xX*]/g, "×")
    : `${cleanValue}×10`;

  return [{ text: baseText }, { text: exponent, sup: true }];
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

  report: Report,

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

    splitSummaryItems(report.test_items_summary || "")

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

  reportImages: LoadedReportImage[]

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

function getDisplayPageNumber(

  contentPage: ReportContentPage,

  pageSettings: PageNumberSettings

) {

  return (

    pageSettings.reportPageStart +

    contentPage.contentPageIndex

  );

}

function getDisplayTotalReportPages(

  autoTotalReportPages: number,

  pageSettings: PageNumberSettings

) {

  return (

    pageSettings.reportTotalPagesOverride ||

    Math.max(autoTotalReportPages, 1)

  );

}

function makeNoBorderCell(

  text: string,

  options?: {

    bold?: boolean;

    fontSize?: number;

    alignment?: "left" | "center" | "right";

    margin?: [number, number, number, number];

  }

): TableCell {

  return {

    text,

    bold: options?.bold ?? false,

    fontSize: options?.fontSize ?? 10,

    alignment: options?.alignment ?? "left",

    border: [false, false, false, false],

    margin: options?.margin ?? [0, 2, 0, 2],

  };

}

function makeResultHeaderCell(text: string): TableCell {

  return {

    text,

    bold: true,

    alignment: "center",

    fontSize: 10,

    color: "#000000",

    margin: [4, 7, 4, 7],

    border: [true, true, true, true],

  };

}

function makeResultBodyCell(text: ResultPdfText): TableCell {

  return {

    text: text || "-",

    alignment: "center",

    fontSize: 10,

    color: "#000000",

    margin: [4, 7, 4, 7],

    border: [true, true, true, true],

  };

}

function buildResultTable(

  resultItems: ReportItem[],

  showEmptyMessage: boolean

) {

  const body: TableCell[][] = [

    [

      makeResultHeaderCell("檢測項目"),

      makeResultHeaderCell("檢測方法"),

      makeResultHeaderCell("結果數據"),

      makeResultHeaderCell("單　位"),

    ],

  ];

  if (showEmptyMessage && resultItems.length === 0) {

    body.push([

      {

        text: "No report items.",

        colSpan: 4,

        alignment: "center",

        fontSize: 10,

        margin: [4, 12, 4, 12],

        border: [true, true, true, true],

      },

      {},

      {},

      {},

    ]);

  }

  resultItems.forEach((item) => {

    body.push([

      makeResultBodyCell(item.item_name || "-"),

      makeResultBodyCell(item.test_method || "-"),

      makeResultBodyCell(

        formatResultValueWithExponent(

          item.result_value,

          item.result_exponent

        )

      ),

      makeResultBodyCell(item.unit || "-"),

    ]);

  });

  return {

    table: {

      headerRows: 1,

      widths: [150, 170, 125, 90],

      body,

      dontBreakRows: true,

      keepWithHeaderRows: 1,

    },

    layout: {

      hLineWidth: () => 0.7,

      vLineWidth: () => 0.7,

      hLineColor: () => "#000000",

      vLineColor: () => "#000000",

      paddingLeft: () => 0,

      paddingRight: () => 0,

      paddingTop: () => 0,

      paddingBottom: () => 0,

    },

    margin: [0, 0, 0, 0],

  };

}

function buildCoverPage(report: Report): Content {

  const topBarImage = imageDataUrl(

    "public/images/report-cover-topbar.png"

  );

  const coverLogoImage = imageDataUrl(

    "public/images/report-cover-logo.png"

  );

  return {

    stack: [

      topBarImage

        ? {

            image: topBarImage,

            width: 595,

            height: 24,

            margin: [-40, -24, -40, 52],

          }

        : {

            text: "",

            margin: [0, 0, 0, 52],

          },

      coverLogoImage

        ? {

            image: coverLogoImage,

            width: 216,

            alignment: "center",

            margin: [0, 8, 0, 60],

          }

        : {

            text: "EMIT",

            alignment: "center",

            bold: true,

            fontSize: 28,

            margin: [0, 8, 0, 60],

          },

      {

        text: "檢測報告",

        alignment: "center",

        bold: true,

        fontSize: 38,

        margin: [0, 0, 0, 30],

      },

      {

        table: {

          widths: [96, "*"],

          body: [

            [

              makeNoBorderCell("報告編號：", {

                bold: true,

                fontSize: 13,

                margin: [0, 5, 0, 5],

              }),

              makeNoBorderCell(report.report_no || "-", {

                fontSize: 13,

                margin: [0, 5, 0, 5],

              }),

            ],

            [

              makeNoBorderCell("樣品名稱：", {

                bold: true,

                fontSize: 13,

                margin: [0, 5, 0, 5],

              }),

              makeNoBorderCell(report.sample_name || "-", {

                fontSize: 13,

                margin: [0, 5, 0, 5],

              }),

            ],

            [

              makeNoBorderCell("委託單位：", {

                bold: true,

                fontSize: 13,

                margin: [0, 5, 0, 5],

              }),

              makeNoBorderCell(

                report.customer_name || "-",

                {

                  fontSize: 13,

                  margin: [0, 5, 0, 5],

                }

              ),

            ],

          ],

        },

        layout: "noBorders",

        margin: [112, 0, 112, 0],

      },

    ],

    pageBreak: "after",

  };

}

function buildContentHeader(

  report: Report,

  displayPageNumber: number,

  displayTotalReportPages: number

): Content {

  const logoIconImage = imageDataUrl(

    "public/images/report-cover-logo-icon.png"

  );

  const logoTextImage = imageDataUrl(

    "public/images/report-cover-logo-text.png"

  );

  return {

    stack: [

      {

        columns: [

          logoIconImage

            ? {

                image: logoIconImage,

                width: 48,

                margin: [0, 0, 6, 0],

              }

            : {

                text: "EMIT",

                bold: true,

                fontSize: 16,

                margin: [0, 0, 6, 0],

              },

          logoTextImage

            ? {

                image: logoTextImage,

                width: 245,

                margin: [0, 6, 0, 0],

              }

            : {

                text: "環科監控檢測有限公司",

                bold: true,

                fontSize: 14,

                margin: [0, 10, 0, 0],

              },

          {

            text: "",

            width: "*",

          },

        ],

        margin: [0, 0, 0, 8],

      },

      {

        text: "檢 測 報 告",

        bold: true,

        fontSize: 20,

        characterSpacing: 4,

        margin: [0, 0, 0, 10],

      },

      {

        table: {

          widths: [62, 128, 36, 108, 36, 105],

          body: [

            [

              makeNoBorderCell("報告編號：", {

                bold: true,

                fontSize: 9,

              }),

              makeNoBorderCell(report.report_no || "-", {

                fontSize: 9,

              }),

              makeNoBorderCell("日期：", {

                bold: true,

                fontSize: 9,

              }),

              makeNoBorderCell(

                formatDateDash(report.report_date),

                {

                  fontSize: 9,

                }

              ),

              makeNoBorderCell("頁碼：", {

                bold: true,

                fontSize: 9,

              }),

              makeNoBorderCell(

                `第 ${displayPageNumber} 頁 共 ${displayTotalReportPages} 頁`,

                {

                  fontSize: 9,

                }

              ),

            ],

          ],

        },

        layout: "noBorders",

        margin: [0, 0, 0, 18],

      },

    ],

  };

}

function buildBasicInformationBlock(

  report: Report,

  remarks: string,

  testItemsSummary: string

): Content {

  return {

    stack: [

      {

        table: {

          widths: [70, "*"],

          body: [

            [

              makeNoBorderCell("委託單位：", {

                bold: true,

              }),

              makeNoBorderCell(

                report.customer_name || "-"

              ),

            ],

            [

              makeNoBorderCell("地　　址：", {

                bold: true,

              }),

              makeNoBorderCell(

                report.customer_address || "-"

              ),

            ],

          ],

        },

        layout: "noBorders",

      },

      {

        text: [

          "本報告是基於採取的申報名稱為 “",

          {

            text: report.sample_name || "-",

            bold: true,

          },

          "” 的樣品所做的檢測。",

        ],

        margin: [0, 8, 0, 8],

      },

      {

        table: {

          widths: [70, "*"],

          body: [

            [

              makeNoBorderCell("備註：", {

                bold: true,

              }),

              makeNoBorderCell(remarks || "-"),

            ],

            [

              makeNoBorderCell("樣品描述：", {

                bold: true,

              }),

              makeNoBorderCell(

                report.sample_description || "-"

              ),

            ],

            [

              makeNoBorderCell("收樣日期：", {

                bold: true,

              }),

              makeNoBorderCell(

                formatDateDash(report.received_date)

              ),

            ],

            [

              makeNoBorderCell("檢測日期：", {

                bold: true,

              }),

              makeNoBorderCell(

                formatTestDateRange(

                  report.test_start_date,

                  report.test_end_date,

                  report.report_date

                )

              ),

            ],

            [

              makeNoBorderCell("檢測項目：", {

                bold: true,

              }),

              makeNoBorderCell(testItemsSummary || "-"),

            ],

          ],

        },

        layout: "noBorders",

      },

    ],

    fontSize: 10,

    margin: [0, 0, 0, 12],

  };

}

function buildSignatureBlock(report: Report): Content {

  const preparedImage = imageDataUrl(

    "public/images/report-signature-prepared.png"

  );

  const reviewedImage = imageDataUrl(

    "public/images/report-signature-reviewed.png"

  );

  const authorizedImage = imageDataUrl(

    "public/images/report-signature-authorized.png"

  );

  function makeSignatureCell(

    label: string,

    name: string | null,

    image: string | null

  ): TableCell {

    return {

      border: [false, false, false, false],

      margin: [0, 0, 0, 0],

      stack: [

        {

          table: {

            widths: [150],

            heights: [58],

            body: [

              [

                {

                  border: [false, false, false, false],

                  margin: [0, 0, 0, 0],

                  stack: [

                    image

                      ? {

                          image,

                          fit: [135, 52],

                          alignment: "center",

                          margin: [0, 4, 0, 0],

                        }

                      : {

                          text: "",

                          margin: [0, 52, 0, 0],

                        },

                  ],

                },

              ],

            ],

          },

          layout: "noBorders",

          margin: [0, 0, 0, 2],

        },

        {

          canvas: [

            {

              type: "line",

              x1: 8,

              y1: 0,

              x2: 142,

              y2: 0,

              lineWidth: 0.7,

              lineColor: "#000000",

            },

          ],

          margin: [0, 0, 0, 6],

        },

        {

          text: label,

          alignment: "center",

          bold: true,

          fontSize: 10,

          margin: [0, 0, 0, name ? 2 : 0],

        },

        name

          ? {

              text: name,

              alignment: "center",

              fontSize: 8,

              margin: [0, 0, 0, 0],

            }

          : {

              text: "",

              margin: [0, 0, 0, 0],

            },

      ],

    };

  }

  return {

    table: {

      widths: [170, 170, 170],

      body: [

        [

          makeSignatureCell(

            "編製人：",

            report.prepared_by,

            preparedImage

          ),

          makeSignatureCell(

            "審核人：",

            report.reviewed_by,

            reviewedImage

          ),

          makeSignatureCell(

            "授權簽署人：",

            report.authorized_signatory,

            authorizedImage

          ),

        ],

      ],

    },

    layout: "noBorders",

    margin: [0, 28, 0, 12],

  };

}

function buildContentPage(

  report: Report,

  contentPage: ReportContentPage,

  displayPageNumber: number,

  displayTotalReportPages: number,

  testItemsSummary: string,

  includeReportEnding: boolean,

  hasFollowingPage: boolean

): Content {

  const stack: Content[] = [

    buildContentHeader(

      report,

      displayPageNumber,

      displayTotalReportPages

    ),

  ];

  if (contentPage.isFirstContentPage) {

    stack.push(

      buildBasicInformationBlock(

        report,

        report.remarks || "-",

        testItemsSummary

      )

    );

  }

  stack.push({

    text: contentPage.isFirstContentPage

      ? "檢測結果："

      : "檢測結果（續）：",

    bold: true,

    fontSize: 10,

    margin: [0, 0, 0, 8],

  });

  stack.push(

    buildResultTable(

      contentPage.resultItems,

      contentPage.resultItems.length === 0

    )

  );

  if (includeReportEnding) {

    stack.push({

      text: "* * * 本報告結束 * * *",

      alignment: "center",

      bold: true,

      fontSize: 10,

      margin: [0, 24, 0, 0],

    });

    stack.push(buildSignatureBlock(report));

    stack.push({

      stack: [

        {

          text: "聲明：本報告的檢驗結果僅與被檢測的樣品有關，除非另行說明。",

          fontSize: 8,

          margin: [0, 0, 0, 2],

        },

        {

          text: "未經本公司書面同意，不得部分複印本報告，完整複印除外。",

          fontSize: 8,

        },

      ],

      margin: [0, 6, 0, 0],

    });

  }

  return {

    stack,

    pageBreak: hasFollowingPage ? "after" : undefined,

  };

}

function buildReportImagePage(

  report: Report,

  imagePage: ReportImagePage,

  displayPageNumber: number,

  displayTotalReportPages: number,

  hasFollowingPage: boolean

): Content {

  const imageBlocks: Content[] = imagePage.images.map(

    (reportImage, imageIndex) => {

      const globalImageNumber =

        imagePage.imagePageIndex *

          REPORT_IMAGES_PER_PAGE +

        imageIndex +

        1;

      return {

        unbreakable: true,

        stack: [

          reportImage.dataUrl

            ? {

                image: reportImage.dataUrl,

                fit: [475, 245],

                alignment: "center",

                margin: [0, 0, 0, 8],

              }

            : {

                table: {

                  widths: ["*"],

                  heights: [220],

                  body: [

                    [

                      {

                        text: `圖${globalImageNumber} 無法讀取`,

                        alignment: "center",

                        color: "#64748b",

                        fontSize: 9,

                        margin: [10, 95, 10, 0],

                        border: [

                          true,

                          true,

                          true,

                          true,

                        ],

                      },

                    ],

                  ],

                },

                layout: {

                  hLineWidth: () => 0.7,

                  vLineWidth: () => 0.7,

                  hLineColor: () => "#94a3b8",

                  vLineColor: () => "#94a3b8",

                },

                margin: [0, 0, 0, 8],

              },

          {

            text: `圖${globalImageNumber}`,

            alignment: "center",

            bold: true,

            fontSize: 10,

            margin: [0, 0, 0, 14],

          },

        ],

      };

    }

  );

  return {

    stack: [

      buildContentHeader(

        report,

        displayPageNumber,

        displayTotalReportPages

      ),

      {

        text: "圖片記錄：",

        bold: true,

        fontSize: 10,

        margin: [0, 0, 0, 12],

      },

      ...imageBlocks,

    ],

    pageBreak: hasFollowingPage ? "after" : undefined,

  };

}

function buildReportEndingPage(

  report: Report,

  displayPageNumber: number,

  displayTotalReportPages: number

): Content {

  return {

    stack: [

      buildContentHeader(

        report,

        displayPageNumber,

        displayTotalReportPages

      ),

      {

        text: "* * * 本報告結束 * * *",

        alignment: "center",

        bold: true,

        fontSize: 12,

        margin: [0, 90, 0, 80],

      },

      buildSignatureBlock(report),

      {

        stack: [

          {

            text: "聲明：本報告的檢驗結果僅與被檢測的樣品有關，除非另行說明。",

            fontSize: 8,

            margin: [0, 0, 0, 2],

          },

          {

            text: "未經本公司書面同意，不得部分複印本報告，完整複印除外。",

            fontSize: 8,

          },

        ],

        margin: [0, 20, 0, 0],

      },

    ],

  };

}

function buildDocumentDefinition(

  report: Report,

  reportItems: ReportItem[],

  reportImages: LoadedReportImage[],

  pageSettings: PageNumberSettings

): TDocumentDefinitions {

  const uniqueItems =

    buildUniqueReportItems(reportItems);

  const contentPages =

    buildReportContentPages(uniqueItems);

  const validReportImages = reportImages.filter(

    (reportImage) => Boolean(reportImage.dataUrl)

  );

  const imagePages =

    buildReportImagePages(validReportImages);

  const signaturePageCount =

    validReportImages.length > 0 ? 1 : 0;

  const autoTotalReportPages = Math.max(

    contentPages.length +

      imagePages.length +

      signaturePageCount,

    1

  );

  const displayTotalReportPages =

    getDisplayTotalReportPages(

      autoTotalReportPages,

      pageSettings

    );

  const testItemsSummary =

    buildDisplayTestItemsSummary(report, uniqueItems);

  const watermarkImage = imageDataUrl(

    "public/images/report-watermark-original-v2.png"

  );

  const footerBarImage = imageDataUrl(

    "public/images/report-cover-contact-bar.png"

  );

  const contentPageBlocks = contentPages.map(

    (contentPage) => {

      const displayPageNumber = getDisplayPageNumber(

        contentPage,

        pageSettings

      );

      const includeReportEnding =

        contentPage.isLastContentPage &&

        validReportImages.length === 0;

      const hasFollowingPage =

        !contentPage.isLastContentPage ||

        validReportImages.length > 0;

      return buildContentPage(

        report,

        contentPage,

        displayPageNumber,

        displayTotalReportPages,

        testItemsSummary,

        includeReportEnding,

        hasFollowingPage

      );

    }

  );

  const imagePageBlocks = imagePages.map(

    (imagePage, imagePageIndex) => {

      const displayPageNumber =

        pageSettings.reportPageStart +

        contentPages.length +

        imagePage.imagePageIndex;

      return buildReportImagePage(

        report,

        imagePage,

        displayPageNumber,

        displayTotalReportPages,

        true

      );

    }

  );

  const endingPageBlocks =

    validReportImages.length > 0

      ? [

          buildReportEndingPage(

            report,

            pageSettings.reportPageStart +

              contentPages.length +

              imagePages.length,

            displayTotalReportPages

          ),

        ]

      : [];

  const content: Content[] = [

    buildCoverPage(report),

    ...contentPageBlocks,

    ...imagePageBlocks,

    ...endingPageBlocks,

  ];

  return {

    pageSize: "A4",

    pageMargins: [40, 24, 40, 42],

    defaultStyle: {

      font: "EMITFont",

      fontSize: 10,

      lineHeight: 1.25,

      color: "#000000",

    },

    background(currentPage: number) {

      if (currentPage <= 1 || !watermarkImage) {

        return null;

      }

      return {

        image: watermarkImage,

        width: 360,

        opacity: 0.22,

        absolutePosition: {

          x: 118,

          y: 230,

        },

      };

    },

    footer() {

      if (footerBarImage) {

        return {

          image: footerBarImage,

          width: 535,

          height: 17,

          margin: [30, 8, 30, 0],

        };

      }

      return {

        text: REPORT_CONTACT_LINE,

        alignment: "center",

        fontSize: 6.5,

        margin: [30, 8, 30, 0],

      };

    },

    content,

  };

}

function createPdfBuffer(

  docDefinition: TDocumentDefinitions

): Promise<Buffer> {

  return new Promise((resolve, reject) => {

    try {

      const printer = new PdfPrinter(getPdfFonts());

      const pdfDoc =

        printer.createPdfKitDocument(docDefinition);

      const chunks: Buffer[] = [];

      pdfDoc.on(

        "data",

        (chunk: Buffer | Uint8Array) => {

          chunks.push(

            Buffer.isBuffer(chunk)

              ? chunk

              : Buffer.from(chunk)

          );

        }

      );

      pdfDoc.on("end", () => {

        resolve(Buffer.concat(chunks));

      });

      pdfDoc.on("error", (error: Error) => {

        reject(error);

      });

      pdfDoc.end();

    } catch (error) {

      reject(error);

    }

  });

}

async function loadReportImagesForPdf(

  supabase: any,

  reportId: string

): Promise<LoadedReportImage[]> {

  const {

    data: reportImagesData,

    error: reportImagesError,

  } = await supabase

    .from("report_images")

    .select(

      "id,company_id,report_id,file_name,file_path,mime_type,file_size,caption,sort_order,created_at,updated_at"

    )

    .eq("report_id", reportId)

    .is("deleted_at", null)

    .order("sort_order", { ascending: true })

    .order("created_at", { ascending: true });

  if (reportImagesError) {

    throw reportImagesError;

  }

  const reportImages = Array.isArray(reportImagesData)

    ? (reportImagesData as ReportImage[])

    : [];

  const loadedImages = await Promise.all(

    reportImages.map(async (reportImage) => {

      try {

        const imageBuffer =

          await downloadStorageImageBuffer(

            supabase,

            reportImage.file_path

          );

        const detectedMimeType = detectImageMimeType(

          imageBuffer,

          reportImage.mime_type

        );

        if (!detectedMimeType) {

          console.warn(

            "Unsupported report image format:",

            reportImage.file_path,

            reportImage.mime_type

          );

          return {

            ...reportImage,

            dataUrl: null,

          };

        }

        return {

          ...reportImage,

          dataUrl: bufferToImageDataUrl(

            imageBuffer,

            detectedMimeType

          ),

        };

      } catch (error) {

        console.warn(

          "Load report image for PDF warning:",

          reportImage.file_path,

          error

        );

        return {

          ...reportImage,

          dataUrl: null,

        };

      }

    })

  );

  return loadedImages;

}

function makeContentDisposition(report: Report) {

  const reportNo =

    report.report_no || `report-${report.id}`;

  const utf8FileName = `${safeFileName(reportNo)}.pdf`;

  const asciiFileName = `${safeAsciiFileName(

    reportNo

  )}.pdf`;

  return `inline; filename="${asciiFileName}"; filename*=UTF-8''${encodeURIComponent(

    utf8FileName

  )}`;

}

export async function GET(

  request: Request,

  context: {

    params:

      | Promise<{ id: string }>

      | { id: string };

  }

) {

  try {

    const params = await Promise.resolve(context.params);

    const reportId = params.id;

    if (!reportId) {

      return NextResponse.json(

        {

          error: "Missing report id.",

        },

        {

          status: 400,

        }

      );

    }

    const supabase = getSupabaseClient();

    const { data: reportData, error: reportError } =

      await supabase

        .from("reports")

        .select("*")

        .eq("id", reportId)

        .is("deleted_at", null)

        .maybeSingle();

    if (reportError) {

      return NextResponse.json(

        {

          error: "Failed to load report.",

          details: reportError.message,

        },

        {

          status: 500,

        }

      );

    }

    if (!reportData) {

      return NextResponse.json(

        {

          error: "Report not found.",

        },

        {

          status: 404,

        }

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

      return NextResponse.json(

        {

          error: "Failed to load report items.",

          details: reportItemsError.message,

        },

        {

          status: 500,

        }

      );

    }

    const report = reportData as Report;

    const reportItems = Array.isArray(reportItemsData)

      ? (reportItemsData as ReportItem[])

      : [];

    const reportImages = await loadReportImagesForPdf(

      supabase,

      reportId

    );

    console.log(

      "Report PDF image load result:",

      reportImages.map((reportImage, imageIndex) => ({

        imageNumber: imageIndex + 1,

        filePath: reportImage.file_path,

        mimeType: reportImage.mime_type,

        hasDataUrl: Boolean(reportImage.dataUrl),

      }))

    );

    const pageSettings = getPageNumberSettings(

      request,

      report

    );

    const docDefinition = buildDocumentDefinition(

      report,

      reportItems,

      reportImages,

      pageSettings

    );

    const pdfBuffer = await createPdfBuffer(

      docDefinition

    );

    return new Response(new Uint8Array(pdfBuffer), {

      status: 200,

      headers: {

        "Content-Type": "application/pdf",

        "Content-Disposition":

          makeContentDisposition(report),

        "Cache-Control": "no-store",

      },

    });

  } catch (error: any) {

    console.error(

      "Generate report PDF error:",

      error

    );

    return NextResponse.json(

      {

        error: "Failed to generate report PDF.",

        details: error?.message || String(error),

      },

      {

        status: 500,

      }

    );

  }

}

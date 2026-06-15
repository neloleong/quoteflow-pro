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
  "地址: 澳門美副將大馬路48號萬基工業大廈3樓A座  |  郵箱：admin01@emit.com.mo  |  電話：+853 2875 1742  |  傳真：+853 2852 0536";

const FIRST_RESULT_PAGE_ITEM_LIMIT = 7;
const CONTINUATION_RESULT_PAGE_ITEM_LIMIT = 12;

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

type ReportContentPage = {
  id: string;
  pageNumber: number;
  isFirstContentPage: boolean;
  isLastContentPage: boolean;
  resultItems: ReportItem[];
};

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase environment variables. Please check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return createClient(supabaseUrl, supabaseKey);
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

function imageDataUrl(relativePath: string): string | null {
  const fullPath = path.resolve(process.cwd(), relativePath);

  if (!fs.existsSync(fullPath)) {
    return null;
  }

  const stat = fs.statSync(fullPath);

  if (!stat.isFile() || stat.size <= 0) {
    return null;
  }

  const ext = path.extname(fullPath).replace(".", "").toLowerCase();
  const mimeType = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
  const base64 = fs.readFileSync(fullPath).toString("base64");

  return `data:${mimeType};base64,${base64}`;
}

function textValue(
  row: AnyRecord | null | undefined,
  keys: string[],
  fallback = ""
): string {
  if (!row) {
    return fallback;
  }

  for (const key of keys) {
    const value = row[key];

    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }

  return fallback;
}

function formatDateDash(dateValue: string | null | undefined) {
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

  return `${formatDateDash(startDate)} 至 ${formatDateDash(finalEndDate)}`;
}

function safeFileName(value: string) {
  return value
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .trim();
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

function buildDisplayTestItemsSummary(report: Report, uniqueItems: ReportItem[]) {
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

function makeResultBodyCell(
  text: string,
  options?: {
    alignment?: "left" | "center" | "right";
  }
): TableCell {
  return {
    text: text || "-",
    alignment: options?.alignment ?? "center",
    fontSize: 10,
    color: "#000000",
    margin: [4, 7, 4, 7],
    border: [true, true, true, true],
  };
}

function buildResultTable(resultItems: ReportItem[], showEmptyMessage: boolean) {
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
      makeResultBodyCell(item.result_value || "-"),
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
  const topBarImage = imageDataUrl("public/images/report-cover-topbar.png");
  const coverLogoImage = imageDataUrl("public/images/report-cover-logo.png");

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
              makeNoBorderCell(report.customer_name || "-", {
                fontSize: 13,
                margin: [0, 5, 0, 5],
              }),
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
  pageNumber: number,
  totalReportPages: number
): Content {
  const logoIconImage = imageDataUrl("public/images/report-cover-logo-icon.png");
  const logoTextImage = imageDataUrl("public/images/report-cover-logo-text.png");

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
              makeNoBorderCell("報告編號：", { bold: true, fontSize: 9 }),
              makeNoBorderCell(report.report_no || "-", { fontSize: 9 }),
              makeNoBorderCell("日期：", { bold: true, fontSize: 9 }),
              makeNoBorderCell(formatDateDash(report.report_date), {
                fontSize: 9,
              }),
              makeNoBorderCell("頁碼：", { bold: true, fontSize: 9 }),
              makeNoBorderCell(`第 ${pageNumber} 頁 共 ${totalReportPages} 頁`, {
                fontSize: 9,
              }),
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
              makeNoBorderCell("委託單位：", { bold: true }),
              makeNoBorderCell(report.customer_name || "-"),
            ],
            [
              makeNoBorderCell("地　　址：", { bold: true }),
              makeNoBorderCell(report.customer_address || "-"),
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
              makeNoBorderCell("備註：", { bold: true }),
              makeNoBorderCell(remarks || "-"),
            ],
            [
              makeNoBorderCell("樣品描述：", { bold: true }),
              makeNoBorderCell(report.sample_description || "-"),
            ],
            [
              makeNoBorderCell("收樣日期：", { bold: true }),
              makeNoBorderCell(formatDateDash(report.received_date)),
            ],
            [
              makeNoBorderCell("檢測日期：", { bold: true }),
              makeNoBorderCell(
                formatTestDateRange(
                  report.test_start_date,
                  report.test_end_date,
                  report.report_date
                )
              ),
            ],
            [
              makeNoBorderCell("檢測項目：", { bold: true }),
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
          makeSignatureCell("編製人：", report.prepared_by, preparedImage),
          makeSignatureCell("審核人：", report.reviewed_by, reviewedImage),
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
  totalReportPages: number,
  testItemsSummary: string
): Content {
  const stack: Content[] = [
    buildContentHeader(report, contentPage.pageNumber, totalReportPages),
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
    text: contentPage.isFirstContentPage ? "檢測結果：" : "檢測結果（續）：",
    bold: true,
    fontSize: 10,
    margin: [0, 0, 0, 8],
  });

  stack.push(
    buildResultTable(contentPage.resultItems, contentPage.resultItems.length === 0)
  );

  if (contentPage.isLastContentPage) {
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
    pageBreak: contentPage.isLastContentPage ? undefined : "after",
  };
}

function buildDocumentDefinition(
  report: Report,
  reportItems: ReportItem[]
): TDocumentDefinitions {
  const uniqueItems = buildUniqueReportItems(reportItems);
  const contentPages = buildReportContentPages(uniqueItems);
  const totalReportPages = 1 + contentPages.length;
  const testItemsSummary = buildDisplayTestItemsSummary(report, uniqueItems);

  const watermarkImage = imageDataUrl("public/images/report-watermark-original-v2.png");
  const footerBarImage = imageDataUrl("public/images/report-cover-contact-bar.png");

  const content: Content[] = [
    buildCoverPage(report),
    ...contentPages.map((contentPage) =>
      buildContentPage(report, contentPage, totalReportPages, testItemsSummary)
    ),
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

function createPdfBuffer(docDefinition: TDocumentDefinitions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const printer = new PdfPrinter(getPdfFonts());
      const pdfDoc = printer.createPdfKitDocument(docDefinition);

      const chunks: Buffer[] = [];

      pdfDoc.on("data", (chunk: Buffer) => {
        chunks.push(chunk);
      });

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

export async function GET(
  request: Request,
  context: {
    params: Promise<{ id: string }> | { id: string };
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

    const { data: reportData, error: reportError } = await supabase
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

    const { data: reportItemsData, error: reportItemsError } = await supabase
      .from("report_items")
      .select("*")
      .eq("report_id", reportId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true });

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

    const docDefinition = buildDocumentDefinition(report, reportItems);
    const pdfBuffer = await createPdfBuffer(docDefinition);

    const reportNo = report.report_no || `report-${report.id}`;
    const fileName = `${safeFileName(reportNo)}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(
          fileName
        )}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("Generate report PDF error:", error);

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
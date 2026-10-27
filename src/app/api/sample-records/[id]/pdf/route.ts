import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const require = createRequire(import.meta.url);

type SampleRecordRow = {
  id: string;
  record_no: string | null;
  quotation_id: string | null;
  quotation_no: string | null;
  customer_name: string | null;
  customer_address: string | null;
  project_name: string | null;
  received_date: string | null;
  received_by: string | null;
  test_start_date: string | null;
  test_end_date: string | null;
  status: string | null;
  remarks: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type SampleRecordSampleRow = {
  id: string;
  sample_record_id: string;
  sample_key: string | null;
  sample_no: string | null;
  sample_name: string | null;
  sample_description: string | null;
  quantity: string | null;
  sample_condition: string | null;
  received_status: string | null;
  remarks: string | null;
  sort_order: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type SampleRecordItemRow = {
  id: string;
  sample_record_id: string;
  sample_record_sample_id: string;
  quotation_item_id: string | null;
  source_test_item_id: string | null;
  item_code: string | null;
  item_name: string | null;
  category_name: string | null;
  vendor_name: string | null;
  test_method: string | null;
  unit: string | null;
  source_group_id: string | null;
  source_group_code: string | null;
  source_group_name: string | null;
  test_status: string | null;
  remarks: string | null;
  sort_order: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type MatrixRow = {
  key: string;
  itemName: string;
  itemCode: string;
  categoryName: string;
  sourceGroupName: string;
  sortOrder: number;
  cells: Record<string, SampleRecordItemRow[]>;
};

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function safeText(value: unknown, fallback = "-") {
  if (value === null || value === undefined) {
    return fallback;
  }

  const text = String(value).trim();

  return text || fallback;
}

function emptyText(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  return value.slice(0, 10);
}

function normalizeStatus(status?: string | null) {
  const value = (status || "draft").toLowerCase();

  if (value === "received") return "Received";
  if (value === "testing") return "Testing";
  if (value === "completed") return "Completed";
  if (value === "cancelled") return "Cancelled";

  return "Draft";
}

function buildMatrixKey(item: SampleRecordItemRow) {
  const sourceTestItemId = emptyText(item.source_test_item_id);
  const itemName = safeText(item.item_name, "Unnamed Test Item");
  const method = safeText(item.test_method, "-");
  const unit = safeText(item.unit, "-");
  const groupCode = emptyText(item.source_group_code);

  if (sourceTestItemId) {
    return `test:${sourceTestItemId}|method:${method}|unit:${unit}|group:${groupCode}`;
  }

  return `name:${itemName}|method:${method}|unit:${unit}|group:${groupCode}`;
}

function buildMatrixRows(items: SampleRecordItemRow[]) {
  const rowMap = new Map<string, MatrixRow>();

  items.forEach((item, index) => {
    const key = buildMatrixKey(item);

    if (!rowMap.has(key)) {
      rowMap.set(key, {
        key,
        itemName: safeText(item.item_name, "Unnamed Test Item"),
        itemCode: emptyText(item.item_code),
        categoryName: emptyText(item.category_name),
        sourceGroupName: emptyText(item.source_group_name),
        sortOrder:
          typeof item.sort_order === "number" ? item.sort_order : index,
        cells: {},
      });
    }

    const row = rowMap.get(key);

    if (!row) {
      return;
    }

    if (!row.cells[item.sample_record_sample_id]) {
      row.cells[item.sample_record_sample_id] = [];
    }

    row.cells[item.sample_record_sample_id].push(item);
  });

  return Array.from(rowMap.values()).sort((a, b) => {
    return a.sortOrder - b.sortOrder;
  });
}

function sanitizeFilename(value: string) {
  return value
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function sanitizeAsciiFilename(value: string) {
  const safeValue = value
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();

  return safeValue || "sample-record";
}

function getFontPath(fileName: string) {
  return path.join(process.cwd(), "public", "fonts", fileName);
}

function getPdfPrinter() {
  const PdfPrinterModule = require("pdfmake");
  const PdfPrinter = PdfPrinterModule.default || PdfPrinterModule;

  const normalFontPath = getFontPath("msyh.ttf");
  const boldFontPath = getFontPath("msyhbd.ttf");

  const normalFontExists = fs.existsSync(normalFontPath);
  const boldFontExists = fs.existsSync(boldFontPath);

  if (!normalFontExists) {
    throw new Error(
      `Missing PDF font: ${normalFontPath}. Please put msyh.ttf in public/fonts.`
    );
  }

  const normal = normalFontPath;
  const bold = boldFontExists ? boldFontPath : normalFontPath;

  return new PdfPrinter({
    MSYH: {
      normal,
      bold,
      italics: normal,
      bolditalics: bold,
    },
  });
}

function createPdfBuffer(docDefinition: Record<string, unknown>) {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const printer = getPdfPrinter();
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const chunks: Buffer[] = [];

      pdfDoc.on("data", (chunk: Buffer | Uint8Array) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });

      pdfDoc.on("end", () => {
        resolve(Buffer.concat(chunks));
      });

      pdfDoc.on("error", (error: unknown) => {
        reject(error);
      });

      pdfDoc.end();
    } catch (error) {
      reject(error);
    }
  });
}

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

function makeInfoTable(record: SampleRecordRow) {
  return {
    table: {
      widths: [90, "*", 90, "*"],
      body: [
        [
          { text: "Record No.", style: "infoLabel" },
          { text: safeText(record.record_no), style: "infoValue" },
          { text: "Status", style: "infoLabel" },
          { text: normalizeStatus(record.status), style: "infoValue" },
        ],
        [
          { text: "Quotation No.", style: "infoLabel" },
          { text: safeText(record.quotation_no), style: "infoValue" },
          { text: "Received Date", style: "infoLabel" },
          { text: formatDate(record.received_date), style: "infoValue" },
        ],
        [
          { text: "Customer", style: "infoLabel" },
          { text: safeText(record.customer_name), style: "infoValue" },
          { text: "Received By", style: "infoLabel" },
          { text: safeText(record.received_by), style: "infoValue" },
        ],
        [
          { text: "Project", style: "infoLabel" },
          { text: safeText(record.project_name), style: "infoValue" },
          { text: "Test Period", style: "infoLabel" },
          {
            text: `${formatDate(record.test_start_date)} 至 ${formatDate(
              record.test_end_date
            )}`,
            style: "infoValue",
          },
        ],
        [
          { text: "Customer Address", style: "infoLabel" },
          {
            text: safeText(record.customer_address),
            style: "infoValue",
            colSpan: 3,
          },
          {},
          {},
        ],
        [
          { text: "Remarks", style: "infoLabel" },
          {
            text: safeText(record.remarks),
            style: "infoValue",
            colSpan: 3,
          },
          {},
          {},
        ],
      ],
    },
    layout: {
      hLineColor: () => "#cbd5e1",
      vLineColor: () => "#cbd5e1",
      paddingLeft: () => 5,
      paddingRight: () => 5,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
    margin: [0, 0, 0, 12],
  };
}

function makeSampleTable(samples: SampleRecordSampleRow[]) {
  const body = [
    [
      { text: "No.", style: "tableHeader" },
      { text: "Sample Name", style: "tableHeader" },
      { text: "Description", style: "tableHeader" },
      { text: "Quantity", style: "tableHeader" },
      { text: "Condition", style: "tableHeader" },
      { text: "Status", style: "tableHeader" },
      { text: "Remarks", style: "tableHeader" },
    ],
    ...samples.map((sample, index) => [
      {
        text: safeText(sample.sample_no, String(index + 1)),
        style: "tableCell",
      },
      { text: safeText(sample.sample_name), style: "tableCell" },
      { text: safeText(sample.sample_description), style: "tableCell" },
      { text: safeText(sample.quantity), style: "tableCell" },
      { text: safeText(sample.sample_condition), style: "tableCell" },
      {
        text: safeText(sample.received_status, "received"),
        style: "tableCell",
      },
      { text: safeText(sample.remarks), style: "tableCell" },
    ]),
  ];

  return {
    table: {
      headerRows: 1,
      widths: [35, 110, "*", 60, 65, 65, 90],
      body,
    },
    layout: {
      fillColor: (rowIndex: number) => (rowIndex === 0 ? "#e2e8f0" : null),
      hLineColor: () => "#cbd5e1",
      vLineColor: () => "#cbd5e1",
      paddingLeft: () => 4,
      paddingRight: () => 4,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
    margin: [0, 0, 0, 12],
  };
}

function makeMatrixTable(
  samples: SampleRecordSampleRow[],
  items: SampleRecordItemRow[]
) {
  const matrixRows = buildMatrixRows(items);

  const header = [
    { text: "Test Item", style: "tableHeader", alignment: "left" },
    ...samples.map((sample, index) => ({
      stack: [
        {
          text: safeText(sample.sample_no, String(index + 1)),
          bold: true,
          alignment: "center",
        },
        {
          text: safeText(sample.sample_name),
          fontSize: 6.5,
          alignment: "center",
        },
      ],
      margin: [0, 1, 0, 1],
    })),
  ];

  const emptyBody = [
    header,
    [
      {
        text: "No matrix items found.",
        colSpan: samples.length + 1,
        alignment: "center",
        color: "#64748b",
        margin: [0, 10, 0, 10],
      },
      ...samples.map(() => ({})),
    ],
  ];

  const normalBody = [
    header,
    ...matrixRows.map((row) => [
      {
        stack: [
          { text: row.itemName, bold: true },
          row.itemCode
            ? { text: row.itemCode, fontSize: 6.5, color: "#64748b" }
            : { text: "" },
          row.sourceGroupName
            ? {
                text: `Group: ${row.sourceGroupName}`,
                fontSize: 6.5,
                color: "#92400e",
              }
            : { text: "" },
          row.categoryName
            ? { text: row.categoryName, fontSize: 6.5, color: "#64748b" }
            : { text: "" },
        ],
        margin: [0, 2, 0, 2],
      },
      ...samples.map((sample) => {
        const checked = Boolean(row.cells[sample.id]?.length);

        return {
          text: checked ? "√" : "",
          alignment: "center",
          fontSize: 13,
          bold: true,
          color: "#b45309",
          margin: [0, 2, 0, 2],
        };
      }),
    ]),
  ];

  return {
    table: {
      headerRows: 1,
      widths: [150, ...samples.map(() => "*")],
      body: matrixRows.length === 0 ? emptyBody : normalBody,
    },
    layout: {
      fillColor: (rowIndex: number) => (rowIndex === 0 ? "#e2e8f0" : null),
      hLineColor: () => "#cbd5e1",
      vLineColor: () => "#cbd5e1",
      paddingLeft: () => 4,
      paddingRight: () => 4,
      paddingTop: () => 4,
      paddingBottom: () => 4,
    },
  };
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

    if (errorObject.message) return errorObject.message;
    if (errorObject.details) return errorObject.details;
    if (errorObject.hint) return errorObject.hint;
    if (errorObject.code) return `Database error code: ${errorObject.code}`;

    const jsonText = JSON.stringify(errorObject);

    if (jsonText && jsonText !== "{}") {
      return jsonText;
    }
  }

  return fallbackMessage;
}

function makeContentDisposition(record: SampleRecordRow) {
  const rawBaseName = safeText(record.record_no, "sample-record");
  const utf8BaseName = sanitizeFilename(rawBaseName) || "sample-record";
  const utf8FileName = `${utf8BaseName}.pdf`;

  const asciiBaseName = sanitizeAsciiFilename(
    `${safeText(record.record_no, "sample-record")}-${record.id}`
  );
  const asciiFileName = `${asciiBaseName}.pdf`;

  return `inline; filename="${asciiFileName}"; filename*=UTF-8''${encodeURIComponent(
    utf8FileName
  )}`;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id: recordId } = await context.params;

    if (!recordId) {
      return NextResponse.json(
        { error: "Missing sample record id." },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();

    const { data: recordData, error: recordError } = await supabase
      .from("sample_records")
      .select("*")
      .eq("id", recordId)
      .single();

    if (recordError || !recordData) {
      return NextResponse.json(
        {
          error:
            getErrorMessage(
              recordError,
              "Sample record not found or cannot be loaded."
            ) || "Sample record not found or cannot be loaded.",
        },
        { status: 404 }
      );
    }

    const record = recordData as SampleRecordRow;

    const { data: sampleData, error: sampleError } = await supabase
      .from("sample_record_samples")
      .select("*")
      .eq("sample_record_id", recordId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (sampleError) {
      throw sampleError;
    }

    const { data: itemData, error: itemError } = await supabase
      .from("sample_record_items")
      .select("*")
      .eq("sample_record_id", recordId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (itemError) {
      throw itemError;
    }

    const samples = (sampleData || []) as SampleRecordSampleRow[];
    const items = (itemData || []) as SampleRecordItemRow[];

    const docDefinition = {
      pageSize: "A4",
      pageOrientation: "landscape",
      pageMargins: [28, 28, 28, 36],
      defaultStyle: {
        font: "MSYH",
        fontSize: 8,
        color: "#0f172a",
      },
      styles: {
        title: {
          fontSize: 17,
          bold: true,
          alignment: "center",
          margin: [0, 0, 0, 4],
        },
        subTitle: {
          fontSize: 9,
          alignment: "center",
          color: "#475569",
          margin: [0, 0, 0, 12],
        },
        sectionTitle: {
          fontSize: 10,
          bold: true,
          margin: [0, 8, 0, 5],
        },
        infoLabel: {
          bold: true,
          color: "#334155",
          fillColor: "#f1f5f9",
        },
        infoValue: {
          color: "#0f172a",
        },
        tableHeader: {
          bold: true,
          color: "#334155",
          fillColor: "#e2e8f0",
        },
        tableCell: {
          color: "#0f172a",
        },
      },
      footer: (currentPage: number, pageCount: number) => {
        return {
          columns: [
            {
              text: `Generated: ${new Date().toLocaleString("zh-HK")}`,
              alignment: "left",
              margin: [28, 0, 0, 0],
              fontSize: 7,
              color: "#64748b",
            },
            {
              text: `Page ${currentPage} of ${pageCount}`,
              alignment: "right",
              margin: [0, 0, 28, 0],
              fontSize: 7,
              color: "#64748b",
            },
          ],
        };
      },
      content: [
        {
          text: "收樣檢測記錄 / Sample Test Record",
          style: "title",
        },
        {
          text: safeText(record.record_no),
          style: "subTitle",
        },
        makeInfoTable(record),
        {
          text: "Sample Information",
          style: "sectionTitle",
        },
        makeSampleTable(samples),
        {
          text: "Sample × Test Item Matrix",
          style: "sectionTitle",
        },
        {
          text: "√ 代表該樣品需要做該項檢測。",
          fontSize: 8,
          color: "#475569",
          margin: [0, 0, 0, 5],
        },
        makeMatrixTable(samples, items),
      ],
    };

    const pdfBuffer = await createPdfBuffer(docDefinition);

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": makeContentDisposition(record),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Generate sample record PDF error:", error);

    return NextResponse.json(
      {
        error: "Failed to generate sample record PDF.",
        detail: getErrorMessage(error, "Unknown PDF generation error."),
      },
      { status: 500 }
    );
  }
}
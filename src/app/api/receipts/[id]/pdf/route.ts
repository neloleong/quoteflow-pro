import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createRequire } from "module";
import fs from "fs";
import path from "path";

type Content = any;
type TableCell = any;
type TDocumentDefinitions = any;

const nodeRequire = createRequire(import.meta.url);
const PdfPrinter: any = nodeRequire("pdfmake");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AnyRecord = Record<string, any>;

type Receipt = {
  id: string;
  company_id: string | null;
  invoice_id: string | null;
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
  payment_reference: string | null;
  received_by: string | null;
  remarks: string | null;
  status: string | null;
  created_at?: string | null;
};

type ReceiptItem = {
  id: string;
  receipt_id?: string | null;
  invoice_item_id?: string | null;
  invoice_id?: string | null;
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
  line_total?: number | null;
  sort_order: number | null;
  created_at?: string | null;
};

type GroupedReceiptItem = {
  itemNo: number;
  itemName: string;
  items: ReceiptItem[];
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
    "public/fonts/upcl.ttf",
    "public/fonts/方正小标宋_GBK.TTF",
    "public/fonts/方正小标宋简体.ttf",
    "public/fonts/文泉广告中宋.ttf",
    "public/fonts/NotoSansTC-Regular.ttf",
  ]);

  const boldFontPath = firstExistingPath([
    process.env.PDF_FONT_BOLD_PATH || "",
    "public/fonts/msyhbd.ttf",
    "public/fonts/msyh.ttf",
    "public/fonts/upcl.ttf",
    "public/fonts/方正小标宋_GBK.TTF",
    "public/fonts/方正小标宋简体.ttf",
    "public/fonts/文泉广告中宋.ttf",
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

function numberValue(
  row: AnyRecord | null | undefined,
  keys: string[],
  fallback = 0
): number {
  if (!row) {
    return fallback;
  }

  for (const key of keys) {
    const value = row[key];

    if (value !== undefined && value !== null && String(value).trim() !== "") {
      const numericValue = Number(value);

      if (!Number.isNaN(numericValue)) {
        return numericValue;
      }
    }
  }

  return fallback;
}

function formatDateText(dateValue: string | null | undefined) {
  if (!dateValue) {
    return "-";
  }

  const dateText = String(dateValue).slice(0, 10);
  const [year, month, day] = dateText.split("-");

  if (!year || !month || !day) {
    return String(dateValue);
  }

  return `${day}/${month}/${year}`;
}

function formatAmount(value: number) {
  const numericValue = Number(value || 0);

  if (Number.isInteger(numericValue)) {
    return numericValue.toLocaleString("en-US", {
      maximumFractionDigits: 0,
    });
  }

  return numericValue.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function safeFileName(value: string): string {
  return value
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
    .trim();
}

function getReceiptNo(receipt: Receipt) {
  return textValue(
    receipt,
    ["receipt_no", "receipt_number", "document_number"],
    "EMIT-receipt"
  );
}

function getCurrency(receipt: Receipt) {
  return receipt.currency || "MOP";
}

function getCustomerName(receipt: Receipt) {
  return textValue(
    receipt,
    ["customer_name", "to_customer_name", "client_name"],
    "-"
  );
}

function getProjectName(receipt: Receipt) {
  return textValue(receipt, ["project_name"], "食品檢測");
}

function splitProjectDescription(projectDescription: string | null | undefined) {
  return String(projectDescription || "")
    .split(/[、,\n\r]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getProjectDisplayText(receipt: Receipt, items: ReceiptItem[]) {
  const projectDescription = textValue(receipt, ["project_description"], "");

  if (projectDescription && projectDescription !== "-") {
    return projectDescription;
  }

  const itemNames = Array.from(
    new Set(
      items
        .map((item) => String(item.sample_name || item.item_name || "").trim())
        .filter(Boolean)
    )
  );

  if (itemNames.length > 0) {
    return itemNames.join("、");
  }

  return "-";
}

function getFromTel() {
  return "(853) 2875 1742";
}

function getFromFax() {
  return "(853) 2835 5613";
}

function getFromEmail() {
  return "finance01@emit.com.mo";
}

function getItemNo(item: ReceiptItem, index: number) {
  const itemNo = Number(item.sample_no || item.item_no || index + 1);

  if (Number.isNaN(itemNo) || itemNo <= 0) {
    return index + 1;
  }

  return itemNo;
}

function getItemName(receipt: Receipt, item: ReceiptItem, itemNo: number) {
  const directName = textValue(
    item,
    ["sample_name", "item_name", "name"],
    ""
  );

  if (directName) {
    return directName;
  }

  const projectItems = splitProjectDescription(receipt.project_description);

  return projectItems[itemNo - 1] || `Item ${itemNo}`;
}

function getDescriptionColumn(item: ReceiptItem) {
  return textValue(
    item,
    [
      "description",
      "item_name",
      "name",
      "test_item_name",
      "test_name",
      "test_item_name_zh",
    ],
    "-"
  );
}

function getUnitPrice(item: ReceiptItem) {
  return numberValue(
    item,
    [
      "unit_price",
      "unit_price_mop",
      "customer_unit_price_mop_snapshot",
      "price",
    ],
    0
  );
}

function getQuantity(item: ReceiptItem) {
  const quantity = numberValue(item, ["quantity", "qty"], 1);

  if (Number.isNaN(quantity) || quantity <= 0) {
    return 1;
  }

  return quantity;
}

function getLineTotal(item: ReceiptItem) {
  const savedTotal = numberValue(
    item,
    [
      "total_amount",
      "total_price",
      "line_total",
      "customer_total_price_mop_snapshot",
    ],
    0
  );

  if (!Number.isNaN(savedTotal) && savedTotal > 0) {
    return savedTotal;
  }

  return getUnitPrice(item) * getQuantity(item);
}

function sortReceiptItems(items: ReceiptItem[]) {
  return [...items].sort((a, b) => {
    const aOrder = Number(a.sort_order || 0);
    const bOrder = Number(b.sort_order || 0);

    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }

    const aItemNo = Number(a.sample_no || a.item_no || 0);
    const bItemNo = Number(b.sample_no || b.item_no || 0);

    if (aItemNo !== bItemNo) {
      return aItemNo - bItemNo;
    }

    const aCreated = a.created_at || "";
    const bCreated = b.created_at || "";

    return aCreated.localeCompare(bCreated);
  });
}

function groupReceiptItems(receipt: Receipt, items: ReceiptItem[]) {
  const groupMap = new Map<number, GroupedReceiptItem>();

  sortReceiptItems(items).forEach((item, index) => {
    const itemNo = getItemNo(item, index);
    const itemName = getItemName(receipt, item, itemNo);
    const existingGroup = groupMap.get(itemNo);

    if (existingGroup) {
      existingGroup.items.push(item);
    } else {
      groupMap.set(itemNo, {
        itemNo,
        itemName,
        items: [item],
      });
    }
  });

  return Array.from(groupMap.values()).sort((a, b) => a.itemNo - b.itemNo);
}

function makeLabelCell(text: string): TableCell {
  return {
    text,
    bold: true,
    color: "#001334",
    fontSize: 8,
    border: [false, false, false, false],
    margin: [0, 2, 0, 2],
  };
}

function makeValueCell(text: string): TableCell {
  return {
    text: text || "-",
    color: "#001334",
    fontSize: 8,
    border: [false, false, false, false],
    margin: [0, 2, 0, 2],
  };
}

function getMergedCellFontSize(text: string) {
  const textLength = String(text || "").length;

  if (textLength >= 18) {
    return 6.3;
  }

  if (textLength >= 14) {
    return 6.6;
  }

  if (textLength >= 10) {
    return 6.9;
  }

  return 7.1;
}

function getMiddleRowIndex(rowCount: number) {
  if (rowCount <= 1) {
    return 0;
  }

  return Math.floor((rowCount - 1) / 2);
}

function makeHeaderCell(text: string): TableCell {
  return {
    text,
    bold: true,
    alignment: "center",
    color: "#001334",
    fillColor: "#f3f7fb",
    fontSize: 7,
    margin: [0, 4, 0, 4],
    border: [true, true, true, true],
    noWrap: false,
  };
}

function makePseudoMergedCell(
  text: string,
  rowIndex: number,
  rowCount: number,
  options?: {
    bold?: boolean;
    fontSize?: number;
  }
): TableCell {
  const isFirstRow = rowIndex === 0;
  const isLastRow = rowIndex === rowCount - 1;
  const middleRowIndex = getMiddleRowIndex(rowCount);
  const shouldShowText = rowIndex === middleRowIndex;

  return {
    text: shouldShowText ? text : "",
    bold: options?.bold ?? false,
    alignment: "center",
    color: "#001334",
    fontSize: options?.fontSize ?? 6.8,
    margin: [1, shouldShowText ? 2 : 0, 1, shouldShowText ? 2 : 0],
    border: [true, isFirstRow, true, isLastRow],
    noWrap: false,
  };
}

function makeBodyCell(
  text: string | number,
  options?: {
    bold?: boolean;
    fontSize?: number;
    alignment?: "left" | "center" | "right";
    margin?: [number, number, number, number];
    fillColor?: string;
    color?: string;
    noWrap?: boolean;
  }
): TableCell {
  const displayText =
    text === null || text === undefined || String(text).trim() === ""
      ? "-"
      : String(text);

  return {
    text: displayText,
    bold: options?.bold ?? false,
    alignment: options?.alignment ?? "center",
    color: options?.color ?? "#001334",
    fillColor: options?.fillColor,
    fontSize: options?.fontSize ?? 6.8,
    margin: options?.margin ?? [1, 3, 1, 3],
    border: [true, true, true, true],
    noWrap: options?.noWrap ?? false,
  };
}

function buildTopSection(): Content[] {
  const logoImage = imageDataUrl("public/images/emit-logo.png");

  return [
    {
      columns: [
        logoImage
          ? {
              image: logoImage,
              width: 145,
              alignment: "left",
            }
          : {
              text: "EMIT",
              fontSize: 18,
              bold: true,
              color: "#0084b8",
              alignment: "left",
            },
        {
          width: "*",
          text: "",
        },
      ],
      margin: [0, 0, 0, 8],
    },
    {
      text: "RECEIPT",
      alignment: "center",
      bold: true,
      fontSize: 20,
      color: "#001334",
      margin: [0, 0, 0, 8],
    },
    {
      canvas: [
        {
          type: "line",
          x1: 0,
          y1: 0,
          x2: 531,
          y2: 0,
          lineWidth: 0.6,
          lineColor: "#d6e0ea",
        },
      ],
      margin: [0, 0, 0, 9],
    },
    {
      stack: [
        {
          text: "澳門美副將大馬路萬基工業大廈 3樓A座",
          fontSize: 8,
          color: "#001334",
          margin: [0, 0, 0, 3],
        },
        {
          text: `TEL: ${getFromTel()}    FAX: ${getFromFax()}    E-MAIL: ${getFromEmail()}`,
          fontSize: 8,
          color: "#001334",
        },
      ],
      margin: [0, 0, 0, 10],
    },
  ];
}

function buildInfoSection(receipt: Receipt, items: ReceiptItem[]): Content {
  return {
    table: {
      widths: [76, 190, 70, "*"],
      body: [
        [
          makeLabelCell("Customer:"),
          makeValueCell(getCustomerName(receipt)),
          makeLabelCell("Receipt No:"),
          makeValueCell(getReceiptNo(receipt)),
        ],
        [
          makeLabelCell("Invoice No:"),
          makeValueCell(receipt.invoice_no || "-"),
          makeLabelCell("Date:"),
          makeValueCell(formatDateText(receipt.receipt_date || receipt.created_at)),
        ],
        [
          makeLabelCell("Project Name:"),
          makeValueCell(getProjectName(receipt)),
          makeLabelCell(""),
          makeValueCell(""),
        ],
        [
          makeLabelCell("Project:"),
          makeValueCell(getProjectDisplayText(receipt, items)),
          makeLabelCell(""),
          makeValueCell(""),
        ],
      ],
    },
    layout: "noBorders",
    margin: [0, 0, 0, 10],
  };
}

function buildReceiptItemsTable(receipt: Receipt, items: ReceiptItem[]): Content {
  const currency = getCurrency(receipt);
  const groupedItems = groupReceiptItems(receipt, items);

  const header: TableCell[] = [
    makeHeaderCell("Item\n事項"),
    makeHeaderCell("Name\n名稱"),
    makeHeaderCell("Description\n描述"),
    makeHeaderCell("Unit Price\n單價"),
    makeHeaderCell("Qty.\n數量"),
    makeHeaderCell("Total\n總價"),
  ];

  const body: TableCell[][] = [header];

  if (groupedItems.length === 0) {
    body.push([
      {
        text: "No receipt items.",
        colSpan: 6,
        alignment: "center",
        color: "#64748b",
        fontSize: 8,
        margin: [0, 10, 0, 10],
        border: [true, true, true, true],
      },
      {},
      {},
      {},
      {},
      {},
    ]);
  }

  groupedItems.forEach((group) => {
    const rowCount = group.items.length;
    const mergedFontSize = getMergedCellFontSize(group.itemName);

    group.items.forEach((item, itemIndex) => {
      body.push([
        makePseudoMergedCell(String(group.itemNo), itemIndex, rowCount, {
          bold: true,
          fontSize: 7,
        }),

        makePseudoMergedCell(group.itemName, itemIndex, rowCount, {
          bold: true,
          fontSize: mergedFontSize,
        }),

        makeBodyCell(getDescriptionColumn(item), {
          fontSize: 6.6,
          alignment: "center",
          margin: [1, 3, 1, 3],
        }),

        makeBodyCell(formatAmount(getUnitPrice(item)), {
          fontSize: 6.6,
          alignment: "center",
          margin: [1, 3, 1, 3],
        }),

        makeBodyCell(formatAmount(getQuantity(item)), {
          fontSize: 6.6,
          alignment: "center",
          margin: [1, 3, 1, 3],
        }),

        makeBodyCell(`${currency} ${formatAmount(getLineTotal(item))}`, {
          bold: true,
          fontSize: 6.6,
          alignment: "center",
          margin: [1, 3, 1, 3],
        }),
      ]);
    });
  });

  const itemTotalAmount = items.reduce((sum, item) => {
    return sum + getLineTotal(item);
  }, 0);

  const amountReceived = Number(receipt.amount_received || 0);

  body.push([
    {
      text: "Invoice Total / 發票總額：",
      colSpan: 5,
      alignment: "right",
      bold: true,
      color: "#001334",
      fillColor: "#f8fafc",
      fontSize: 7.4,
      margin: [0, 5, 6, 5],
      border: [true, true, true, true],
    },
    {},
    {},
    {},
    {},
    {
      text: `${currency} ${formatAmount(itemTotalAmount)}`,
      alignment: "center",
      bold: true,
      color: "#001334",
      fillColor: "#f8fafc",
      fontSize: 7.4,
      margin: [0, 5, 0, 5],
      border: [true, true, true, true],
    },
  ]);

  body.push([
    {
      text: "Amount Received / 已收款項：",
      colSpan: 5,
      alignment: "right",
      bold: true,
      color: "#064e3b",
      fillColor: "#ecfdf5",
      fontSize: 7.4,
      margin: [0, 5, 6, 5],
      border: [true, true, true, true],
    },
    {},
    {},
    {},
    {},
    {
      text: `${currency} ${formatAmount(amountReceived)}`,
      alignment: "center",
      bold: true,
      color: "#064e3b",
      fillColor: "#ecfdf5",
      fontSize: 7.4,
      margin: [0, 5, 0, 5],
      border: [true, true, true, true],
    },
  ]);

  return {
    table: {
      headerRows: 1,
      widths: [50, 140, 110, 82, 52, 97],
      body,
      dontBreakRows: true,
      keepWithHeaderRows: 1,
    },
    layout: {
      hLineWidth: () => 0.45,
      vLineWidth: () => 0.45,
      hLineColor: () => "#b8c4d4",
      vLineColor: () => "#b8c4d4",
      paddingLeft: () => 1.5,
      paddingRight: () => 1.5,
      paddingTop: () => 1.2,
      paddingBottom: () => 1.2,
    },
    margin: [0, 0, 0, 12],
  };
}

function buildPaymentSection(receipt: Receipt): Content {
  return {
    table: {
      widths: [120, "*"],
      body: [
        [
          makeBodyCell("Payment Method", {
            alignment: "left",
            bold: true,
            fontSize: 7.4,
            fillColor: "#f3f7fb",
            margin: [5, 4, 5, 4],
          }),
          makeBodyCell(receipt.payment_method || "-", {
            alignment: "left",
            fontSize: 7.4,
            margin: [5, 4, 5, 4],
          }),
        ],
        [
          makeBodyCell("Payment Reference", {
            alignment: "left",
            bold: true,
            fontSize: 7.4,
            fillColor: "#f3f7fb",
            margin: [5, 4, 5, 4],
          }),
          makeBodyCell(receipt.payment_reference || "-", {
            alignment: "left",
            fontSize: 7.4,
            margin: [5, 4, 5, 4],
          }),
        ],
        [
          makeBodyCell("Received By", {
            alignment: "left",
            bold: true,
            fontSize: 7.4,
            fillColor: "#f3f7fb",
            margin: [5, 4, 5, 4],
          }),
          makeBodyCell(receipt.received_by || "-", {
            alignment: "left",
            fontSize: 7.4,
            margin: [5, 4, 5, 4],
          }),
        ],
        [
          makeBodyCell("Remarks", {
            alignment: "left",
            bold: true,
            fontSize: 7.4,
            fillColor: "#f3f7fb",
            margin: [5, 4, 5, 4],
          }),
          makeBodyCell(receipt.remarks || "-", {
            alignment: "left",
            fontSize: 7.4,
            margin: [5, 4, 5, 4],
          }),
        ],
      ],
    },
    layout: {
      hLineWidth: () => 0.45,
      vLineWidth: () => 0.45,
      hLineColor: () => "#b8c4d4",
      vLineColor: () => "#b8c4d4",
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
    margin: [0, 0, 0, 14],
  };
}

function buildSignatureSection(): Content {
  const stampImage = imageDataUrl("public/images/emit-signature-stamp.png");

  return {
    unbreakable: true,
    stack: [
      {
        text: "環科監控檢測有限公司",
        bold: true,
        color: "#001334",
        fontSize: 10,
        margin: [0, 0, 0, 3],
      },
      {
        text: "EMIT Environment Monitoring Inspection and Testing Co. Ltd.",
        bold: true,
        color: "#001334",
        fontSize: 10,
        margin: [0, 0, 0, 5],
      },
      stampImage
        ? {
            image: stampImage,
            width: 150,
            alignment: "left",
            margin: [0, 0, 0, 5],
          }
        : {
            text: "",
            margin: [0, 0, 0, 40],
          },
      {
        canvas: [
          {
            type: "line",
            x1: 0,
            y1: 0,
            x2: 220,
            y2: 0,
            lineWidth: 0.6,
            lineColor: "#d6e0ea",
          },
        ],
        margin: [0, 0, 0, 6],
      },
      {
        text: "Authorized Signature",
        color: "#64748b",
        fontSize: 7,
      },
    ],
    margin: [0, 0, 0, 0],
  };
}

function buildDocumentDefinition(
  receipt: Receipt,
  items: ReceiptItem[]
): TDocumentDefinitions {
  const receiptNo = getReceiptNo(receipt);

  const content: Content[] = [
    ...buildTopSection(),
    buildInfoSection(receipt, items),
    buildReceiptItemsTable(receipt, items),
    buildPaymentSection(receipt),
    buildSignatureSection(),
  ];

  return {
    pageSize: "A4",
    pageMargins: [32, 24, 32, 38],
    defaultStyle: {
      font: "EMITFont",
      fontSize: 8,
      lineHeight: 1.1,
      color: "#001334",
    },
    footer(currentPage: number, pageCount: number) {
      return {
        columns: [
          {
            text: `Receipt No.: ${receiptNo}`,
            alignment: "left",
            fontSize: 7,
            color: "#334155",
            margin: [32, 8, 0, 0],
          },
          {
            text: `Page ${currentPage} of ${pageCount}`,
            alignment: "right",
            fontSize: 7,
            color: "#334155",
            margin: [0, 8, 32, 0],
          },
        ],
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

async function loadReceiptItems(
  supabase: any,
  receipt: Receipt
): Promise<ReceiptItem[]> {
  const { data: receiptItemsData, error: receiptItemsError } = await supabase
    .from("receipt_items")
    .select("*")
    .eq("receipt_id", receipt.id)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  if (receiptItemsError) {
    throw receiptItemsError;
  }

  const receiptItems = Array.isArray(receiptItemsData)
    ? (receiptItemsData as ReceiptItem[])
    : [];

  if (receiptItems.length > 0 || !receipt.invoice_id) {
    return receiptItems;
  }

  const { data: invoiceItemsData, error: invoiceItemsError } = await supabase
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", receipt.invoice_id)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  if (invoiceItemsError) {
    throw invoiceItemsError;
  }

  return Array.isArray(invoiceItemsData)
    ? (invoiceItemsData as ReceiptItem[])
    : [];
}

export async function GET(
  request: Request,
  context: {
    params: Promise<{ id: string }> | { id: string };
  }
) {
  try {
    const params = await Promise.resolve(context.params);
    const receiptId = params.id;

    if (!receiptId) {
      return NextResponse.json(
        {
          error: "Missing receipt id.",
        },
        {
          status: 400,
        }
      );
    }

    const supabase = getSupabaseClient();

    const { data: receiptData, error: receiptError } = await supabase
      .from("receipts")
      .select("*")
      .eq("id", receiptId)
      .is("deleted_at", null)
      .maybeSingle();

    if (receiptError) {
      return NextResponse.json(
        {
          error: "Failed to load receipt.",
          details: receiptError.message,
        },
        {
          status: 500,
        }
      );
    }

    if (!receiptData) {
      return NextResponse.json(
        {
          error: "Receipt not found.",
        },
        {
          status: 404,
        }
      );
    }

    const receipt = receiptData as Receipt;
    const receiptItems = await loadReceiptItems(supabase, receipt);

    const docDefinition = buildDocumentDefinition(receipt, receiptItems);
    const pdfBuffer = await createPdfBuffer(docDefinition);

    const fileName = `${safeFileName(getReceiptNo(receipt))}.pdf`;

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
    console.error("Generate receipt PDF error:", error);

    return NextResponse.json(
      {
        error: "Failed to generate receipt PDF.",
        details: error?.message || String(error),
      },
      {
        status: 500,
      }
    );
  }
}
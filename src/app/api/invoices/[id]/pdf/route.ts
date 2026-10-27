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



type Invoice = {

  id: string;

  company_id: string | null;

  customer_id: string | null;

  invoice_no: string | null;

  invoice_date: string | null;

  customer_name: string | null;

  project_name: string | null;

  project_description: string | null;

  subtotal: number | null;

  discount_amount: number | null;

  total_amount: number | null;

  currency: string | null;

  payment_method?: string | null;

  status: string | null;

  created_at?: string | null;

};



type InvoiceItem = {

  id: string;

  invoice_id: string;

  quotation_item_id?: string | null;

  test_item_id?: string | null;

  sample_no: number | null;

  sample_name: string | null;

  test_category_name?: string | null;

  item_no: number | null;

  item_name?: string | null;

  name?: string | null;

  description: string | null;

  quantity: number | null;

  unit?: string | null;

  unit_price?: number | null;

  unit_price_mop?: number | null;

  total_price?: number | null;

  total_amount?: number | null;

  line_total?: number | null;

  customer_unit_price_mop_snapshot?: number | null;

  customer_total_price_mop_snapshot?: number | null;

  sort_order: number | null;

  created_at?: string | null;

};



type GroupedInvoiceItem = {

  itemNo: number;

  sampleName: string;

  items: InvoiceItem[];

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



function getInvoiceNo(invoice: Invoice) {

  return textValue(

    invoice,

    ["invoice_no", "invoice_number", "document_number"],

    "EMIT-invoice"

  );

}



function getCurrency(invoice: Invoice) {

  return invoice.currency || "MOP";

}



function getCustomerName(invoice: Invoice) {

  return textValue(

    invoice,

    ["customer_name", "to_customer_name", "client_name"],

    "-"

  );

}



function getProjectName(invoice: Invoice) {

  return textValue(invoice, ["project_name"], "食品檢測");

}



function getProjectDescription(invoice: Invoice) {

  return textValue(invoice, ["project_description"], "-");

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



function splitProjectDescription(projectDescription: string | null | undefined) {

  return String(projectDescription || "")

    .split(/[、,\n\r]+/)

    .map((item) => item.trim())

    .filter(Boolean);

}



function getItemNo(item: InvoiceItem, index: number) {

  return Number(item.sample_no || item.item_no || index + 1);

}



function getSampleName(

  invoice: Invoice,

  item: InvoiceItem,

  itemNo: number

) {

  const sampleName = textValue(

    item,

    ["sample_name", "name", "item_name"],

    ""

  );



  if (sampleName) {

    return sampleName;

  }



  const projectSampleNames = splitProjectDescription(

    invoice.project_description

  );



  return projectSampleNames[itemNo - 1] || `Item ${itemNo}`;

}



function getDescriptionColumn(item: InvoiceItem) {

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



function getUnitPrice(item: InvoiceItem) {

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



function getQuantity(item: InvoiceItem) {

  const quantity = numberValue(item, ["quantity", "qty"], 1);



  if (Number.isNaN(quantity) || quantity <= 0) {

    return 1;

  }



  return quantity;

}



function getLineTotal(item: InvoiceItem) {

  const savedTotal = numberValue(

    item,

    [

      "total_price",

      "total_amount",

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



function sortInvoiceItems(items: InvoiceItem[]) {

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



function groupInvoiceItems(invoice: Invoice, items: InvoiceItem[]) {

  const groupMap = new Map<number, GroupedInvoiceItem>();



  sortInvoiceItems(items).forEach((item, index) => {

    const itemNo = getItemNo(item, index);

    const sampleName = getSampleName(invoice, item, itemNo);

    const existingGroup = groupMap.get(itemNo);



    if (existingGroup) {

      existingGroup.items.push(item);

    } else {

      groupMap.set(itemNo, {

        itemNo,

        sampleName,

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

    color: "#001334",

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

      text: "INVOICE",

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

          text: `TEL: ${getFromTel()}    FAX: ${getFromFax()}    E-MAIL: ${getFromEmail()}`,

          fontSize: 8,

          color: "#001334",

        },

      ],

      margin: [0, 0, 0, 10],

    },

  ];

}



function buildInfoSection(invoice: Invoice): Content {

  return {

    table: {

      widths: [76, 190, 70, "*"],

      body: [

        [

          makeLabelCell("Customer:"),

          makeValueCell(getCustomerName(invoice)),

          makeLabelCell("Invoice No:"),

          makeValueCell(getInvoiceNo(invoice)),

        ],

        [

          makeLabelCell("Project Name:"),

          makeValueCell(getProjectName(invoice)),

          makeLabelCell("Date:"),

          makeValueCell(formatDateText(invoice.invoice_date || invoice.created_at)),

        ],

        [

          makeLabelCell("Project:"),

          makeValueCell(getProjectDescription(invoice)),

          makeLabelCell("Status:"),

          makeValueCell(textValue(invoice, ["status"], "-")),

        ],

      ],

    },

    layout: "noBorders",

    margin: [0, 0, 0, 10],

  };

}



function buildInvoiceTable(invoice: Invoice, items: InvoiceItem[]): Content {

  const currency = getCurrency(invoice);

  const groupedItems = groupInvoiceItems(invoice, items);



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

        text: "No invoice items.",

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

    const mergedFontSize = getMergedCellFontSize(group.sampleName);



    group.items.forEach((item, itemIndex) => {

      body.push([

        makePseudoMergedCell(String(group.itemNo), itemIndex, rowCount, {

          bold: true,

          fontSize: 7,

        }),



        makePseudoMergedCell(group.sampleName, itemIndex, rowCount, {

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



  const calculatedTotal = items.reduce((sum, item) => {

    return sum + getLineTotal(item);

  }, 0);



  const totalAmount = Number(invoice.total_amount || 0) || calculatedTotal;



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

      text: `${currency} ${formatAmount(totalAmount)}`,

      alignment: "center",

      bold: true,

      color: "#001334",

      fillColor: "#f8fafc",

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

    margin: [0, 0, 0, 14],

  };

}



function buildSignatureAndBankSection(): Content {

  const stampImage = imageDataUrl("public/images/emit-signature-stamp.png");



  const bankLines = [

    "Make all checks payable to: 環科監控檢測有限公司",

    "Payable by check or Electronic Transfer",

    "Receiving Bank: BANCO TAI FUNG (大豐銀行)",

    "Beneficiary Account No: MOP:",

    "201-1-09950-1",

    "Beneficiary Account Name: 環科監控檢測有限公司",

    "Swift Code: TFBLMOMX",

  ];



  return {

    unbreakable: true,

    columns: [

      {

        width: "*",

        stack: [

          {

            text: "環科監控檢測有限公司",

            bold: true,

            color: "#001334",

            fontSize: 11,

            margin: [0, 0, 0, 3],

          },

          {

            text: "EMIT Environment Monitoring Inspection and Testing Co. Ltd.",

            bold: true,

            color: "#001334",

            fontSize: 11,

            margin: [0, 0, 0, 6],

          },

          stampImage

            ? {

                image: stampImage,

                width: 190,

                alignment: "left",

                margin: [0, 0, 0, 5],

              }

            : {

                text: "",

                margin: [0, 0, 0, 42],

              },

          {

            canvas: [

              {

                type: "line",

                x1: 0,

                y1: 0,

                x2: 300,

                y2: 0,

                lineWidth: 0.6,

                lineColor: "#d6e0ea",

              },

            ],

            margin: [0, 0, 0, 8],

          },

          {

            text: "Authorized Signature",

            color: "#64748b",

            fontSize: 8,

          },

        ],

      },

      {

        width: 245,

        table: {

          widths: ["*"],

          body: [

            [

              {

                stack: [

                  {

                    text: "Bank Details:",

                    bold: true,

                    color: "#001334",

                    fontSize: 10,

                    margin: [0, 0, 0, 7],

                  },

                  ...bankLines.map((line) => ({

                    text: line,

                    color: "#001334",

                    fontSize: 8.2,

                    margin: [0, 0, 0, 5],

                  })),

                ],

                fillColor: "#f8fafc",

                margin: [10, 8, 10, 8],

                border: [true, true, true, true],

              },

            ],

          ],

        },

        layout: {

          hLineWidth: () => 0.5,

          vLineWidth: () => 0.5,

          hLineColor: () => "#d6e0ea",

          vLineColor: () => "#d6e0ea",

          paddingLeft: () => 0,

          paddingRight: () => 0,

          paddingTop: () => 0,

          paddingBottom: () => 0,

        },

      },

    ],

    columnGap: 28,

    margin: [0, 4, 0, 0],

  };

}



function buildDocumentDefinition(

  invoice: Invoice,

  items: InvoiceItem[]

): TDocumentDefinitions {

  const invoiceNo = getInvoiceNo(invoice);



  const content: Content[] = [

    ...buildTopSection(),

    buildInfoSection(invoice),

    buildInvoiceTable(invoice, items),

    buildSignatureAndBankSection(),

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

            text: `Invoice No.: ${invoiceNo}`,

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



export async function GET(

  request: Request,

  context: {

    params: Promise<{ id: string }> | { id: string };

  }

) {

  try {

    const params = await Promise.resolve(context.params);

    const invoiceId = params.id;



    if (!invoiceId) {

      return NextResponse.json(

        {

          error: "Missing invoice id.",

        },

        {

          status: 400,

        }

      );

    }



    const supabase = getSupabaseClient();



    const { data: invoiceData, error: invoiceError } = await supabase

      .from("invoices")

      .select("*")

      .eq("id", invoiceId)

      .is("deleted_at", null)

      .maybeSingle();



    if (invoiceError) {

      return NextResponse.json(

        {

          error: "Failed to load invoice.",

          details: invoiceError.message,

        },

        {

          status: 500,

        }

      );

    }



    if (!invoiceData) {

      return NextResponse.json(

        {

          error: "Invoice not found.",

        },

        {

          status: 404,

        }

      );

    }



    const { data: itemsData, error: itemsError } = await supabase

      .from("invoice_items")

      .select("*")

      .eq("invoice_id", invoiceId)

      .is("deleted_at", null)

      .order("sort_order", { ascending: true });



    if (itemsError) {

      return NextResponse.json(

        {

          error: "Failed to load invoice items.",

          details: itemsError.message,

        },

        {

          status: 500,

        }

      );

    }



    const invoice = invoiceData as Invoice;

    const invoiceItems = Array.isArray(itemsData)

      ? (itemsData as InvoiceItem[])

      : [];



    const docDefinition = buildDocumentDefinition(invoice, invoiceItems);

    const pdfBuffer = await createPdfBuffer(docDefinition);



    const fileName = `${safeFileName(getInvoiceNo(invoice))}.pdf`;



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

    console.error("Generate invoice PDF error:", error);



    return NextResponse.json(

      {

        error: "Failed to generate invoice PDF.",

        details: error?.message || String(error),

      },

      {

        status: 500,

      }

    );

  }

}

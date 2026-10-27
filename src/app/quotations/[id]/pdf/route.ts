import { NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";

import { createRequire } from "module";

import type {

  Content,

  TableCell,

  TDocumentDefinitions,

} from "pdfmake/interfaces";

import fs from "fs";

import path from "path";



const nodeRequire = createRequire(import.meta.url);

const PdfPrinter = nodeRequire("pdfmake");



export const runtime = "nodejs";

export const dynamic = "force-dynamic";



type AnyRecord = Record<string, any>;



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

  subtotal: number | null;

  discount_type: string | null;

  discount_value: number | null;

  discount_amount: number | null;

  total_amount: number | null;

  currency: string | null;

  notes: string | null;

  status: string | null;

};



type CustomerContact = {
  phone: string | null;
  fax: string | null;
  email: string | null;
};


// Historic quotations may have EMIT's contact fields stored under from_*.
// New quotation drafts use these fields as quotation-specific customer contact
// snapshots, without changing the customers master record.
function getContactValue(
  quotation: { from_tel?: string | null; from_fax?: string | null; from_email?: string | null },
  customer: { phone: string | null; fax: string | null; email: string | null } | null,
  field: "phone" | "fax" | "email"
): string {
  const saved = (field === "phone" ? quotation.from_tel
    : field === "fax" ? quotation.from_fax : quotation.from_email)?.trim();
  const legacy = field === "phone"
    ? ["+853 2875 1742", "(853) 2875 1742"]
    : field === "fax"
      ? ["+853 2852 0536", "(853) 2852 0536"]
      : ["am01@emit.com.mo"];
  if (saved && !legacy.includes(saved)) return saved;
  return customer?.[field]?.trim() || "-";
}

type QuotationItem = {

  id: string;

  quotation_id: string;

  test_item_id: string | null;

  sample_no: number | null;

  sample_name: string | null;

  test_category_name: string | null;

  item_no: number | null;

  description: string | null;

  quantity: number | null;

  unit: string | null;

  lab_price_rmb_snapshot: number | null;

  customer_unit_price_mop_snapshot: number | null;

  customer_total_price_mop_snapshot: number | null;

  sort_order: number | null;

  created_at?: string | null;

};



type GroupedQuotationItem = {

  itemNo: number;

  sampleName: string;

  items: QuotationItem[];

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



    if (value !== undefined && value !== null && value !== "") {

      const parsed = Number(value);



      if (!Number.isNaN(parsed)) {

        return parsed;

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



  return `${year} / ${month} / ${day}`;

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

    .replace(/[\/\\:*?"<>|]/g, "-")

    .replace(/\s+/g, "-")

    .trim();

}



function getQuotationNo(quotation: Quotation) {

  return textValue(

    quotation,

    ["quotation_no", "quotation_number", "quote_no", "document_number"],

    "EMIT-quotation"

  );

}



function getCurrency(quotation: Quotation) {

  return quotation.currency || "MOP";

}



// These helpers are only for the sender's contact line at the top of the PDF.
// The TEL/FAX/EMAIL fields in the details table use the selected customer.
function getCustomerContactText(
  customer: CustomerContact | null,
  field: keyof CustomerContact
): string {
  return customer?.[field]?.trim() || "-";
}

function getFromTel(quotation: Quotation) {

  return "+853 2875 1742";

}



function getFromFax(quotation: Quotation) {

  return "+853 2852 0536";

}



function getFromEmail(quotation: Quotation) {

  return "am01@emit.com.mo";

}



function getItemNo(item: QuotationItem, index: number) {

  return Number(item.sample_no || item.item_no || index + 1);

}



function getSampleName(item: QuotationItem, itemNo: number) {

  return item.sample_name || `Item ${itemNo}`;

}



function getDescriptionColumn(item: QuotationItem) {

  return item.test_category_name || "-";

}



function getTestingItemColumn(item: QuotationItem) {

  return item.description || "-";

}



function getUnitPrice(item: QuotationItem) {

  return Number(item.customer_unit_price_mop_snapshot || 0);

}



function getQuantity(item: QuotationItem) {

  const quantity = Number(item.quantity || 1);



  if (Number.isNaN(quantity) || quantity <= 0) {

    return 1;

  }



  return quantity;

}



function getLineTotal(item: QuotationItem) {

  const savedTotal = Number(item.customer_total_price_mop_snapshot || 0);



  if (!Number.isNaN(savedTotal) && savedTotal > 0) {

    return savedTotal;

  }



  return getUnitPrice(item) * getQuantity(item);

}



function getDiscountType(quotation: Quotation) {

  const discountType = String(

    quotation.discount_type || "none"

  ).toLowerCase();



  if (

    discountType === "percentage" ||

    discountType === "percent" ||

    discountType === "%"

  ) {

    return "percentage";

  }



  if (

    discountType === "fixed" ||

    discountType === "amount" ||

    discountType === "fixed_amount"

  ) {

    return "fixed";

  }



  return "none";

}



function getDiscountValue(quotation: Quotation) {

  const discountValue = Number(quotation.discount_value || 0);



  if (Number.isNaN(discountValue) || discountValue < 0) {

    return 0;

  }



  return discountValue;

}



function calculateDiscountAmount(

  quotation: Quotation,

  subtotalAmount: number

) {

  const savedDiscountAmount = Number(quotation.discount_amount);



  if (

    quotation.discount_amount !== null &&

    quotation.discount_amount !== undefined &&

    !Number.isNaN(savedDiscountAmount) &&

    savedDiscountAmount >= 0

  ) {

    return Math.min(savedDiscountAmount, subtotalAmount);

  }



  const discountType = getDiscountType(quotation);

  const discountValue = getDiscountValue(quotation);



  if (discountType === "percentage") {

    const percentage = Math.min(discountValue, 100);



    return Math.min(

      subtotalAmount,

      subtotalAmount * (percentage / 100)

    );

  }



  if (discountType === "fixed") {

    return Math.min(discountValue, subtotalAmount);

  }



  return 0;

}



function getDiscountLabel(quotation: Quotation) {

  const discountType = getDiscountType(quotation);

  const discountValue = getDiscountValue(quotation);



  if (discountType === "percentage" && discountValue > 0) {

    return `Discount 折扣 (${formatAmount(discountValue)}%)：`;

  }



  if (discountType === "fixed" && discountValue > 0) {

    return "Discount 折扣：";

  }



  return "Discount 折扣：";

}



function sortQuotationItems(items: QuotationItem[]) {

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



function groupQuotationItems(items: QuotationItem[]) {

  const groupMap = new Map<number, GroupedQuotationItem>();



  sortQuotationItems(items).forEach((item, index) => {

    const itemNo = getItemNo(item, index);

    const sampleName = getSampleName(item, itemNo);

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

    fontSize: 8.5,

    border: [false, false, false, false],

    margin: [0, 4, 0, 4],

  };

}



function makeValueCell(text: string): TableCell {

  return {

    text: text || "-",

    color: "#001334",

    fontSize: 8.5,

    border: [false, false, false, false],

    margin: [0, 4, 0, 4],

  };

}



function buildTopSection(quotation: Quotation): Content[] {

  const logoImage = imageDataUrl("public/images/emit-logo.png");



  return [

    {

      columns: [

        logoImage

          ? {

              image: logoImage,

              width: 170,

              alignment: "left",

            }

          : {

              text: "EMIT",

              fontSize: 20,

              bold: true,

              color: "#0084b8",

              alignment: "left",

            },

        {

          width: "\*",

          text: "",

        },

      ],

      margin: [0, 0, 0, 24],

    },

    {

      text: "QUOTATION",

      alignment: "center",

      bold: true,

      fontSize: 21,

      color: "#001334",

      margin: [0, 0, 0, 18],

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

      margin: [0, 0, 0, 18],

    },

    {

      stack: [

        {

          text: "澳門美副將大馬路萬基工業大廈 3樓A座",

          fontSize: 8.5,

          color: "#001334",

          margin: [0, 0, 0, 5],

        },

        {

          text: `TEL: ${getFromTel(quotation)}    FAX: ${getFromFax(

            quotation

          )}    E-MAIL: ${getFromEmail(quotation)}`,

          fontSize: 8.5,

          color: "#001334",

        },

      ],

      margin: [0, 0, 0, 24],

    },

  ];

}



function buildInfoSection(quotation: Quotation, customerContact: CustomerContact | null): Content {

  return {

    table: {

      widths: [50, 210, 50, "\*"],

      body: [

        [

          makeLabelCell("TO:"),

          makeValueCell(quotation.to_customer_name || "-"),

          makeLabelCell("FROM:"),

          makeValueCell(quotation.from_company_name || "EMIT"),

        ],

        [

          makeLabelCell("ATTN:"),

          makeValueCell(quotation.attention_to || "-"),

          makeLabelCell("TEL:"),

          makeValueCell(getContactValue(quotation, customerContact, "phone")),

        ],

        [

          makeLabelCell("DATE:"),

          makeValueCell(formatDateText(quotation.quotation_date)),

          makeLabelCell("FAX:"),

          makeValueCell(getContactValue(quotation, customerContact, "fax")),

        ],

        [

          makeLabelCell("NO.:"),

          makeValueCell(getQuotationNo(quotation)),

          makeLabelCell("EMAIL:"),

          makeValueCell(getContactValue(quotation, customerContact, "email")),

        ],

      ],

    },

    layout: "noBorders",

    margin: [0, 0, 0, 26],

  };

}



function buildProjectSection(quotation: Quotation): Content[] {

  return [

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

      margin: [0, 0, 0, 16],

    },

    {

      table: {

        widths: [78, "\*"],

        body: [

          [

            makeLabelCell("Project 項目"),

            makeValueCell(quotation.project_name || "-"),

          ],

          [

            makeLabelCell("檢測食品描述"),

            makeValueCell(quotation.project_description || "-"),

          ],

        ],

      },

      layout: "noBorders",

      margin: [0, 0, 0, 22],

    },

  ];

}



function getMergedCellTopMargin(rowCount: number, text: string) {

  const textLength = String(text || "").length;

  const baseMargin = (rowCount - 1) * 15 + 6;



  if (textLength >= 12) {

    return Math.max(8, baseMargin - 6);

  }



  return Math.max(8, baseMargin);

}



function getMergedCellFontSize(text: string) {

  const textLength = String(text || "").length;



  if (textLength >= 16) {

    return 6.8;

  }



  if (textLength >= 12) {

    return 7.1;

  }



  return 7.5;

}



function buildQuotationTable(

  quotation: Quotation,

  items: QuotationItem[]

): Content {

  const currency = getCurrency(quotation);

  const groupedItems = groupQuotationItems(items);



  const header: TableCell[] = [

    {

      text: "Item",

      bold: true,

      alignment: "center",

      color: "#001334",

      fillColor: "#f3f7fb",

      fontSize: 7.5,

      margin: [0, 7, 0, 7],

    },

    {

      text: "檢測食品描述",

      bold: true,

      alignment: "center",

      color: "#001334",

      fillColor: "#f3f7fb",

      fontSize: 7.5,

      margin: [0, 7, 0, 7],

    },

    {

      text: "Description 描述",

      bold: true,

      alignment: "center",

      color: "#001334",

      fillColor: "#f3f7fb",

      fontSize: 7.5,

      margin: [0, 7, 0, 7],

    },

    {

      text: "檢測項目",

      bold: true,

      alignment: "center",

      color: "#001334",

      fillColor: "#f3f7fb",

      fontSize: 7.5,

      margin: [0, 7, 0, 7],

    },

    {

      text: "Unit Price",

      bold: true,

      alignment: "center",

      color: "#001334",

      fillColor: "#f3f7fb",

      fontSize: 7.5,

      margin: [0, 7, 0, 7],

    },

    {

      text: "Qty",

      bold: true,

      alignment: "center",

      color: "#001334",

      fillColor: "#f3f7fb",

      fontSize: 7.5,

      margin: [0, 7, 0, 7],

    },

    {

      text: "Total",

      bold: true,

      alignment: "center",

      color: "#001334",

      fillColor: "#f3f7fb",

      fontSize: 7.5,

      margin: [0, 7, 0, 7],

    },

  ];



  const body: TableCell[][] = [header];



  if (groupedItems.length === 0) {

    body.push([

      {

        text: "No quotation items.",

        colSpan: 7,

        alignment: "center",

        color: "#64748b",

        fontSize: 8,

        margin: [0, 12, 0, 12],

      },

      {},

      {},

      {},

      {},

      {},

      {},

    ]);

  }



  groupedItems.forEach((group) => {

    group.items.forEach((item, itemIndex) => {

      const isFirstRow = itemIndex === 0;

      const isLastRow = itemIndex === group.items.length - 1;



      body.push([

        {

          text: isFirstRow ? String(group.itemNo) : "",

          alignment: "center",

          bold: isFirstRow,

          color: "#001334",

          fontSize: 7.5,

          margin: [0, 8, 0, 8],

          border: [true, isFirstRow, true, isLastRow],

        },

        {

          text: isFirstRow ? group.sampleName : "",

          alignment: "center",

          bold: isFirstRow,

          color: "#001334",

          fontSize: 7.5,

          margin: [2, 8, 2, 8],

          border: [true, isFirstRow, true, isLastRow],

        },

        {

          text: getDescriptionColumn(item),

          alignment: "center",

          color: "#001334",

          fontSize: 7.3,

          margin: [2, 8, 2, 8],

        },

        {

          text: getTestingItemColumn(item),

          alignment: "center",

          color: "#001334",

          fontSize: 7.3,

          margin: [2, 8, 2, 8],

        },

        {

          text: `${currency} ${formatAmount(getUnitPrice(item))}`,

          alignment: "center",

          color: "#001334",

          fontSize: 7.3,

          margin: [1, 8, 1, 8],

        },

        {

          text: formatAmount(getQuantity(item)),

          alignment: "center",

          color: "#001334",

          fontSize: 7.3,

          margin: [0, 8, 0, 8],

        },

        {

          text: formatAmount(getLineTotal(item)),

          alignment: "center",

          color: "#001334",

          fontSize: 7.3,

          margin: [1, 8, 1, 8],

        },

      ]);

    });

  });



  const calculatedSubtotal = items.reduce((sum, item) => {

    return sum + getLineTotal(item);

  }, 0);



  const savedSubtotal = Number(quotation.subtotal);



  const subtotalAmount =

    quotation.subtotal !== null &&

    quotation.subtotal !== undefined &&

    !Number.isNaN(savedSubtotal)

      ? savedSubtotal

      : calculatedSubtotal;



  const discountAmount = calculateDiscountAmount(

    quotation,

    subtotalAmount

  );



  const totalAmount = Math.max(

    0,

    subtotalAmount - discountAmount

  );



  body.push([

    {

      text: `Subtotal 小計(${currency})：`,

      colSpan: 6,

      alignment: "center",

      bold: true,

      color: "#001334",

      fillColor: "#f8fafc",

      fontSize: 8,

      margin: [0, 7, 0, 7],

    },

    {},

    {},

    {},

    {},

    {},

    {

      text: formatAmount(subtotalAmount),

      alignment: "center",

      bold: true,

      color: "#001334",

      fillColor: "#f8fafc",

      fontSize: 8,

      margin: [0, 7, 0, 7],

    },

  ]);



  body.push([

    {

      text: getDiscountLabel(quotation),

      colSpan: 6,

      alignment: "center",

      bold: true,

      color: "#001334",

      fillColor: "#f8fafc",

      fontSize: 8,

      margin: [0, 7, 0, 7],

    },

    {},

    {},

    {},

    {},

    {},

    {

      text:

        discountAmount > 0

          ? `-${formatAmount(discountAmount)}`

          : "0",

      alignment: "center",

      bold: true,

      color: "#001334",

      fillColor: "#f8fafc",

      fontSize: 8,

      margin: [0, 7, 0, 7],

    },

  ]);



  body.push([

    {

      text: `Total 應付總額(${currency})：`,

      colSpan: 6,

      alignment: "center",

      bold: true,

      color: "#001334",

      fillColor: "#eef5fb",

      fontSize: 8.3,

      margin: [0, 8, 0, 8],

    },

    {},

    {},

    {},

    {},

    {},

    {

      text: formatAmount(totalAmount),

      alignment: "center",

      bold: true,

      color: "#001334",

      fillColor: "#eef5fb",

      fontSize: 8.3,

      margin: [0, 8, 0, 8],

    },

  ]);



  return {

    table: {

      headerRows: 1,

      widths: [37, 95, 121, 86, 70, 42, 80],

      body,

      dontBreakRows: true,

      keepWithHeaderRows: 1,

    },

    layout: {

      hLineWidth: () => 0.55,

      vLineWidth: () => 0.55,

      hLineColor: () => "#b9c8da",

      vLineColor: () => "#b9c8da",

      paddingLeft: () => 2,

      paddingRight: () => 2,

      paddingTop: () => 0,

      paddingBottom: () => 0,

    },

    margin: [0, 0, 0, 24],

  };

}



function buildNotesSection(quotation: Quotation): Content {

  const noteLines = (quotation.notes || "")

    .split(/\r?\n/)

    .map((line) => line.trim())

    .filter(Boolean);



  return {

    table: {

      widths: ["\*"],

      body: [

        [

          {

            stack: [

              {

                text: "Notes:",

                bold: true,

                color: "#001334",

                fontSize: 9,

                margin: [0, 0, 0, 6],

              },

              noteLines.length > 0

                ? {

                    ol: noteLines.map((note) => ({

                      text: note,

                      color: "#334155",

                      fontSize: 8,

                      margin: [0, 1, 0, 1],

                    })),

                    margin: [10, 0, 0, 0],

                  }

                : {

                    text: "",

                    fontSize: 8,

                  },

            ],

            fillColor: "#f8fafc",

            margin: [10, 8, 10, 8],

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

    margin: [0, 0, 0, 22],

  };

}



function buildSignatureSection(quotation: Quotation): Content {

  const stampImage = imageDataUrl("public/images/emit-signature-stamp.png");



  return {

    unbreakable: true,

    stack: [

      {

        text: `Dear ${

          quotation.attention_to || "Client"

        }, this quotation has been developed based on information provided.`,

        color: "#334155",

        fontSize: 8.5,

        margin: [0, 0, 0, 10],

      },

      {

        text: "Acceptance of this quotation is required within 90 days from date of issue.",

        color: "#334155",

        fontSize: 8.5,

        margin: [0, 0, 0, 10],

      },

      {

        text: "Yours Sincerely,",

        color: "#334155",

        fontSize: 8.5,

        margin: [0, 0, 0, 14],

      },

      {

        columns: [

          {

            width: "\*",

            stack: [

              {

                text: "For and on behalf of",

                bold: true,

                color: "#001334",

                fontSize: 8.5,

                margin: [0, 0, 0, 3],

              },

              {

                text: "EMIT Environment Monitoring Inspection and Testing Co. Ltd.",

                bold: true,

                color: "#001334",

                fontSize: 8.5,

                margin: [0, 0, 0, 6],

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

                    margin: [0, 0, 0, 45],

                  },

              {

                text: "Company Chop and Authorized Signature",

                color: "#64748b",

                fontSize: 7.5,

              },

            ],

          },

          {

            width: 245,

            stack: [

              {

                text: "Name of Signatory:",

                bold: true,

                color: "#001334",

                fontSize: 8.5,

                margin: [0, 31, 0, 45],

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

                    lineColor: "#475569",

                  },

                ],

                margin: [0, 0, 0, 6],

              },

              {

                text: "Signature",

                color: "#64748b",

                fontSize: 7.5,

              },

            ],

          },

        ],

        columnGap: 28,

      },

    ],

    margin: [0, 0, 0, 0],

  };

}



function buildDocumentDefinition(
  quotation: Quotation,
  items: QuotationItem[],
  customerContact: CustomerContact | null
): TDocumentDefinitions {

  const quotationNo = getQuotationNo(quotation);



  const content: Content[] = [

    ...buildTopSection(quotation),

    buildInfoSection(quotation, customerContact),

    ...buildProjectSection(quotation),

    buildQuotationTable(quotation, items),

    buildNotesSection(quotation),

    buildSignatureSection(quotation),

  ];



  return {

    pageSize: "A4",

    pageMargins: [32, 28, 32, 42],

    defaultStyle: {

      font: "EMITFont",

      fontSize: 8.5,

      lineHeight: 1.18,

      color: "#001334",

    },

    footer(currentPage, pageCount) {

      return {

        columns: [

          {

            text: `Quotation No.: ${quotationNo}`,

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

    const quotationId = params.id;



    if (!quotationId) {

      return NextResponse.json(

        {

          error: "Missing quotation id.",

        },

        {

          status: 400,

        }

      );

    }



    const supabase = getSupabaseClient();



    const { data: quotationData, error: quotationError } = await supabase

      .from("quotations")

      .select("\*")

      .eq("id", quotationId)

      .is("deleted_at", null)

      .maybeSingle();



    if (quotationError) {

      return NextResponse.json(

        {

          error: "Failed to load quotation.",

          details: quotationError.message,

        },

        {

          status: 500,

        }

      );

    }



    if (!quotationData) {

      return NextResponse.json(

        {

          error: "Quotation not found.",

        },

        {

          status: 404,

        }

      );

    }



    // Resolve customer by the quotation's customer_id, not the sender's from_* fields.
    // Do not filter deleted_at: an archived client can still be referenced by an older quotation.
    let customerContact: CustomerContact | null = null;
    if (quotationData.customer_id) {
      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .select("phone,fax,email")
        .eq("id", quotationData.customer_id)
        .eq("company_id", quotationData.company_id)
        .maybeSingle();

      if (customerError) {
        return NextResponse.json(
          { error: "Failed to load quotation customer contact.", details: customerError.message },
          { status: 500 }
        );
      }
      customerContact = (customerData as CustomerContact | null) ?? null;
    }

    const { data: itemsData, error: itemsError } = await supabase

      .from("quotation_items")

      .select("\*")

      .eq("quotation_id", quotationId)

      .is("deleted_at", null)

      .order("sort_order", { ascending: true });



    if (itemsError) {

      return NextResponse.json(

        {

          error: "Failed to load quotation items.",

          details: itemsError.message,

        },

        {

          status: 500,

        }

      );

    }



    const quotation = quotationData as Quotation;

    const quotationItems = Array.isArray(itemsData)

      ? (itemsData as QuotationItem[])

      : [];



    const docDefinition = buildDocumentDefinition(
      quotation,
      quotationItems,
      customerContact
    );



    const pdfBuffer = await createPdfBuffer(docDefinition);



    const fileName = `${safeFileName(

      getQuotationNo(quotation)

    )}.pdf`;



    return new NextResponse(new Uint8Array(pdfBuffer), {

      status: 200,

      headers: {

        "Content-Type": "application/pdf",

        "Content-Disposition": `attachment; filename="${fileName}"; filename\*=UTF-8''${encodeURIComponent(

          fileName

        )}`,

        "Cache-Control": "no-store",

      },

    });

  } catch (error: any) {

    console.error("Generate quotation PDF error:", error);



    return NextResponse.json(

      {

        error: "Failed to generate quotation PDF.",

        details: error?.message || String(error),

      },

      {

        status: 500,

      }

    );

  }

}

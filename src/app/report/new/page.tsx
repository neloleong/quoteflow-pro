"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase/client";

const EMIT_COMPANY_ID = "11111111-1111-1111-1111-111111111111";

type AnyRecord = Record<string, unknown>;

type QuotationOption = {
  id: string;
  company_id: string | null;
  customer_id: string | null;
  quotation_no: string | null;
  quotation_date: string | null;
  customer_name: string | null;
  customer_address: string | null;
  project_name: string | null;
  project_description: string | null;
  status: string | null;
  created_at: string | null;
  client_id: string | null;
};

type ClientInfo = {
  id: string;
  name: string;
  address: string;
};

type TestItemInfo = {
  id: string;
  item_name: string;
  standard: string;
  unit: string;
};

type ReportItemInput = {
  sample_group_name: string;
  source_quotation_item_id: string | null;
  source_test_item_id: string | null;
  item_name: string;
  test_method: string;
  result_value: string;
  result_exponent: string;
  unit: string;
};

type ReportItemEditableField =
  | "sample_group_name"
  | "item_name"
  | "test_method"
  | "result_value"
  | "result_exponent"
  | "unit";

function getTodayDateText() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getReportPrefix(dateText: string) {
  const [year, month, day] = dateText.split("-");

  if (!year || !month || !day) {
    return "J";
  }

  return `J${year.slice(-2)}${month}${day}`;
}

function getNextSequentialReportNo(currentReportNo: string) {
  const match = currentReportNo.match(/^(.*?)(\d+)$/);

  if (!match) {
    return `${currentReportNo}-001`;
  }

  const prefix = match[1];
  const numberText = match[2];
  const nextNumber = Number(numberText) + 1;

  return `${prefix}${String(nextNumber).padStart(numberText.length, "0")}`;
}

function splitFoodSamples(descriptionText: string) {
  const samples = descriptionText
    .split(/[\n\r、，,；;]+/g)
    .map((item) => item.trim())
    .filter(Boolean);

  return Array.from(new Set(samples));
}

function normalizeReportText(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

function dedupeTextList(items: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  items.forEach((item) => {
    const trimmedItem = item.trim();
    const key = normalizeReportText(trimmedItem);

    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(trimmedItem);
  });

  return result;
}

function getReportItemUniqueKey(item: ReportItemInput) {
  const sourceTestItemId = normalizeReportText(item.source_test_item_id);

  if (sourceTestItemId) {
    return `source-test-item:${sourceTestItemId}`;
  }

  const itemName = normalizeReportText(item.item_name);
  const testMethod = normalizeReportText(item.test_method);

  if (!itemName && !testMethod) {
    return "";
  }

  return `item-method:${itemName}|${testMethod}`;
}

function dedupeReportItemsByTestItem<T extends ReportItemInput>(
  reportItems: T[]
) {
  const uniqueMap = new Map<string, T>();
  const passthroughItems: T[] = [];

  reportItems.forEach((item) => {
    const uniqueKey = getReportItemUniqueKey(item);

    if (!uniqueKey) {
      passthroughItems.push(item);
      return;
    }

    const existingItem = uniqueMap.get(uniqueKey);

    if (!existingItem) {
      uniqueMap.set(uniqueKey, item);
      return;
    }

    uniqueMap.set(uniqueKey, {
      ...existingItem,
      sample_group_name:
        existingItem.sample_group_name || item.sample_group_name,
      source_quotation_item_id:
        existingItem.source_quotation_item_id ||
        item.source_quotation_item_id,
      source_test_item_id:
        existingItem.source_test_item_id || item.source_test_item_id,
      item_name: existingItem.item_name || item.item_name,
      test_method: existingItem.test_method || item.test_method,
      result_value: existingItem.result_value || item.result_value,
      result_exponent: existingItem.result_exponent || item.result_exponent,
      unit: existingItem.unit || item.unit,
    });
  });

  return [...uniqueMap.values(), ...passthroughItems];
}

function dedupeReportItemsBySampleAndTest<T extends ReportItemInput>(
  reportItems: T[]
) {
  const uniqueMap = new Map<string, T>();
  const passthroughItems: T[] = [];

  reportItems.forEach((item) => {
    const sampleGroupKey = normalizeReportText(item.sample_group_name);
    const testItemKey = getReportItemUniqueKey(item);

    if (!sampleGroupKey || !testItemKey) {
      passthroughItems.push(item);
      return;
    }

    const uniqueKey = `${sampleGroupKey}::${testItemKey}`;
    const existingItem = uniqueMap.get(uniqueKey);

    if (!existingItem) {
      uniqueMap.set(uniqueKey, item);
      return;
    }

    uniqueMap.set(uniqueKey, {
      ...existingItem,
      sample_group_name:
        existingItem.sample_group_name || item.sample_group_name,
      source_quotation_item_id:
        existingItem.source_quotation_item_id ||
        item.source_quotation_item_id,
      source_test_item_id:
        existingItem.source_test_item_id || item.source_test_item_id,
      item_name: existingItem.item_name || item.item_name,
      test_method: existingItem.test_method || item.test_method,
      result_value: existingItem.result_value || item.result_value,
      result_exponent: existingItem.result_exponent || item.result_exponent,
      unit: existingItem.unit || item.unit,
    });
  });

  return [...uniqueMap.values(), ...passthroughItems];
}

function getUniqueReportItemNameText(reportItems: ReportItemInput[]) {
  return dedupeTextList(
    reportItems.map((item) => item.item_name).filter(Boolean)
  ).join("、");
}

function isDuplicateKeyError(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const errorObject = error as {
    code?: string;
    message?: string;
    details?: string;
  };

  return (
    errorObject.code === "23505" ||
    errorObject.message?.includes("duplicate key") ||
    errorObject.details?.includes("already exists")
  );
}

function pickString(record: AnyRecord | null | undefined, keys: string[]) {
  if (!record) {
    return "";
  }

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number") {
      return String(value);
    }
  }

  return "";
}

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

function formatCreatedDateText(createdAt: string | null) {
  if (!createdAt) {
    return "-";
  }

  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return createdAt;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year} / ${month} / ${day}`;
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

function getClientIdFromQuotation(record: AnyRecord) {
  return (
    pickString(record, [
      "client_id",
      "customer_id",
      "company_id",
      "customer_company_id",
    ]) || null
  );
}

function getCustomerIdFromQuotation(record: AnyRecord) {
  return (
    pickString(record, [
      "customer_id",
      "client_id",
      "customer_company_id",
    ]) || null
  );
}

function mapClientRecord(record: AnyRecord): ClientInfo | null {
  const id = pickString(record, ["id"]);

  if (!id) {
    return null;
  }

  const name = pickString(record, [
    "company_name",
    "name",
    "client_name",
    "customer_name",
    "display_name",
    "contact_person",
    "contact_name",
  ]);

  const address = pickString(record, [
    "address",
    "company_address",
    "client_address",
    "customer_address",
    "billing_address",
  ]);

  return {
    id,
    name,
    address,
  };
}

function mapTestItemRecord(record: AnyRecord): TestItemInfo | null {
  const id = pickString(record, ["id"]);

  if (!id) {
    return null;
  }

  return {
    id,
    item_name: pickString(record, [
      "item_name",
      "test_item_name",
      "test_item",
      "testing_item_name",
      "test_name",
      "name",
      "name_tc",
      "name_zh",
      "zh_name",
      "chinese_name",
      "display_name",
      "description",
      "檢測項目",
      "檢測名稱",
      "項目名稱",
      "item_name_zh",
    ]),
    standard: pickString(record, [
      "standard",
      "test_standard",
      "method",
      "test_method",
      "testing_method",
      "檢測方法",
      "標準",
    ]),
    unit: pickString(record, [
      "result_unit",
      "unit",
      "testing_unit",
      "檢測單位",
      "單位",
    ]),
  };
}

function getQuotationDirectCustomerName(record: AnyRecord) {
  return pickString(record, [
    "to_customer_name",
    "customer_name",
    "client_name",
    "company_name",
    "to_name",
    "customer",
    "client",
  ]);
}

function getQuotationDirectCustomerAddress(record: AnyRecord) {
  return pickString(record, [
    "to_customer_address",
    "customer_address",
    "client_address",
    "company_address",
    "address",
  ]);
}

function getQuotationNo(record: AnyRecord) {
  return pickString(record, ["quotation_no", "quote_no", "no"]);
}

function getQuotationDate(record: AnyRecord) {
  return pickString(record, ["quotation_date", "quote_date", "date"]);
}

function getQuotationProjectName(record: AnyRecord) {
  return pickString(record, ["project_name", "project", "project_title"]);
}

function getQuotationProjectDescription(record: AnyRecord) {
  return pickString(record, [
    "project_description",
    "sample_description",
    "food_description",
    "description",
    "item_description",
  ]);
}

function getQuotationItemSampleGroupName(record: AnyRecord) {
  return pickString(record, [
    "sample_group_name",
    "sample_name",
    "sample_description",
    "food_description",
    "food_name",
    "product_name",
    "inspection_food_description",
    "testing_food_description",
    "item_food_description",
    "food_item_description",
    "檢測食品描述",
    "食品描述",
    "樣品描述",
    "食品名稱",
  ]);
}

function getQuotationItemTestItemName(
  record: AnyRecord,
  testItemInfo: TestItemInfo | null | undefined
) {
  return (
    testItemInfo?.item_name ||
    pickString(record, [
      "test_item_name",
      "test_item",
      "testing_item_name",
      "testing_item",
      "test_name",
      "name",
      "name_tc",
      "name_zh",
      "display_name",
      "description",
      "test_item_description",
      "test_description",
      "檢測項目",
      "檢測名稱",
      "項目名稱",
    ])
  );
}

function getSampleReportPreviewNames(
  reportItems: ReportItemInput[],
  fallbackText: string
) {
  const itemGroupNames = reportItems
    .map((item) => item.sample_group_name.trim())
    .filter(Boolean);

  if (itemGroupNames.length > 0) {
    return Array.from(new Set(itemGroupNames));
  }

  return splitFoodSamples(fallbackText);
}

function getQuotationOptionLabel(quotation: QuotationOption) {
  const quotationNo = quotation.quotation_no || "No Quotation No.";
  const customerName = quotation.customer_name || "未填食品廠";
  const createdDate = formatCreatedDateText(quotation.created_at);
  const foodItem =
    quotation.project_description || quotation.project_name || "未填食品項目";

  return `${quotationNo}｜食品廠：${customerName}｜新增日期：${createdDate}｜${foodItem}`;
}

export default function NewReportPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const today = useMemo(() => getTodayDateText(), []);

  const [hasMounted, setHasMounted] = useState(false);
  const [loadingQuotations, setLoadingQuotations] = useState(false);
  const [loadingQuotationDetail, setLoadingQuotationDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingNo, setGeneratingNo] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [quotations, setQuotations] = useState<QuotationOption[]>([]);
  const [selectedQuotationId, setSelectedQuotationId] = useState("");
  const [selectedQuotationNo, setSelectedQuotationNo] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(
    null
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null
  );
  const [selectedQuotationCreatedAt, setSelectedQuotationCreatedAt] =
    useState<string | null>(null);

  const [reportNo, setReportNo] = useState("");
  const [reportDate, setReportDate] = useState(today);
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [sampleName, setSampleName] = useState("");
  const [sampleDescription, setSampleDescription] = useState("");
  const [receivedDate, setReceivedDate] = useState(today);
  const [testStartDate, setTestStartDate] = useState(today);
  const [testEndDate, setTestEndDate] = useState(today);
  const [testItemsSummary, setTestItemsSummary] = useState("");
  const [remarks, setRemarks] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [reviewedBy, setReviewedBy] = useState("");
  const [authorizedSignatory, setAuthorizedSignatory] = useState("");
  const [status, setStatus] = useState("draft");

  const [items, setItems] = useState<ReportItemInput[]>([
    {
      sample_group_name: "",
      source_quotation_item_id: null,
      source_test_item_id: null,
      item_name: "",
      test_method: "",
      result_value: "",
      result_exponent: "",
      unit: "",
    },
  ]);

  const sampleReportsPreview = useMemo(() => {
    const sourceText = sampleDescription.trim() || sampleName.trim();

    if (!sourceText && items.every((item) => !item.sample_group_name.trim())) {
      return [];
    }

    return getSampleReportPreviewNames(items, sourceText);
  }, [items, sampleDescription, sampleName]);

  const groupedPreview = useMemo(() => {
    const groupMap = new Map<string, ReportItemInput[]>();

    items.forEach((item) => {
      const groupName = item.sample_group_name.trim();

      if (!groupName) {
        return;
      }

      const currentItems = groupMap.get(groupName) ?? [];
      currentItems.push(item);
      groupMap.set(groupName, currentItems);
    });

    return Array.from(groupMap.entries()).map(([groupName, groupItems]) => ({
      groupName,
      groupItems: dedupeReportItemsByTestItem(groupItems),
    }));
  }, [items]);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!hasMounted) {
      return;
    }

    loadQuotations();
    generateReportNo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMounted]);

  async function loadClientMap(clientIds: string[]) {
    const uniqueClientIds = Array.from(new Set(clientIds.filter(Boolean)));

    if (uniqueClientIds.length === 0) {
      return new Map<string, ClientInfo>();
    }

    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .in("id", uniqueClientIds);

    if (error) {
      console.warn("Load clients for quotations warning:", error);
      return new Map<string, ClientInfo>();
    }

    const clientMap = new Map<string, ClientInfo>();

    (data ?? []).forEach((client) => {
      const clientInfo = mapClientRecord(client as AnyRecord);

      if (clientInfo) {
        clientMap.set(clientInfo.id, clientInfo);
      }
    });

    return clientMap;
  }

  async function loadSingleClient(clientId: string | null) {
    if (!clientId) {
      return null;
    }

    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .maybeSingle();

    if (error) {
      console.warn("Load single client warning:", error);
      return null;
    }

    if (!data) {
      return null;
    }

    return mapClientRecord(data as AnyRecord);
  }

  async function loadQuotations() {
    try {
      setLoadingQuotations(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("quotations")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      const quotationRecords = (data ?? []) as AnyRecord[];

      const clientIds = quotationRecords
        .map((record) => getClientIdFromQuotation(record))
        .filter((clientId): clientId is string => Boolean(clientId));

      const clientMap = await loadClientMap(clientIds);

      const mappedQuotations = quotationRecords.map((record) => {
        const id = pickString(record, ["id"]);
        const clientId = getClientIdFromQuotation(record);
        const clientInfo = clientId ? clientMap.get(clientId) : null;

        const directCustomerName = getQuotationDirectCustomerName(record);
        const directCustomerAddress = getQuotationDirectCustomerAddress(record);

        return {
          id,
          company_id: pickString(record, ["company_id"]) || EMIT_COMPANY_ID,
          customer_id: getCustomerIdFromQuotation(record),
          quotation_no: getQuotationNo(record) || null,
          quotation_date: getQuotationDate(record) || null,
          customer_name: directCustomerName || clientInfo?.name || null,
          customer_address: directCustomerAddress || clientInfo?.address || null,
          project_name: getQuotationProjectName(record) || null,
          project_description: getQuotationProjectDescription(record) || null,
          status: pickString(record, ["status"]) || null,
          created_at: pickString(record, ["created_at"]) || null,
          client_id: clientId,
        };
      });

      setQuotations(mappedQuotations.filter((quotation) => quotation.id));
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Failed to load quotations."));
    } finally {
      setLoadingQuotations(false);
    }
  }

  async function reportNoExists(targetReportNo: string) {
    const { data, error } = await supabase
      .from("reports")
      .select("id,report_no")
      .eq("report_no", targetReportNo)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return Boolean(data);
  }

  async function getNextAvailableReportNo(baseDate: string) {
    const prefix = getReportPrefix(baseDate);

    const { data, error } = await supabase
      .from("reports")
      .select("report_no")
      .like("report_no", `${prefix}%`)
      .order("report_no", { ascending: false })
      .limit(1);

    if (error) {
      throw error;
    }

    const latestReportNo = data?.[0]?.report_no as string | undefined;
    let nextNumber = 1;

    if (latestReportNo) {
      const latestSequenceText = latestReportNo.replace(prefix, "");
      const latestSequenceNumber = Number(latestSequenceText);

      if (!Number.isNaN(latestSequenceNumber)) {
        nextNumber = latestSequenceNumber + 1;
      }
    }

    return `${prefix}${String(nextNumber).padStart(3, "0")}`;
  }

  async function getAvailableSequentialReportNos(
    preferredFirstReportNo: string,
    reportCount: number,
    baseDate: string
  ) {
    const reportNos: string[] = [];
    let candidateReportNo =
      preferredFirstReportNo || (await getNextAvailableReportNo(baseDate));

    while (reportNos.length < reportCount) {
      const existsInCurrentBatch = reportNos.includes(candidateReportNo);
      const existsInDatabase = await reportNoExists(candidateReportNo);

      if (!existsInCurrentBatch && !existsInDatabase) {
        reportNos.push(candidateReportNo);
      }

      candidateReportNo = getNextSequentialReportNo(candidateReportNo);
    }

    return reportNos;
  }

  async function generateReportNo() {
    try {
      setGeneratingNo(true);
      setErrorMessage("");

      const baseDate = receivedDate || reportDate || today;
      const nextReportNo = await getNextAvailableReportNo(baseDate);

      setReportNo(nextReportNo);
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Failed to generate report no."));
    } finally {
      setGeneratingNo(false);
    }
  }

  async function loadQuotationIntoReport(quotationId: string) {
    if (!quotationId) {
      setSelectedQuotationId("");
      setSelectedQuotationNo("");
      setSelectedCompanyId(null);
      setSelectedCustomerId(null);
      setSelectedQuotationCreatedAt(null);
      return;
    }

    try {
      setLoadingQuotationDetail(true);
      setErrorMessage("");
      setSelectedQuotationId(quotationId);

      const { data: quotationData, error: quotationError } = await supabase
        .from("quotations")
        .select("*")
        .eq("id", quotationId)
        .single();

      if (quotationError) {
        throw quotationError;
      }

      const quotationRecord = quotationData as AnyRecord;

      const quotationNo = getQuotationNo(quotationRecord);
      const quotationDate = getQuotationDate(quotationRecord);
      const quotationCreatedAt = pickString(quotationRecord, ["created_at"]);
      const quotationCompanyId =
        pickString(quotationRecord, ["company_id"]) || EMIT_COMPANY_ID;
      const quotationCustomerId = getCustomerIdFromQuotation(quotationRecord);
      const clientId = getClientIdFromQuotation(quotationRecord);

      const clientInfo = await loadSingleClient(clientId);

      const loadedCustomerName =
        getQuotationDirectCustomerName(quotationRecord) ||
        clientInfo?.name ||
        "";

      const loadedCustomerAddress =
        getQuotationDirectCustomerAddress(quotationRecord) ||
        clientInfo?.address ||
        "";

      const loadedProjectName = getQuotationProjectName(quotationRecord);
      const loadedProjectDescription =
        getQuotationProjectDescription(quotationRecord);

      setSelectedQuotationNo(quotationNo);
      setSelectedCompanyId(quotationCompanyId);
      setSelectedCustomerId(quotationCustomerId);
      setSelectedQuotationCreatedAt(quotationCreatedAt || null);
      setCustomerName(loadedCustomerName);
      setCustomerAddress(loadedCustomerAddress);

      if (loadedProjectDescription) {
        setSampleName(loadedProjectDescription);
        setSampleDescription(loadedProjectDescription);
      } else if (loadedProjectName) {
        setSampleName(loadedProjectName);
        setSampleDescription(loadedProjectName);
      }

      if (quotationDate) {
        setReceivedDate(quotationDate);
        setTestStartDate(quotationDate);
        setTestEndDate(quotationDate);
      }

      const { data: quotationItemsData, error: quotationItemsError } =
        await supabase
          .from("quotation_items")
          .select("*")
          .eq("quotation_id", quotationId);

      if (quotationItemsError) {
        throw quotationItemsError;
      }

      const sortedQuotationItems = [...(quotationItemsData ?? [])].sort(
        (a, b) => {
          const recordA = a as AnyRecord;
          const recordB = b as AnyRecord;

          const sortA = Number(
            recordA.sort_order ?? recordA.item_order ?? recordA.order_no ?? 0
          );
          const sortB = Number(
            recordB.sort_order ?? recordB.item_order ?? recordB.order_no ?? 0
          );

          return sortA - sortB;
        }
      );

      const testItemIds = sortedQuotationItems
        .map((quotationItem) => {
          const record = quotationItem as AnyRecord;

          return pickString(record, [
            "test_item_id",
            "source_test_item_id",
            "item_id",
          ]);
        })
        .filter(Boolean);

      const testItemMap = new Map<string, TestItemInfo>();

      if (testItemIds.length > 0) {
        const uniqueTestItemIds = Array.from(new Set(testItemIds));

        const { data: testItemsData, error: testItemsError } = await supabase
          .from("test_items")
          .select("*")
          .in("id", uniqueTestItemIds);

        if (testItemsError) {
          throw testItemsError;
        }

        (testItemsData ?? []).forEach((testItem) => {
          const testItemInfo = mapTestItemRecord(testItem as AnyRecord);

          if (testItemInfo) {
            testItemMap.set(testItemInfo.id, testItemInfo);
          }
        });
      }

      const fallbackSamples = splitFoodSamples(
        loadedProjectDescription || loadedProjectName || ""
      );

      const mappedItems = sortedQuotationItems
        .map((quotationItem, quotationItemIndex) => {
          const record = quotationItem as AnyRecord;

          const testItemId =
            pickString(record, [
              "test_item_id",
              "source_test_item_id",
              "item_id",
            ]) || null;

          const testItemInfo = testItemId ? testItemMap.get(testItemId) : null;

          const fallbackSampleName =
            fallbackSamples[quotationItemIndex] ||
            loadedProjectDescription ||
            loadedProjectName ||
            "";

          const sampleGroupName =
            getQuotationItemSampleGroupName(record) || fallbackSampleName;

          const itemName =
            getQuotationItemTestItemName(record, testItemInfo) ||
            testItemInfo?.item_name ||
            "";

          const testMethod =
            testItemInfo?.standard ||
            pickString(record, [
              "standard",
              "test_standard",
              "method",
              "test_method",
            ]);

          const unit =
            pickString(record, ["unit", "result_unit"]) ||
            testItemInfo?.unit ||
            "";

          return {
            sample_group_name: sampleGroupName,
            source_quotation_item_id: pickString(record, ["id"]) || null,
            source_test_item_id: testItemId,
            item_name: itemName,
            test_method: testMethod,
            result_value: "",
            result_exponent: "",
            unit,
          };
        })
        .filter(
          (item) =>
            item.sample_group_name || item.item_name || item.test_method
        );

      const dedupedMappedItems = dedupeReportItemsBySampleAndTest(mappedItems);

      if (dedupedMappedItems.length > 0) {
        setItems(dedupedMappedItems);

        const summaryText = getUniqueReportItemNameText(dedupedMappedItems);

        setTestItemsSummary(summaryText);
      } else {
        setItems([
          {
            sample_group_name: "",
            source_quotation_item_id: null,
            source_test_item_id: null,
            item_name: "",
            test_method: "",
            result_value: "",
            result_exponent: "",
            unit: "",
          },
        ]);
        setTestItemsSummary("");
      }
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error, "Failed to load quotation detail.")
      );
    } finally {
      setLoadingQuotationDetail(false);
    }
  }

  function updateItem(
    index: number,
    field: ReportItemEditableField,
    value: string
  ) {
    setItems((currentItems) =>
      currentItems.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        return {
          ...item,
          [field]: value,
        };
      })
    );
  }

  function addItem() {
    setItems((currentItems) => [
      ...currentItems,
      {
        sample_group_name: "",
        source_quotation_item_id: null,
        source_test_item_id: null,
        item_name: "",
        test_method: "",
        result_value: "",
        result_exponent: "",
        unit: "",
      },
    ]);
  }

  function removeItem(index: number) {
    setItems((currentItems) => {
      if (currentItems.length <= 1) {
        return currentItems;
      }

      return currentItems.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  async function saveReport() {
    try {
      setSaving(true);
      setErrorMessage("");

      const cleanedReportNo = reportNo.trim();
      const cleanedCustomerName = customerName.trim();
      const cleanedSampleName = sampleName.trim();
      const cleanedSampleDescription = sampleDescription.trim();

      if (!selectedQuotationId) {
        throw new Error("Please select a quotation first.");
      }

      if (!selectedCustomerId) {
        throw new Error(
          "Selected quotation has no customer_id. Please check this quotation customer record."
        );
      }

      if (!cleanedReportNo) {
        throw new Error("Please enter or generate Report No.");
      }

      if (!cleanedCustomerName) {
        throw new Error("Please enter customer name.");
      }

      if (!cleanedSampleName) {
        throw new Error("Please enter sample name.");
      }

      const validItems = items
        .map((item) => ({
          sample_group_name: item.sample_group_name.trim(),
          source_quotation_item_id: item.source_quotation_item_id,
          source_test_item_id: item.source_test_item_id,
          item_name: item.item_name.trim(),
          test_method: item.test_method.trim(),
          result_value: item.result_value.trim(),
          result_exponent: item.result_exponent.trim(),
          unit: item.unit.trim(),
        }))
        .filter(
          (item) =>
            item.item_name ||
            item.test_method ||
            item.result_value ||
            item.result_exponent ||
            item.unit
        );

      if (validItems.length === 0) {
        throw new Error("Please add at least one test result item.");
      }

      const sampleSourceText =
        cleanedSampleDescription || cleanedSampleName || "";

      const hasItemGroupNames = validItems.some((item) =>
        item.sample_group_name.trim()
      );

      const reportGroups = hasItemGroupNames
        ? Array.from(
            validItems.reduce((groupMap, item) => {
              const sampleGroupName =
                item.sample_group_name ||
                cleanedSampleName ||
                cleanedSampleDescription ||
                "未命名樣品";

              const groupItems = groupMap.get(sampleGroupName) ?? [];
              groupItems.push(item);
              groupMap.set(sampleGroupName, groupItems);

              return groupMap;
            }, new Map<string, typeof validItems>())
          )
            .map(([sampleGroupName, groupItems]) => ({
              sampleGroupName,
              groupItems: dedupeReportItemsByTestItem(groupItems),
            }))
            .filter((group) => group.groupItems.length > 0)
        : splitFoodSamples(sampleSourceText)
            .map((sampleGroupName) => ({
              sampleGroupName,
              groupItems: dedupeReportItemsByTestItem(validItems),
            }))
            .filter((group) => group.groupItems.length > 0);

      if (reportGroups.length === 0) {
        throw new Error("Please enter at least one sample description.");
      }

      const baseDate = reportDate || receivedDate || today;

      const availableReportNos = await getAvailableSequentialReportNos(
        cleanedReportNo,
        reportGroups.length,
        baseDate
      );

      if (availableReportNos.length > 0) {
        setReportNo(availableReportNos[0]);
      }

      const insertedReportIds: string[] = [];

      for (
        let sampleIndex = 0;
        sampleIndex < reportGroups.length;
        sampleIndex += 1
      ) {
        const currentReportGroup = reportGroups[sampleIndex];
        const currentSampleName = currentReportGroup.sampleGroupName;
        const currentReportItems = currentReportGroup.groupItems;
        const currentReportNo = availableReportNos[sampleIndex];

        const currentTestItemsSummary = getUniqueReportItemNameText(
          currentReportItems
        );

        const reportPayload = {
          company_id: selectedCompanyId || EMIT_COMPANY_ID,
          customer_id: selectedCustomerId,
          source_quotation_id: selectedQuotationId,
          source_quotation_no: selectedQuotationNo || null,
          report_no: currentReportNo,
          report_date: reportDate || null,
          customer_name: cleanedCustomerName,
          customer_address: customerAddress.trim() || null,
          sample_name: currentSampleName,
          sample_description: currentSampleName,
          received_date: receivedDate || null,
          test_start_date: testStartDate || null,
          test_end_date: testEndDate || null,
          test_items_summary:
            currentTestItemsSummary || testItemsSummary.trim() || null,
          remarks: remarks.trim() || null,
          prepared_by: preparedBy.trim() || null,
          reviewed_by: reviewedBy.trim() || null,
          authorized_signatory: authorizedSignatory.trim() || null,
          status,
          updated_at: new Date().toISOString(),
        };

        const { data: insertedReport, error: reportError } = await supabase
          .from("reports")
          .insert(reportPayload)
          .select("id")
          .single();

        if (reportError) {
          if (isDuplicateKeyError(reportError)) {
            throw new Error(
              `Report No. already exists during save: ${currentReportNo}. Please click Generate and save again.`
            );
          }

          throw reportError;
        }

        if (!insertedReport?.id) {
          throw new Error("Report was created but no report id was returned.");
        }

        insertedReportIds.push(insertedReport.id);

        const reportItemsPayload = currentReportItems.map((item, index) => ({
          report_id: insertedReport.id,
          source_quotation_item_id: item.source_quotation_item_id,
          source_test_item_id: item.source_test_item_id,
          item_name: item.item_name || null,
          test_method: item.test_method || null,
          result_value: item.result_value || null,
          result_exponent: item.result_exponent || null,
          unit: item.unit || null,
          sort_order: index + 1,
        }));

        const { error: itemsError } = await supabase
          .from("report_items")
          .insert(reportItemsPayload);

        if (itemsError) {
          throw itemsError;
        }
      }

      if (insertedReportIds.length === 1) {
        router.push(`/report/${insertedReportIds[0]}`);
        return;
      }

      router.push("/report");
    } catch (error) {
      setErrorMessage(getErrorMessage(error, "Failed to save report."));
    } finally {
      setSaving(false);
    }
  }

  if (!hasMounted) {
    return (
      <AppShell>
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm text-slate-500">Loading new report form...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">New Report</h1>
            <p className="mt-2 text-slate-500">
              Select an existing quotation, import testing items, then enter
              testing results.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => router.push("/report")}
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Back
            </button>

            <button
              onClick={saveReport}
              disabled={saving || loadingQuotationDetail}
              className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? "Saving..."
                : sampleReportsPreview.length > 1
                  ? `Save ${sampleReportsPreview.length} Reports`
                  : "Save Report"}
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-5 text-lg font-bold text-slate-900">
                Source Quotation
              </h2>

              <div className="grid gap-4 lg:grid-cols-[1fr_160px]">
                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Select Quotation
                  </label>
                  <select
                    value={selectedQuotationId}
                    onChange={(event) =>
                      loadQuotationIntoReport(event.target.value)
                    }
                    disabled={loadingQuotations || loadingQuotationDetail}
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">
                      {loadingQuotations
                        ? "Loading quotations..."
                        : "Please select quotation"}
                    </option>

                    {quotations.map((quotation) => (
                      <option key={quotation.id} value={quotation.id}>
                        {getQuotationOptionLabel(quotation)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={loadQuotations}
                    disabled={loadingQuotations}
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loadingQuotations ? "Loading..." : "Refresh"}
                  </button>
                </div>
              </div>

              {selectedQuotationId && (
                <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                  <p>
                    Selected quotation:{" "}
                    <span className="font-semibold text-slate-900">
                      {selectedQuotationNo || selectedQuotationId}
                    </span>
                  </p>

                  <p className="mt-1">
                    食品廠：{" "}
                    <span className="font-semibold text-slate-900">
                      {customerName || "未填食品廠"}
                    </span>
                  </p>

                  <p className="mt-1">
                    新增日期：{" "}
                    <span className="font-semibold text-slate-900">
                      {formatCreatedDateText(selectedQuotationCreatedAt)}
                    </span>
                  </p>

                  {loadingQuotationDetail && (
                    <p className="mt-2 text-slate-500">
                      Loading quotation items...
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-5 text-lg font-bold text-slate-900">
                Report Information
              </h2>

              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-700">
                    First Report No.
                  </label>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={reportNo}
                      onChange={(event) => setReportNo(event.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                    />
                    <button
                      type="button"
                      onClick={generateReportNo}
                      disabled={generatingNo}
                      className="whitespace-nowrap rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {generatingNo ? "..." : "Generate"}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    如有多個食品樣品，系統會自動順延報告編號。
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Report Date
                  </label>
                  <input
                    type="date"
                    value={reportDate}
                    onChange={(event) => setReportDate(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Customer / 委託單位
                  </label>
                  <input
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Sample Name / 樣品名稱
                  </label>
                  <input
                    value={sampleName}
                    onChange={(event) => setSampleName(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="text-sm font-medium text-slate-700">
                    Customer Address / 地址
                  </label>
                  <input
                    value={customerAddress}
                    onChange={(event) =>
                      setCustomerAddress(event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="text-sm font-medium text-slate-700">
                    Sample Description / 樣品描述
                  </label>
                  <input
                    value={sampleDescription}
                    onChange={(event) =>
                      setSampleDescription(event.target.value)
                    }
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                  />

                  {sampleReportsPreview.length > 0 && (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                      <p className="font-semibold">
                        系統將生成 {sampleReportsPreview.length} 份獨立報告：
                      </p>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {sampleReportsPreview.map((sample, index) => (
                          <span
                            key={`${sample}-${index}`}
                            className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200"
                          >
                            {index + 1}. {sample}
                          </span>
                        ))}
                      </div>

                      {groupedPreview.length > 0 && (
                        <div className="mt-4 space-y-2">
                          {groupedPreview.map((group) => (
                            <div
                              key={group.groupName}
                              className="rounded-lg bg-white p-3 text-xs ring-1 ring-amber-200"
                            >
                              <p className="font-bold">{group.groupName}</p>
                              <p className="mt-1">
                                檢測項目：
                                {getUniqueReportItemNameText(
                                  group.groupItems
                                ) || "-"}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Received Date / 收樣日期
                  </label>
                  <input
                    type="date"
                    value={receivedDate}
                    onChange={(event) => setReceivedDate(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                  />
                </div>

                <div>
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

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Test Start Date / 檢測開始日期
                  </label>
                  <input
                    type="date"
                    value={testStartDate}
                    onChange={(event) => setTestStartDate(event.target.value)}
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
                    onChange={(event) => setTestEndDate(event.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="text-sm font-medium text-slate-700">
                    Test Items Summary / 檢測項目
                  </label>
                  <textarea
                    value={testItemsSummary}
                    onChange={(event) =>
                      setTestItemsSummary(event.target.value)
                    }
                    rows={3}
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="text-sm font-medium text-slate-700">
                    Remarks / 備註
                  </label>
                  <textarea
                    value={remarks}
                    onChange={(event) => setRemarks(event.target.value)}
                    rows={3}
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Imported Test Result Items
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Items are imported from the selected quotation. The test
                    method is loaded from test_items.standard.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addItem}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                >
                  Add Item
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1180px] border-collapse text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="w-[60px] border border-slate-200 px-3 py-3 text-center font-semibold text-slate-700">
                        #
                      </th>
                      <th className="border border-slate-200 px-3 py-3 text-left font-semibold text-slate-700">
                        檢測食品描述
                      </th>
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
                      <th className="w-[90px] border border-slate-200 px-3 py-3 text-center font-semibold text-slate-700">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {items.map((item, index) => (
                      <tr key={`report-item-${index}`}>
                        <td className="border border-slate-200 px-3 py-3 text-center text-slate-500">
                          {index + 1}
                        </td>

                        <td className="border border-slate-200 px-3 py-3">
                          <input
                            value={item.sample_group_name}
                            onChange={(event) =>
                              updateItem(
                                index,
                                "sample_group_name",
                                event.target.value
                              )
                            }
                            placeholder="例如：香腸"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                          />
                        </td>

                        <td className="border border-slate-200 px-3 py-3">
                          <input
                            value={item.item_name}
                            onChange={(event) =>
                              updateItem(
                                index,
                                "item_name",
                                event.target.value
                              )
                            }
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                          />
                        </td>

                        <td className="border border-slate-200 px-3 py-3">
                          <input
                            value={item.test_method}
                            onChange={(event) =>
                              updateItem(
                                index,
                                "test_method",
                                event.target.value
                              )
                            }
                            placeholder="自動讀取 test_items.standard"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                          />
                        </td>

                        <td className="border border-slate-200 px-3 py-3">
                          <input
                            value={item.result_value}
                            onChange={(event) =>
                              updateItem(
                                index,
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
                            value={item.result_exponent}
                            onChange={(event) =>
                              updateItem(
                                index,
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
                            value={item.unit}
                            onChange={(event) =>
                              updateItem(index, "unit", event.target.value)
                            }
                            placeholder="例如：CFU/g"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                          />
                        </td>

                        <td className="border border-slate-200 px-3 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            disabled={items.length <= 1}
                            className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-5 text-lg font-bold text-slate-900">
                Signatory
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
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-lg font-bold text-slate-900">
                Report Preview
              </h2>

              <div className="space-y-3 text-sm text-slate-600">
                <p>
                  <span className="font-semibold text-slate-900">
                    Quotation:
                  </span>{" "}
                  {selectedQuotationNo || "-"}
                </p>

                <p>
                  <span className="font-semibold text-slate-900">食品廠:</span>{" "}
                  {customerName || "-"}
                </p>

                <p>
                  <span className="font-semibold text-slate-900">新增日期:</span>{" "}
                  {formatCreatedDateText(selectedQuotationCreatedAt)}
                </p>

                <p>
                  <span className="font-semibold text-slate-900">
                    First Report No.:
                  </span>{" "}
                  {reportNo || "-"}
                </p>

                <p>
                  <span className="font-semibold text-slate-900">Reports:</span>{" "}
                  {sampleReportsPreview.length || "-"}
                </p>

                <p>
                  <span className="font-semibold text-slate-900">Sample:</span>{" "}
                  {sampleReportsPreview.length > 0
                    ? sampleReportsPreview.join("、")
                    : sampleName || "-"}
                </p>

                <p>
                  <span className="font-semibold text-slate-900">
                    Received Date:
                  </span>{" "}
                  {formatDateText(receivedDate)}
                </p>

                <p>
                  <span className="font-semibold text-slate-900">
                    Imported Rows:
                  </span>{" "}
                  {items.length}
                </p>

                <p>
                  <span className="font-semibold text-slate-900">Status:</span>{" "}
                  {status}
                </p>
              </div>

              <div className="mt-6 rounded-xl bg-slate-50 p-4 text-xs leading-6 text-slate-500">
                報告會優先根據 Imported Test Result Items 內的「檢測食品描述」分組。
                例如 quotation_items 有「香腸 / 防腐劑」及「即食南非乾鮑魚成品 / 防腐劑」，
                系統會生成兩份獨立報告，並且每份報告只包含自己食品對應的檢測項目。
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
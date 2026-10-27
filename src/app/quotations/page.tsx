"use client";

import Image from "next/image";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase/client";

const EMIT_COMPANY_ID = "11111111-1111-1111-1111-111111111111";
const EMIT_SIGNATURE_STAMP_SRC = "/images/emit-signature-stamp.png";
// Snapshot fields in older quotations were populated with company contacts.
// Treat those historic values as unset contact overrides so old quotations still
// display the selected customer's information.
const LEGACY_COMPANY_CONTACT = {
  phone: new Set(["+853 2875 1742", "(853) 2875 1742"]),
  fax: new Set(["+853 2852 0536", "(853) 2852 0536"]),
  email: new Set(["am01@emit.com.mo"]),
};
function readCustomerContactOverride(
  value: string | null | undefined,
  field: "phone" | "fax" | "email"
): string | null {
  const trimmed = (value || "").trim();
  if (!trimmed || LEGACY_COMPANY_CONTACT[field].has(trimmed)) return null;
  return trimmed === "-" ? "" : trimmed;
}

const DEFAULT_NOTES = [
  "On-site sampling fee (per visit) is MOP 250;",
  "Report issue: approx. 7 ~10 working days upon sample collection;",
  "Contact Person : +853 66596580 / Mr. Leong",
].join("\n");

type DiscountType = "none" | "percentage" | "fixed";

type Customer = {
  id: string;
  company_id: string;
  customer_name: string;
  contact_person: string | null;
  phone: string | null;
  fax: string | null;
  email: string | null;
  address: string | null;
};

type TestCategory = {
  id: string;
  category_name: string;
};

type TestItem = {
  id: string;
  category_id: string | null;
  item_code: string | null;
  item_name_zh: string;
  item_name_en: string | null;
  major_category: string | null;
  testing_object: string | null;
  customer_price_mop: number;
  lab_price_rmb: number;
  test_standard: string | null;
  turnaround_text: string | null;
  unit: string | null;
};

type TestItemGroup = {
  id: string;
  company_id: string;
  group_code: string;
  group_name_zh: string;
  group_name_en: string | null;
  description: string | null;
  customer_group_price_mop: number;
  lab_group_price_rmb: number;
  price_mode: string;
  sort_order: number;
  is_active: boolean;
};

type TestItemGroupItem = {
  id: string;
  company_id: string;
  group_id: string;
  test_item_id: string;
  sort_order: number;
  display_name_override: string | null;
};

type CustomerFoodSample = {
  id: string;
  customer_id: string;
  sample_name: string;
  sample_name_normalized: string;
};

type QuotationSampleItem = {
  id: string;
  testItemId: string;
  testCategoryName: string;
  testItemName: string;
  unitPriceMop: number;
  labPriceRmb: number;
  quantity: number;
  unit: string | null;
  sourceGroupId?: string | null;
  sourceGroupCode?: string | null;
  sourceGroupName?: string | null;
  sourceGroupSortOrder?: number | null;
};

type QuotationSample = {
  id: string;
  sampleName: string;
  selectedTestItemId: string;
  testItemSearchText: string;
  selectedGroupId: string;
  groupSearchText: string;
  items: QuotationSampleItem[];
};

type ExistingQuotation = {
  id: string;
  company_id: string;
  customer_id: string;
  quotation_no: string | null;
  quotation_date: string | null;
  project_name: string | null;
  project_description: string | null;
  subtotal: number | null;
  discount_type: string | null;
  discount_value: number | null;
  discount_amount: number | null;
  total_amount: number | null;
  notes: string | null;
  status: string | null;
  to_customer_name?: string | null;
  attention_to?: string | null;
  from_company_name?: string | null;
  from_tel?: string | null;
  from_fax?: string | null;
  from_email?: string | null;
};

type ExistingQuotationItem = {
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

type PreviewSnapshot = {
  samples: QuotationSample[];
  clientName: string | null;
  attention: string | null;
  sender: string;
  tel: string | null;
  fax: string | null;
  email: string | null;
  description: string | null;
  quotationNo: string;
  quotationDate: string;
  projectName: string;
  notes: string;
  discountType: DiscountType;
  discountValue: number;
};

type SampleTableRow = {
  rowKey: string;
  item: QuotationSampleItem;
  itemIndex: number;
  groupKey: string;
  isFirstGroupRow: boolean;
  groupRowSpan: number;
  groupDescription: string;
  groupUnitPrice: number;
  groupTotal: number;
  groupQuantity: number;
};

function createLocalId() {
  return crypto.randomUUID();
}

function normalizeSampleName(sampleName: string) {
  return sampleName.trim().replace(/\s+/g, "").toLowerCase();
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function splitSampleDescriptionText(descriptionText: string | null | undefined) {
  return String(descriptionText || "")
    .split(/[、，,；;\n\r]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getTodayInputValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getTodayText() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year} / ${month} / ${day}`;
}

function formatQuotationDate(dateValue: string) {
  if (!dateValue) {
    return getTodayText();
  }

  const [year, month, day] = dateValue.split("-");

  if (!year || !month || !day) {
    return getTodayText();
  }

  return `${year} / ${month} / ${day}`;
}

function normalizeDiscountType(value: string | null | undefined): DiscountType {
  const normalizedValue = String(value || "none").trim().toLowerCase();

  if (
    normalizedValue === "percentage" ||
    normalizedValue === "percent" ||
    normalizedValue === "%"
  ) {
    return "percentage";
  }

  if (
    normalizedValue === "fixed" ||
    normalizedValue === "amount" ||
    normalizedValue === "fixed_amount"
  ) {
    return "fixed";
  }

  return "none";
}

function formatMoney(value: number) {
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

function generateDraftQuotationNo() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const random = String(Math.floor(Math.random() * 900) + 100);

  return `EMIT-QF${yy}${mm}${dd}-${random}`;
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

function stringifyError(error: unknown) {
  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

function normalizeLoadedGroup(rawGroup: Record<string, unknown>): TestItemGroup {
  return {
    id: String(rawGroup.id || ""),
    company_id: String(rawGroup.company_id || EMIT_COMPANY_ID),
    group_code: String(rawGroup.group_code || ""),
    group_name_zh: String(rawGroup.group_name_zh || ""),
    group_name_en: rawGroup.group_name_en
      ? String(rawGroup.group_name_en)
      : null,
    description: rawGroup.description ? String(rawGroup.description) : null,
    customer_group_price_mop: Number(rawGroup.customer_group_price_mop || 0),
    lab_group_price_rmb: Number(rawGroup.lab_group_price_rmb || 0),
    price_mode: String(rawGroup.price_mode || "sum_items"),
    sort_order: Number(rawGroup.sort_order || 0),
    is_active:
      typeof rawGroup.is_active === "boolean" ? rawGroup.is_active : true,
  };
}

function normalizeLoadedGroupItem(
  rawGroupItem: Record<string, unknown>
): TestItemGroupItem {
  return {
    id: String(rawGroupItem.id || ""),
    company_id: String(rawGroupItem.company_id || EMIT_COMPANY_ID),
    group_id: String(rawGroupItem.group_id || ""),
    test_item_id: String(rawGroupItem.test_item_id || ""),
    sort_order: Number(rawGroupItem.sort_order || 0),
    display_name_override: rawGroupItem.display_name_override
      ? String(rawGroupItem.display_name_override)
      : null,
  };
}

function QuotationsPageContent() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();

  const editQuotationId = searchParams.get("editQuotationId") || "";
  const editReload = searchParams.get("editReload") || "";

  const [hasMounted, setHasMounted] = useState(false);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [testItems, setTestItems] = useState<TestItem[]>([]);
  const [categories, setCategories] = useState<TestCategory[]>([]);
  const [testItemGroups, setTestItemGroups] = useState<TestItemGroup[]>([]);
  const [testItemGroupItems, setTestItemGroupItems] = useState<
    TestItemGroupItem[]
  >([]);

  const [groupLoadDebugMessage, setGroupLoadDebugMessage] = useState("");

  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [projectName, setProjectName] = useState("食品檢測");
  const [quotationDate, setQuotationDate] = useState(getTodayInputValue());
  const [quotationNotes, setQuotationNotes] = useState(DEFAULT_NOTES);
  const [discountType, setDiscountType] = useState<DiscountType>("none");
  const [discountValue, setDiscountValue] = useState(0);

  const [signatoryName, setSignatoryName] = useState("");
  const [signatoryDate, setSignatoryDate] = useState(getTodayInputValue());

  const [newSampleName, setNewSampleName] = useState("即食南非乾鮑魚成品");
  const [samples, setSamples] = useState<QuotationSample[]>([]);

  const [customerFoodSamples, setCustomerFoodSamples] = useState<
    CustomerFoodSample[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [loadingEditQuotation, setLoadingEditQuotation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);

  const [editingQuotationId, setEditingQuotationId] = useState("");
  const [editingQuotationNo, setEditingQuotationNo] = useState("");
  // Quotation-specific overrides: these never update the customers table.
  // null means inherit from the selected customer; "" means intentionally blank.
  const [clientNameOverride, setClientNameOverride] = useState<string | null>(null);
  const [attentionOverride, setAttentionOverride] = useState<string | null>(null);
  const [senderName, setSenderName] = useState("EMIT");
  const [telOverride, setTelOverride] = useState<string | null>(null);
  const [faxOverride, setFaxOverride] = useState<string | null>(null);
  const [emailOverride, setEmailOverride] = useState<string | null>(null);
  const [projectDescriptionOverride, setProjectDescriptionOverride] = useState<string | null>(null);
  const [isPreviewEditing, setIsPreviewEditing] = useState(false);
  const previewSnapshotRef = useRef<PreviewSnapshot | null>(null);
  const [loadedEditQuotationId, setLoadedEditQuotationId] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selectedCustomer = useMemo(() => {
    return (
      customers.find((customer) => customer.id === selectedCustomerId) || null
    );
  }, [customers, selectedCustomerId]);

  const previewCustomerName = clientNameOverride !== null
    ? clientNameOverride : (selectedCustomer?.customer_name || "");
  const previewAttention = attentionOverride !== null
    ? attentionOverride : (selectedCustomer?.contact_person || "");
  const previewTel = telOverride !== null ? telOverride : (selectedCustomer?.phone || "");
  const previewFax = faxOverride !== null ? faxOverride : (selectedCustomer?.fax || "");
  const previewEmail = emailOverride !== null ? emailOverride : (selectedCustomer?.email || "");

  const activeCompanyId = useMemo(() => {
    return selectedCustomer?.company_id || EMIT_COMPANY_ID;
  }, [selectedCustomer]);

  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>();

    categories.forEach((category) => {
      map.set(category.id, category.category_name);
    });

    return map;
  }, [categories]);

  const testItemMap = useMemo(() => {
    const map = new Map<string, TestItem>();

    testItems.forEach((item) => {
      map.set(item.id, item);
    });

    return map;
  }, [testItems]);

  const groupItemsMap = useMemo(() => {
    const map = new Map<string, TestItemGroupItem[]>();

    testItemGroupItems.forEach((groupItem) => {
      const currentItems = map.get(groupItem.group_id) || [];
      currentItems.push(groupItem);
      map.set(groupItem.group_id, currentItems);
    });

    map.forEach((items, groupId) => {
      map.set(
        groupId,
        [...items].sort((itemA, itemB) => itemA.sort_order - itemB.sort_order)
      );
    });

    return map;
  }, [testItemGroupItems]);

  const samplesWithItems = useMemo(() => {
    return samples.filter((sample) => sample.items.length > 0);
  }, [samples]);

  const sampleDescriptionText = useMemo(() => {
    const sampleNames = samples
      .map((sample) => sample.sampleName.trim())
      .filter(Boolean);

    if (sampleNames.length === 0) {
      return "請先新增檢測食品描述";
    }

    return sampleNames.join("、");
  }, [samples]);

  const previewProjectDescription = projectDescriptionOverride !== null
    ? projectDescriptionOverride : sampleDescriptionText;

  const totalAmount = useMemo(() => {
    return samples.reduce((sampleSum, sample) => {
      const itemSum = sample.items.reduce(
        (sum, item) => sum + item.unitPriceMop * item.quantity,
        0
      );

      return sampleSum + itemSum;
    }, 0);
  }, [samples]);

  const safeDiscountValue = useMemo(() => {
    const numericValue = Number(discountValue || 0);

    if (Number.isNaN(numericValue) || numericValue < 0) {
      return 0;
    }

    if (discountType === "percentage") {
      return Math.min(numericValue, 100);
    }

    return numericValue;
  }, [discountType, discountValue]);

  const discountAmount = useMemo(() => {
    if (discountType === "percentage") {
      return Math.min(
        totalAmount,
        totalAmount * (safeDiscountValue / 100)
      );
    }

    if (discountType === "fixed") {
      return Math.min(totalAmount, safeDiscountValue);
    }

    return 0;
  }, [discountType, safeDiscountValue, totalAmount]);

  const finalTotalAmount = useMemo(() => {
    return Math.max(0, totalAmount - discountAmount);
  }, [discountAmount, totalAmount]);

  const discountPreviewLabel = useMemo(() => {
    if (discountType === "percentage" && safeDiscountValue > 0) {
      return `Discount 折扣 (${formatMoney(safeDiscountValue)}%)：`;
    }

    return "Discount 折扣：";
  }, [discountType, safeDiscountValue]);

  const totalLabCostRmb = useMemo(() => {
    return samples.reduce((sampleSum, sample) => {
      const itemSum = sample.items.reduce(
        (sum, item) => sum + item.labPriceRmb * item.quantity,
        0
      );

      return sampleSum + itemSum;
    }, 0);
  }, [samples]);

  const quotationPreviewRows = useMemo(() => {
    const flatRows = samplesWithItems.flatMap((sample, sampleIndex) =>
      sample.items.map((item, itemIndex) => ({
        rowKey: `${sample.id}-${item.id}`,
        sampleId: sample.id,
        sampleIndex,
        sampleName: sample.sampleName,
        sampleItemCount: sample.items.length,
        itemIndex,
        item,
        priceGroupKey: item.sourceGroupId
          ? `${sample.id}-group-${item.sourceGroupId}`
          : `${sample.id}-single-${item.id}`,
      }))
    );

    return flatRows.map((row, rowIndex) => {
      const previousRow = flatRows[rowIndex - 1];

      const isFirstSampleRow = row.itemIndex === 0;

      const isFirstDescriptionRow =
        !previousRow ||
        previousRow.sampleId !== row.sampleId ||
        previousRow.item.testCategoryName !== row.item.testCategoryName ||
        previousRow.item.sourceGroupId !== row.item.sourceGroupId;

      let descriptionRowSpan = 0;

      if (isFirstDescriptionRow) {
        for (let index = rowIndex; index < flatRows.length; index += 1) {
          const currentRow = flatRows[index];

          if (
            !currentRow ||
            currentRow.sampleId !== row.sampleId ||
            currentRow.item.testCategoryName !== row.item.testCategoryName ||
            currentRow.item.sourceGroupId !== row.item.sourceGroupId
          ) {
            break;
          }

          descriptionRowSpan += 1;
        }
      }

      const isFirstPriceGroupRow =
        !previousRow || previousRow.priceGroupKey !== row.priceGroupKey;

      let priceGroupRowSpan = 0;

      if (isFirstPriceGroupRow) {
        for (let index = rowIndex; index < flatRows.length; index += 1) {
          const currentRow = flatRows[index];

          if (!currentRow || currentRow.priceGroupKey !== row.priceGroupKey) {
            break;
          }

          priceGroupRowSpan += 1;
        }
      }

      const priceGroupRows = flatRows
        .slice(rowIndex, rowIndex + priceGroupRowSpan)
        .filter((currentRow) => currentRow.priceGroupKey === row.priceGroupKey);

      const priceGroupItems = priceGroupRows.map(
        (currentRow) => currentRow.item
      );

      const pricedItem =
        priceGroupItems.find((item) => Number(item.unitPriceMop || 0) > 0) ||
        row.item;

      const priceGroupUnitPrice = priceGroupItems.reduce(
        (sum, item) => sum + Number(item.unitPriceMop || 0),
        0
      );

      const priceGroupTotal = priceGroupItems.reduce(
        (sum, item) =>
          sum + Number(item.unitPriceMop || 0) * Number(item.quantity || 1),
        0
      );

      return {
        ...row,
        isFirstSampleRow,
        isFirstDescriptionRow,
        descriptionRowSpan,
        isFirstPriceGroupRow,
        priceGroupRowSpan,
        priceGroupUnitPrice,
        priceGroupTotal,
        priceGroupQuantity: Number(pricedItem.quantity || 1),
      };
    });
  }, [samplesWithItems]);

  const isEditMode = Boolean(editingQuotationId);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!hasMounted) {
      return;
    }

    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMounted]);

  useEffect(() => {
    if (!initialDataLoaded || !editQuotationId) {
      return;
    }

    if (loadedEditQuotationId === editQuotationId && !editReload) {
      return;
    }

    loadQuotationForEdit(editQuotationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDataLoaded, editQuotationId, editReload, loadedEditQuotationId]);

  useEffect(() => {
    if (!selectedCustomerId) {
      return;
    }

    loadCustomerFoodSamples(selectedCustomerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCustomerId, activeCompanyId]);

  async function loadInitialData() {
    try {
      setLoading(true);
      setErrorMessage("");

      const [customersResult, testItemsResult, categoriesResult] =
        await Promise.all([
          supabase
            .from("customers")
            .select(
              "id,company_id,customer_name,contact_person,phone,fax,email,address"
            )
            .eq("is_active", true)
            .is("deleted_at", null)
            .order("customer_name", { ascending: true }),

          supabase
            .from("test_items")
            .select(
              "id,category_id,item_code,item_name_zh,item_name_en,major_category,testing_object,customer_price_mop,lab_price_rmb,test_standard,turnaround_text,unit"
            )
            .eq("is_active", true)
            .eq("show_in_quotation", true)
            .is("deleted_at", null)
            .order("item_code", { ascending: true }),

          supabase
            .from("test_categories")
            .select("id,category_name")
            .eq("is_active", true)
            .is("deleted_at", null)
            .order("sort_order", { ascending: true }),
        ]);

      if (customersResult.error) {
        throw customersResult.error;
      }

      if (testItemsResult.error) {
        throw testItemsResult.error;
      }

      if (categoriesResult.error) {
        throw categoriesResult.error;
      }

      const loadedCustomers = (customersResult.data ?? []) as Customer[];
      const loadedTestItems = (testItemsResult.data ?? []) as TestItem[];
      const loadedCategories = (categoriesResult.data ?? []) as TestCategory[];

      setCustomers(loadedCustomers);
      setTestItems(loadedTestItems);
      setCategories(loadedCategories);

      if (!editQuotationId) {
        if (loadedCustomers.length > 0) {
          setSelectedCustomerId((currentCustomerId) => {
            if (
              currentCustomerId &&
              loadedCustomers.some(
                (customer) => customer.id === currentCustomerId
              )
            ) {
              return currentCustomerId;
            }

            return loadedCustomers[0].id;
          });
        } else {
          setSelectedCustomerId("");
        }
      }

      await loadTestItemGroups();

      setInitialDataLoaded(true);
    } catch (error) {
      console.error("Load quotation data error:", error);
      setErrorMessage(getErrorMessage(error, "Failed to load quotation data."));
    } finally {
      setLoading(false);
    }
  }

  async function loadTestItemGroups() {
    try {
      setGroupLoadDebugMessage("");

      let groupsData: unknown[] = [];

      const groupsResult = await supabase
        .from("test_item_groups")
        .select("*")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true })
        .order("group_code", { ascending: true });

      if (groupsResult.error) {
        console.error(
          "Load test item groups warning:",
          JSON.stringify(groupsResult.error, null, 2)
        );

        setGroupLoadDebugMessage(
          `First group query failed: ${stringifyError(groupsResult.error)}`
        );

        const fallbackGroupsResult = await supabase
          .from("test_item_groups")
          .select("*")
          .eq("is_active", true)
          .order("group_code", { ascending: true });

        if (fallbackGroupsResult.error) {
          console.error(
            "Load test item groups fallback warning:",
            JSON.stringify(fallbackGroupsResult.error, null, 2)
          );

          setGroupLoadDebugMessage(
            `Fallback group query failed: ${stringifyError(
              fallbackGroupsResult.error
            )}`
          );

          setTestItemGroups([]);
          setTestItemGroupItems([]);
          return;
        }

        groupsData = (fallbackGroupsResult.data ?? []) as unknown[];
      } else {
        groupsData = (groupsResult.data ?? []) as unknown[];
      }

      const loadedGroups = groupsData
        .map((rawGroup) =>
          normalizeLoadedGroup(rawGroup as Record<string, unknown>)
        )
        .filter((group) => group.id && group.group_code && group.group_name_zh);

      setTestItemGroups(loadedGroups);

      if (loadedGroups.length === 0) {
        setTestItemGroupItems([]);
        setGroupLoadDebugMessage("Group query success, but 0 groups loaded.");
        return;
      }

      const groupIds = loadedGroups.map((group) => group.id);

      let groupItemsData: unknown[] = [];

      const groupItemsResult = await supabase
        .from("test_item_group_items")
        .select("*")
        .in("group_id", groupIds)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true });

      if (groupItemsResult.error) {
        console.error(
          "Load test item group items warning:",
          JSON.stringify(groupItemsResult.error, null, 2)
        );

        setGroupLoadDebugMessage(
          `Group items query failed: ${stringifyError(groupItemsResult.error)}`
        );

        const fallbackGroupItemsResult = await supabase
          .from("test_item_group_items")
          .select("*")
          .in("group_id", groupIds)
          .order("sort_order", { ascending: true });

        if (fallbackGroupItemsResult.error) {
          console.error(
            "Load test item group items fallback warning:",
            JSON.stringify(fallbackGroupItemsResult.error, null, 2)
          );

          setGroupLoadDebugMessage(
            `Fallback group items query failed: ${stringifyError(
              fallbackGroupItemsResult.error
            )}`
          );

          setTestItemGroupItems([]);
          return;
        }

        groupItemsData = (fallbackGroupItemsResult.data ?? []) as unknown[];
      } else {
        groupItemsData = (groupItemsResult.data ?? []) as unknown[];
      }

      const loadedGroupItems = groupItemsData
        .map((rawGroupItem) =>
          normalizeLoadedGroupItem(rawGroupItem as Record<string, unknown>)
        )
        .filter(
          (groupItem) =>
            groupItem.id && groupItem.group_id && groupItem.test_item_id
        );

      setTestItemGroupItems(loadedGroupItems);

      setGroupLoadDebugMessage(
        `Loaded groups: ${loadedGroups.length}; group items: ${loadedGroupItems.length}`
      );
    } catch (error) {
      console.error(
        "Load test item groups unexpected warning:",
        stringifyError(error)
      );

      setGroupLoadDebugMessage(
        `Unexpected group load error: ${stringifyError(error)}`
      );

      setTestItemGroups([]);
      setTestItemGroupItems([]);
    }
  }

  async function loadQuotationForEdit(quotationId: string) {
    try {
      setLoadingEditQuotation(true);
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

      const loadedQuotation = quotationData as ExistingQuotation;
      const loadedQuotationItems =
        (quotationItemsData ?? []) as ExistingQuotationItem[];

      const groupedSampleMap = new Map<number, QuotationSample>();

      loadedQuotationItems.forEach((item, index) => {
        const sampleNo = Number(item.sample_no || item.item_no || index + 1);
        const sampleName = item.sample_name || `Item ${sampleNo}`;

        const existingSample =
          groupedSampleMap.get(sampleNo) ||
          ({
            id: `sample-${sampleNo}-${createLocalId()}`,
            sampleName,
            selectedTestItemId: item.test_item_id || testItems[0]?.id || "",
            testItemSearchText: "",
            selectedGroupId: item.source_group_id || testItemGroups[0]?.id || "",
            groupSearchText: "",
            items: [],
          } as QuotationSample);

        existingSample.items.push({
          id: item.id || createLocalId(),
          testItemId: item.test_item_id || "",
          testCategoryName: item.test_category_name || "檢測項目",
          testItemName: item.description || "",
          unitPriceMop: Number(item.customer_unit_price_mop_snapshot || 0),
          labPriceRmb: Number(item.lab_price_rmb_snapshot || 0),
          quantity: Number(item.quantity || 1),
          unit: item.unit || testItemMap.get(item.test_item_id || "")?.unit || "item",
          sourceGroupId: item.source_group_id || null,
          sourceGroupCode: item.source_group_code || null,
          sourceGroupName: item.source_group_name || null,
          sourceGroupSortOrder:
            typeof item.source_group_sort_order === "number"
              ? item.source_group_sort_order
              : null,
        });

        if (!existingSample.selectedTestItemId && item.test_item_id) {
          existingSample.selectedTestItemId = item.test_item_id;
        }

        if (!existingSample.selectedGroupId && item.source_group_id) {
          existingSample.selectedGroupId = item.source_group_id;
        }

        groupedSampleMap.set(sampleNo, existingSample);
      });

      const loadedSamples = Array.from(groupedSampleMap.entries())
        .sort(([sampleNoA], [sampleNoB]) => sampleNoA - sampleNoB)
        .map(([, sample]) => sample);

      const savedSampleNames = splitSampleDescriptionText(
        loadedQuotation.project_description || ""
      );

      const existingSampleNameKeys = new Set(
        loadedSamples.map((sample) => normalizeSampleName(sample.sampleName))
      );

      savedSampleNames.forEach((sampleName) => {
        const normalizedSampleName = normalizeSampleName(sampleName);

        if (!normalizedSampleName || existingSampleNameKeys.has(normalizedSampleName)) {
          return;
        }

        loadedSamples.push({
          id: `sample-description-${createLocalId()}`,
          sampleName,
          selectedTestItemId: testItems[0]?.id || "",
          testItemSearchText: "",
          selectedGroupId: testItemGroups[0]?.id || "",
          groupSearchText: "",
          items: [],
        });

        existingSampleNameKeys.add(normalizedSampleName);
      });

      setEditingQuotationId(loadedQuotation.id);
      setEditingQuotationNo(loadedQuotation.quotation_no || "");
      setClientNameOverride(loadedQuotation.to_customer_name ?? null);
      setAttentionOverride(loadedQuotation.attention_to ?? null);
      setSenderName(loadedQuotation.from_company_name || "EMIT");
      setTelOverride(readCustomerContactOverride(loadedQuotation.from_tel, "phone"));
      setFaxOverride(readCustomerContactOverride(loadedQuotation.from_fax, "fax"));
      setEmailOverride(readCustomerContactOverride(loadedQuotation.from_email, "email"));
      setProjectDescriptionOverride(
        loadedQuotation.project_description &&
        loadedQuotation.project_description !== loadedSamples.map(s => s.sampleName).join("、")
          ? loadedQuotation.project_description
          : null
      );
      previewSnapshotRef.current = null;
      setIsPreviewEditing(false);
      setLoadedEditQuotationId(loadedQuotation.id);

      setSelectedCustomerId(loadedQuotation.customer_id || "");
      setProjectName(loadedQuotation.project_name || "食品檢測");
      setQuotationDate(loadedQuotation.quotation_date || getTodayInputValue());
      setQuotationNotes(loadedQuotation.notes || DEFAULT_NOTES);
      setDiscountType(normalizeDiscountType(loadedQuotation.discount_type));
      setDiscountValue(Number(loadedQuotation.discount_value || 0));
      setSamples(loadedSamples);
      setNewSampleName("");

      setSuccessMessage(
        `已載入 Quotation：${loadedQuotation.quotation_no || loadedQuotation.id}`
      );
    } catch (error) {
      console.error("Load quotation for edit error:", error);
      setErrorMessage(
        getErrorMessage(error, "Failed to load quotation for edit.")
      );
    } finally {
      setLoadingEditQuotation(false);
    }
  }

  async function loadCustomerFoodSamples(customerId: string) {
    try {
      const customer = customers.find(
        (currentCustomer) => currentCustomer.id === customerId
      );

      const companyId = customer?.company_id || activeCompanyId;

      const { data, error } = await supabase
        .from("customer_food_samples")
        .select("id,customer_id,sample_name,sample_name_normalized")
        .eq("company_id", companyId)
        .eq("customer_id", customerId)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("last_used_at", { ascending: false })
        .order("sample_name", { ascending: true });

      if (error) {
        throw error;
      }

      setCustomerFoodSamples((data ?? []) as CustomerFoodSample[]);
    } catch (error) {
      console.error("Load customer food samples error:", error);
      setErrorMessage(
        getErrorMessage(error, "Failed to load customer food samples.")
      );
    }
  }

  async function ensureCustomerFoodSampleExists(sampleName: string) {
    if (!selectedCustomerId) {
      return;
    }

    const cleanSampleName = sampleName.trim();
    const normalizedName = normalizeSampleName(cleanSampleName);

    if (!cleanSampleName || !normalizedName) {
      return;
    }

    const existingSample = customerFoodSamples.find(
      (sample) => sample.sample_name_normalized === normalizedName
    );

    if (existingSample) {
      const { error: updateError } = await supabase
        .from("customer_food_samples")
        .update({
          last_used_at: new Date().toISOString(),
        })
        .eq("id", existingSample.id);

      if (updateError) {
        throw updateError;
      }

      await loadCustomerFoodSamples(selectedCustomerId);
      return;
    }

    const { error: insertError } = await supabase
      .from("customer_food_samples")
      .insert({
        company_id: activeCompanyId,
        customer_id: selectedCustomerId,
        sample_name: cleanSampleName,
        sample_name_normalized: normalizedName,
        usage_count: 1,
        last_used_at: new Date().toISOString(),
        is_active: true,
      });

    if (insertError) {
      throw insertError;
    }

    await loadCustomerFoodSamples(selectedCustomerId);
  }

  function getTestCategoryName(testItem: TestItem) {
    return (
      (testItem.category_id && categoryNameMap.get(testItem.category_id)) ||
      testItem.major_category ||
      "檢測項目"
    );
  }

  function getTestItemOptionText(testItem: TestItem) {
    const itemCode = testItem.item_code || "";
    const itemNameZh = testItem.item_name_zh || "";
    const itemNameEn = testItem.item_name_en || "";
    const priceText = `MOP ${Number(
      testItem.customer_price_mop || 0
    ).toLocaleString()}`;

    return [itemCode, itemNameZh, itemNameEn, priceText]
      .filter(Boolean)
      .join(" - ");
  }

  function getFilteredTestItems(searchText: string) {
    const cleanSearchText = normalizeText(searchText);

    if (!cleanSearchText) {
      return testItems;
    }

    return testItems.filter((item) => {
      const searchableText = [
        item.item_code || "",
        item.item_name_zh || "",
        item.item_name_en || "",
        item.major_category || "",
        item.testing_object || "",
        item.test_standard || "",
        getTestItemOptionText(item),
      ].join(" ");

      return normalizeText(searchableText).includes(cleanSearchText);
    });
  }

  function getSafeSelectedTestItemId(sample: QuotationSample) {
    const filteredItems = getFilteredTestItems(sample.testItemSearchText || "");

    if (filteredItems.length === 0) {
      return "";
    }

    const stillAvailable = filteredItems.some(
      (item) => item.id === sample.selectedTestItemId
    );

    if (stillAvailable) {
      return sample.selectedTestItemId;
    }

    return filteredItems[0].id;
  }

  function getTestItemGroupOptionText(group: TestItemGroup) {
    const codeText = group.group_code || "";
    const nameZh = group.group_name_zh || "";
    const nameEn = group.group_name_en || "";
    const groupItems = groupItemsMap.get(group.id) || [];
    const countText = `${groupItems.length} items`;

    return [codeText, nameZh, nameEn, countText].filter(Boolean).join(" - ");
  }

  function getFilteredTestItemGroups(searchText: string) {
    const cleanSearchText = normalizeText(searchText);

    if (!cleanSearchText) {
      return testItemGroups;
    }

    return testItemGroups.filter((group) => {
      const groupItems = groupItemsMap.get(group.id) || [];
      const childItemsText = groupItems
        .map((groupItem) => {
          const childItem = testItemMap.get(groupItem.test_item_id);

          return [
            childItem?.item_code || "",
            childItem?.item_name_zh || "",
            childItem?.item_name_en || "",
            groupItem.display_name_override || "",
          ].join(" ");
        })
        .join(" ");

      const searchableText = [
        group.group_code || "",
        group.group_name_zh || "",
        group.group_name_en || "",
        group.description || "",
        getTestItemGroupOptionText(group),
        childItemsText,
      ].join(" ");

      return normalizeText(searchableText).includes(cleanSearchText);
    });
  }

  function getSafeSelectedGroupId(sample: QuotationSample) {
    const filteredGroups = getFilteredTestItemGroups(
      sample.groupSearchText || ""
    );

    if (filteredGroups.length === 0) {
      return "";
    }

    const stillAvailable = filteredGroups.some(
      (group) => group.id === sample.selectedGroupId
    );

    if (stillAvailable) {
      return sample.selectedGroupId;
    }

    return filteredGroups[0].id;
  }

  function getAvailableGroupChildItems(groupId: string) {
    const groupItems = groupItemsMap.get(groupId) || [];

    return groupItems
      .map((groupItem) => {
        const testItem = testItemMap.get(groupItem.test_item_id);

        if (!testItem) {
          return null;
        }

        return {
          groupItem,
          testItem,
        };
      })
      .filter(
        (
          row
        ): row is {
          groupItem: TestItemGroupItem;
          testItem: TestItem;
        } => Boolean(row)
      );
  }

  function shouldUseGroupPrice(group: TestItemGroup) {
    const priceMode = normalizeText(group.price_mode || "");

    return (
      Number(group.customer_group_price_mop || 0) > 0 &&
      ["group_price", "fixed_group", "package_price"].includes(priceMode)
    );
  }

  function getSampleTableRows(sample: QuotationSample): SampleTableRow[] {
    const baseRows = sample.items.map((item, itemIndex) => {
      const groupKey = item.sourceGroupId
        ? `group-${item.sourceGroupId}`
        : `single-${item.id}`;

      return {
        rowKey: `${sample.id}-${item.id}`,
        item,
        itemIndex,
        groupKey,
      };
    });

    return baseRows.map((row, rowIndex) => {
      const previousRow = baseRows[rowIndex - 1];
      const isFirstGroupRow =
        !previousRow || previousRow.groupKey !== row.groupKey;

      let groupRowSpan = 0;

      if (isFirstGroupRow) {
        for (let index = rowIndex; index < baseRows.length; index += 1) {
          const currentRow = baseRows[index];

          if (!currentRow || currentRow.groupKey !== row.groupKey) {
            break;
          }

          groupRowSpan += 1;
        }
      }

      const groupedRows = baseRows
        .slice(rowIndex, rowIndex + groupRowSpan)
        .filter((currentRow) => currentRow.groupKey === row.groupKey);

      const groupedItems = groupedRows.map((currentRow) => currentRow.item);

      const pricedItem =
        groupedItems.find((item) => Number(item.unitPriceMop || 0) > 0) ||
        row.item;

      const groupUnitPrice = groupedItems.reduce(
        (sum, item) => sum + Number(item.unitPriceMop || 0),
        0
      );

      const groupTotal = groupedItems.reduce(
        (sum, item) =>
          sum + Number(item.unitPriceMop || 0) * Number(item.quantity || 1),
        0
      );

      return {
        ...row,
        isFirstGroupRow,
        groupRowSpan,
        groupUnitPrice,
        groupTotal,
        groupQuantity: Number(pricedItem.quantity || 1),
        groupDescription: row.item.sourceGroupName || row.item.testCategoryName,
      };
    });
  }

  function handleExitEditMode() {
    if (!editingQuotationId) {
      router.push("/quotations");
      return;
    }

    router.push(`/quotations/${editingQuotationId}`);
  }

  async function handleAddSample() {
    const cleanSampleName = newSampleName.trim();

    if (!cleanSampleName) {
      setErrorMessage("請輸入檢測食品描述 / Sample Name。");
      return;
    }

    const normalizedSampleName = normalizeSampleName(cleanSampleName);

    const duplicated = samples.some(
      (sample) => normalizeSampleName(sample.sampleName) === normalizedSampleName
    );

    if (duplicated) {
      setErrorMessage(
        "這個檢測食品描述已經存在，請直接在該樣本下面新增檢測項目。"
      );
      return;
    }

    let foodSampleSaveWarning = "";

    try {
      await ensureCustomerFoodSampleExists(cleanSampleName);
    } catch (error) {
      console.error("Save customer food sample error:", error);
      foodSampleSaveWarning = getErrorMessage(
        error,
        "Failed to save customer food sample."
      );
    }

    const newSample: QuotationSample = {
      id: createLocalId(),
      sampleName: cleanSampleName,
      selectedTestItemId: testItems[0]?.id || "",
      testItemSearchText: "",
      selectedGroupId: testItemGroups[0]?.id || "",
      groupSearchText: "",
      items: [],
    };

    setSamples((currentSamples) => [...currentSamples, newSample]);
    setNewSampleName("");
    setSuccessMessage("");

    if (foodSampleSaveWarning) {
      setErrorMessage(
        `樣本已加入本張 Quotation，但未能儲存到食品廠食品資料庫：${foodSampleSaveWarning}`
      );
    } else {
      setErrorMessage("");
    }
  }

  function handleRemoveSample(sampleId: string) {
    const confirmed = window.confirm(
      "確認刪除這個樣本嗎？樣本下面的檢測項目也會一起移除。"
    );

    if (!confirmed) {
      return;
    }

    setSamples((currentSamples) =>
      currentSamples.filter((sample) => sample.id !== sampleId)
    );
  }

  function handleChangeSampleTestItem(sampleId: string, testItemId: string) {
    setSamples((currentSamples) =>
      currentSamples.map((sample) =>
        sample.id === sampleId
          ? {
              ...sample,
              selectedTestItemId: testItemId,
            }
          : sample
      )
    );
  }

  function handleChangeSampleTestItemSearchText(
    sampleId: string,
    searchText: string
  ) {
    const filteredItems = getFilteredTestItems(searchText);

    setSamples((currentSamples) =>
      currentSamples.map((sample) => {
        if (sample.id !== sampleId) {
          return sample;
        }

        const stillAvailable = filteredItems.some(
          (item) => item.id === sample.selectedTestItemId
        );

        return {
          ...sample,
          testItemSearchText: searchText,
          selectedTestItemId: stillAvailable
            ? sample.selectedTestItemId
            : filteredItems[0]?.id || "",
        };
      })
    );
  }

  function handleChangeSampleGroup(sampleId: string, groupId: string) {
    setSamples((currentSamples) =>
      currentSamples.map((sample) =>
        sample.id === sampleId
          ? {
              ...sample,
              selectedGroupId: groupId,
            }
          : sample
      )
    );
  }

  function handleChangeSampleGroupSearchText(
    sampleId: string,
    searchText: string
  ) {
    const filteredGroups = getFilteredTestItemGroups(searchText);

    setSamples((currentSamples) =>
      currentSamples.map((sample) => {
        if (sample.id !== sampleId) {
          return sample;
        }

        const stillAvailable = filteredGroups.some(
          (group) => group.id === sample.selectedGroupId
        );

        return {
          ...sample,
          groupSearchText: searchText,
          selectedGroupId: stillAvailable
            ? sample.selectedGroupId
            : filteredGroups[0]?.id || "",
        };
      })
    );
  }

  function handleAddTestItemToSample(sampleId: string) {
    const targetSample = samples.find((sample) => sample.id === sampleId);

    if (!targetSample) {
      return;
    }

    if (testItems.length === 0) {
      setErrorMessage("目前沒有可用檢測項目，請先到 Test Items 新增。");
      return;
    }

    const safeSelectedTestItemId = getSafeSelectedTestItemId(targetSample);

    if (!safeSelectedTestItemId) {
      setErrorMessage("沒有符合搜尋條件的檢測項目，請重新輸入關鍵字。");
      return;
    }

    const selectedTestItem = testItems.find(
      (item) => item.id === safeSelectedTestItemId
    );

    if (!selectedTestItem) {
      setErrorMessage("請先從下拉列表選擇一個檢測項目。");
      return;
    }

    const alreadyAdded = targetSample.items.some(
      (item) => item.testItemId === selectedTestItem.id
    );

    if (alreadyAdded) {
      setErrorMessage("這個樣本已經加入相同檢測項目。");
      return;
    }

    const newItem: QuotationSampleItem = {
      id: createLocalId(),
      testItemId: selectedTestItem.id,
      testCategoryName: getTestCategoryName(selectedTestItem),
      testItemName: selectedTestItem.item_name_zh,
      unitPriceMop: Number(selectedTestItem.customer_price_mop),
      labPriceRmb: Number(selectedTestItem.lab_price_rmb),
      quantity: 1,
      unit: selectedTestItem.unit || "item",
      sourceGroupId: null,
      sourceGroupCode: null,
      sourceGroupName: null,
      sourceGroupSortOrder: null,
    };

    setSamples((currentSamples) =>
      currentSamples.map((sample) =>
        sample.id === sampleId
          ? {
              ...sample,
              selectedTestItemId: safeSelectedTestItemId,
              items: [...sample.items, newItem],
            }
          : sample
      )
    );

    setErrorMessage("");
    setSuccessMessage("");
  }

  function handleAddTestGroupToSample(sampleId: string) {
    const targetSample = samples.find((sample) => sample.id === sampleId);

    if (!targetSample) {
      return;
    }

    if (testItemGroups.length === 0) {
      setErrorMessage("目前沒有可用檢測組，請先建立 test_item_groups。");
      return;
    }

    const safeSelectedGroupId = getSafeSelectedGroupId(targetSample);

    if (!safeSelectedGroupId) {
      setErrorMessage("沒有符合搜尋條件的檢測組，請重新輸入關鍵字。");
      return;
    }

    const selectedGroup = testItemGroups.find(
      (group) => group.id === safeSelectedGroupId
    );

    if (!selectedGroup) {
      setErrorMessage("請先從下拉列表選擇一個檢測組。");
      return;
    }

    const groupChildRows = getAvailableGroupChildItems(selectedGroup.id);

    if (groupChildRows.length === 0) {
      setErrorMessage("這個檢測組暫時沒有可用的檢測項目。");
      return;
    }

    const existingTestItemIds = new Set(
      targetSample.items.map((item) => item.testItemId)
    );

    const useGroupPrice = shouldUseGroupPrice(selectedGroup);

    const newGroupItems: QuotationSampleItem[] = groupChildRows
      .filter(({ testItem }) => !existingTestItemIds.has(testItem.id))
      .map(({ groupItem, testItem }, index) => {
        const itemPrice = useGroupPrice
          ? index === 0
            ? Number(selectedGroup.customer_group_price_mop || 0)
            : 0
          : Number(testItem.customer_price_mop || 0);

        const labPrice = useGroupPrice
          ? index === 0
            ? Number(selectedGroup.lab_group_price_rmb || 0)
            : 0
          : Number(testItem.lab_price_rmb || 0);

        return {
          id: createLocalId(),
          testItemId: testItem.id,
          testCategoryName: selectedGroup.group_name_zh,
          testItemName: groupItem.display_name_override || testItem.item_name_zh,
          unitPriceMop: itemPrice,
          labPriceRmb: labPrice,
          quantity: 1,
          unit: testItem.unit || "item",
          sourceGroupId: selectedGroup.id,
          sourceGroupCode: selectedGroup.group_code,
          sourceGroupName: selectedGroup.group_name_zh,
          sourceGroupSortOrder: groupItem.sort_order,
        };
      });

    if (newGroupItems.length === 0) {
      setErrorMessage("這個檢測組內的項目已全部加入此樣本。");
      return;
    }

    setSamples((currentSamples) =>
      currentSamples.map((sample) =>
        sample.id === sampleId
          ? {
              ...sample,
              selectedGroupId: safeSelectedGroupId,
              items: [...sample.items, ...newGroupItems],
            }
          : sample
      )
    );

    setErrorMessage("");

    if (newGroupItems.length < groupChildRows.length) {
      setSuccessMessage(
        `已加入檢測組「${selectedGroup.group_name_zh}」中的 ${newGroupItems.length} 個新項目；已存在的項目已自動略過。`
      );
    } else {
      setSuccessMessage(
        `已加入檢測組「${selectedGroup.group_name_zh}」，共 ${newGroupItems.length} 個檢測項目。`
      );
    }
  }

  function handleRemoveItemFromSample(sampleId: string, itemId: string) {
    setSamples((currentSamples) =>
      currentSamples.map((sample) =>
        sample.id === sampleId
          ? {
              ...sample,
              items: sample.items.filter((item) => item.id !== itemId),
            }
          : sample
      )
    );
  }

  function handleRemoveGroupFromSample(sampleId: string, sourceGroupId: string) {
    const confirmed = window.confirm("確認移除整個檢測組嗎？");

    if (!confirmed) {
      return;
    }

    setSamples((currentSamples) =>
      currentSamples.map((sample) =>
        sample.id === sampleId
          ? {
              ...sample,
              items: sample.items.filter(
                (item) => item.sourceGroupId !== sourceGroupId
              ),
            }
          : sample
      )
    );
  }

  function updateSampleNameInPreview(sampleId: string, value: string) {
    setSamples(current => current.map(sample => sample.id === sampleId
      ? { ...sample, sampleName: value } : sample));
  }

  function updateSampleItemInPreview(
    sampleId: string, itemId: string,
    patch: Partial<Pick<QuotationSampleItem, "testItemName" | "testCategoryName">>
  ) {
    setSamples(current => current.map(sample => sample.id === sampleId
      ? { ...sample, items: sample.items.map(item => item.id === itemId
        ? { ...item, ...patch } : item) } : sample));
  }

  function updateDescriptionGroupInPreview(
    sampleId: string, itemId: string, newName: string
  ) {
    setSamples(current => current.map(sample => {
      if (sample.id !== sampleId) return sample;
      const anchor = sample.items.find(item => item.id === itemId);
      if (!anchor) return sample;
      return { ...sample, items: sample.items.map(item =>
        item.testCategoryName === anchor.testCategoryName &&
        item.sourceGroupId === anchor.sourceGroupId
          ? { ...item, testCategoryName: newName,
              ...(item.sourceGroupId ? { sourceGroupName: newName } : {}) } : item
      ) };
    }));
  }

  // A grouped price is shown as one editable figure. Preserve individual
  // test-item price proportions (and existing zero-price package children).
  function updatePriceGroupInPreview(
    sampleId: string, groupKey: string, newPrice: number
  ) {
    if (!Number.isFinite(newPrice) || newPrice < 0) return;
    const target = Math.round(newPrice * 100);
    setSamples(current => current.map(sample => {
      if (sample.id !== sampleId) return sample;
      const group = sample.items.filter(item =>
        (item.sourceGroupId ? `${sample.id}-group-${item.sourceGroupId}`
          : `${sample.id}-single-${item.id}`) === groupKey);
      if (group.length === 0) return sample;
      const originalTotalCents = group.reduce((total, item) =>
        total + Math.round(item.unitPriceMop * 100), 0);
      let allocated = 0;
      const prices = new Map<string, number>();
      group.forEach((item, index) => {
        const remaining = Math.max(0, target - allocated);
        const proportional = originalTotalCents > 0
          ? Math.round(target * Math.round(item.unitPriceMop * 100) / originalTotalCents)
          : index === 0 ? target : 0;
        const cents = index === group.length - 1
          ? remaining : Math.max(0, Math.min(remaining, proportional));
        prices.set(item.id, cents / 100);
        allocated += cents;
      });
      return { ...sample, items: sample.items.map(item =>
        prices.has(item.id) ? { ...item, unitPriceMop: prices.get(item.id)! } : item) };
    }));
  }

  function beginPreviewEdit() {
    previewSnapshotRef.current = {
      samples: samples.map(s => ({ ...s, items: s.items.map(i => ({ ...i })) })),
      clientName: clientNameOverride, attention: attentionOverride,
      sender: senderName, tel: telOverride, fax: faxOverride, email: emailOverride,
      description: projectDescriptionOverride, quotationNo: editingQuotationNo,
      quotationDate, projectName, notes: quotationNotes,
      discountType, discountValue,
    };
    setIsPreviewEditing(true);
  }

  function cancelPreviewEdit() {
    const old = previewSnapshotRef.current;
    if (old) {
      setSamples(old.samples);
      setClientNameOverride(old.clientName);
      setAttentionOverride(old.attention);
      setSenderName(old.sender);
      setTelOverride(old.tel);
      setFaxOverride(old.fax);
      setEmailOverride(old.email);
      setProjectDescriptionOverride(old.description);
      setEditingQuotationNo(old.quotationNo);
      setQuotationDate(old.quotationDate);
      setProjectName(old.projectName);
      setQuotationNotes(old.notes);
      setDiscountType(old.discountType);
      setDiscountValue(old.discountValue);
    }
    previewSnapshotRef.current = null;
    setIsPreviewEditing(false);
  }

  function handleUpdateItemQuantity(
    sampleId: string,
    itemId: string,
    quantity: number
  ) {
    const safeQuantity = Number.isNaN(quantity) || quantity <= 0 ? 1 : quantity;

    setSamples((currentSamples) =>
      currentSamples.map((sample) =>
        sample.id === sampleId
          ? {
              ...sample,
              items: sample.items.map((item) =>
                item.id === itemId
                  ? {
                      ...item,
                      quantity: safeQuantity,
                    }
                  : item
              ),
            }
          : sample
      )
    );
  }

  function handleUpdateGroupQuantity(
    sampleId: string,
    sourceGroupId: string,
    quantity: number
  ) {
    const safeQuantity = Number.isNaN(quantity) || quantity <= 0 ? 1 : quantity;

    setSamples((currentSamples) =>
      currentSamples.map((sample) =>
        sample.id === sampleId
          ? {
              ...sample,
              items: sample.items.map((item) =>
                item.sourceGroupId === sourceGroupId
                  ? {
                      ...item,
                      quantity: safeQuantity,
                    }
                  : item
              ),
            }
          : sample
      )
    );
  }

  function buildQuotationItemPayload(targetQuotationId: string) {
    const quotationItemPayload: Array<{
      company_id: string;
      quotation_id: string;
      test_item_id: string | null;
      sample_no: number;
      sample_name: string;
      test_category_name: string;
      item_no: number;
      description: string;
      quantity: number;
      unit: string;
      lab_price_rmb_snapshot: number;
      customer_unit_price_mop_snapshot: number;
      customer_total_price_mop_snapshot: number;
      sort_order: number;
      source_group_id: string | null;
      source_group_code: string | null;
      source_group_name: string | null;
      source_group_sort_order: number | null;
    }> = [];

    let sortOrder = 1;

    samplesWithItems.forEach((sample, sampleIndex) => {
      sample.items.forEach((item) => {
        quotationItemPayload.push({
          company_id: activeCompanyId,
          quotation_id: targetQuotationId,
          test_item_id: item.testItemId || null,
          sample_no: sampleIndex + 1,
          sample_name: sample.sampleName,
          test_category_name: item.testCategoryName,
          item_no: sampleIndex + 1,
          description: item.testItemName,
          quantity: item.quantity,
          unit: item.unit || "item",
          lab_price_rmb_snapshot: item.labPriceRmb,
          customer_unit_price_mop_snapshot: item.unitPriceMop,
          customer_total_price_mop_snapshot:
            item.unitPriceMop * item.quantity,
          sort_order: sortOrder,
          source_group_id: item.sourceGroupId || null,
          source_group_code: item.sourceGroupCode || null,
          source_group_name: item.sourceGroupName || null,
          source_group_sort_order:
            typeof item.sourceGroupSortOrder === "number"
              ? item.sourceGroupSortOrder
              : null,
        });

        sortOrder += 1;
      });
    });

    return quotationItemPayload;
  }

  async function handleSaveDraft() {
    if (!selectedCustomer) {
      setErrorMessage("請先選擇客戶。");
      return;
    }

    if (editingQuotationId && !editingQuotationNo.trim()) {
      setErrorMessage("已儲存的報價單編號不能留空。");
      return;
    }
    if (!previewCustomerName.trim()) {
      setErrorMessage("請輸入報價單上的客戶名稱（TO）。");
      return;
    }
    if (samples.some(s => s.items.length > 0 && !s.sampleName.trim())) {
      setErrorMessage("檢測食品描述不能留空。");
      return;
    }
    if (samplesWithItems.some(s => s.items.some(i => !i.testItemName.trim()))) {
      setErrorMessage("檢測項目名稱不能留空。");
      return;
    }
    if (samplesWithItems.length === 0) {
      setErrorMessage("請至少新增一個樣本，並加入至少一個檢測項目。");
      return;
    }

    try {
      setSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      if (editingQuotationId) {
        const quotationItemPayload =
          buildQuotationItemPayload(editingQuotationId);

        if (quotationItemPayload.length === 0) {
          throw new Error("請至少加入一個有效的檢測項目後再儲存。");
        }

        const { error: quotationUpdateError } = await supabase
          .from("quotations")
          .update({
            company_id: activeCompanyId,
            customer_id: selectedCustomer.id,
            quotation_date:
              quotationDate || new Date().toISOString().slice(0, 10),
            no_of_pages: 3,
            quotation_no: editingQuotationNo.trim() || undefined,
            to_customer_name: previewCustomerName.trim(),
            attention_to: previewAttention.trim() || null,
            from_company_name: senderName.trim() || "EMIT",
            from_tel: previewTel.trim() || "-",
            from_fax: previewFax.trim() || "-",
            from_email: previewEmail.trim() || "-",
            project_name: projectName,
            project_description: previewProjectDescription,
            subtotal: totalAmount,
            discount_type: discountType,
            discount_value: safeDiscountValue,
            discount_amount: discountAmount,
            total_amount: finalTotalAmount,
            currency: "MOP",
            notes: quotationNotes || DEFAULT_NOTES,
            status: "draft",
            updated_at: new Date().toISOString(),
          })
          .eq("id", editingQuotationId);

        if (quotationUpdateError) {
          throw quotationUpdateError;
        }

        const deletedAt = new Date().toISOString();

        const { error: oldItemsSoftDeleteError } = await supabase
          .from("quotation_items")
          .update({
            deleted_at: deletedAt,
            updated_at: deletedAt,
          })
          .eq("quotation_id", editingQuotationId)
          .is("deleted_at", null);

        if (oldItemsSoftDeleteError) {
          throw oldItemsSoftDeleteError;
        }

        const { error: newItemsError } = await supabase
          .from("quotation_items")
          .insert(quotationItemPayload);

        if (newItemsError) {
          throw newItemsError;
        }

        setSuccessMessage(
          `Quotation updated: ${editingQuotationNo || editingQuotationId}`
        );
        router.push(`/quotations/${editingQuotationId}`);
        return;
      }

      const quotationNo = editingQuotationNo.trim() || generateDraftQuotationNo();

      const { data: quotationData, error: quotationError } = await supabase
        .from("quotations")
        .insert({
          company_id: activeCompanyId,
          customer_id: selectedCustomer.id,
          quotation_no: quotationNo,
          quotation_date: quotationDate || getTodayInputValue(),
          no_of_pages: 3,
          to_customer_name: previewCustomerName.trim(),
          attention_to: previewAttention.trim() || null,
          from_company_name: senderName.trim() || "EMIT",
          from_tel: previewTel.trim() || "-",
          from_fax: previewFax.trim() || "-",
          from_email: previewEmail.trim() || "-",
          project_name: projectName,
          project_description: previewProjectDescription,
          subtotal: totalAmount,
          discount_type: discountType,
          discount_value: safeDiscountValue,
          discount_amount: discountAmount,
          total_amount: finalTotalAmount,
          currency: "MOP",
          notes: quotationNotes || DEFAULT_NOTES,
          status: "draft",
        })
        .select("id, quotation_no")
        .single();

      if (quotationError) {
        throw quotationError;
      }

      const quotationItemPayload = buildQuotationItemPayload(quotationData.id);

      if (quotationItemPayload.length === 0) {
        throw new Error("請至少加入一個有效的檢測項目後再儲存。");
      }

      const { error: itemsError } = await supabase
        .from("quotation_items")
        .insert(quotationItemPayload);

      if (itemsError) {
        throw itemsError;
      }

      setSuccessMessage(`Quotation draft saved: ${quotationData.quotation_no}`);
      router.push(`/quotations/${quotationData.id}`);
    } catch (error) {
      console.error("Save quotation error:", error);
      setErrorMessage(getErrorMessage(error, "Failed to save quotation."));
    } finally {
      setSaving(false);
    }
  }

  if (!hasMounted) {
    return (
      <AppShell>
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <p className="text-sm text-slate-500">Loading quotation form...</p>
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
            <h1 className="text-3xl font-bold text-slate-900">
              {isEditMode ? "Edit Quotation" : "Quotations"}
            </h1>
            <p className="mt-2 text-slate-500">
              {isEditMode
                ? `Editing quotation: ${editingQuotationNo || editingQuotationId}`
                : "Create EMIT quotation documents by sample, test items and test groups."}
            </p>
          </div>

          <div className="flex gap-3">
            {isEditMode && (
              <button
                onClick={handleExitEditMode}
                className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Back to Detail
              </button>
            )}

            <button
              onClick={() => router.push("/quotations/list")}
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              View Saved
            </button>

            <button
              onClick={handleSaveDraft}
              disabled={saving || loading || loadingEditQuotation}
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? "Saving..."
                : isEditMode
                  ? "Update Quotation"
                  : "Save Draft"}
            </button>

            <button className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700">
              Generate PDF
            </button>
          </div>
        </div>

        {loadingEditQuotation && (
          <div className="mb-6 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-700">
            Loading existing quotation data...
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-700">
            {successMessage}
          </div>
        )}

        <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            Quotation Setup
          </h2>

          {groupLoadDebugMessage && (
            <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-800">
              <p>Debug Test Groups: {testItemGroups.length}</p>
              <p>Debug Group Items: {testItemGroupItems.length}</p>
              <p>
                Groups:{" "}
                {testItemGroups
                  .map(
                    (group) => `${group.group_code} - ${group.group_name_zh}`
                  )
                  .join(" / ") || "No groups loaded"}
              </p>
              <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-purple-900">
                {groupLoadDebugMessage}
              </pre>
            </div>
          )}

          {isEditMode && (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              你正在修改已存在的 quotation。儲存後會更新原 quotation 及其檢測項目。
            </div>
          )}

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700">
                Select Client
              </label>
              <select
                value={selectedCustomerId}
                onChange={(event) => {
                    setSelectedCustomerId(event.target.value);
                    setClientNameOverride(null);
                    setAttentionOverride(null);
                    setTelOverride(null);
                    setFaxOverride(null);
                    setEmailOverride(null);
                  }}
                disabled={loading || loadingEditQuotation}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
              >
                {customers.length === 0 && (
                  <option value="">No clients loaded</option>
                )}

                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.customer_name}
                    {customer.contact_person
                      ? ` / ${customer.contact_person}`
                      : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Project 項目
              </label>
              <input
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Name of Signatory 簽署人名稱
              </label>
              <input
                value={signatoryName}
                onChange={(event) => setSignatoryName(event.target.value)}
                placeholder="例如：ChiKei L"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Signatory Date 簽署日期
              </label>
              <input
                type="date"
                value={signatoryDate}
                onChange={(event) => setSignatoryDate(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
              />
            </div>

            {isEditMode && (
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Quotation Date
                </label>
                <input
                  type="date"
                  value={quotationDate}
                  onChange={(event) => setQuotationDate(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                />
              </div>
            )}
          </div>

          <div className="mt-6">
            <label className="text-sm font-medium text-slate-700">
              Notes 備注
            </label>
            <textarea
              value={quotationNotes}
              onChange={(event) => setQuotationNotes(event.target.value)}
              rows={4}
              placeholder="每行一條備注，會顯示在報價單下方 Notes 區塊"
              className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
            />
            <p className="mt-2 text-xs text-slate-500">
              每按一次 Enter 換行，即為一條新備注。留空則使用預設備注。
            </p>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="text-lg font-bold text-slate-900">
              Add Sample 新增檢測食品描述
            </h3>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_auto]">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-700">
                    已儲存食品描述 / Saved Sample
                  </label>

                  <select
                    value=""
                    onChange={(event) => {
                      if (event.target.value) {
                        setNewSampleName(event.target.value);
                      }
                    }}
                    disabled={
                      !selectedCustomerId || customerFoodSamples.length === 0
                    }
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">
                      {customerFoodSamples.length === 0
                        ? "此食品廠暫無已儲存食品描述"
                        : "請選擇已儲存食品描述"}
                    </option>

                    {customerFoodSamples.map((sample) => (
                      <option key={sample.id} value={sample.sample_name}>
                        {sample.sample_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium text-slate-700">
                    檢測食品描述 / Sample Name
                  </label>

                  <input
                    value={newSampleName}
                    onChange={(event) => setNewSampleName(event.target.value)}
                    placeholder="可以選擇上方已儲存食品，或直接輸入新食品"
                    className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleAddSample}
                  disabled={loading}
                  className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Add Sample
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-5">
            {samples.map((sample, sampleIndex) => {
              const sampleTableRows = getSampleTableRows(sample);

              const filteredTestItems = getFilteredTestItems(
                sample.testItemSearchText || ""
              );
              const safeSelectedTestItemId = getSafeSelectedTestItemId(sample);

              const filteredGroups = getFilteredTestItemGroups(
                sample.groupSearchText || ""
              );
              const safeSelectedGroupId = getSafeSelectedGroupId(sample);
              const selectedGroup = testItemGroups.find(
                (group) => group.id === safeSelectedGroupId
              );
              const selectedGroupChildItems = safeSelectedGroupId
                ? getAvailableGroupChildItems(safeSelectedGroupId)
                : [];

              return (
                <div
                  key={sample.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-slate-500">
                        Item {sampleIndex + 1}
                      </p>
                      <h3 className="text-lg font-bold text-slate-900">
                        {sample.sampleName}
                      </h3>
                    </div>

                    <button
                      onClick={() => handleRemoveSample(sample.id)}
                      className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                    >
                      Remove Sample
                    </button>
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h4 className="text-sm font-bold text-slate-900">
                      單一檢測項目 / Single Test Item
                    </h4>

                    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
                      <div>
                        <label className="text-sm font-medium text-slate-700">
                          打字搜尋檢測項目 / Search Test Item
                        </label>

                        <input
                          value={sample.testItemSearchText || ""}
                          onChange={(event) =>
                            handleChangeSampleTestItemSearchText(
                              sample.id,
                              event.target.value
                            )
                          }
                          placeholder="輸入編號、中文名稱、英文名稱、類別或標準搜尋"
                          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
                        />

                        <p className="mt-2 text-xs text-slate-500">
                          輸入關鍵字後，右邊下拉列表會自動篩選資料庫已有的檢測項目。
                        </p>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-slate-700">
                          下拉選擇已有檢測項目 / Select Test Item
                        </label>

                        <select
                          value={safeSelectedTestItemId}
                          onChange={(event) =>
                            handleChangeSampleTestItem(
                              sample.id,
                              event.target.value
                            )
                          }
                          disabled={filteredTestItems.length === 0}
                          className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          {filteredTestItems.length === 0 && (
                            <option value="">沒有符合的檢測項目</option>
                          )}

                          {filteredTestItems.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.item_code} - {item.item_name_zh} / MOP{" "}
                              {Number(
                                item.customer_price_mop
                              ).toLocaleString()}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-start pt-[30px]">
                        <button
                          onClick={() => handleAddTestItemToSample(sample.id)}
                          disabled={filteredTestItems.length === 0}
                          className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Add Test Item
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <h4 className="text-sm font-bold text-emerald-900">
                      檢測組 / Test Group
                    </h4>

                    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
                      <div>
                        <label className="text-sm font-medium text-emerald-900">
                          打字搜尋檢測組 / Search Test Group
                        </label>

                        <input
                          value={sample.groupSearchText || ""}
                          onChange={(event) =>
                            handleChangeSampleGroupSearchText(
                              sample.id,
                              event.target.value
                            )
                          }
                          placeholder="例如：營養標籤、微生物套餐、重金屬套餐"
                          className="mt-2 w-full rounded-xl border border-emerald-300 px-4 py-3 text-sm outline-none focus:border-emerald-900"
                        />

                        <p className="mt-2 text-xs text-emerald-700">
                          選擇檢測組後，系統會一次加入該組內所有已設定的檢測項目。
                        </p>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-emerald-900">
                          下拉選擇檢測組 / Select Test Group
                        </label>

                        <select
                          value={safeSelectedGroupId}
                          onChange={(event) =>
                            handleChangeSampleGroup(
                              sample.id,
                              event.target.value
                            )
                          }
                          disabled={filteredGroups.length === 0}
                          className="mt-2 w-full rounded-xl border border-emerald-300 px-4 py-3 text-sm outline-none focus:border-emerald-900 disabled:bg-emerald-100 disabled:text-emerald-400"
                        >
                          {filteredGroups.length === 0 && (
                            <option value="">沒有符合的檢測組</option>
                          )}

                          {filteredGroups.map((group) => {
                            const childCount =
                              groupItemsMap.get(group.id)?.length || 0;

                            return (
                              <option key={group.id} value={group.id}>
                                {group.group_code} - {group.group_name_zh} /{" "}
                                {childCount} items
                              </option>
                            );
                          })}
                        </select>

                        {selectedGroup && (
                          <p className="mt-2 text-xs text-emerald-700">
                            已選：{selectedGroup.group_name_zh}，包含{" "}
                            {selectedGroupChildItems.length} 個可用項目。
                          </p>
                        )}
                      </div>

                      <div className="flex items-start pt-[30px]">
                        <button
                          onClick={() => handleAddTestGroupToSample(sample.id)}
                          disabled={filteredGroups.length === 0}
                          className="rounded-xl bg-emerald-900 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Add Test Group
                        </button>
                      </div>
                    </div>

                    {selectedGroupChildItems.length > 0 && (
                      <div className="mt-4 rounded-xl border border-emerald-200 bg-white p-3">
                        <p className="text-xs font-semibold text-emerald-900">
                          此檢測組包含：
                        </p>
                        <p className="mt-2 text-xs leading-6 text-slate-700">
                          {selectedGroupChildItems
                            .map(({ groupItem, testItem }) => {
                              return (
                                groupItem.display_name_override ||
                                testItem.item_name_zh
                              );
                            })
                            .join("、")}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 overflow-x-auto">
                    <table className="w-full min-w-[900px] border-collapse text-sm">
                      <thead>
                        <tr className="bg-slate-100">
                          <th className="border border-slate-200 px-4 py-3 text-center align-middle">
                            Description
                          </th>
                          <th className="border border-slate-200 px-4 py-3 text-center align-middle">
                            Test Item
                          </th>
                          <th className="border border-slate-200 px-4 py-3 text-center align-middle">
                            Source
                          </th>
                          <th className="border border-slate-200 px-4 py-3 text-center align-middle">
                            Unit Price
                          </th>
                          <th className="border border-slate-200 px-4 py-3 text-center align-middle">
                            Qty
                          </th>
                          <th className="border border-slate-200 px-4 py-3 text-center align-middle">
                            Total
                          </th>
                          <th className="border border-slate-200 px-4 py-3 text-center align-middle">
                            Action
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {sampleTableRows.map((row) => (
                          <tr key={row.rowKey}>
                            {row.isFirstGroupRow && (
                              <td
                                rowSpan={row.groupRowSpan}
                                className="border border-slate-200 px-4 py-3 text-center align-middle"
                              >
                                {row.groupDescription}
                              </td>
                            )}

                            <td className="border border-slate-200 px-4 py-3 text-center align-middle font-semibold">
                              {row.item.testItemName}
                            </td>

                            {row.isFirstGroupRow && (
                              <>
                                <td
                                  rowSpan={row.groupRowSpan}
                                  className="border border-slate-200 px-4 py-3 text-center align-middle"
                                >
                                  {row.item.sourceGroupName ? (
                                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                                      {row.item.sourceGroupName}
                                    </span>
                                  ) : (
                                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                                      Single
                                    </span>
                                  )}
                                </td>

                                <td
                                  rowSpan={row.groupRowSpan}
                                  className="border border-slate-200 px-4 py-3 text-center align-middle"
                                >
                                  MOP {row.groupUnitPrice.toLocaleString()}
                                </td>

                                <td
                                  rowSpan={row.groupRowSpan}
                                  className="border border-slate-200 px-4 py-3 text-center align-middle"
                                >
                                  <input
                                    type="number"
                                    min="1"
                                    value={row.groupQuantity}
                                    onChange={(event) => {
                                      if (row.item.sourceGroupId) {
                                        handleUpdateGroupQuantity(
                                          sample.id,
                                          row.item.sourceGroupId,
                                          Number(event.target.value)
                                        );
                                        return;
                                      }

                                      handleUpdateItemQuantity(
                                        sample.id,
                                        row.item.id,
                                        Number(event.target.value)
                                      );
                                    }}
                                    className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-center"
                                  />
                                </td>

                                <td
                                  rowSpan={row.groupRowSpan}
                                  className="border border-slate-200 px-4 py-3 text-center align-middle"
                                >
                                  {row.groupTotal.toLocaleString()}
                                </td>

                                <td
                                  rowSpan={row.groupRowSpan}
                                  className="border border-slate-200 px-4 py-3 text-center align-middle"
                                >
                                  {row.item.sourceGroupId ? (
                                    <button
                                      onClick={() =>
                                        handleRemoveGroupFromSample(
                                          sample.id,
                                          row.item.sourceGroupId!
                                        )
                                      }
                                      className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                                    >
                                      Remove Group
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() =>
                                        handleRemoveItemFromSample(
                                          sample.id,
                                          row.item.id
                                        )
                                      }
                                      className="rounded-lg border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50"
                                    >
                                      Remove
                                    </button>
                                  )}
                                </td>
                              </>
                            )}
                          </tr>
                        ))}

                        {sampleTableRows.length === 0 && (
                          <tr>
                            <td
                              colSpan={7}
                              className="border border-slate-200 px-4 py-6 text-center align-middle text-slate-500"
                            >
                              No test items added for this sample.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}

            {samples.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
                No samples yet. Please add a sample first.
              </div>
            )}
          </div>

          <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Discount 折扣設定
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  可選擇百分比折扣或固定金額折扣，系統會自動計算應付總額。
                </p>
              </div>

              <div className="rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm text-slate-700">
                Subtotal 小計：MOP {formatMoney(totalAmount)}
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Discount Type 折扣類型
                </label>
                <select
                  value={discountType}
                  onChange={(event) => {
                    const nextDiscountType = normalizeDiscountType(
                      event.target.value
                    );

                    setDiscountType(nextDiscountType);

                    if (nextDiscountType === "none") {
                      setDiscountValue(0);
                    }
                  }}
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-900"
                >
                  <option value="none">No Discount／不設折扣</option>
                  <option value="percentage">
                    Percentage／百分比折扣
                  </option>
                  <option value="fixed">Fixed Amount／固定金額折扣</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  {discountType === "percentage"
                    ? "Discount Percentage 折扣百分比 (%)"
                    : discountType === "fixed"
                      ? "Discount Amount 折扣金額 (MOP)"
                      : "Discount Value 折扣數值"}
                </label>
                <input
                  type="number"
                  min="0"
                  max={discountType === "percentage" ? 100 : undefined}
                  step="0.01"
                  value={discountValue}
                  onChange={(event) => {
                    const nextValue = Number(event.target.value);

                    if (Number.isNaN(nextValue) || nextValue < 0) {
                      setDiscountValue(0);
                      return;
                    }

                    if (discountType === "percentage") {
                      setDiscountValue(Math.min(nextValue, 100));
                      return;
                    }

                    setDiscountValue(nextValue);
                  }}
                  disabled={discountType === "none"}
                  placeholder={
                    discountType === "percentage"
                      ? "例如：10 代表 10%"
                      : "例如：500 代表 MOP 500"
                  }
                  className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                />
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Subtotal 小計
                </p>
                <p className="mt-2 text-lg font-bold text-slate-900">
                  MOP {formatMoney(totalAmount)}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Discount 折扣
                </p>
                <p className="mt-2 text-lg font-bold text-red-600">
                  - MOP {formatMoney(discountAmount)}
                </p>
              </div>

              <div className="rounded-xl border border-slate-900 bg-slate-900 p-4 text-white">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">
                  Total 應付總額
                </p>
                <p className="mt-2 text-lg font-bold">
                  MOP {formatMoney(finalTotalAmount)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            Internal cost reference: RMB {formatMoney(totalLabCostRmb)}.
            Customer quotation subtotal: MOP {formatMoney(totalAmount)}.
            Discount: MOP {formatMoney(discountAmount)}.
            Customer quotation total: MOP {formatMoney(finalTotalAmount)}.
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-6">
            <div className="w-36" />
            <h2 className="text-center text-3xl font-bold tracking-wide text-slate-900">QUOTATION</h2>
            <div className="flex flex-wrap justify-end gap-2">
              {isPreviewEditing ? (
                <>
                  <button type="button" onClick={cancelPreviewEdit}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:bg-slate-100">
                    Cancel
                  </button>
                  <button type="button" onClick={handleSaveDraft}
                    disabled={saving || loading || loadingEditQuotation}
                    className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60">
                    {saving ? "Saving..." : isEditMode ? "Save Changes" : "Save Quotation"}
                  </button>
                </>
              ) : (
                <button type="button" onClick={beginPreviewEdit}
                  disabled={loading || loadingEditQuotation}
                  className="rounded-lg border border-blue-300 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60">
                  Edit Quotation
                </button>
              )}
            </div>
          </div>
          {isPreviewEditing && (
            <p className="mt-3 text-sm text-blue-700">
              直接修改以下欄位；只有按 Save Changes / Save Quotation 才會儲存至 Supabase。
              客戶及檢測項目主資料不會被修改。
            </p>
          )}

          <div className="mt-8 grid grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                <p className="font-semibold text-slate-700">TO:</p>
                {isPreviewEditing ?
                  <input aria-label="Quotation customer name" value={previewCustomerName}
                    onChange={e => setClientNameOverride(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /> :
                  <p className="text-slate-900">{previewCustomerName || "-"}</p>}
              </div>
              <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                <p className="font-semibold text-slate-700">ATTN:</p>
                {isPreviewEditing ?
                  <input aria-label="Quotation contact person" value={previewAttention}
                    onChange={e => setAttentionOverride(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /> :
                  <p className="text-slate-900">{previewAttention || "-"}</p>}
              </div>
              <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                <p className="font-semibold text-slate-700">DATE:</p>
                {isPreviewEditing ?
                  <input aria-label="Quotation date" type="date" value={quotationDate}
                    onChange={e => setQuotationDate(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /> :
                  <p className="text-slate-900">{formatQuotationDate(quotationDate)}</p>}
              </div>
              <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                <p className="font-semibold text-slate-700">NO.:</p>
                {isPreviewEditing ?
                  <input aria-label="Quotation number" value={editingQuotationNo}
                    onChange={e => setEditingQuotationNo(e.target.value)} placeholder="Leave blank for automatic number"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /> :
                  <p className="text-slate-900">{editingQuotationNo || "Auto after Save Draft"}</p>}
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                <p className="font-semibold text-slate-700">FROM:</p>
                {isPreviewEditing ?
                  <input aria-label="Sender" value={senderName}
                    onChange={e => setSenderName(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /> :
                  <p className="text-slate-900">{senderName || "EMIT"}</p>}
              </div>
              <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                <p className="font-semibold text-slate-700">TEL:</p>
                {isPreviewEditing ?
                  <input aria-label="Customer phone on quotation" value={previewTel}
                    onChange={e => setTelOverride(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /> :
                  <p className="text-slate-900">{previewTel || "-"}</p>}
              </div>
              <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                <p className="font-semibold text-slate-700">FAX:</p>
                {isPreviewEditing ?
                  <input aria-label="Customer fax on quotation" value={previewFax}
                    onChange={e => setFaxOverride(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /> :
                  <p className="text-slate-900">{previewFax || "-"}</p>}
              </div>
              <div className="grid grid-cols-[100px_1fr] items-center gap-4">
                <p className="font-semibold text-slate-700">EMAIL:</p>
                {isPreviewEditing ?
                  <input aria-label="Customer email on quotation" type="email" value={previewEmail}
                    onChange={e => setEmailOverride(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /> :
                  <p className="text-slate-900">{previewEmail || "-"}</p>}
              </div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-[160px_1fr] items-center gap-4 border-t border-slate-200 pt-6">
            <p className="font-semibold text-slate-700">Project 項目</p>
            {isPreviewEditing ?
              <input aria-label="Quotation project" value={projectName} onChange={e => setProjectName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /> :
              <p className="text-slate-900">{projectName}</p>}
            <p className="font-semibold text-slate-700">檢測食品描述</p>
            {isPreviewEditing ?
              <textarea aria-label="Quotation project description" rows={2} value={previewProjectDescription}
                onChange={e => setProjectDescriptionOverride(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /> :
              <p className="text-slate-900">{previewProjectDescription}</p>}
          </div>

          <div className="mt-8 overflow-hidden rounded-xl border border-slate-300">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="w-16 border border-slate-300 px-4 py-3 text-center align-middle font-semibold text-slate-700">
                    Item
                  </th>
                  <th className="w-44 border border-slate-300 px-4 py-3 text-center align-middle font-semibold text-slate-700">
                    檢測食品描述
                  </th>
                  <th className="w-56 border border-slate-300 px-4 py-3 text-center align-middle font-semibold text-slate-700">
                    Description 描述
                  </th>
                  <th className="border border-slate-300 px-4 py-3 text-center align-middle font-semibold text-slate-700">
                    檢測項目
                  </th>
                  <th className="w-32 border border-slate-300 px-4 py-3 text-center align-middle font-semibold text-slate-700">
                    Unit Price
                  </th>
                  <th className="w-24 border border-slate-300 px-4 py-3 text-center align-middle font-semibold text-slate-700">
                    Qty
                  </th>
                  <th className="w-32 border border-slate-300 px-4 py-3 text-center align-middle font-semibold text-slate-700">
                    Total
                  </th>
                </tr>
              </thead>

              <tbody>
                {quotationPreviewRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="border border-slate-300 px-4 py-10 text-center align-middle text-slate-500"
                    >
                      No quotation items yet.
                    </td>
                  </tr>
                )}

                {quotationPreviewRows.map((row) => (
                  <tr key={row.rowKey}>
                    {row.isFirstSampleRow && (
                      <>
                        <td
                          rowSpan={row.sampleItemCount}
                          className="border border-slate-300 px-4 py-3 text-center align-middle text-slate-900"
                        >
                          {row.sampleIndex + 1}
                        </td>

                        <td
                          rowSpan={row.sampleItemCount}
                          className="border border-slate-300 px-4 py-3 text-center align-middle font-medium text-slate-900"
                        >
                          {isPreviewEditing ? (
                            <input aria-label={`Sample ${row.sampleIndex + 1} name`} value={row.sampleName}
                              onChange={e => updateSampleNameInPreview(row.sampleId, e.target.value)}
                              className="w-full min-w-24 rounded border border-slate-300 px-1 py-1 text-center text-sm" />
                          ) : row.sampleName}
                        </td>
                      </>
                    )}

                    {row.isFirstDescriptionRow && (
                      <td
                        rowSpan={row.descriptionRowSpan}
                        className="border border-slate-300 px-4 py-3 text-center align-middle text-slate-900"
                      >
                        <div className="font-semibold">
                          {isPreviewEditing ? (
                            <input aria-label={`Description group ${row.item.id}`} value={row.item.testCategoryName}
                              onChange={e => updateDescriptionGroupInPreview(row.sampleId, row.item.id, e.target.value)}
                              className="w-full min-w-24 rounded border border-slate-300 px-1 py-1 text-center text-sm" />
                          ) : row.item.testCategoryName}
                        </div>
                        {row.item.sourceGroupCode && (
                          <div className="mt-1 text-[11px] text-emerald-700">
                            {row.item.sourceGroupCode}
                          </div>
                        )}
                      </td>
                    )}

                    <td className="border border-slate-300 px-4 py-3 text-center align-middle text-slate-900">
                      {isPreviewEditing ? (
                        <input aria-label={`Test item ${row.item.id}`} value={row.item.testItemName}
                          onChange={e => updateSampleItemInPreview(row.sampleId, row.item.id, { testItemName: e.target.value })}
                          className="w-full min-w-28 rounded border border-slate-300 px-1 py-1 text-center text-sm" />
                      ) : row.item.testItemName}
                    </td>

                    {row.isFirstPriceGroupRow && (
                      <>
                        <td
                          rowSpan={row.priceGroupRowSpan}
                          className="border border-slate-300 px-4 py-3 text-center align-middle text-slate-900"
                        >
                          {isPreviewEditing ? (
                            <div className="flex items-center gap-1">
                              <span>MOP</span>
                              <input aria-label={`Price of ${row.priceGroupKey}`} type="number" min="0" step="0.01"
                                value={row.priceGroupUnitPrice}
                                onChange={e => updatePriceGroupInPreview(row.sampleId, row.priceGroupKey, Number(e.target.value))}
                                className="w-24 rounded border border-slate-300 px-1 py-1 text-center text-sm" />
                            </div>
                          ) : <>MOP {row.priceGroupUnitPrice.toLocaleString()}</>}
                        </td>

                        <td
                          rowSpan={row.priceGroupRowSpan}
                          className="border border-slate-300 px-4 py-3 text-center align-middle text-slate-900"
                        >
                          <input
                            type="number"
                            min="1"
                            value={row.priceGroupQuantity}
                            onChange={(event) => {
                              if (row.item.sourceGroupId) {
                                handleUpdateGroupQuantity(
                                  row.sampleId,
                                  row.item.sourceGroupId,
                                  Number(event.target.value)
                                );
                                return;
                              }

                              handleUpdateItemQuantity(
                                row.sampleId,
                                row.item.id,
                                Number(event.target.value)
                              );
                            }}
                            className="mx-auto w-16 rounded-lg border border-slate-300 px-2 py-1 text-center outline-none focus:border-slate-900"
                          />
                        </td>

                        <td
                          rowSpan={row.priceGroupRowSpan}
                          className="border border-slate-300 px-4 py-3 text-center align-middle text-slate-900"
                        >
                          {row.priceGroupTotal.toLocaleString()}
                        </td>
                      </>
                    )}
                  </tr>
                ))}

                <tr className="bg-slate-50">
                  <td
                    colSpan={6}
                    className="border border-slate-300 px-4 py-3 text-center align-middle font-bold text-slate-900"
                  >
                    Subtotal 小計(MOP)：
                  </td>
                  <td className="border border-slate-300 px-4 py-3 text-center align-middle font-bold text-slate-900">
                    {formatMoney(totalAmount)}
                  </td>
                </tr>

                <tr className="bg-slate-50">
                  <td
                    colSpan={6}
                    className="border border-slate-300 px-4 py-3 text-center align-middle font-bold text-slate-900"
                  >
                    {isPreviewEditing ? (
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <span>Discount 折扣：</span>
                        <select aria-label="Preview discount type" value={discountType}
                          onChange={e => {
                            const type = normalizeDiscountType(e.target.value);
                            setDiscountType(type);
                            if (type === "none") setDiscountValue(0);
                          }} className="rounded border border-slate-300 bg-white px-2 py-1 text-sm">
                          <option value="none">None</option>
                          <option value="percentage">%</option>
                          <option value="fixed">MOP</option>
                        </select>
                        <input aria-label="Preview discount value" type="number" min="0"
                          max={discountType === "percentage" ? 100 : undefined}
                          step="0.01" disabled={discountType === "none"}
                          value={discountValue}
                          onChange={e => {
                            const value = Number(e.target.value);
                            if (Number.isFinite(value) && value >= 0)
                              setDiscountValue(discountType === "percentage" ? Math.min(100, value) : value);
                          }} className="w-24 rounded border border-slate-300 bg-white px-2 py-1 text-sm" />
                      </div>
                    ) : discountPreviewLabel}
                  </td>
                  <td className="border border-slate-300 px-4 py-3 text-center align-middle font-bold text-red-600">
                    {discountAmount > 0
                      ? `-${formatMoney(discountAmount)}`
                      : "0"}
                  </td>
                </tr>

                <tr className="bg-slate-100">
                  <td
                    colSpan={6}
                    className="border border-slate-300 px-4 py-3 text-center align-middle font-bold text-slate-900"
                  >
                    Total 應付總額(MOP)：
                  </td>
                  <td className="border border-slate-300 px-4 py-3 text-center align-middle font-bold text-slate-900">
                    {formatMoney(finalTotalAmount)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
            <h3 className="font-semibold text-slate-900">Notes:</h3>
            {isPreviewEditing ? (
              <textarea aria-label="Quotation notes" value={quotationNotes}
                onChange={e => setQuotationNotes(e.target.value)} rows={4}
                className="mt-3 w-full rounded-lg border border-slate-300 bg-white p-3 text-sm" />
            ) : <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-700">
              {(quotationNotes || DEFAULT_NOTES)
                .split("\n")
                .filter(Boolean)
                .map((note, index) => (
                  <li key={`${note}-${index}`}>{note}</li>
                ))}
            </ol>}
          </div>

          <div className="mt-8 space-y-5 text-sm leading-7 text-slate-700">
            <p>
              Dear {previewAttention || "Client"}, this
              quotation has been developed based on information provided.
            </p>

            <p>
              Acceptance of this quotation is required within 90 days from date
              of issue.
            </p>

            <p>Yours Sincerely,</p>

            <div className="grid grid-cols-[1fr_520px] gap-12 pt-2">
              <div>
                <p className="font-semibold text-slate-900">
                  For and on behalf of
                </p>
                <p className="font-semibold text-slate-900">
                  EMIT Environment Monitoring Inspection and Testing Co. Ltd.
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

                <p className="mt-2 text-sm text-slate-500">
                  Company Chop and Authorized Signature
                </p>
              </div>

              <div className="pt-[31px]">
                <p className="font-semibold text-slate-900">
                  Name of Signatory:
                </p>

                <div className="mt-16 border-b border-slate-400">
                  {signatoryName && (
                    <p className="pb-1 text-sm text-slate-900">
                      {signatoryName}
                    </p>
                  )}
                </div>

                <p className="mt-3 text-sm text-slate-500">Signature</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

export default function QuotationsPage() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <div className="mx-auto max-w-7xl">
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <p className="text-sm text-slate-500">Loading quotation form...</p>
            </div>
          </div>
        </AppShell>
      }
    >
      <QuotationsPageContent />
    </Suspense>
  );
}

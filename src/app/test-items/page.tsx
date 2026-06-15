"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase/client";

const EMIT_COMPANY_ID = "11111111-1111-1111-1111-111111111111";
const DEFAULT_ITEM_CODE_PREFIX = "MICRO-";

type TestCategory = {
  id: string;
  company_id: string;
  category_name: string;
};

type Vendor = {
  id: string;
  company_id: string;
  vendor_name: string;
};

type TestItem = {
  id: string;
  company_id: string;
  category_id: string | null;
  vendor_id: string | null;
  item_code: string | null;
  item_name_zh: string;
  item_name_en: string | null;
  major_category: string | null;
  testing_object: string | null;
  test_standard: string | null;
  lab_price_rmb: number;
  customer_price_mop: number;
  currency_lab: string;
  currency_customer: string;
  turnaround_text: string | null;
  is_accredited: boolean;
  show_in_quotation: boolean;
  is_active: boolean;
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

type FormState = {
  itemCode: string;
  itemNameZh: string;
  itemNameEn: string;
  categoryId: string;
  vendorId: string;
  majorCategory: string;
  testingObject: string;
  testStandard: string;
  labPriceRmb: string;
  customerPriceMop: string;
  turnaroundText: string;
  isAccredited: boolean;
  showInQuotation: boolean;
  isActive: boolean;
};

type GroupFormState = {
  groupCode: string;
  groupNameZh: string;
  groupNameEn: string;
  description: string;
  customerGroupPriceMop: string;
  labGroupPriceRmb: string;
  priceMode: string;
  sortOrder: string;
  isActive: boolean;
};

type DraftGroupItem = {
  localId: string;
  testItemId: string;
  sortOrder: number;
  displayNameOverride: string;
};

const defaultForm: FormState = {
  itemCode: "",
  itemNameZh: "",
  itemNameEn: "",
  categoryId: "",
  vendorId: "",
  majorCategory: "食品",
  testingObject: "食品",
  testStandard: "",
  labPriceRmb: "0",
  customerPriceMop: "",
  turnaroundText: "約 7 個工作天",
  isAccredited: true,
  showInQuotation: true,
  isActive: true,
};

const defaultGroupForm: GroupFormState = {
  groupCode: "",
  groupNameZh: "",
  groupNameEn: "",
  description: "",
  customerGroupPriceMop: "0",
  labGroupPriceRmb: "0",
  priceMode: "sum_items",
  sortOrder: "0",
  isActive: true,
};

function createLocalId() {
  return crypto.randomUUID();
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function getItemCodeParts(itemCode: string | null) {
  const cleanItemCode = (itemCode || "").trim();
  const match = cleanItemCode.match(/^(.+?)(\d+)$/);

  if (!match) {
    return {
      prefix: cleanItemCode || DEFAULT_ITEM_CODE_PREFIX,
      numberText: "",
    };
  }

  return {
    prefix: match[1],
    numberText: match[2],
  };
}

function getPrefixOptionsFromItems(sourceItems: TestItem[]) {
  const prefixSet = new Set<string>();

  sourceItems.forEach((item) => {
    const itemCode = item.item_code || "";
    const parts = getItemCodeParts(itemCode);

    if (parts.prefix) {
      prefixSet.add(parts.prefix);
    }
  });

  if (prefixSet.size === 0) {
    prefixSet.add(DEFAULT_ITEM_CODE_PREFIX);
  }

  return Array.from(prefixSet).sort((a, b) => a.localeCompare(b));
}

function getNextItemCodeForPrefix(
  sourceItems: TestItem[],
  prefix: string,
  excludeItemId: string | null
) {
  const safePrefix = prefix || DEFAULT_ITEM_CODE_PREFIX;
  let maxNumber = 0;
  let digitLength = 3;

  sourceItems.forEach((item) => {
    if (excludeItemId && item.id === excludeItemId) {
      return;
    }

    const itemCode = item.item_code || "";

    if (!itemCode.startsWith(safePrefix)) {
      return;
    }

    const numberText = itemCode.slice(safePrefix.length);

    if (!/^\d+$/.test(numberText)) {
      return;
    }

    const currentNumber = Number(numberText);

    if (!Number.isNaN(currentNumber)) {
      maxNumber = Math.max(maxNumber, currentNumber);
      digitLength = Math.max(digitLength, numberText.length);
    }
  });

  return `${safePrefix}${String(maxNumber + 1).padStart(digitLength, "0")}`;
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

export default function TestItemsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [items, setItems] = useState<TestItem[]>([]);
  const [categories, setCategories] = useState<TestCategory[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  const [groups, setGroups] = useState<TestItemGroup[]>([]);
  const [groupItems, setGroupItems] = useState<TestItemGroupItem[]>([]);

  const [form, setForm] = useState<FormState>(defaultForm);
  const [itemCodePrefix, setItemCodePrefix] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);

  const [groupForm, setGroupForm] =
    useState<GroupFormState>(defaultGroupForm);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupCompanyId, setEditingGroupCompanyId] = useState<
    string | null
  >(null);
  const [draftGroupItems, setDraftGroupItems] = useState<DraftGroupItem[]>([]);
  const [groupItemKeyword, setGroupItemKeyword] = useState("");
  const [selectedGroupTestItemId, setSelectedGroupTestItemId] = useState("");

  const [keyword, setKeyword] = useState("");
  const [groupKeyword, setGroupKeyword] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingGroup, setSavingGroup] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeCompanyId = useMemo(() => {
    return (
      editingCompanyId ||
      editingGroupCompanyId ||
      categories[0]?.company_id ||
      vendors[0]?.company_id ||
      items[0]?.company_id ||
      groups[0]?.company_id ||
      EMIT_COMPANY_ID
    );
  }, [
    categories,
    vendors,
    items,
    groups,
    editingCompanyId,
    editingGroupCompanyId,
  ]);

  const itemCodePrefixOptions = useMemo(() => {
    const options = getPrefixOptionsFromItems(items);
    const mergedOptions = new Set(options);

    if (itemCodePrefix) {
      mergedOptions.add(itemCodePrefix);
    }

    return Array.from(mergedOptions).sort((a, b) => a.localeCompare(b));
  }, [items, itemCodePrefix]);

  const itemMap = useMemo(() => {
    const map = new Map<string, TestItem>();

    items.forEach((item) => {
      map.set(item.id, item);
    });

    return map;
  }, [items]);

  const categoryNameMap = useMemo(() => {
    const map = new Map<string, string>();

    categories.forEach((category) => {
      map.set(category.id, category.category_name);
    });

    return map;
  }, [categories]);

  const vendorNameMap = useMemo(() => {
    const map = new Map<string, string>();

    vendors.forEach((vendor) => {
      map.set(vendor.id, vendor.vendor_name);
    });

    return map;
  }, [vendors]);

  const groupItemsMap = useMemo(() => {
    const map = new Map<string, TestItemGroupItem[]>();

    groupItems.forEach((groupItem) => {
      const currentItems = map.get(groupItem.group_id) || [];
      currentItems.push(groupItem);
      map.set(groupItem.group_id, currentItems);
    });

    map.forEach((value, key) => {
      map.set(
        key,
        [...value].sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
      );
    });

    return map;
  }, [groupItems]);

  const filteredItems = useMemo(() => {
    const lowerKeyword = keyword.trim().toLowerCase();

    if (!lowerKeyword) {
      return items;
    }

    return items.filter((item) => {
      return (
        item.item_code?.toLowerCase().includes(lowerKeyword) ||
        item.item_name_zh.toLowerCase().includes(lowerKeyword) ||
        item.item_name_en?.toLowerCase().includes(lowerKeyword) ||
        item.major_category?.toLowerCase().includes(lowerKeyword) ||
        item.testing_object?.toLowerCase().includes(lowerKeyword) ||
        item.test_standard?.toLowerCase().includes(lowerKeyword)
      );
    });
  }, [items, keyword]);

  const filteredGroupPickerItems = useMemo(() => {
    const lowerKeyword = groupItemKeyword.trim().toLowerCase();
    const activeItems = items.filter((item) => item.is_active);

    if (!lowerKeyword) {
      return activeItems;
    }

    return activeItems.filter((item) => {
      return (
        item.item_code?.toLowerCase().includes(lowerKeyword) ||
        item.item_name_zh.toLowerCase().includes(lowerKeyword) ||
        item.item_name_en?.toLowerCase().includes(lowerKeyword) ||
        item.major_category?.toLowerCase().includes(lowerKeyword) ||
        item.testing_object?.toLowerCase().includes(lowerKeyword) ||
        item.test_standard?.toLowerCase().includes(lowerKeyword)
      );
    });
  }, [items, groupItemKeyword]);

  const filteredGroups = useMemo(() => {
    const lowerKeyword = normalizeText(groupKeyword);

    if (!lowerKeyword) {
      return groups;
    }

    return groups.filter((group) => {
      const children = groupItemsMap.get(group.id) || [];
      const childrenText = children
        .map((child) => {
          const childItem = itemMap.get(child.test_item_id);

          return [
            child.display_name_override || "",
            childItem?.item_code || "",
            childItem?.item_name_zh || "",
            childItem?.item_name_en || "",
          ].join(" ");
        })
        .join(" ");

      const searchText = [
        group.group_code,
        group.group_name_zh,
        group.group_name_en || "",
        group.description || "",
        childrenText,
      ].join(" ");

      return normalizeText(searchText).includes(lowerKeyword);
    });
  }, [groups, groupKeyword, groupItemsMap, itemMap]);

  const totalLabPrice = useMemo(() => {
    return items
      .filter((item) => item.is_active)
      .reduce((sum, item) => sum + Number(item.lab_price_rmb || 0), 0);
  }, [items]);

  const totalCustomerPrice = useMemo(() => {
    return items
      .filter((item) => item.is_active && item.show_in_quotation)
      .reduce((sum, item) => sum + Number(item.customer_price_mop || 0), 0);
  }, [items]);

  async function loadInitialData() {
    try {
      setLoading(true);
      setErrorMessage("");

      const [itemsResult, categoriesResult, vendorsResult] = await Promise.all([
        supabase
          .from("test_items")
          .select(
            "id,company_id,category_id,vendor_id,item_code,item_name_zh,item_name_en,major_category,testing_object,test_standard,lab_price_rmb,customer_price_mop,currency_lab,currency_customer,turnaround_text,is_accredited,show_in_quotation,is_active"
          )
          .is("deleted_at", null)
          .order("item_code", { ascending: true }),

        supabase
          .from("test_categories")
          .select("id,company_id,category_name")
          .eq("is_active", true)
          .is("deleted_at", null)
          .order("sort_order", { ascending: true }),

        supabase
          .from("vendors")
          .select("id,company_id,vendor_name")
          .eq("is_active", true)
          .is("deleted_at", null)
          .order("vendor_name", { ascending: true }),
      ]);

      if (itemsResult.error) {
        throw itemsResult.error;
      }

      if (categoriesResult.error) {
        throw categoriesResult.error;
      }

      if (vendorsResult.error) {
        throw vendorsResult.error;
      }

      const loadedItems = (itemsResult.data ?? []) as TestItem[];
      const loadedCategories = (categoriesResult.data ?? []) as TestCategory[];
      const loadedVendors = (vendorsResult.data ?? []) as Vendor[];

      const loadedPrefixOptions = getPrefixOptionsFromItems(loadedItems);
      const nextPrefix =
        itemCodePrefix || loadedPrefixOptions[0] || DEFAULT_ITEM_CODE_PREFIX;

      setItems(loadedItems);
      setCategories(loadedCategories);
      setVendors(loadedVendors);
      setItemCodePrefix(nextPrefix);

      setForm((current) => ({
        ...current,
        itemCode:
          editingItemId || current.itemCode
            ? current.itemCode
            : getNextItemCodeForPrefix(loadedItems, nextPrefix, null),
        categoryId: current.categoryId || loadedCategories[0]?.id || "",
        vendorId: current.vendorId || loadedVendors[0]?.id || "",
      }));

      await loadGroupData();

      return {
        loadedItems,
        loadedCategories,
        loadedVendors,
      };
    } catch (error) {
      console.error("Load test items data error:", error);
      setErrorMessage(getErrorMessage(error, "Failed to load data."));
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function loadGroupData() {
    try {
      const { data: groupData, error: groupError } = await supabase
        .from("test_item_groups")
        .select(
          "id,company_id,group_code,group_name_zh,group_name_en,description,customer_group_price_mop,lab_group_price_rmb,price_mode,sort_order,is_active"
        )
        .is("deleted_at", null)
        .order("sort_order", { ascending: true })
        .order("group_code", { ascending: true });

      if (groupError) {
        console.warn("Load test item groups warning:", groupError);
        setGroups([]);
        setGroupItems([]);
        return;
      }

      const loadedGroups = (groupData ?? []) as TestItemGroup[];
      setGroups(loadedGroups);

      if (loadedGroups.length === 0) {
        setGroupItems([]);
        return;
      }

      const groupIds = loadedGroups.map((group) => group.id);

      const { data: groupItemData, error: groupItemError } = await supabase
        .from("test_item_group_items")
        .select(
          "id,company_id,group_id,test_item_id,sort_order,display_name_override"
        )
        .in("group_id", groupIds)
        .is("deleted_at", null)
        .order("sort_order", { ascending: true });

      if (groupItemError) {
        console.warn("Load test item group items warning:", groupItemError);
        setGroupItems([]);
        return;
      }

      setGroupItems((groupItemData ?? []) as TestItemGroupItem[]);
    } catch (error) {
      console.warn("Load group data warning:", error);
      setGroups([]);
      setGroupItems([]);
    }
  }

  function handleChangeItemCodePrefix(prefix: string) {
    const safePrefix = prefix || DEFAULT_ITEM_CODE_PREFIX;
    setItemCodePrefix(safePrefix);

    setForm((current) => {
      const currentParts = getItemCodeParts(current.itemCode);

      if (editingItemId && currentParts.prefix === safePrefix) {
        return current;
      }

      return {
        ...current,
        itemCode: getNextItemCodeForPrefix(items, safePrefix, editingItemId),
      };
    });
  }

  function resetForm(sourceItems: TestItem[] = items, clearMessages = true) {
    const nextPrefix =
      itemCodePrefix ||
      getPrefixOptionsFromItems(sourceItems)[0] ||
      DEFAULT_ITEM_CODE_PREFIX;

    setItemCodePrefix(nextPrefix);

    setForm({
      ...defaultForm,
      itemCode: getNextItemCodeForPrefix(sourceItems, nextPrefix, null),
      categoryId: categories[0]?.id || "",
      vendorId: vendors[0]?.id || "",
    });

    setEditingItemId(null);
    setEditingCompanyId(null);

    if (clearMessages) {
      setErrorMessage("");
      setSuccessMessage("");
    }
  }

  function resetGroupForm(clearMessages = true) {
    setGroupForm(defaultGroupForm);
    setEditingGroupId(null);
    setEditingGroupCompanyId(null);
    setDraftGroupItems([]);
    setGroupItemKeyword("");
    setSelectedGroupTestItemId("");

    if (clearMessages) {
      setErrorMessage("");
      setSuccessMessage("");
    }
  }

  function validateForm() {
    if (!form.itemCode.trim()) {
      return "請輸入 Item Code。";
    }

    if (!form.itemNameZh.trim()) {
      return "請輸入檢測項目中文名稱。";
    }

    if (!form.categoryId) {
      return "請選擇檢測分類。";
    }

    if (!form.vendorId) {
      return "請選擇實驗室 / 廠商。";
    }

    const labPrice = Number(form.labPriceRmb);
    const customerPrice = Number(form.customerPriceMop);

    if (Number.isNaN(labPrice) || labPrice < 0) {
      return "請輸入正確的實驗室價錢 RMB。";
    }

    if (Number.isNaN(customerPrice) || customerPrice < 0) {
      return "請輸入正確的客戶報價 MOP。";
    }

    return "";
  }

  function validateGroupForm() {
    if (!groupForm.groupCode.trim()) {
      return "請輸入 Group Code。";
    }

    if (!groupForm.groupNameZh.trim()) {
      return "請輸入檢測組中文名稱。";
    }

    const customerGroupPrice = Number(groupForm.customerGroupPriceMop || 0);
    const labGroupPrice = Number(groupForm.labGroupPriceRmb || 0);
    const sortOrder = Number(groupForm.sortOrder || 0);

    if (Number.isNaN(customerGroupPrice) || customerGroupPrice < 0) {
      return "請輸入正確的檢測組客戶價 MOP。";
    }

    if (Number.isNaN(labGroupPrice) || labGroupPrice < 0) {
      return "請輸入正確的檢測組實驗室價 RMB。";
    }

    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      return "Sort Order 必須是 0 或以上整數。";
    }

    if (draftGroupItems.length === 0) {
      return "請至少加入一個檢測項目到檢測組。";
    }

    return "";
  }

  async function handleSaveItem() {
    const validationError = validateForm();

    if (validationError) {
      setErrorMessage(validationError);
      setSuccessMessage("");
      return;
    }

    try {
      setSaving(true);
      setErrorMessage("");
      setSuccessMessage("");

      const selectedCategory = categories.find(
        (category) => category.id === form.categoryId
      );

      const selectedVendor = vendors.find(
        (vendor) => vendor.id === form.vendorId
      );

      const payload = {
        company_id:
          editingCompanyId ||
          selectedCategory?.company_id ||
          selectedVendor?.company_id ||
          activeCompanyId,
        category_id: form.categoryId,
        vendor_id: form.vendorId,
        item_code: form.itemCode.trim(),
        item_name_zh: form.itemNameZh.trim(),
        item_name_en: form.itemNameEn.trim() || null,
        major_category: form.majorCategory.trim() || null,
        testing_object: form.testingObject.trim() || null,
        test_standard: form.testStandard.trim() || null,
        lab_price_rmb: Number(form.labPriceRmb),
        customer_price_mop: Number(form.customerPriceMop),
        currency_lab: "RMB",
        currency_customer: "MOP",
        turnaround_text: form.turnaroundText.trim() || null,
        accreditation_required: form.isAccredited,
        is_accredited: form.isAccredited,
        show_in_quotation: form.isActive ? form.showInQuotation : false,
        is_active: form.isActive,
      };

      if (editingItemId) {
        const { error } = await supabase
          .from("test_items")
          .update(payload)
          .eq("id", editingItemId);

        if (error) {
          throw error;
        }

        setSuccessMessage("檢測項目已更新。");
      } else {
        const { error } = await supabase.from("test_items").insert(payload);

        if (error) {
          throw error;
        }

        setSuccessMessage("檢測項目已新增。");
      }

      const loadedData = await loadInitialData();

      resetForm(loadedData?.loadedItems || items, false);
    } catch (error) {
      console.error("Save test item error:", error);
      setErrorMessage(getErrorMessage(error, "Failed to save test item."));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveGroup() {
    const validationError = validateGroupForm();

    if (validationError) {
      setErrorMessage(validationError);
      setSuccessMessage("");
      return;
    }

    try {
      setSavingGroup(true);
      setErrorMessage("");
      setSuccessMessage("");

      const cleanGroupCode = groupForm.groupCode.trim();
      const groupPayload = {
        company_id: editingGroupCompanyId || activeCompanyId,
        group_code: cleanGroupCode,
        group_name_zh: groupForm.groupNameZh.trim(),
        group_name_en: groupForm.groupNameEn.trim() || null,
        description: groupForm.description.trim() || null,
        customer_group_price_mop: Number(
          groupForm.customerGroupPriceMop || 0
        ),
        lab_group_price_rmb: Number(groupForm.labGroupPriceRmb || 0),
        price_mode: groupForm.priceMode || "sum_items",
        sort_order: Number(groupForm.sortOrder || 0),
        is_active: groupForm.isActive,
        updated_at: new Date().toISOString(),
      };

      let targetGroupId = editingGroupId;

      if (editingGroupId) {
        const { error: updateGroupError } = await supabase
          .from("test_item_groups")
          .update(groupPayload)
          .eq("id", editingGroupId);

        if (updateGroupError) {
          throw updateGroupError;
        }
      } else {
        const { data: createdGroup, error: createGroupError } = await supabase
          .from("test_item_groups")
          .insert({
            ...groupPayload,
            created_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (createGroupError) {
          throw createGroupError;
        }

        targetGroupId = createdGroup.id as string;
      }

      if (!targetGroupId) {
        throw new Error("Missing group id after save.");
      }

      const nowText = new Date().toISOString();

      const { error: softDeleteError } = await supabase
        .from("test_item_group_items")
        .update({
          deleted_at: nowText,
          updated_at: nowText,
        })
        .eq("group_id", targetGroupId)
        .is("deleted_at", null);

      if (softDeleteError) {
        throw softDeleteError;
      }

      const groupItemPayload = draftGroupItems.map((draftItem, index) => ({
        company_id: editingGroupCompanyId || activeCompanyId,
        group_id: targetGroupId,
        test_item_id: draftItem.testItemId,
        sort_order:
          Number.isNaN(Number(draftItem.sortOrder)) ||
          Number(draftItem.sortOrder) < 0
            ? (index + 1) * 10
            : Number(draftItem.sortOrder),
        display_name_override:
          draftItem.displayNameOverride.trim() || null,
      }));

      const { error: insertGroupItemsError } = await supabase
        .from("test_item_group_items")
        .insert(groupItemPayload);

      if (insertGroupItemsError) {
        throw insertGroupItemsError;
      }

      setSuccessMessage(
        editingGroupId ? "檢測組已更新。" : "檢測組已新增。"
      );

      resetGroupForm(false);
      await loadGroupData();
    } catch (error) {
      console.error("Save test item group error:", error);
      setErrorMessage(getErrorMessage(error, "Failed to save test group."));
    } finally {
      setSavingGroup(false);
    }
  }

  function handleEditItem(item: TestItem) {
    const codeParts = getItemCodeParts(item.item_code || "");

    setEditingItemId(item.id);
    setEditingCompanyId(item.company_id);
    setItemCodePrefix(codeParts.prefix || DEFAULT_ITEM_CODE_PREFIX);
    setSuccessMessage("");
    setErrorMessage("");

    setForm({
      itemCode: item.item_code || "",
      itemNameZh: item.item_name_zh,
      itemNameEn: item.item_name_en || "",
      categoryId: item.category_id || categories[0]?.id || "",
      vendorId: item.vendor_id || vendors[0]?.id || "",
      majorCategory: item.major_category || "食品",
      testingObject: item.testing_object || "食品",
      testStandard: item.test_standard || "",
      labPriceRmb: String(item.lab_price_rmb),
      customerPriceMop: String(item.customer_price_mop),
      turnaroundText: item.turnaround_text || "約 7 個工作天",
      isAccredited: item.is_accredited,
      showInQuotation: item.show_in_quotation,
      isActive: item.is_active,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleEditGroup(group: TestItemGroup) {
    const children = groupItemsMap.get(group.id) || [];

    setEditingGroupId(group.id);
    setEditingGroupCompanyId(group.company_id);
    setSuccessMessage("");
    setErrorMessage("");

    setGroupForm({
      groupCode: group.group_code || "",
      groupNameZh: group.group_name_zh || "",
      groupNameEn: group.group_name_en || "",
      description: group.description || "",
      customerGroupPriceMop: String(group.customer_group_price_mop || 0),
      labGroupPriceRmb: String(group.lab_group_price_rmb || 0),
      priceMode: group.price_mode || "sum_items",
      sortOrder: String(group.sort_order || 0),
      isActive: group.is_active,
    });

    setDraftGroupItems(
      children.map((child) => ({
        localId: child.id || createLocalId(),
        testItemId: child.test_item_id,
        sortOrder: Number(child.sort_order || 0),
        displayNameOverride: child.display_name_override || "",
      }))
    );

    window.scrollTo({ top: 480, behavior: "smooth" });
  }

  function handleAddItemToDraftGroup() {
    const fallbackItem = filteredGroupPickerItems[0];
    const targetTestItemId = selectedGroupTestItemId || fallbackItem?.id || "";

    if (!targetTestItemId) {
      setErrorMessage("請先選擇要加入檢測組的檢測項目。");
      setSuccessMessage("");
      return;
    }

    const selectedItem = itemMap.get(targetTestItemId);

    if (!selectedItem) {
      setErrorMessage("找不到所選檢測項目。");
      setSuccessMessage("");
      return;
    }

    const duplicated = draftGroupItems.some(
      (draftItem) => draftItem.testItemId === selectedItem.id
    );

    if (duplicated) {
      setErrorMessage("這個檢測項目已經在檢測組內。");
      setSuccessMessage("");
      return;
    }

    const maxSortOrder = draftGroupItems.reduce(
      (maxValue, draftItem) => Math.max(maxValue, Number(draftItem.sortOrder)),
      0
    );

    setDraftGroupItems((currentItems) => [
      ...currentItems,
      {
        localId: createLocalId(),
        testItemId: selectedItem.id,
        sortOrder: maxSortOrder + 10,
        displayNameOverride: "",
      },
    ]);

    setGroupItemKeyword("");
    setSelectedGroupTestItemId("");
    setErrorMessage("");
    setSuccessMessage("");
  }

  function handleRemoveDraftGroupItem(localId: string) {
    setDraftGroupItems((currentItems) =>
      currentItems.filter((item) => item.localId !== localId)
    );
  }

  function handleUpdateDraftGroupItem(
    localId: string,
    fieldName: "sortOrder" | "displayNameOverride",
    value: string
  ) {
    setDraftGroupItems((currentItems) =>
      currentItems.map((item) => {
        if (item.localId !== localId) {
          return item;
        }

        if (fieldName === "sortOrder") {
          return {
            ...item,
            sortOrder: Number(value || 0),
          };
        }

        return {
          ...item,
          displayNameOverride: value,
        };
      })
    );
  }

  function handleApplyNutritionTemplate() {
    const nutritionTargets = [
      {
        keywordList: ["能量"],
        override: "能量",
        sortOrder: 10,
      },
      {
        keywordList: ["总碳水化合物", "總碳水化合物", "碳水化合物"],
        override: "碳水化合物",
        sortOrder: 20,
      },
      {
        keywordList: ["蛋白质", "蛋白質"],
        override: "蛋白質",
        sortOrder: 30,
      },
      {
        keywordList: ["钠（其他产品类）", "鈉（其他產品類）", "钠/钠", "鈉"],
        override: "鈉",
        sortOrder: 40,
      },
      {
        keywordList: ["反式脂肪酸(C18:1n9t + C18:2n6t)", "反式脂肪酸"],
        override: "反式脂肪酸",
        sortOrder: 50,
      },
      {
        keywordList: ["饱和脂肪酸", "飽和脂肪酸"],
        override: "飽和脂肪酸",
        sortOrder: 60,
      },
      {
        keywordList: [
          "总糖(以果糖、葡萄糖、蔗糖、麦芽糖和乳糖之和计)",
          "總糖",
          "总糖",
        ],
        override: "總糖",
        sortOrder: 70,
      },
      {
        keywordList: ["脂肪"],
        override: "脂肪",
        sortOrder: 80,
      },
      {
        keywordList: ["水分/水分(干燥失重)", "水分"],
        override: "水分",
        sortOrder: 90,
      },
      {
        keywordList: ["灰分"],
        override: "灰分",
        sortOrder: 100,
      },
    ];

    const selectedDraftItems: DraftGroupItem[] = [];

    nutritionTargets.forEach((target) => {
      const matchedItem = items.find((item) => {
        const nameText = item.item_name_zh || "";

        return target.keywordList.some((keyword) =>
          normalizeText(nameText).includes(normalizeText(keyword))
        );
      });

      if (!matchedItem) {
        return;
      }

      if (
        selectedDraftItems.some(
          (draftItem) => draftItem.testItemId === matchedItem.id
        )
      ) {
        return;
      }

      selectedDraftItems.push({
        localId: createLocalId(),
        testItemId: matchedItem.id,
        sortOrder: target.sortOrder,
        displayNameOverride: target.override,
      });
    });

    setGroupForm({
      groupCode: "GROUP-NUTRITION-LABEL",
      groupNameZh: "營養標籤",
      groupNameEn: "Nutrition Label",
      description:
        "營養標籤檢測組：能量、碳水化合物、蛋白質、鈉、反式脂肪酸、飽和脂肪酸、總糖、脂肪、水分、灰分。",
      customerGroupPriceMop: "0",
      labGroupPriceRmb: "0",
      priceMode: "sum_items",
      sortOrder: "10",
      isActive: true,
    });

    setDraftGroupItems(selectedDraftItems);
    setEditingGroupId(null);
    setEditingGroupCompanyId(null);
    setErrorMessage("");

    if (selectedDraftItems.length === nutritionTargets.length) {
      setSuccessMessage("已套用營養標籤模板。");
    } else {
      setSuccessMessage(
        `已套用營養標籤模板，但只找到 ${selectedDraftItems.length} 個項目，請檢查是否仍有缺失項目。`
      );
    }
  }

  async function handleToggleQuotation(item: TestItem) {
    try {
      setErrorMessage("");
      setSuccessMessage("");

      const { error } = await supabase
        .from("test_items")
        .update({
          show_in_quotation: !item.show_in_quotation,
        })
        .eq("id", item.id);

      if (error) {
        throw error;
      }

      await loadInitialData();
    } catch (error) {
      console.error("Update quotation visibility error:", error);
      setErrorMessage(
        getErrorMessage(error, "Failed to update quotation visibility.")
      );
    }
  }

  async function handleDisableItem(item: TestItem) {
    const confirmed = window.confirm(
      `確認要停用「${item.item_name_zh}」嗎？停用後不會出現在新的 Quotation，但舊報價資料仍會保留。`
    );

    if (!confirmed) {
      return;
    }

    try {
      setErrorMessage("");
      setSuccessMessage("");

      const { error } = await supabase
        .from("test_items")
        .update({
          is_active: false,
          show_in_quotation: false,
        })
        .eq("id", item.id);

      if (error) {
        throw error;
      }

      setSuccessMessage("檢測項目已停用。");
      await loadInitialData();
    } catch (error) {
      console.error("Disable test item error:", error);
      setErrorMessage(getErrorMessage(error, "Failed to disable item."));
    }
  }

  async function handleEnableItem(item: TestItem) {
    try {
      setErrorMessage("");
      setSuccessMessage("");

      const { error } = await supabase
        .from("test_items")
        .update({
          is_active: true,
        })
        .eq("id", item.id);

      if (error) {
        throw error;
      }

      setSuccessMessage("檢測項目已重新啟用。");
      await loadInitialData();
    } catch (error) {
      console.error("Enable test item error:", error);
      setErrorMessage(getErrorMessage(error, "Failed to enable item."));
    }
  }

  async function handleDisableGroup(group: TestItemGroup) {
    const confirmed = window.confirm(
      `確認要停用檢測組「${group.group_name_zh}」嗎？停用後不會出現在新的 Quotation 檢測組選單。`
    );

    if (!confirmed) {
      return;
    }

    try {
      setErrorMessage("");
      setSuccessMessage("");

      const { error } = await supabase
        .from("test_item_groups")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", group.id);

      if (error) {
        throw error;
      }

      setSuccessMessage("檢測組已停用。");
      await loadGroupData();
    } catch (error) {
      console.error("Disable test item group error:", error);
      setErrorMessage(getErrorMessage(error, "Failed to disable group."));
    }
  }

  async function handleEnableGroup(group: TestItemGroup) {
    try {
      setErrorMessage("");
      setSuccessMessage("");

      const { error } = await supabase
        .from("test_item_groups")
        .update({
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", group.id);

      if (error) {
        throw error;
      }

      setSuccessMessage("檢測組已重新啟用。");
      await loadGroupData();
    } catch (error) {
      console.error("Enable test item group error:", error);
      setErrorMessage(getErrorMessage(error, "Failed to enable group."));
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Test Items 檢測項目管理
            </h1>
            <p className="mt-2 text-slate-500">
              管理檢測項目、檢測組、實驗室價 RMB、客戶價 MOP，以及是否顯示在 Quotation。
            </p>
          </div>

          <button
            onClick={loadInitialData}
            disabled={loading}
            className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Refresh
          </button>
        </div>

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

        <div className="grid gap-6 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Total Items</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">
              {items.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Active Items</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">
              {items.filter((item) => item.is_active).length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Test Groups</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">
              {groups.length}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Active: {groups.filter((group) => group.is_active).length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Price Summary</p>
            <p className="mt-3 text-xl font-bold text-slate-900">
              MOP {totalCustomerPrice.toLocaleString()}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Lab Total: RMB {totalLabPrice.toLocaleString()}
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            {editingItemId
              ? "Edit Test Item 修改檢測項目"
              : "Add Test Item 新增檢測項目"}
          </h2>

          <div className="mt-6 grid gap-4 lg:grid-cols-4">
            <div>
              <label className="text-sm font-medium text-slate-700">
                Item Code
              </label>

              <div className="mt-2 grid grid-cols-[120px_1fr] gap-2">
                <select
                  value={itemCodePrefix}
                  onChange={(event) =>
                    handleChangeItemCodePrefix(event.target.value)
                  }
                  className="w-full rounded-xl border border-slate-300 px-3 py-3 text-sm outline-none focus:border-slate-900"
                >
                  {itemCodePrefixOptions.map((prefix) => (
                    <option key={prefix} value={prefix}>
                      {prefix}
                    </option>
                  ))}
                </select>

                <input
                  value={form.itemCode}
                  readOnly
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none"
                />
              </div>

              <p className="mt-2 text-xs text-slate-500">
                選擇前綴後，系統會按現有最大編號自動 +1。
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                檢測項目中文名稱
              </label>
              <input
                value={form.itemNameZh}
                onChange={(event) =>
                  setForm({ ...form, itemNameZh: event.target.value })
                }
                placeholder="菌落總數"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                English Name
              </label>
              <input
                value={form.itemNameEn}
                onChange={(event) =>
                  setForm({ ...form, itemNameEn: event.target.value })
                }
                placeholder="Total Plate Count"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Category 分類
              </label>
              <select
                value={form.categoryId}
                onChange={(event) =>
                  setForm({ ...form, categoryId: event.target.value })
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
              >
                {categories.length === 0 && (
                  <option value="">No categories loaded</option>
                )}

                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.category_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Vendor / Lab 實驗室
              </label>
              <select
                value={form.vendorId}
                onChange={(event) =>
                  setForm({ ...form, vendorId: event.target.value })
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
              >
                {vendors.length === 0 && (
                  <option value="">No vendors loaded</option>
                )}

                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.vendor_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Major Category
              </label>
              <input
                value={form.majorCategory}
                onChange={(event) =>
                  setForm({ ...form, majorCategory: event.target.value })
                }
                placeholder="食品"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Testing Object
              </label>
              <input
                value={form.testingObject}
                onChange={(event) =>
                  setForm({ ...form, testingObject: event.target.value })
                }
                placeholder="食品"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Turnaround
              </label>
              <input
                value={form.turnaroundText}
                onChange={(event) =>
                  setForm({ ...form, turnaroundText: event.target.value })
                }
                placeholder="約 7 個工作天"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Lab Price RMB 實驗室價
              </label>
              <input
                value={form.labPriceRmb}
                onChange={(event) =>
                  setForm({ ...form, labPriceRmb: event.target.value })
                }
                type="number"
                min="0"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Customer Price MOP 客戶價
              </label>
              <input
                value={form.customerPriceMop}
                onChange={(event) =>
                  setForm({ ...form, customerPriceMop: event.target.value })
                }
                type="number"
                min="0"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="text-sm font-medium text-slate-700">
                Test Standard 檢測標準
              </label>
              <input
                value={form.testStandard}
                onChange={(event) =>
                  setForm({ ...form, testStandard: event.target.value })
                }
                placeholder="GB 5009.12-2023"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.isAccredited}
                onChange={(event) =>
                  setForm({ ...form, isAccredited: event.target.checked })
                }
              />
              ISO / IEC 17025 Accredited
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.showInQuotation}
                onChange={(event) =>
                  setForm({ ...form, showInQuotation: event.target.checked })
                }
                disabled={!form.isActive}
              />
              Show in Quotation
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) =>
                  setForm({
                    ...form,
                    isActive: event.target.checked,
                    showInQuotation: event.target.checked
                      ? form.showInQuotation
                      : false,
                  })
                }
              />
              Active
            </label>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={handleSaveItem}
              disabled={saving}
              className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? "Saving..."
                : editingItemId
                  ? "Update Item"
                  : "Add Item"}
            </button>

            {editingItemId && (
              <button
                onClick={() => resetForm()}
                className="rounded-xl border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancel Edit
              </button>
            )}
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-emerald-900">
                {editingGroupId
                  ? "Edit Test Group 修改檢測組"
                  : "Add Test Group 新增檢測組"}
              </h2>
              <p className="mt-2 text-sm text-emerald-700">
                用於建立「營養標籤」這類套餐／檢測組，Quotation 可一次加入整組項目。
              </p>
            </div>

            <button
              onClick={handleApplyNutritionTemplate}
              className="rounded-xl border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
            >
              套用營養標籤模板
            </button>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-4">
            <div>
              <label className="text-sm font-medium text-slate-700">
                Group Code
              </label>
              <input
                value={groupForm.groupCode}
                onChange={(event) =>
                  setGroupForm({
                    ...groupForm,
                    groupCode: event.target.value,
                  })
                }
                placeholder="GROUP-NUTRITION-LABEL"
                className="mt-2 w-full rounded-xl border border-emerald-300 px-4 py-3 text-sm outline-none focus:border-emerald-900"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                檢測組中文名稱
              </label>
              <input
                value={groupForm.groupNameZh}
                onChange={(event) =>
                  setGroupForm({
                    ...groupForm,
                    groupNameZh: event.target.value,
                  })
                }
                placeholder="營養標籤"
                className="mt-2 w-full rounded-xl border border-emerald-300 px-4 py-3 text-sm outline-none focus:border-emerald-900"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                English Name
              </label>
              <input
                value={groupForm.groupNameEn}
                onChange={(event) =>
                  setGroupForm({
                    ...groupForm,
                    groupNameEn: event.target.value,
                  })
                }
                placeholder="Nutrition Label"
                className="mt-2 w-full rounded-xl border border-emerald-300 px-4 py-3 text-sm outline-none focus:border-emerald-900"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Price Mode
              </label>
              <select
                value={groupForm.priceMode}
                onChange={(event) =>
                  setGroupForm({
                    ...groupForm,
                    priceMode: event.target.value,
                  })
                }
                className="mt-2 w-full rounded-xl border border-emerald-300 px-4 py-3 text-sm outline-none focus:border-emerald-900"
              >
                <option value="sum_items">sum_items：子項目加總</option>
                <option value="group_price">group_price：套餐價</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Customer Group Price MOP
              </label>
              <input
                value={groupForm.customerGroupPriceMop}
                onChange={(event) =>
                  setGroupForm({
                    ...groupForm,
                    customerGroupPriceMop: event.target.value,
                  })
                }
                type="number"
                min="0"
                className="mt-2 w-full rounded-xl border border-emerald-300 px-4 py-3 text-sm outline-none focus:border-emerald-900"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Lab Group Price RMB
              </label>
              <input
                value={groupForm.labGroupPriceRmb}
                onChange={(event) =>
                  setGroupForm({
                    ...groupForm,
                    labGroupPriceRmb: event.target.value,
                  })
                }
                type="number"
                min="0"
                className="mt-2 w-full rounded-xl border border-emerald-300 px-4 py-3 text-sm outline-none focus:border-emerald-900"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Sort Order
              </label>
              <input
                value={groupForm.sortOrder}
                onChange={(event) =>
                  setGroupForm({
                    ...groupForm,
                    sortOrder: event.target.value,
                  })
                }
                type="number"
                min="0"
                className="mt-2 w-full rounded-xl border border-emerald-300 px-4 py-3 text-sm outline-none focus:border-emerald-900"
              />
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={groupForm.isActive}
                  onChange={(event) =>
                    setGroupForm({
                      ...groupForm,
                      isActive: event.target.checked,
                    })
                  }
                />
                Active
              </label>
            </div>

            <div className="lg:col-span-4">
              <label className="text-sm font-medium text-slate-700">
                Description
              </label>
              <textarea
                value={groupForm.description}
                onChange={(event) =>
                  setGroupForm({
                    ...groupForm,
                    description: event.target.value,
                  })
                }
                rows={3}
                placeholder="營養標籤檢測組：能量、碳水化合物、蛋白質、鈉、反式脂肪酸、飽和脂肪酸、總糖、脂肪..."
                className="mt-2 w-full rounded-xl border border-emerald-300 px-4 py-3 text-sm outline-none focus:border-emerald-900"
              />
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <h3 className="text-base font-bold text-emerald-900">
              組內檢測項目 / Group Items
            </h3>

            <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
              <div>
                <label className="text-sm font-medium text-emerald-900">
                  搜尋檢測項目
                </label>
                <input
                  value={groupItemKeyword}
                  onChange={(event) => {
                    setGroupItemKeyword(event.target.value);
                    setSelectedGroupTestItemId("");
                  }}
                  placeholder="例如：能量、鈉、總糖、脂肪"
                  className="mt-2 w-full rounded-xl border border-emerald-300 px-4 py-3 text-sm outline-none focus:border-emerald-900"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-emerald-900">
                  選擇檢測項目
                </label>
                <select
                  value={
                    selectedGroupTestItemId ||
                    filteredGroupPickerItems[0]?.id ||
                    ""
                  }
                  onChange={(event) =>
                    setSelectedGroupTestItemId(event.target.value)
                  }
                  disabled={filteredGroupPickerItems.length === 0}
                  className="mt-2 w-full rounded-xl border border-emerald-300 px-4 py-3 text-sm outline-none focus:border-emerald-900 disabled:bg-emerald-100 disabled:text-emerald-400"
                >
                  {filteredGroupPickerItems.length === 0 && (
                    <option value="">沒有符合的檢測項目</option>
                  )}

                  {filteredGroupPickerItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.item_code} - {item.item_name_zh} / MOP{" "}
                      {Number(item.customer_price_mop || 0).toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleAddItemToDraftGroup}
                  disabled={filteredGroupPickerItems.length === 0}
                  className="rounded-xl bg-emerald-900 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Add to Group
                </button>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr className="bg-white text-left">
                    <th className="border border-emerald-200 px-4 py-3">
                      Sort
                    </th>
                    <th className="border border-emerald-200 px-4 py-3">
                      Code
                    </th>
                    <th className="border border-emerald-200 px-4 py-3">
                      Original Name
                    </th>
                    <th className="border border-emerald-200 px-4 py-3">
                      Display Name Override
                    </th>
                    <th className="border border-emerald-200 px-4 py-3 text-right">
                      Customer MOP
                    </th>
                    <th className="border border-emerald-200 px-4 py-3">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {draftGroupItems
                    .slice()
                    .sort(
                      (a, b) => Number(a.sortOrder) - Number(b.sortOrder)
                    )
                    .map((draftItem) => {
                      const item = itemMap.get(draftItem.testItemId);

                      return (
                        <tr key={draftItem.localId}>
                          <td className="border border-emerald-200 px-4 py-3">
                            <input
                              value={draftItem.sortOrder}
                              onChange={(event) =>
                                handleUpdateDraftGroupItem(
                                  draftItem.localId,
                                  "sortOrder",
                                  event.target.value
                                )
                              }
                              type="number"
                              min="0"
                              className="w-20 rounded-lg border border-emerald-300 px-2 py-1 text-center"
                            />
                          </td>
                          <td className="border border-emerald-200 px-4 py-3">
                            {item?.item_code || "-"}
                          </td>
                          <td className="border border-emerald-200 px-4 py-3 font-semibold">
                            {item?.item_name_zh || "Unknown item"}
                          </td>
                          <td className="border border-emerald-200 px-4 py-3">
                            <input
                              value={draftItem.displayNameOverride}
                              onChange={(event) =>
                                handleUpdateDraftGroupItem(
                                  draftItem.localId,
                                  "displayNameOverride",
                                  event.target.value
                                )
                              }
                              placeholder={item?.item_name_zh || ""}
                              className="w-full rounded-lg border border-emerald-300 px-3 py-2 text-sm outline-none focus:border-emerald-900"
                            />
                          </td>
                          <td className="border border-emerald-200 px-4 py-3 text-right">
                            MOP{" "}
                            {Number(
                              item?.customer_price_mop || 0
                            ).toLocaleString()}
                          </td>
                          <td className="border border-emerald-200 px-4 py-3">
                            <button
                              onClick={() =>
                                handleRemoveDraftGroupItem(draftItem.localId)
                              }
                              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                  {draftGroupItems.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="border border-emerald-200 px-4 py-8 text-center text-emerald-700"
                      >
                        尚未加入組內檢測項目。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={handleSaveGroup}
              disabled={savingGroup}
              className="rounded-xl bg-emerald-900 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingGroup
                ? "Saving..."
                : editingGroupId
                  ? "Update Group"
                  : "Save Group"}
            </button>

            {editingGroupId && (
              <button
                onClick={() => resetGroupForm()}
                className="rounded-xl border border-emerald-300 px-6 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-50"
              >
                Cancel Edit
              </button>
            )}
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-emerald-900">
                Test Group List 檢測組列表
              </h2>
              <p className="mt-1 text-sm text-emerald-700">
                Quotation 頁面可以直接選擇這些檢測組，一次加入整組檢測項目。
              </p>
            </div>

            <input
              value={groupKeyword}
              onChange={(event) => setGroupKeyword(event.target.value)}
              placeholder="Search test group..."
              className="w-80 rounded-xl border border-emerald-300 px-4 py-3 text-sm outline-none focus:border-emerald-900"
            />
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[1200px] border-collapse text-sm">
              <thead>
                <tr className="bg-emerald-50 text-left">
                  <th className="border border-emerald-200 px-4 py-3">
                    Code
                  </th>
                  <th className="border border-emerald-200 px-4 py-3">
                    Action
                  </th>
                  <th className="border border-emerald-200 px-4 py-3">
                    Group Name
                  </th>
                  <th className="border border-emerald-200 px-4 py-3">
                    Items
                  </th>
                  <th className="border border-emerald-200 px-4 py-3">
                    Price Mode
                  </th>
                  <th className="border border-emerald-200 px-4 py-3 text-right">
                    Customer MOP
                  </th>
                  <th className="border border-emerald-200 px-4 py-3 text-right">
                    Lab RMB
                  </th>
                  <th className="border border-emerald-200 px-4 py-3">
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredGroups.map((group) => {
                  const children = groupItemsMap.get(group.id) || [];

                  return (
                    <tr key={group.id}>
                      <td className="border border-emerald-200 px-4 py-3">
                        {group.group_code}
                      </td>

                      <td className="border border-emerald-200 px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleEditGroup(group)}
                            className="rounded-lg border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
                          >
                            Edit
                          </button>

                          {group.is_active ? (
                            <button
                              onClick={() => handleDisableGroup(group)}
                              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                            >
                              Disable
                            </button>
                          ) : (
                            <button
                              onClick={() => handleEnableGroup(group)}
                              className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                            >
                              Enable
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="border border-emerald-200 px-4 py-3 font-semibold text-slate-900">
                        {group.group_name_zh}
                        {group.group_name_en && (
                          <p className="mt-1 text-xs font-normal text-slate-500">
                            {group.group_name_en}
                          </p>
                        )}
                        {group.description && (
                          <p className="mt-1 text-xs font-normal text-slate-500">
                            {group.description}
                          </p>
                        )}
                      </td>

                      <td className="border border-emerald-200 px-4 py-3">
                        <p className="font-semibold">{children.length} items</p>
                        <p className="mt-1 max-w-[360px] text-xs leading-5 text-slate-500">
                          {children
                            .map((child) => {
                              const childItem = itemMap.get(child.test_item_id);

                              return (
                                child.display_name_override ||
                                childItem?.item_name_zh ||
                                "Unknown"
                              );
                            })
                            .join("、")}
                        </p>
                      </td>

                      <td className="border border-emerald-200 px-4 py-3">
                        {group.price_mode}
                      </td>

                      <td className="border border-emerald-200 px-4 py-3 text-right font-semibold">
                        MOP{" "}
                        {Number(
                          group.customer_group_price_mop || 0
                        ).toLocaleString()}
                      </td>

                      <td className="border border-emerald-200 px-4 py-3 text-right">
                        RMB{" "}
                        {Number(
                          group.lab_group_price_rmb || 0
                        ).toLocaleString()}
                      </td>

                      <td className="border border-emerald-200 px-4 py-3">
                        <span
                          className={
                            group.is_active
                              ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                              : "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500"
                          }
                        >
                          {group.is_active ? "Active" : "Disabled"}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {filteredGroups.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="border border-emerald-200 px-4 py-10 text-center text-emerald-700"
                    >
                      No test groups found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Test Item List
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                客戶價 MOP 會顯示在 Quotation；實驗室價 RMB 只作內部成本分析。
              </p>
            </div>

            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Search test item..."
              className="w-80 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
            />
          </div>

          {loading ? (
            <div className="mt-6 rounded-xl bg-slate-50 p-6 text-slate-500">
              Loading test items...
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[1200px] border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100 text-left">
                    <th className="border border-slate-200 px-4 py-3">
                      Code
                    </th>
                    <th className="border border-slate-200 px-4 py-3">
                      Action
                    </th>
                    <th className="border border-slate-200 px-4 py-3">
                      Item Name
                    </th>
                    <th className="border border-slate-200 px-4 py-3">
                      Category
                    </th>
                    <th className="border border-slate-200 px-4 py-3">
                      Vendor
                    </th>
                    <th className="border border-slate-200 px-4 py-3">
                      Standard
                    </th>
                    <th className="border border-slate-200 px-4 py-3 text-right">
                      Lab RMB
                    </th>
                    <th className="border border-slate-200 px-4 py-3 text-right">
                      Customer MOP
                    </th>
                    <th className="border border-slate-200 px-4 py-3">
                      Quotation
                    </th>
                    <th className="border border-slate-200 px-4 py-3">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredItems.map((item) => (
                    <tr key={item.id}>
                      <td className="border border-slate-200 px-4 py-3">
                        {item.item_code}
                      </td>

                      <td className="border border-slate-200 px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleEditItem(item)}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Edit
                          </button>

                          {item.is_active ? (
                            <button
                              onClick={() => handleDisableItem(item)}
                              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                            >
                              Disable
                            </button>
                          ) : (
                            <button
                              onClick={() => handleEnableItem(item)}
                              className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                            >
                              Enable
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="border border-slate-200 px-4 py-3 font-semibold text-slate-900">
                        {item.item_name_zh}
                        {item.item_name_en && (
                          <p className="mt-1 text-xs font-normal text-slate-500">
                            {item.item_name_en}
                          </p>
                        )}
                      </td>

                      <td className="border border-slate-200 px-4 py-3">
                        {item.category_id
                          ? categoryNameMap.get(item.category_id) || "-"
                          : "-"}
                      </td>

                      <td className="border border-slate-200 px-4 py-3">
                        {item.vendor_id
                          ? vendorNameMap.get(item.vendor_id) || "-"
                          : "-"}
                      </td>

                      <td className="border border-slate-200 px-4 py-3">
                        {item.test_standard || "-"}
                      </td>

                      <td className="border border-slate-200 px-4 py-3 text-right">
                        RMB {Number(item.lab_price_rmb || 0).toLocaleString()}
                      </td>

                      <td className="border border-slate-200 px-4 py-3 text-right font-semibold">
                        MOP{" "}
                        {Number(item.customer_price_mop || 0).toLocaleString()}
                      </td>

                      <td className="border border-slate-200 px-4 py-3">
                        <button
                          onClick={() => handleToggleQuotation(item)}
                          disabled={!item.is_active}
                          className={
                            item.show_in_quotation
                              ? "rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 disabled:opacity-40"
                              : "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500 disabled:opacity-40"
                          }
                        >
                          {item.show_in_quotation ? "Show" : "Hide"}
                        </button>
                      </td>

                      <td className="border border-slate-200 px-4 py-3">
                        <span
                          className={
                            item.is_active
                              ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                              : "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500"
                          }
                        >
                          {item.is_active ? "Active" : "Disabled"}
                        </span>
                      </td>
                    </tr>
                  ))}

                  {filteredItems.length === 0 && (
                    <tr>
                      <td
                        colSpan={10}
                        className="border border-slate-200 px-4 py-10 text-center text-slate-500"
                      >
                        No test items found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
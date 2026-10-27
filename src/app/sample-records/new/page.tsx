"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase/client";

type DbRow = Record<string, unknown> & {
  id: string;
};

type QuotationItemRow = {
  id: string;
  quotation_id: string | null;

  sample_name: string | null;
  sample_description: string | null;
  food_description: string | null;

  test_item_id: string | null;
  item_code: string | null;
  item_name: string | null;
  description: string | null;

  category_name: string | null;
  vendor_name: string | null;
  test_method: string | null;
  test_standard: string | null;
  unit: string | null;

  source_group_id: string | null;
  source_group_code: string | null;
  source_group_name: string | null;

  quantity: number | null;
  sort_order: number | null;
  is_deleted: boolean | null;
  created_at: string | null;
};

type SampleColumn = {
  key: string;
  sampleNo: string;
  sampleName: string;
  sampleDescription: string;
  quantity: string;
  sampleCondition: string;
  receivedStatus: string;
  remarks: string;
  sortOrder: number;
};

type MatrixRow = {
  key: string;
  itemName: string;
  itemCode: string;
  categoryName: string;
  vendorName: string;
  testMethod: string;
  unit: string;
  sourceTestItemId: string | null;
  sourceGroupId: string | null;
  sourceGroupCode: string | null;
  sourceGroupName: string | null;
  sortOrder: number;
  samples: Record<string, QuotationItemRow[]>;
};

function safeText(value: unknown, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function pickText(row: DbRow | null, keys: string[], fallback = "") {
  if (!row) return fallback;

  for (const key of keys) {
    const value = row[key];
    const text = safeText(value);

    if (text) return text;
  }

  return fallback;
}

function todayString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function buildRecordNo() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `SR${yy}${mm}${dd}-${hh}${mi}${ss}`;
}

function getQuotationNo(quotation: DbRow | null) {
  return pickText(
    quotation,
    ["quotation_no", "quote_no", "quotation_number", "number"],
    "-"
  );
}

function getClientId(quotation: DbRow | null) {
  return pickText(quotation, ["client_id", "customer_id"]);
}

function getCustomerName(quotation: DbRow | null, client: DbRow | null) {
  return (
    pickText(quotation, [
      "customer_name",
      "client_name",
      "company_name",
      "customer",
    ]) ||
    pickText(client, [
      "company_name",
      "client_name",
      "name",
      "customer_name",
      "contact_person",
      "contact_name",
    ]) ||
    "-"
  );
}

function getCustomerAddress(quotation: DbRow | null, client: DbRow | null) {
  return (
    pickText(quotation, ["customer_address", "client_address", "address"]) ||
    pickText(client, [
      "address",
      "company_address",
      "client_address",
      "billing_address",
    ]) ||
    ""
  );
}

function getProjectName(quotation: DbRow | null) {
  return pickText(
    quotation,
    ["project_description", "project_name", "project", "description"],
    "-"
  );
}

function getSampleName(item: QuotationItemRow, index: number) {
  return safeText(
    item.sample_name ||
      item.sample_description ||
      item.food_description ||
      `Sample ${index + 1}`,
    `Sample ${index + 1}`
  );
}

function getItemName(item: QuotationItemRow) {
  return safeText(item.item_name || item.description, "Unnamed Test Item");
}

function getTestMethod(item: QuotationItemRow) {
  return safeText(item.test_method || item.test_standard, "-");
}

function buildItemKey(item: QuotationItemRow) {
  const sourceTestItemId = safeText(item.test_item_id);
  const name = getItemName(item);
  const method = getTestMethod(item);
  const unit = safeText(item.unit, "-");
  const groupCode = safeText(item.source_group_code);

  if (sourceTestItemId) {
    return `test:${sourceTestItemId}|method:${method}|unit:${unit}|group:${groupCode}`;
  }

  return `name:${name}|method:${method}|unit:${unit}|group:${groupCode}`;
}

export default function NewSampleRecordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [quotations, setQuotations] = useState<DbRow[]>([]);
  const [selectedQuotationId, setSelectedQuotationId] = useState("");
  const [selectedQuotation, setSelectedQuotation] = useState<DbRow | null>(
    null
  );
  const [selectedClient, setSelectedClient] = useState<DbRow | null>(null);

  const [quotationItems, setQuotationItems] = useState<QuotationItemRow[]>([]);
  const [sampleColumns, setSampleColumns] = useState<SampleColumn[]>([]);
  const [matrixRows, setMatrixRows] = useState<MatrixRow[]>([]);

  const [recordNo, setRecordNo] = useState("");
  const [receivedDate, setReceivedDate] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [testStartDate, setTestStartDate] = useState("");
  const [testEndDate, setTestEndDate] = useState("");
  const [status, setStatus] = useState("received");
  const [remarks, setRemarks] = useState("");

  const [loadingQuotations, setLoadingQuotations] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function loadQuotations() {
    setLoadingQuotations(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("quotations")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Load quotations error:", error);
      setErrorMessage(error.message || "Failed to load quotations.");
      setQuotations([]);
    } else {
      setQuotations((data || []) as DbRow[]);
    }

    setLoadingQuotations(false);
  }

  async function loadClientForQuotation(quotation: DbRow | null) {
    const clientId = getClientId(quotation);

    if (!clientId) {
      setSelectedClient(null);
      return;
    }

    const { data, error } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .maybeSingle();

    if (error) {
      console.warn("Load quotation client warning:", error);
      setSelectedClient(null);
      return;
    }

    setSelectedClient((data || null) as DbRow | null);
  }

  async function loadQuotationDetail(quotationId: string) {
    if (!quotationId) {
      setSelectedQuotation(null);
      setSelectedClient(null);
      setQuotationItems([]);
      setSampleColumns([]);
      setMatrixRows([]);
      return;
    }

    setLoadingItems(true);
    setErrorMessage("");

    const quotation =
      quotations.find((item) => item.id === quotationId) || null;

    setSelectedQuotation(quotation);
    await loadClientForQuotation(quotation);

    const { data, error } = await supabase
      .from("quotation_items")
      .select("*")
      .eq("quotation_id", quotationId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Load quotation items error:", error);
      setErrorMessage(error.message || "Failed to load quotation items.");
      setQuotationItems([]);
      setSampleColumns([]);
      setMatrixRows([]);
      setLoadingItems(false);
      return;
    }

    const rawItems = ((data || []) as QuotationItemRow[]).filter((item) => {
      if (item.is_deleted === true) return false;
      return true;
    });

    setQuotationItems(rawItems);

    const sampleMap = new Map<string, SampleColumn>();

    rawItems.forEach((item, index) => {
      const sampleName = getSampleName(item, index);
      const sampleDescription = safeText(
        item.sample_description || item.food_description || sampleName,
        sampleName
      );
      const sampleKey = sampleName;

      if (!sampleMap.has(sampleKey)) {
        sampleMap.set(sampleKey, {
          key: sampleKey,
          sampleNo: String(sampleMap.size + 1),
          sampleName,
          sampleDescription,
          quantity: "",
          sampleCondition: "正常",
          receivedStatus: "received",
          remarks: "",
          sortOrder: sampleMap.size,
        });
      }
    });

    const samples = Array.from(sampleMap.values());

    const rowMap = new Map<string, MatrixRow>();

    rawItems.forEach((item, index) => {
      const sampleName = getSampleName(item, index);
      const itemKey = buildItemKey(item);

      if (!rowMap.has(itemKey)) {
        rowMap.set(itemKey, {
          key: itemKey,
          itemName: getItemName(item),
          itemCode: safeText(item.item_code),
          categoryName: safeText(item.category_name),
          vendorName: safeText(item.vendor_name),
          testMethod: getTestMethod(item),
          unit: safeText(item.unit, "-"),
          sourceTestItemId: item.test_item_id || null,
          sourceGroupId: item.source_group_id || null,
          sourceGroupCode: item.source_group_code || null,
          sourceGroupName: item.source_group_name || null,
          sortOrder:
            typeof item.sort_order === "number" ? item.sort_order : index,
          samples: {},
        });
      }

      const row = rowMap.get(itemKey);

      if (row) {
        if (!row.samples[sampleName]) {
          row.samples[sampleName] = [];
        }

        row.samples[sampleName].push(item);
      }
    });

    const rows = Array.from(rowMap.values()).sort((a, b) => {
      return a.sortOrder - b.sortOrder;
    });

    setSampleColumns(samples);
    setMatrixRows(rows);
    setLoadingItems(false);
  }

  useEffect(() => {
    setRecordNo(buildRecordNo());
    setReceivedDate(todayString());
    loadQuotations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadQuotationDetail(selectedQuotationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuotationId]);

  function updateSampleColumn(key: string, patch: Partial<SampleColumn>) {
    setSampleColumns((prev) =>
      prev.map((sample) =>
        sample.key === key ? { ...sample, ...patch } : sample
      )
    );
  }

  async function handleSave() {
    if (!selectedQuotation) {
      setErrorMessage("Please select a quotation first.");
      return;
    }

    if (sampleColumns.length === 0 || matrixRows.length === 0) {
      setErrorMessage("This quotation has no sample test items.");
      return;
    }

    setSaving(true);
    setErrorMessage("");

    const customerName = getCustomerName(selectedQuotation, selectedClient);
    const customerAddress = getCustomerAddress(
      selectedQuotation,
      selectedClient
    );

    const { data: recordData, error: recordError } = await supabase
      .from("sample_records")
      .insert({
        record_no: recordNo,
        quotation_id: selectedQuotation.id,
        quotation_no: getQuotationNo(selectedQuotation),
        customer_name: customerName,
        customer_address: customerAddress,
        project_name: getProjectName(selectedQuotation),
        received_date: receivedDate || null,
        received_by: receivedBy || null,
        test_start_date: testStartDate || null,
        test_end_date: testEndDate || null,
        status,
        remarks: remarks || null,
      })
      .select("id")
      .single();

    if (recordError || !recordData?.id) {
      console.error("Create sample record error:", recordError);
      setErrorMessage(
        recordError?.message || "Failed to create sample record."
      );
      setSaving(false);
      return;
    }

    const sampleRecordId = recordData.id as string;

    const samplePayload = sampleColumns.map((sample, index) => ({
      sample_record_id: sampleRecordId,
      sample_key: sample.key,
      sample_no: sample.sampleNo || String(index + 1),
      sample_name: sample.sampleName,
      sample_description: sample.sampleDescription,
      quantity: sample.quantity || null,
      sample_condition: sample.sampleCondition || null,
      received_status: sample.receivedStatus || "received",
      remarks: sample.remarks || null,
      sort_order: index,
    }));

    const { data: insertedSamples, error: sampleError } = await supabase
      .from("sample_record_samples")
      .insert(samplePayload)
      .select("id, sample_key");

    if (sampleError || !insertedSamples) {
      console.error("Create sample record samples error:", sampleError);
      setErrorMessage(
        sampleError?.message || "Failed to create sample record samples."
      );
      setSaving(false);
      return;
    }

    const sampleIdMap = new Map<string, string>();

    insertedSamples.forEach((sample: { id: string; sample_key: string }) => {
      sampleIdMap.set(sample.sample_key, sample.id);
    });

    const itemPayload: Record<string, unknown>[] = [];

    matrixRows.forEach((row, rowIndex) => {
      sampleColumns.forEach((sample) => {
        const qItems = row.samples[sample.key] || [];
        const sampleRecordSampleId = sampleIdMap.get(sample.key);

        if (!sampleRecordSampleId) return;

        qItems.forEach((qItem) => {
          itemPayload.push({
            sample_record_id: sampleRecordId,
            sample_record_sample_id: sampleRecordSampleId,

            quotation_item_id: qItem.id,
            source_test_item_id: qItem.test_item_id || null,

            item_code: qItem.item_code || null,
            item_name: getItemName(qItem),
            category_name: qItem.category_name || null,
            vendor_name: qItem.vendor_name || null,
            test_method: getTestMethod(qItem),
            unit: qItem.unit || null,

            source_group_id: qItem.source_group_id || null,
            source_group_code: qItem.source_group_code || null,
            source_group_name: qItem.source_group_name || null,

            test_status: "pending",
            remarks: null,
            sort_order: rowIndex,
          });
        });
      });
    });

    if (itemPayload.length > 0) {
      const { error: itemError } = await supabase
        .from("sample_record_items")
        .insert(itemPayload);

      if (itemError) {
        console.error("Create sample record items error:", itemError);
        setErrorMessage(
          itemError.message || "Failed to create sample record items."
        );
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    router.push(`/sample-records/${sampleRecordId}`);
  }

  const selectedCustomerName = getCustomerName(
    selectedQuotation,
    selectedClient
  );
  const selectedProjectName = getProjectName(selectedQuotation);

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              New Sample Test Record
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Select a quotation and generate a sample × test item matrix.
            </p>
          </div>

          <div className="flex gap-2">
            <Link
              href="/sample-records"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Back to Records
            </Link>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !selectedQuotation || matrixRows.length === 0}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {saving ? "Saving..." : "Save Sample Record"}
            </button>
          </div>
        </div>

        {errorMessage ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-slate-900">
            Record Information
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Sample Record No.
              </span>
              <input
                value={recordNo}
                onChange={(event) => setRecordNo(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Quotation
              </span>
              <select
                value={selectedQuotationId}
                onChange={(event) => setSelectedQuotationId(event.target.value)}
                disabled={loadingQuotations}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              >
                <option value="">
                  {loadingQuotations
                    ? "Loading quotations..."
                    : "Select quotation"}
                </option>

                {quotations.map((quotation) => (
                  <option key={quotation.id} value={quotation.id}>
                    {getQuotationNo(quotation)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Status
              </span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              >
                <option value="draft">Draft</option>
                <option value="received">Received</option>
                <option value="testing">Testing</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Received Date
              </span>
              <input
                type="date"
                value={receivedDate}
                onChange={(event) => setReceivedDate(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Received By
              </span>
              <input
                value={receivedBy}
                onChange={(event) => setReceivedBy(event.target.value)}
                placeholder="Staff name"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Test Start Date
              </span>
              <input
                type="date"
                value={testStartDate}
                onChange={(event) => setTestStartDate(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Test End Date
              </span>
              <input
                type="date"
                value={testEndDate}
                onChange={(event) => setTestEndDate(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-slate-700">
                Remarks
              </span>
              <input
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
                placeholder="Optional remarks"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </label>
          </div>
        </div>

        {selectedQuotation ? (
          <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-slate-900">
              Quotation Information
            </h2>

            <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-4">
              <div>
                <div className="text-slate-500">Quotation No.</div>
                <div className="font-medium text-slate-900">
                  {getQuotationNo(selectedQuotation)}
                </div>
              </div>

              <div>
                <div className="text-slate-500">Customer</div>
                <div className="font-medium text-slate-900">
                  {selectedCustomerName}
                </div>
              </div>

              <div className="md:col-span-2">
                <div className="text-slate-500">Project</div>
                <div className="font-medium text-slate-900">
                  {selectedProjectName}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {sampleColumns.length > 0 ? (
          <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-slate-900">
              Sample Information
            </h2>

            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">No.</th>
                    <th className="px-3 py-2">Sample Name</th>
                    <th className="px-3 py-2">Description</th>
                    <th className="px-3 py-2">Quantity</th>
                    <th className="px-3 py-2">Condition</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Remarks</th>
                  </tr>
                </thead>

                <tbody>
                  {sampleColumns.map((sample) => (
                    <tr key={sample.key} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <input
                          value={sample.sampleNo}
                          onChange={(event) =>
                            updateSampleColumn(sample.key, {
                              sampleNo: event.target.value,
                            })
                          }
                          className="w-16 rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                      </td>

                      <td className="px-3 py-2">
                        <input
                          value={sample.sampleName}
                          onChange={(event) =>
                            updateSampleColumn(sample.key, {
                              sampleName: event.target.value,
                            })
                          }
                          className="min-w-40 rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                      </td>

                      <td className="px-3 py-2">
                        <input
                          value={sample.sampleDescription}
                          onChange={(event) =>
                            updateSampleColumn(sample.key, {
                              sampleDescription: event.target.value,
                            })
                          }
                          className="min-w-56 rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                      </td>

                      <td className="px-3 py-2">
                        <input
                          value={sample.quantity}
                          onChange={(event) =>
                            updateSampleColumn(sample.key, {
                              quantity: event.target.value,
                            })
                          }
                          placeholder="e.g. 1 pack"
                          className="w-28 rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                      </td>

                      <td className="px-3 py-2">
                        <input
                          value={sample.sampleCondition}
                          onChange={(event) =>
                            updateSampleColumn(sample.key, {
                              sampleCondition: event.target.value,
                            })
                          }
                          className="w-28 rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                      </td>

                      <td className="px-3 py-2">
                        <select
                          value={sample.receivedStatus}
                          onChange={(event) =>
                            updateSampleColumn(sample.key, {
                              receivedStatus: event.target.value,
                            })
                          }
                          className="w-32 rounded border border-slate-300 px-2 py-1 text-sm"
                        >
                          <option value="received">Received</option>
                          <option value="pending">Pending</option>
                          <option value="rejected">Rejected</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </td>

                      <td className="px-3 py-2">
                        <input
                          value={sample.remarks}
                          onChange={(event) =>
                            updateSampleColumn(sample.key, {
                              remarks: event.target.value,
                            })
                          }
                          className="min-w-40 rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-2 text-xs text-slate-500">
              Total samples: {sampleColumns.length}
            </p>
          </div>
        ) : null}

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Sample × Test Item Matrix
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                √ means the selected sample requires this test item.
              </p>
            </div>

            {quotationItems.length > 0 ? (
              <div className="text-sm text-slate-500">
                Quotation items: {quotationItems.length}
              </div>
            ) : null}
          </div>

          {loadingItems ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Loading quotation items...
            </div>
          ) : !selectedQuotation ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Please select a quotation first.
            </div>
          ) : matrixRows.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              No quotation items found for this quotation.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="sticky left-0 z-10 min-w-56 border border-slate-200 bg-slate-100 px-3 py-2">
                      Test Item
                    </th>

                    {sampleColumns.map((sample) => (
                      <th
                        key={sample.key}
                        className="min-w-28 border border-slate-200 px-3 py-2 text-center"
                      >
                        <div className="font-semibold text-slate-700">
                          {sample.sampleNo}
                        </div>
                        <div className="mt-1 normal-case text-slate-600">
                          {sample.sampleName}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {matrixRows.map((row) => (
                    <tr key={row.key} className="hover:bg-slate-50">
                      <td className="sticky left-0 z-10 border border-slate-200 bg-white px-3 py-2 align-top">
                        <div className="font-medium text-slate-900">
                          {row.itemName}
                        </div>

                        {row.itemCode ? (
                          <div className="mt-1 text-xs text-slate-500">
                            {row.itemCode}
                          </div>
                        ) : null}

                        {row.sourceGroupName ? (
                          <div className="mt-1 text-xs text-amber-700">
                            Group: {row.sourceGroupName}
                          </div>
                        ) : null}
                      </td>

                      {sampleColumns.map((sample) => {
                        const checked =
                          (row.samples[sample.key] || []).length > 0;

                        return (
                          <td
                            key={`${row.key}-${sample.key}`}
                            className={`border border-slate-200 px-3 py-2 text-center align-middle text-lg font-bold ${
                              checked
                                ? "bg-amber-50 text-amber-700"
                                : "bg-white text-slate-300"
                            }`}
                          >
                            {checked ? "√" : ""}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Link
            href="/sample-records"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </Link>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !selectedQuotation || matrixRows.length === 0}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {saving ? "Saving..." : "Save Sample Record"}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
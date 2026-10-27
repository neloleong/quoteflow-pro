"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase/client";

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
  vendorName: string;
  testMethod: string;
  unit: string;
  sourceGroupName: string;
  sortOrder: number;
  cells: Record<string, SampleRecordItemRow[]>;
};

function safeText(value: unknown, fallback = "") {
  if (value === null || value === undefined) return fallback;

  const text = String(value).trim();

  return text || fallback;
}

function formatDate(value?: string | null) {
  if (!value) return "";

  return value.slice(0, 10);
}

function displayDate(value?: string | null) {
  const text = formatDate(value);

  return text || "-";
}

function normalizeStatus(status?: string | null) {
  const value = (status || "draft").toLowerCase();

  if (value === "received") return "Received";
  if (value === "testing") return "Testing";
  if (value === "completed") return "Completed";
  if (value === "cancelled") return "Cancelled";

  return "Draft";
}

function statusClass(status?: string | null) {
  const value = (status || "draft").toLowerCase();

  if (value === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (value === "testing") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (value === "received") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (value === "cancelled") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function sampleStatusClass(status?: string | null) {
  const value = (status || "received").toLowerCase();

  if (value === "received") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (value === "pending") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (value === "rejected") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (value === "cancelled") {
    return "border-slate-200 bg-slate-50 text-slate-600";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function testStatusClass(status?: string | null) {
  const value = (status || "pending").toLowerCase();

  if (value === "completed") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (value === "testing") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (value === "pending") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (value === "cancelled") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function buildMatrixKey(item: SampleRecordItemRow) {
  const sourceTestItemId = safeText(item.source_test_item_id);
  const itemName = safeText(item.item_name, "Unnamed Test Item");
  const method = safeText(item.test_method, "-");
  const unit = safeText(item.unit, "-");
  const groupCode = safeText(item.source_group_code);

  if (sourceTestItemId) {
    return `test:${sourceTestItemId}|method:${method}|unit:${unit}|group:${groupCode}`;
  }

  return `name:${itemName}|method:${method}|unit:${unit}|group:${groupCode}`;
}

function getRawParamId(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || "";

  return value || "";
}

export default function SampleRecordDetailPage() {
  const params = useParams();
  const recordId = getRawParamId(params?.id as string | string[] | undefined);

  const supabase = useMemo(() => createClient(), []);

  const [record, setRecord] = useState<SampleRecordRow | null>(null);
  const [samples, setSamples] = useState<SampleRecordSampleRow[]>([]);
  const [items, setItems] = useState<SampleRecordItemRow[]>([]);

  const [recordNo, setRecordNo] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [projectName, setProjectName] = useState("");
  const [receivedDate, setReceivedDate] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [testStartDate, setTestStartDate] = useState("");
  const [testEndDate, setTestEndDate] = useState("");
  const [status, setStatus] = useState("draft");
  const [remarks, setRemarks] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const matrixRows = useMemo(() => {
    const rowMap = new Map<string, MatrixRow>();

    items.forEach((item, index) => {
      const key = buildMatrixKey(item);

      if (!rowMap.has(key)) {
        rowMap.set(key, {
          key,
          itemName: safeText(item.item_name, "Unnamed Test Item"),
          itemCode: safeText(item.item_code),
          categoryName: safeText(item.category_name),
          vendorName: safeText(item.vendor_name),
          testMethod: safeText(item.test_method, "-"),
          unit: safeText(item.unit, "-"),
          sourceGroupName: safeText(item.source_group_name),
          sortOrder:
            typeof item.sort_order === "number" ? item.sort_order : index,
          cells: {},
        });
      }

      const row = rowMap.get(key);

      if (!row) return;

      if (!row.cells[item.sample_record_sample_id]) {
        row.cells[item.sample_record_sample_id] = [];
      }

      row.cells[item.sample_record_sample_id].push(item);
    });

    return Array.from(rowMap.values()).sort((a, b) => {
      return a.sortOrder - b.sortOrder;
    });
  }, [items]);

  async function loadRecord() {
    if (!recordId) {
      setLoading(false);
      setErrorMessage("Missing sample record ID.");
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    const { data: recordData, error: recordError } = await supabase
      .from("sample_records")
      .select("*")
      .eq("id", recordId)
      .single();

    if (recordError || !recordData) {
      console.error("Load sample record error:", recordError);
      setErrorMessage(recordError?.message || "Failed to load sample record.");
      setLoading(false);
      return;
    }

    const currentRecord = recordData as SampleRecordRow;

    const { data: sampleData, error: sampleError } = await supabase
      .from("sample_record_samples")
      .select("*")
      .eq("sample_record_id", recordId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (sampleError) {
      console.error("Load sample record samples error:", sampleError);
      setErrorMessage(
        sampleError.message || "Failed to load sample record samples."
      );
      setLoading(false);
      return;
    }

    const { data: itemData, error: itemError } = await supabase
      .from("sample_record_items")
      .select("*")
      .eq("sample_record_id", recordId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (itemError) {
      console.error("Load sample record items error:", itemError);
      setErrorMessage(
        itemError.message || "Failed to load sample record items."
      );
      setLoading(false);
      return;
    }

    setRecord(currentRecord);
    setSamples((sampleData || []) as SampleRecordSampleRow[]);
    setItems((itemData || []) as SampleRecordItemRow[]);

    setRecordNo(safeText(currentRecord.record_no));
    setCustomerName(safeText(currentRecord.customer_name));
    setCustomerAddress(safeText(currentRecord.customer_address));
    setProjectName(safeText(currentRecord.project_name));
    setReceivedDate(formatDate(currentRecord.received_date));
    setReceivedBy(safeText(currentRecord.received_by));
    setTestStartDate(formatDate(currentRecord.test_start_date));
    setTestEndDate(formatDate(currentRecord.test_end_date));
    setStatus(safeText(currentRecord.status, "draft"));
    setRemarks(safeText(currentRecord.remarks));

    setLoading(false);
  }

  useEffect(() => {
    loadRecord();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId]);

  function updateSample(
    sampleId: string,
    patch: Partial<SampleRecordSampleRow>
  ) {
    setSamples((prev) =>
      prev.map((sample) =>
        sample.id === sampleId ? { ...sample, ...patch } : sample
      )
    );
  }

  function updateItem(itemId: string, patch: Partial<SampleRecordItemRow>) {
    setItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, ...patch } : item))
    );
  }

  function updateCellItems(
    sampleId: string,
    matrixKey: string,
    patch: Partial<SampleRecordItemRow>
  ) {
    setItems((prev) =>
      prev.map((item) => {
        const itemKey = buildMatrixKey(item);

        if (
          item.sample_record_sample_id === sampleId &&
          itemKey === matrixKey
        ) {
          return { ...item, ...patch };
        }

        return item;
      })
    );
  }

  function handleGeneratePdf() {
    setErrorMessage("");
    setSuccessMessage("");

    if (!recordId) {
      setErrorMessage("Missing sample record ID.");
      return;
    }

    const pdfUrl = `/api/sample-records/${encodeURIComponent(recordId)}/pdf`;

    window.open(pdfUrl, "_blank", "noopener,noreferrer");
  }

  async function handleSave() {
    if (!recordId || !record) return;

    setSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    const now = new Date().toISOString();

    const { error: recordError } = await supabase
      .from("sample_records")
      .update({
        record_no: recordNo || null,
        customer_name: customerName || null,
        customer_address: customerAddress || null,
        project_name: projectName || null,
        received_date: receivedDate || null,
        received_by: receivedBy || null,
        test_start_date: testStartDate || null,
        test_end_date: testEndDate || null,
        status: status || "draft",
        remarks: remarks || null,
        updated_at: now,
      })
      .eq("id", recordId);

    if (recordError) {
      console.error("Update sample record error:", recordError);
      setErrorMessage(recordError.message || "Failed to update sample record.");
      setSaving(false);
      return;
    }

    for (let index = 0; index < samples.length; index += 1) {
      const sample = samples[index];

      const { error: sampleError } = await supabase
        .from("sample_record_samples")
        .update({
          sample_no: sample.sample_no || String(index + 1),
          sample_name: sample.sample_name || null,
          sample_description: sample.sample_description || null,
          quantity: sample.quantity || null,
          sample_condition: sample.sample_condition || null,
          received_status: sample.received_status || "received",
          remarks: sample.remarks || null,
          sort_order: index,
          updated_at: now,
        })
        .eq("id", sample.id);

      if (sampleError) {
        console.error("Update sample record sample error:", sampleError);
        setErrorMessage(
          sampleError.message || "Failed to update sample information."
        );
        setSaving(false);
        return;
      }
    }

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];

      const { error: itemError } = await supabase
        .from("sample_record_items")
        .update({
          test_status: item.test_status || "pending",
          remarks: item.remarks || null,
          sort_order:
            typeof item.sort_order === "number" ? item.sort_order : index,
          updated_at: now,
        })
        .eq("id", item.id);

      if (itemError) {
        console.error("Update sample record item error:", itemError);
        setErrorMessage(
          itemError.message || "Failed to update test item information."
        );
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setSuccessMessage("Sample record saved successfully.");
    await loadRecord();
  }

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-7xl">
          <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm">
            Loading sample record...
          </div>
        </div>
      </AppShell>
    );
  }

  if (!record) {
    return (
      <AppShell>
        <div className="mx-auto max-w-7xl">
          <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center text-sm text-red-700">
            Sample record not found.
          </div>

          <div className="mt-4">
            <Link
              href="/sample-records"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Back to Records
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Sample Test Record
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              收樣檢測記錄：根據 Quotation 生成的 Sample × Test Item matrix。
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/sample-records"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Back to Records
            </Link>

            {record.quotation_id ? (
              <Link
                href={`/quotations/${encodeURIComponent(record.quotation_id)}`}
                className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
              >
                Open Quotation
              </Link>
            ) : null}

            {record.quotation_id ? (
              <Link
                href={`/report/new?quotationId=${encodeURIComponent(
                  record.quotation_id
                )}&sampleRecordId=${encodeURIComponent(record.id)}`}
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
              >
                Create Report
              </Link>
            ) : null}

            <button
              type="button"
              onClick={handleGeneratePdf}
              className="rounded-lg border border-slate-900 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100"
            >
              Generate PDF
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        {errorMessage ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {successMessage}
          </div>
        ) : null}

        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                Record Information
              </h2>

              <span
                className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(
                  status
                )}`}
              >
                {normalizeStatus(status)}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Record No.
                </span>
                <input
                  value={recordNo}
                  onChange={(event) => setRecordNo(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                />
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

              <label className="block md:col-span-3">
                <span className="mb-1 block text-sm font-medium text-slate-700">
                  Remarks
                </span>
                <input
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                />
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-base font-semibold text-slate-900">
              Source Quotation
            </h2>

            <div className="space-y-3 text-sm">
              <div>
                <div className="text-slate-500">Quotation No.</div>
                <div className="font-medium text-slate-900">
                  {record.quotation_no || "-"}
                </div>
              </div>

              <div>
                <div className="text-slate-500">Customer</div>
                <input
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <div className="text-slate-500">Customer Address</div>
                <textarea
                  value={customerAddress}
                  onChange={(event) => setCustomerAddress(event.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                />
              </div>

              <div>
                <div className="text-slate-500">Project</div>
                <textarea
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <div>
                  <div>Created</div>
                  <div className="font-medium text-slate-700">
                    {displayDate(record.created_at)}
                  </div>
                </div>

                <div>
                  <div>Updated</div>
                  <div className="font-medium text-slate-700">
                    {displayDate(record.updated_at)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Sample Information
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                可修改樣品編號、樣品名稱、數量、狀態及備註。
              </p>
            </div>

            <div className="text-sm text-slate-500">
              Total samples: {samples.length}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="whitespace-nowrap border border-slate-200 px-3 py-2">
                    No.
                  </th>
                  <th className="whitespace-nowrap border border-slate-200 px-3 py-2">
                    Sample Name
                  </th>
                  <th className="whitespace-nowrap border border-slate-200 px-3 py-2">
                    Description
                  </th>
                  <th className="whitespace-nowrap border border-slate-200 px-3 py-2">
                    Quantity
                  </th>
                  <th className="whitespace-nowrap border border-slate-200 px-3 py-2">
                    Condition
                  </th>
                  <th className="whitespace-nowrap border border-slate-200 px-3 py-2">
                    Status
                  </th>
                  <th className="whitespace-nowrap border border-slate-200 px-3 py-2">
                    Remarks
                  </th>
                </tr>
              </thead>

              <tbody>
                {samples.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="border border-slate-200 px-3 py-8 text-center text-slate-500"
                    >
                      No samples found.
                    </td>
                  </tr>
                ) : (
                  samples.map((sample, index) => (
                    <tr key={sample.id} className="hover:bg-slate-50">
                      <td className="border border-slate-200 px-3 py-2">
                        <input
                          value={sample.sample_no || String(index + 1)}
                          onChange={(event) =>
                            updateSample(sample.id, {
                              sample_no: event.target.value,
                            })
                          }
                          className="w-16 rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                      </td>

                      <td className="border border-slate-200 px-3 py-2">
                        <input
                          value={sample.sample_name || ""}
                          onChange={(event) =>
                            updateSample(sample.id, {
                              sample_name: event.target.value,
                            })
                          }
                          className="min-w-40 rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                      </td>

                      <td className="border border-slate-200 px-3 py-2">
                        <input
                          value={sample.sample_description || ""}
                          onChange={(event) =>
                            updateSample(sample.id, {
                              sample_description: event.target.value,
                            })
                          }
                          className="min-w-56 rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                      </td>

                      <td className="border border-slate-200 px-3 py-2">
                        <input
                          value={sample.quantity || ""}
                          onChange={(event) =>
                            updateSample(sample.id, {
                              quantity: event.target.value,
                            })
                          }
                          className="w-28 rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                      </td>

                      <td className="border border-slate-200 px-3 py-2">
                        <input
                          value={sample.sample_condition || ""}
                          onChange={(event) =>
                            updateSample(sample.id, {
                              sample_condition: event.target.value,
                            })
                          }
                          className="w-28 rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                      </td>

                      <td className="border border-slate-200 px-3 py-2">
                        <div className="flex flex-col gap-1">
                          <select
                            value={sample.received_status || "received"}
                            onChange={(event) =>
                              updateSample(sample.id, {
                                received_status: event.target.value,
                              })
                            }
                            className="w-32 rounded border border-slate-300 px-2 py-1 text-sm"
                          >
                            <option value="received">Received</option>
                            <option value="pending">Pending</option>
                            <option value="rejected">Rejected</option>
                            <option value="cancelled">Cancelled</option>
                          </select>

                          <span
                            className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-[11px] font-medium ${sampleStatusClass(
                              sample.received_status
                            )}`}
                          >
                            {safeText(sample.received_status, "received")}
                          </span>
                        </div>
                      </td>

                      <td className="border border-slate-200 px-3 py-2">
                        <input
                          value={sample.remarks || ""}
                          onChange={(event) =>
                            updateSample(sample.id, {
                              remarks: event.target.value,
                            })
                          }
                          className="min-w-40 rounded border border-slate-300 px-2 py-1 text-sm"
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Sample × Test Item Matrix
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                √ 代表該樣品需要做該項檢測。每個格子可快速更新檢測狀態。
              </p>
            </div>

            <div className="text-sm text-slate-500">
              Test item rows: {matrixRows.length}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="sticky left-0 z-20 min-w-56 border border-slate-200 bg-slate-100 px-3 py-2">
                    Test Item
                  </th>

                  {samples.map((sample) => (
                    <th
                      key={sample.id}
                      className="min-w-36 border border-slate-200 px-3 py-2 text-center"
                    >
                      <div className="font-semibold text-slate-700">
                        {sample.sample_no || "-"}
                      </div>
                      <div className="mt-1 normal-case text-slate-600">
                        {sample.sample_name || "-"}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {matrixRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={samples.length + 1}
                      className="border border-slate-200 px-3 py-8 text-center text-slate-500"
                    >
                      No matrix items found.
                    </td>
                  </tr>
                ) : (
                  matrixRows.map((row) => (
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

                        {row.categoryName ? (
                          <div className="mt-1 text-xs text-slate-500">
                            {row.categoryName}
                          </div>
                        ) : null}
                      </td>

                      {samples.map((sample) => {
                        const cellItems = row.cells[sample.id] || [];
                        const checked = cellItems.length > 0;
                        const firstItem = cellItems[0] || null;

                        return (
                          <td
                            key={`${row.key}-${sample.id}`}
                            className={`border border-slate-200 px-3 py-2 text-center align-middle ${
                              checked ? "bg-amber-50" : "bg-white"
                            }`}
                          >
                            {checked && firstItem ? (
                              <div className="flex flex-col items-center gap-2">
                                <div className="text-xl font-bold text-amber-700">
                                  √
                                </div>

                                <select
                                  value={firstItem.test_status || "pending"}
                                  onChange={(event) =>
                                    updateCellItems(sample.id, row.key, {
                                      test_status: event.target.value,
                                    })
                                  }
                                  className="w-28 rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                                >
                                  <option value="pending">Pending</option>
                                  <option value="testing">Testing</option>
                                  <option value="completed">Completed</option>
                                  <option value="cancelled">Cancelled</option>
                                </select>

                                <span
                                  className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${testStatusClass(
                                    firstItem.test_status
                                  )}`}
                                >
                                  {safeText(firstItem.test_status, "pending")}
                                </span>
                              </div>
                            ) : null}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Test Item Detail
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                這裏可以逐項修改檢測狀態及備註，不影響原 quotation_items。
              </p>
            </div>

            <div className="text-sm text-slate-500">
              Total rows: {items.length}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead className="bg-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="whitespace-nowrap border border-slate-200 px-3 py-2">
                    Sample
                  </th>
                  <th className="whitespace-nowrap border border-slate-200 px-3 py-2">
                    Test Item
                  </th>
                  <th className="whitespace-nowrap border border-slate-200 px-3 py-2">
                    Status
                  </th>
                  <th className="whitespace-nowrap border border-slate-200 px-3 py-2">
                    Remarks
                  </th>
                </tr>
              </thead>

              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="border border-slate-200 px-3 py-8 text-center text-slate-500"
                    >
                      No test items found.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const sample = samples.find(
                      (sampleRow) =>
                        sampleRow.id === item.sample_record_sample_id
                    );

                    return (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="border border-slate-200 px-3 py-2 align-top">
                          <div className="font-medium text-slate-900">
                            {sample?.sample_no || "-"}
                          </div>
                          <div className="text-xs text-slate-500">
                            {sample?.sample_name || "-"}
                          </div>
                        </td>

                        <td className="border border-slate-200 px-3 py-2 align-top">
                          <div className="font-medium text-slate-900">
                            {item.item_name || "-"}
                          </div>

                          {item.item_code ? (
                            <div className="mt-1 text-xs text-slate-500">
                              {item.item_code}
                            </div>
                          ) : null}

                          {item.source_group_name ? (
                            <div className="mt-1 text-xs text-amber-700">
                              Group: {item.source_group_name}
                            </div>
                          ) : null}
                        </td>

                        <td className="border border-slate-200 px-3 py-2 align-top">
                          <div className="flex flex-col gap-1">
                            <select
                              value={item.test_status || "pending"}
                              onChange={(event) =>
                                updateItem(item.id, {
                                  test_status: event.target.value,
                                })
                              }
                              className="w-32 rounded border border-slate-300 px-2 py-1 text-sm"
                            >
                              <option value="pending">Pending</option>
                              <option value="testing">Testing</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>

                            <span
                              className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-[11px] font-medium ${testStatusClass(
                                item.test_status
                              )}`}
                            >
                              {safeText(item.test_status, "pending")}
                            </span>
                          </div>
                        </td>

                        <td className="border border-slate-200 px-3 py-2 align-top">
                          <input
                            value={item.remarks || ""}
                            onChange={(event) =>
                              updateItem(item.id, {
                                remarks: event.target.value,
                              })
                            }
                            className="min-w-56 rounded border border-slate-300 px-2 py-1 text-sm"
                            placeholder="Optional remarks"
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Link
            href="/sample-records"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Back
          </Link>

          <button
            type="button"
            onClick={handleGeneratePdf}
            className="rounded-lg border border-slate-900 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100"
          >
            Generate PDF
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
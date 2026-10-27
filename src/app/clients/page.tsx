"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase/client";

const EMIT_COMPANY_ID =
  "11111111-1111-1111-1111-111111111111";

type Customer = {
  id: string;
  company_id: string;
  customer_name: string;
  contact_person: string | null;
  phone: string | null;
  fax: string | null;
  email: string | null;
  address: string | null;
  business_registration_no: string | null;
  customer_type: string;
  remarks: string | null;
  is_active: boolean;
};

type CustomerForm = {
  customerName: string;
  contactPerson: string;
  phone: string;
  fax: string;
  email: string;
  address: string;
  businessRegistrationNo: string;
  customerType: string;
  remarks: string;
};

const defaultForm: CustomerForm = {
  customerName: "",
  contactPerson: "",
  phone: "",
  fax: "",
  email: "",
  address: "",
  businessRegistrationNo: "",
  customerType: "company",
  remarks: "",
};

function getErrorMessage(
  error: unknown,
  fallbackMessage: string
) {
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

export default function ClientsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] =
    useState<CustomerForm>(defaultForm);

  const [editingCustomerId, setEditingCustomerId] =
    useState<string | null>(null);

  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [disablingCustomerId, setDisablingCustomerId] =
    useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    loadCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCustomers() {
    try {
      setLoading(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("customers")
        .select(
          "id,company_id,customer_name,contact_person,phone,fax,email,address,business_registration_no,customer_type,remarks,is_active"
        )
        .eq("company_id", EMIT_COMPANY_ID)
        .is("deleted_at", null)
        .order("customer_name", {
          ascending: true,
        });

      if (error) {
        throw error;
      }

      const loadedCustomers: Customer[] = Array.isArray(data)
        ? (data as unknown as Customer[])
        : [];

      setCustomers(loadedCustomers);
    } catch (error) {
      console.error("Load clients error:", error);

      setErrorMessage(
        getErrorMessage(
          error,
          "Failed to load clients."
        )
      );
    } finally {
      setLoading(false);
    }
  }

  const filteredCustomers = useMemo(() => {
    const lowerKeyword = keyword.trim().toLowerCase();

    if (!lowerKeyword) {
      return customers;
    }

    return customers.filter((customer) => {
      const searchableText = [
        customer.customer_name,
        customer.contact_person,
        customer.phone,
        customer.fax,
        customer.email,
        customer.address,
        customer.business_registration_no,
        customer.customer_type,
        customer.remarks,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableText.includes(lowerKeyword);
    });
  }, [customers, keyword]);

  const activeClientsCount = useMemo(() => {
    return customers.filter(
      (customer) => customer.is_active
    ).length;
  }, [customers]);

  const companyClientsCount = useMemo(() => {
    return customers.filter(
      (customer) =>
        customer.customer_type === "company"
    ).length;
  }, [customers]);

  function resetForm(options?: {
    preserveSuccessMessage?: boolean;
  }) {
    setForm(defaultForm);
    setEditingCustomerId(null);
    setErrorMessage("");

    if (!options?.preserveSuccessMessage) {
      setSuccessMessage("");
    }
  }

  function validateForm() {
    if (!form.customerName.trim()) {
      return "請輸入客戶名稱。";
    }

    return "";
  }

  async function handleSaveCustomer() {
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

      const payload = {
        company_id: EMIT_COMPANY_ID,
        customer_name: form.customerName.trim(),
        contact_person:
          form.contactPerson.trim() || null,
        phone: form.phone.trim() || null,
        fax: form.fax.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        business_registration_no:
          form.businessRegistrationNo.trim() || null,
        customer_type: form.customerType,
        remarks: form.remarks.trim() || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      if (editingCustomerId) {
        const { error } = await supabase
          .from("customers")
          .update(payload)
          .eq("id", editingCustomerId)
          .eq("company_id", EMIT_COMPANY_ID);

        if (error) {
          throw error;
        }

        resetForm({
          preserveSuccessMessage: true,
        });

        setSuccessMessage("客戶資料已更新。");
      } else {
        const { error } = await supabase
          .from("customers")
          .insert(payload);

        if (error) {
          throw error;
        }

        resetForm({
          preserveSuccessMessage: true,
        });

        setSuccessMessage("客戶已新增。");
      }

      await loadCustomers();
    } catch (error) {
      console.error("Save client error:", error);

      setErrorMessage(
        getErrorMessage(
          error,
          "Failed to save client."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  function handleEditCustomer(customer: Customer) {
    setEditingCustomerId(customer.id);
    setSuccessMessage("");
    setErrorMessage("");

    setForm({
      customerName: customer.customer_name,
      contactPerson:
        customer.contact_person || "",
      phone: customer.phone || "",
      fax: customer.fax || "",
      email: customer.email || "",
      address: customer.address || "",
      businessRegistrationNo:
        customer.business_registration_no || "",
      customerType:
        customer.customer_type || "company",
      remarks: customer.remarks || "",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function handleViewCustomerDocuments(
    customer: Customer
  ) {
    router.push(
      `/clients/${customer.id}/documents`
    );
  }

  async function handleDisableCustomer(
    customer: Customer
  ) {
    const confirmed = window.confirm(
      `確認要停用「${customer.customer_name}」嗎？停用後不會影響舊報價、報告、Invoice 及 Receipt 記錄。`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDisablingCustomerId(customer.id);
      setErrorMessage("");
      setSuccessMessage("");

      const disabledAt = new Date().toISOString();

      const { error } = await supabase
        .from("customers")
        .update({
          is_active: false,
          deleted_at: disabledAt,
          updated_at: disabledAt,
        })
        .eq("id", customer.id)
        .eq("company_id", EMIT_COMPANY_ID);

      if (error) {
        throw error;
      }

      setSuccessMessage("客戶已停用。");

      await loadCustomers();
    } catch (error) {
      console.error(
        "Disable client error:",
        error
      );

      setErrorMessage(
        getErrorMessage(
          error,
          "Failed to disable client."
        )
      );
    } finally {
      setDisablingCustomerId(null);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl min-w-0 overflow-x-hidden">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">
            Clients 客戶管理
          </h1>

          <p className="mt-2 text-slate-500">
            管理 Quotation 上的 TO、ATTN、電話、Email、地址及客戶備註。
          </p>
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

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">
              Total Clients
            </p>

            <p className="mt-3 text-3xl font-bold text-slate-900">
              {customers.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">
              Active Clients
            </p>

            <p className="mt-3 text-3xl font-bold text-slate-900">
              {activeClientsCount}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">
              Company Clients
            </p>

            <p className="mt-3 text-3xl font-bold text-slate-900">
              {companyClientsCount}
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            {editingCustomerId
              ? "Edit Client 修改客戶資料"
              : "Add Client 新增客戶"}
          </h2>

          <div className="mt-6 grid gap-4 lg:grid-cols-4">
            <div className="min-w-0">
              <label className="text-sm font-medium text-slate-700">
                Client Name 客戶名稱
              </label>

              <input
                value={form.customerName}
                onChange={(event) =>
                  setForm({
                    ...form,
                    customerName:
                      event.target.value,
                  })
                }
                placeholder="資豐食品廠"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
              />
            </div>

            <div className="min-w-0">
              <label className="text-sm font-medium text-slate-700">
                ATTN / Contact Person
              </label>

              <input
                value={form.contactPerson}
                onChange={(event) =>
                  setForm({
                    ...form,
                    contactPerson:
                      event.target.value,
                  })
                }
                placeholder="ChiKei L"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
              />
            </div>

            <div className="min-w-0">
              <label className="text-sm font-medium text-slate-700">
                Phone
              </label>

              <input
                value={form.phone}
                onChange={(event) =>
                  setForm({
                    ...form,
                    phone: event.target.value,
                  })
                }
                placeholder="+853"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
              />
            </div>

            <div className="min-w-0">
              <label className="text-sm font-medium text-slate-700">
                Email
              </label>

              <input
                value={form.email}
                onChange={(event) =>
                  setForm({
                    ...form,
                    email: event.target.value,
                  })
                }
                placeholder="client@example.com"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
              />
            </div>

            <div className="min-w-0">
              <label className="text-sm font-medium text-slate-700">
                Fax
              </label>

              <input
                value={form.fax}
                onChange={(event) =>
                  setForm({
                    ...form,
                    fax: event.target.value,
                  })
                }
                placeholder="Fax"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
              />
            </div>

            <div className="min-w-0">
              <label className="text-sm font-medium text-slate-700">
                Customer Type
              </label>

              <select
                value={form.customerType}
                onChange={(event) =>
                  setForm({
                    ...form,
                    customerType:
                      event.target.value,
                  })
                }
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
              >
                <option value="company">
                  Company
                </option>

                <option value="individual">
                  Individual
                </option>

                <option value="government">
                  Government
                </option>

                <option value="association">
                  Association
                </option>
              </select>
            </div>

            <div className="min-w-0">
              <label className="text-sm font-medium text-slate-700">
                Business Registration No.
              </label>

              <input
                value={
                  form.businessRegistrationNo
                }
                onChange={(event) =>
                  setForm({
                    ...form,
                    businessRegistrationNo:
                      event.target.value,
                  })
                }
                placeholder="商業登記編號"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
              />
            </div>

            <div className="min-w-0">
              <label className="text-sm font-medium text-slate-700">
                Address
              </label>

              <input
                value={form.address}
                onChange={(event) =>
                  setForm({
                    ...form,
                    address:
                      event.target.value,
                  })
                }
                placeholder="地址"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
              />
            </div>

            <div className="min-w-0 lg:col-span-4">
              <label className="text-sm font-medium text-slate-700">
                Remarks
              </label>

              <textarea
                value={form.remarks}
                onChange={(event) =>
                  setForm({
                    ...form,
                    remarks:
                      event.target.value,
                  })
                }
                placeholder="備註，例如：常用檢測項目、付款條件、報價注意事項等"
                rows={3}
                className="mt-2 w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={handleSaveCustomer}
              disabled={saving}
              className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? "Saving..."
                : editingCustomerId
                  ? "Update Client"
                  : "Add Client"}
            </button>

            {editingCustomerId && (
              <button
                onClick={() => resetForm()}
                disabled={saving}
                className="rounded-xl border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel Edit
              </button>
            )}
          </div>
        </div>

        <div className="mt-8 min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-slate-900">
                Client List 客戶列表
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                可查看每個客戶的
                Quotation、Report、Invoice 及
                Receipt。
              </p>
            </div>

            <input
              value={keyword}
              onChange={(event) =>
                setKeyword(event.target.value)
              }
              placeholder="Search client..."
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900 sm:w-72"
            />
          </div>

          {loading ? (
            <div className="mt-6 rounded-xl bg-slate-50 p-6 text-slate-500">
              Loading clients...
            </div>
          ) : (
            <div className="mt-6 w-full min-w-0 overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full table-fixed border-collapse text-sm">
                <colgroup>
                  <col className="w-[25%]" />
                  <col className="w-[10%]" />
                  <col className="w-[11%]" />
                  <col className="w-[18%]" />
                  <col className="w-[8%]" />
                  <col className="w-[8%]" />
                  <col className="w-[20%]" />
                </colgroup>

                <thead>
                  <tr className="bg-slate-100 text-left">
                    <th className="border-b border-r border-slate-200 px-3 py-3 font-semibold text-slate-700">
                      Client
                    </th>

                    <th className="border-b border-r border-slate-200 px-3 py-3 font-semibold text-slate-700">
                      ATTN
                    </th>

                    <th className="border-b border-r border-slate-200 px-3 py-3 font-semibold text-slate-700">
                      Phone
                    </th>

                    <th className="border-b border-r border-slate-200 px-3 py-3 font-semibold text-slate-700">
                      Email
                    </th>

                    <th className="border-b border-r border-slate-200 px-2 py-3 text-center font-semibold text-slate-700">
                      Type
                    </th>

                    <th className="border-b border-r border-slate-200 px-2 py-3 text-center font-semibold text-slate-700">
                      Status
                    </th>

                    <th className="border-b border-slate-200 px-3 py-3 text-left font-semibold text-slate-700">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredCustomers.map(
                    (customer) => {
                      const isDisabling =
                        disablingCustomerId ===
                        customer.id;

                      return (
                        <tr
                          key={customer.id}
                          className="align-middle hover:bg-slate-50"
                        >
                          <td className="min-w-0 border-b border-r border-slate-200 px-3 py-4">
                            <p
                              title={
                                customer.customer_name
                              }
                              className="break-words font-semibold text-slate-900"
                            >
                              {
                                customer.customer_name
                              }
                            </p>

                            {customer.address && (
                              <p
                                title={
                                  customer.address
                                }
                                className="mt-1 line-clamp-2 break-words text-xs font-normal leading-5 text-slate-500"
                              >
                                {
                                  customer.address
                                }
                              </p>
                            )}
                          </td>

                          <td className="min-w-0 border-b border-r border-slate-200 px-3 py-4 text-slate-700">
                            <p
                              title={
                                customer.contact_person ||
                                "-"
                              }
                              className="break-words"
                            >
                              {customer.contact_person ||
                                "-"}
                            </p>
                          </td>

                          <td className="min-w-0 border-b border-r border-slate-200 px-3 py-4 text-slate-700">
                            <p
                              title={
                                customer.phone || "-"
                              }
                              className="break-all"
                            >
                              {customer.phone || "-"}
                            </p>
                          </td>

                          <td className="min-w-0 border-b border-r border-slate-200 px-3 py-4 text-slate-700">
                            <p
                              title={
                                customer.email || "-"
                              }
                              className="break-all leading-5"
                            >
                              {customer.email || "-"}
                            </p>
                          </td>

                          <td className="border-b border-r border-slate-200 px-2 py-4 text-center">
                            <span
                              title={
                                customer.customer_type
                              }
                              className="inline-block max-w-full truncate text-xs text-slate-700"
                            >
                              {
                                customer.customer_type
                              }
                            </span>
                          </td>

                          <td className="border-b border-r border-slate-200 px-2 py-4 text-center">
                            <span
                              className={
                                customer.is_active
                                  ? "inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700"
                                  : "inline-flex rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500"
                              }
                            >
                              {customer.is_active
                                ? "Active"
                                : "Disabled"}
                            </span>
                          </td>

                          <td className="border-b border-slate-200 px-3 py-4 text-left">
                            <div className="flex w-full flex-col items-start gap-2">
                              <div className="flex flex-wrap items-center justify-start gap-2">
                                <button
                                  onClick={() =>
                                    handleViewCustomerDocuments(
                                      customer
                                    )
                                  }
                                  className="whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-semibold text-white hover:bg-slate-700"
                                >
                                  Documents
                                </button>

                                <button
                                  onClick={() =>
                                    handleEditCustomer(
                                      customer
                                    )
                                  }
                                  disabled={
                                    isDisabling
                                  }
                                  className="whitespace-nowrap rounded-lg border border-slate-300 px-3 py-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Edit
                                </button>
                              </div>

                              <button
                                onClick={() =>
                                  handleDisableCustomer(
                                    customer
                                  )
                                }
                                disabled={
                                  !customer.is_active ||
                                  isDisabling
                                }
                                className="whitespace-nowrap rounded-lg border border-red-200 px-3 py-2 text-[11px] font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {isDisabling
                                  ? "Disabling..."
                                  : "Disable"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                  )}

                  {filteredCustomers.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-10 text-center text-slate-500"
                      >
                        No clients found.
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
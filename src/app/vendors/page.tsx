"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { createClient } from "@/lib/supabase/client";

const EMIT_COMPANY_ID = "11111111-1111-1111-1111-111111111111";

type Vendor = {
  id: string;
  company_id: string;
  vendor_name: string;
  contact_person: string | null;
  phone: string | null;
  fax: string | null;
  email: string | null;
  address: string | null;
  accreditation: string | null;
  remarks: string | null;
  is_active: boolean;
  deleted_at: string | null;
};

type VendorForm = {
  vendorName: string;
  contactPerson: string;
  phone: string;
  fax: string;
  email: string;
  address: string;
  accreditation: string;
  remarks: string;
};

const defaultForm: VendorForm = {
  vendorName: "",
  contactPerson: "",
  phone: "",
  fax: "",
  email: "",
  address: "",
  accreditation: "",
  remarks: "",
};

export default function VendorsPage() {
  
  console.log("VENDORS PAGE MOUNT");
  const supabase = createClient();

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [form, setForm] = useState<VendorForm>(defaultForm);
  const [editingVendorId, setEditingVendorId] = useState<string | null>(null);

  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
  

  loadVendors();
  }, []);

  async function loadVendors() {
  try {

    


    const result = await supabase
      .from("vendors")
      .select("*");


    const { data, error } = await supabase
  .from("vendors")
  .select(
    "id,company_id,vendor_name,contact_person,phone,fax,email,address,accreditation,remarks,is_active,deleted_at"
  )
  .eq(
    "company_id",
    EMIT_COMPANY_ID
  )
  .is(
    "deleted_at",
    null
  )
  .order(
    "vendor_name",
    {
      ascending: true,
    }
  );

if (error) {
  throw error;
}

setVendors(data ?? []);


    setVendors(result.data ?? []);


  } catch(error) {

    console.error(
      
      error
    );

  } finally {

    setLoading(false);

  }
}

  const filteredVendors = useMemo(() => {
    const lowerKeyword = keyword.trim().toLowerCase();

    if (!lowerKeyword) {
      return vendors;
    }

    return vendors.filter((vendor) => {
      return (
        vendor.vendor_name.toLowerCase().includes(lowerKeyword) ||
        vendor.contact_person?.toLowerCase().includes(lowerKeyword) ||
        vendor.phone?.toLowerCase().includes(lowerKeyword) ||
        vendor.email?.toLowerCase().includes(lowerKeyword) ||
        vendor.accreditation?.toLowerCase().includes(lowerKeyword)
      );
    });
  }, [vendors, keyword]);

  function resetForm() {
    setForm(defaultForm);
    setEditingVendorId(null);
    setErrorMessage("");
    setSuccessMessage("");
  }

  function validateForm() {
    if (!form.vendorName.trim()) {
      return "請輸入實驗室 / 廠商名稱。";
    }

    return "";
  }

  async function handleSaveVendor() {
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
        vendor_name: form.vendorName.trim(),
        contact_person: form.contactPerson.trim() || null,
        phone: form.phone.trim() || null,
        fax: form.fax.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        accreditation: form.accreditation.trim() || null,
        remarks: form.remarks.trim() || null,
        is_active: true,
      };

      if (editingVendorId) {
        const { error } = await supabase
          .from("vendors")
          .update(payload)
          .eq("id", editingVendorId)
          .eq("company_id", EMIT_COMPANY_ID);

        if (error) {
          throw error;
        }

        setSuccessMessage("實驗室 / 廠商資料已更新。");
      } else {
        const { error } = await supabase.from("vendors").insert(payload);

        if (error) {
          throw error;
        }

        setSuccessMessage("實驗室 / 廠商已新增。");
      }

      resetForm();
      await loadVendors();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to save vendor.";
      setErrorMessage(message);
    } finally {
      setSaving(false);
    }
  }

  function handleEditVendor(vendor: Vendor) {
    setEditingVendorId(vendor.id);
    setSuccessMessage("");
    setErrorMessage("");

    setForm({
      vendorName: vendor.vendor_name,
      contactPerson: vendor.contact_person || "",
      phone: vendor.phone || "",
      fax: vendor.fax || "",
      email: vendor.email || "",
      address: vendor.address || "",
      accreditation: vendor.accreditation || "",
      remarks: vendor.remarks || "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDisableVendor(vendor: Vendor) {
    const confirmed = window.confirm(
      `確認要停用「${vendor.vendor_name}」嗎？停用後不會影響舊檢測項目或舊報價記錄。`
    );

    if (!confirmed) {
      return;
    }

    try {
      setErrorMessage("");
      setSuccessMessage("");

      const { error } = await supabase
        .from("vendors")
        .update({
          is_active: false,
          deleted_at: new Date().toISOString(),
        })
        .eq("id", vendor.id)
        .eq("company_id", EMIT_COMPANY_ID);

      if (error) {
        throw error;
      }

      setSuccessMessage("實驗室 / 廠商已停用。");
      await loadVendors();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to disable vendor.";
      setErrorMessage(message);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">
            Vendors / Labs 實驗室及廠商管理
          </h1>
          <p className="mt-2 text-slate-500">
            管理外判實驗室、供應商、認可資質及聯絡資料。
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
            <p className="text-sm text-slate-500">Total Vendors</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">
              {vendors.length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Active Vendors</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">
              {vendors.filter((vendor) => vendor.is_active).length}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Accredited Labs</p>
            <p className="mt-3 text-3xl font-bold text-slate-900">
              {
                vendors.filter((vendor) =>
                  vendor.accreditation?.toLowerCase().includes("cnas")
                ).length
              }
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            {editingVendorId
              ? "Edit Vendor / Lab 修改實驗室資料"
              : "Add Vendor / Lab 新增實驗室"}
          </h2>

          <div className="mt-6 grid gap-4 lg:grid-cols-4">
            <div>
              <label className="text-sm font-medium text-slate-700">
                Vendor / Lab Name
              </label>
              <input
                value={form.vendorName}
                onChange={(event) =>
                  setForm({ ...form, vendorName: event.target.value })
                }
                placeholder="拱北海关技术中心"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Contact Person
              </label>
              <input
                value={form.contactPerson}
                onChange={(event) =>
                  setForm({ ...form, contactPerson: event.target.value })
                }
                placeholder="聯絡人"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Phone
              </label>
              <input
                value={form.phone}
                onChange={(event) =>
                  setForm({ ...form, phone: event.target.value })
                }
                placeholder="+86 / +853"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
                placeholder="email@example.com"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Fax
              </label>
              <input
                value={form.fax}
                onChange={(event) =>
                  setForm({ ...form, fax: event.target.value })
                }
                placeholder="Fax"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
              />
            </div>

            <div className="lg:col-span-2">
              <label className="text-sm font-medium text-slate-700">
                Accreditation 認可資質
              </label>
              <input
                value={form.accreditation}
                onChange={(event) =>
                  setForm({ ...form, accreditation: event.target.value })
                }
                placeholder="CNAS L0008 / ISO/IEC 17025"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Address
              </label>
              <input
                value={form.address}
                onChange={(event) =>
                  setForm({ ...form, address: event.target.value })
                }
                placeholder="地址"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
              />
            </div>

            <div className="lg:col-span-4">
              <label className="text-sm font-medium text-slate-700">
                Remarks
              </label>
              <textarea
                value={form.remarks}
                onChange={(event) =>
                  setForm({ ...form, remarks: event.target.value })
                }
                placeholder="備註，例如：主要外判食品檢測、報告時間、特別收費等"
                rows={3}
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
              />
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={handleSaveVendor}
              disabled={saving}
              className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? "Saving..."
                : editingVendorId
                ? "Update Vendor"
                : "Add Vendor"}
            </button>

            {editingVendorId && (
              <button
                onClick={resetForm}
                className="rounded-xl border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Cancel Edit
              </button>
            )}
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Vendor / Lab List
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                檢測項目可連接到這裡的實驗室 / 廠商。
              </p>
            </div>

            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Search vendor..."
              className="w-80 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-slate-900"
            />
          </div>

          {loading ? (
            <div className="mt-6 rounded-xl bg-slate-50 p-6 text-slate-500">
              Loading vendors...
            </div>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[1100px] border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100 text-left">
                    <th className="border border-slate-200 px-4 py-3">
                      Vendor / Lab
                    </th>
                    <th className="border border-slate-200 px-4 py-3">
                      Contact
                    </th>
                    <th className="border border-slate-200 px-4 py-3">
                      Phone
                    </th>
                    <th className="border border-slate-200 px-4 py-3">
                      Email
                    </th>
                    <th className="border border-slate-200 px-4 py-3">
                      Accreditation
                    </th>
                    <th className="border border-slate-200 px-4 py-3">
                      Status
                    </th>
                    <th className="border border-slate-200 px-4 py-3 text-right">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredVendors.map((vendor) => (
                    <tr key={vendor.id}>
                      <td className="border border-slate-200 px-4 py-3 font-semibold text-slate-900">
                        {vendor.vendor_name}
                        {vendor.address && (
                          <p className="mt-1 text-xs font-normal text-slate-500">
                            {vendor.address}
                          </p>
                        )}
                      </td>
                      <td className="border border-slate-200 px-4 py-3">
                        {vendor.contact_person || "-"}
                      </td>
                      <td className="border border-slate-200 px-4 py-3">
                        {vendor.phone || "-"}
                      </td>
                      <td className="border border-slate-200 px-4 py-3">
                        {vendor.email || "-"}
                      </td>
                      <td className="border border-slate-200 px-4 py-3">
                        {vendor.accreditation || "-"}
                      </td>
                      <td className="border border-slate-200 px-4 py-3">
                        <span
                          className={
                            vendor.is_active
                              ? "rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
                              : "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500"
                          }
                        >
                          {vendor.is_active ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td className="border border-slate-200 px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEditVendor(vendor)}
                            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => handleDisableVendor(vendor)}
                            disabled={!vendor.is_active}
                            className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            Disable
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredVendors.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="border border-slate-200 px-4 py-10 text-center text-slate-500"
                      >
                        No vendors found.
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
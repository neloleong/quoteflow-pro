"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
};

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/clients", label: "Clients" },
  { href: "/vendors", label: "Vendors / Labs" },
  { href: "/test-items", label: "Test Items" },
  { href: "/quotations", label: "Quotations" },
  { href: "/quotations/list", label: "Quotation Lists" },
  { href: "/sample-records", label: "Sample Records" },
  { href: "/report", label: "Reports" },
  { href: "/invoices", label: "Invoices" },
  { href: "/receipts", label: "Receipts" },
];

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed left-0 top-0 h-screen w-64 overflow-y-auto border-r border-slate-200 bg-white p-6">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-slate-900">
            QuoteFlow Pro
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            SaaS Business Document System
          </p>
        </div>

        <nav className="space-y-2">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "block rounded-xl px-4 py-3 text-sm font-medium transition",
                  isActive
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-950",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="ml-64 min-h-screen p-8">
        {children}
      </main>
    </div>
  );
}
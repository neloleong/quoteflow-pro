"use client";

import Link from "next/link";
import {
  usePathname,
  useRouter,
} from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";

type AppShellProps = {
  children: ReactNode;
};

const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
  },
  {
    href: "/clients",
    label: "Clients",
  },
  {
    href: "/vendors",
    label: "Vendors / Labs",
  },
  {
    href: "/test-items",
    label: "Test Items",
  },
  {
    href: "/quotations",
    label: "Quotations",
  },
  {
    href: "/quotations/list",
    label: "Quotation Lists",
  },
  {
    href: "/sample-records",
    label: "Sample Records",
  },
  {
    href: "/report",
    label: "Reports",
  },
  {
    href: "/invoices",
    label: "Invoices",
  },
  {
    href: "/receipts",
    label: "Receipts",
  },
];

export default function AppShell({
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [userEmail, setUserEmail] =
    useState("");
  const [loggingOut, setLoggingOut] =
    useState(false);

  useEffect(() => {
    let active = true;

    async function loadCurrentUser() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!active) {
          return;
        }

        setUserEmail(
          user?.email || ""
        );
      } catch (error) {
        console.warn(
          "Load current user warning:",
          error
        );
      }
    }

    loadCurrentUser();

    const {
      data: {
        subscription,
      },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!active) {
          return;
        }

        setUserEmail(
          session?.user?.email || ""
        );
      }
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleLogout() {
    try {
      setLoggingOut(true);

      const { error } =
        await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      router.replace("/login");
      router.refresh();
    } catch (error) {
      console.error(
        "Logout error:",
        error
      );

      window.alert(
        "Logout failed. Please try again."
      );
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed left-0 top-0 flex h-screen w-64 flex-col overflow-y-auto border-r border-slate-200 bg-white p-6">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-slate-900">
            QuoteFlow Pro
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            SaaS Business Document System
          </p>
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              pathname.startsWith(
                `${item.href}/`
              );

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

        <div className="mt-8 border-t border-slate-200 pt-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Signed In
          </p>

          <p
            title={userEmail}
            className="mt-2 truncate text-sm font-medium text-slate-700"
          >
            {userEmail || "Authenticated User"}
          </p>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loggingOut
              ? "Logging Out..."
              : "Logout"}
          </button>
        </div>
      </aside>

      <main className="ml-64 min-h-screen p-8">
        {children}
      </main>
    </div>
  );
}

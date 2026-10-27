"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function getErrorMessage(
  error: unknown,
  fallbackMessage: string
) {
  if (error instanceof Error) {
    return error.message || fallbackMessage;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    const message = String(
      (error as { message?: unknown })
        .message || ""
    );

    if (message) {
      return message;
    }
  }

  return fallbackMessage;
}

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [email, setEmail] =
    useState("");
  const [password, setPassword] =
    useState("");

  const [checkingSession, setCheckingSession] =
    useState(true);
  const [signingIn, setSigningIn] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    let active = true;

    async function checkCurrentUser() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (
          active &&
          user
        ) {
          router.replace("/dashboard");
          router.refresh();
          return;
        }
      } catch (error) {
        console.warn(
          "Check login session warning:",
          error
        );
      } finally {
        if (active) {
          setCheckingSession(false);
        }
      }
    }

    checkCurrentUser();

    return () => {
      active = false;
    };
  }, [router, supabase]);

  async function handleLogin(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const cleanEmail =
      email.trim();

    if (!cleanEmail) {
      setErrorMessage(
        "請輸入 Email。"
      );
      return;
    }

    if (!password) {
      setErrorMessage(
        "請輸入 Password。"
      );
      return;
    }

    try {
      setSigningIn(true);
      setErrorMessage("");

      const { error } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (error) {
        throw error;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      console.error(
        "Login error:",
        error
      );

      setErrorMessage(
        getErrorMessage(
          error,
          "登入失敗，請檢查 Email 及 Password。"
        )
      );
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/70">
          <div className="mb-8">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
              EMIT
            </p>

            <h1 className="mt-3 text-3xl font-bold text-slate-900">
              QuoteFlow Pro
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Environment Monitoring Inspection and Testing
            </p>
          </div>

          <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-800">
              Staff Login
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              請使用已由系統管理員建立的公司帳號登入。
            </p>
          </div>

          {errorMessage && (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
              {errorMessage}
            </div>
          )}

          <form
            onSubmit={handleLogin}
            className="space-y-5"
          >
            <div>
              <label
                htmlFor="email"
                className="text-sm font-semibold text-slate-700"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value
                  )
                }
                autoComplete="username"
                disabled={
                  checkingSession ||
                  signingIn
                }
                placeholder="name@emit.com.mo"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="text-sm font-semibold text-slate-700"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value
                  )
                }
                autoComplete="current-password"
                disabled={
                  checkingSession ||
                  signingIn
                }
                placeholder="••••••••"
                className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>

            <button
              type="submit"
              disabled={
                checkingSession ||
                signingIn
              }
              className="w-full rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {checkingSession
                ? "Checking Session..."
                : signingIn
                  ? "Signing In..."
                  : "Sign In"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs leading-5 text-slate-400">
            No public registration is available.
          </p>
        </div>
      </div>
    </main>
  );
}

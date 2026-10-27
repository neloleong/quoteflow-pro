import { createServerClient } from "@supabase/ssr";
import {
  NextResponse,
  type NextRequest,
} from "next/server";

function getSupabasePublicKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

function copyResponseCookies(
  targetResponse: NextResponse,
  sourceResponse: NextResponse
) {
  const cookies = sourceResponse.cookies.getAll();

  cookies.forEach((cookie) => {
    targetResponse.cookies.set(cookie);
  });
}

function copyAuthResponseState(
  targetResponse: NextResponse,
  sourceResponse: NextResponse
) {
  copyResponseCookies(
    targetResponse,
    sourceResponse
  );

  for (const headerName of [
    "cache-control",
    "expires",
    "pragma",
  ]) {
    const headerValue =
      sourceResponse.headers.get(headerName);

    if (headerValue) {
      targetResponse.headers.set(
        headerName,
        headerValue
      );
    }
  }

  return targetResponse;
}

export async function updateSession(
  request: NextRequest
) {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabasePublicKey =
    getSupabasePublicKey();

  if (
    !supabaseUrl ||
    !supabasePublicKey
  ) {
    console.error(
      "Supabase auth proxy configuration is missing."
    );

    return NextResponse.next({
      request,
    });
  }

  let supabaseResponse =
    NextResponse.next({
      request,
    });

  const supabase =
    createServerClient(
      supabaseUrl,
      supabasePublicKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },

          setAll(cookiesToSet) {
            cookiesToSet.forEach(
              ({
                name,
                value,
                options,
              }) => {
                request.cookies.set(
                  name,
                  value
                );

                supabaseResponse.cookies.set(
                  name,
                  value,
                  options
                );
              }
            );
          },
        },
      }
    );

  const pathname =
    request.nextUrl.pathname;

  const isLoginPage =
    pathname === "/login";

  const isRootPage =
    pathname === "/";

  const isApiRoute =
    pathname.startsWith("/api/");

  let userId = "";

  try {
    const {
      data,
      error,
    } = await supabase.auth.getClaims();

    if (error) {
      console.warn(
        "Supabase auth getClaims warning:",
        error.message
      );
    }

    userId =
      typeof data?.claims?.sub ===
      "string"
        ? data.claims.sub
        : "";
  } catch (error) {
    console.error(
      "Supabase auth verification error:",
      error
    );
  }

  if (
    !userId &&
    !isLoginPage
  ) {
    if (isApiRoute) {
      const unauthorizedResponse =
        NextResponse.json(
          {
            error: "Unauthorized",
          },
          {
            status: 401,
          }
        );

      return copyAuthResponseState(
        unauthorizedResponse,
        supabaseResponse
      );
    }

    const loginUrl =
      request.nextUrl.clone();

    loginUrl.pathname = "/login";
    loginUrl.search = "";

    const redirectResponse =
      NextResponse.redirect(loginUrl);

    return copyAuthResponseState(
      redirectResponse,
      supabaseResponse
    );
  }

  if (
    userId &&
    (
      isLoginPage ||
      isRootPage
    )
  ) {
    const dashboardUrl =
      request.nextUrl.clone();

    dashboardUrl.pathname =
      "/dashboard";

    dashboardUrl.search = "";

    const redirectResponse =
      NextResponse.redirect(
        dashboardUrl
      );

    return copyAuthResponseState(
      redirectResponse,
      supabaseResponse
    );
  }

  return supabaseResponse;
}

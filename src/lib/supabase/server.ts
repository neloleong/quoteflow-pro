import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

function getSupabasePublicKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabasePublicKey = getSupabasePublicKey();

  if (!supabaseUrl) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL"
    );
  }

  if (!supabasePublicKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  return createServerClient(
    supabaseUrl,
    supabasePublicKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(
              ({ name, value, options }) => {
                cookieStore.set(
                  name,
                  value,
                  options
                );
              }
            );
          } catch {
            /*
             * Server Components cannot always write cookies.
             * The root proxy refreshes the auth session and
             * writes refreshed cookies to the response.
             */
          }
        },
      },
    }
  );
}

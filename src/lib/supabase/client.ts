import { createBrowserClient } from "@supabase/ssr";

function getSupabasePublicKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function createClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const supabasePublicKey = getSupabasePublicKey();

  console.log(
    "SUPABASE URL FROM CLIENT:",
    supabaseUrl
  );

  console.log(
    "SUPABASE KEY EXISTS:",
    !!supabasePublicKey
  );

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

  console.log();

  return createBrowserClient(
    supabaseUrl,
    supabasePublicKey
  );
}

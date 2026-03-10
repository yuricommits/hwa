import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase service role credentials are not set");
  }

  _client = createClient(url, key);
  return _client;
}

// Keep named export for backwards compatibility
export const serviceClient = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return getServiceClient()[prop as keyof SupabaseClient];
  },
});

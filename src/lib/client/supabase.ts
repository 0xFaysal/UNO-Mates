import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseClient: SupabaseClient | null = null;
let realtimeToken:string|null=null;

/** Realtime's callback is the SDK's source of truth on connect/heartbeat too. */
export async function setRoomRealtimeAuth(token:string){
  realtimeToken=token;
  await getClientSupabase()?.realtime.setAuth(token);
}

export function getClientSupabase(): SupabaseClient | null {
  if (typeof window === 'undefined') return null;
  if (supabaseClient) return supabaseClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (url && anonKey) {
    supabaseClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      realtime: {
        accessToken:async()=>realtimeToken||anonKey,
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    return supabaseClient;
  }

  return null;
}

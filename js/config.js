export const SUPABASE_URL = "https://avvuutsawfivsfcrljpi.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_BcJu7QpgJv8q9i66dNSSxA_gW_5653z";

export const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

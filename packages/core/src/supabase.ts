import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type SupabaseEnv = {
  url: string;
  anonKey: string;
};

export const createSupabaseAnonClient = ({ url, anonKey }: SupabaseEnv): SupabaseClient => {
  return createClient(url, anonKey);
};

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** The Supabase client, or null when no project is configured (the app then runs on local storage). */
export const supabase = url && key ? createClient(url, key) : null;

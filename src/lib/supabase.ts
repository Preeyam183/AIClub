import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = url && key && !url.includes('your-project') && !key.startsWith('your-')
  ? createClient(url, key)
  : null;
export const isDemo = !supabase;

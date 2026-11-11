import { createClient, type PostgrestError, type SupabaseClient } from '@supabase/supabase-js';
import { env, HttpError } from './http.js';

let client: SupabaseClient | undefined;

export function database() {
  if (!client) {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || env('SUPABASE_SECRET_KEY');
    client = createClient(env('SUPABASE_URL'), key, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
      global: {
        fetch: (input, init) => {
          const timeout = AbortSignal.timeout(8000);
          const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
          return fetch(input, { ...init, signal });
        },
      },
    });
  }
  return client;
}

export function checkDatabase(error: PostgrestError | null, operation: string): void {
  if (!error) return;
  console.error('[drama-api] database operation failed', operation, error.code || 'upstream');
  throw new HttpError(502, 'DATABASE_ERROR', 'The database could not complete the request.');
}

// Supabase connection settings.
// Replace these placeholders with values from Supabase Project Settings > API.
// The anon key is safe for browser use when Row Level Security is enabled.
let SUPABASE_URL = '';
let SUPABASE_ANON_KEY = '';

function isSupabaseConfigured() {
    return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)
        && !SUPABASE_URL.includes('YOUR_PROJECT_REF')
        && !SUPABASE_ANON_KEY.includes('YOUR_');
}

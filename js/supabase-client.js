let supabaseClient = null;

async function initializeCloud() {
    try {
        const response = await fetch('/api/config');
        if (response.ok) {
            const config = await response.json();
            SUPABASE_URL = config.supabaseUrl || '';
            SUPABASE_ANON_KEY = config.supabaseAnonKey || '';
        }
    } catch (_) { /* local file mode has no config endpoint */ }
    if (isSupabaseConfigured()) supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

function cloudReady() {
    return Boolean(supabaseClient);
}

function cloudError(error, fallback = 'Cloud request failed.') {
    console.error(error);
    return error?.message || fallback;
}

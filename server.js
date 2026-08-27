require('dotenv').config();
const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = Number(process.env.PORT || 3000);
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;
const cloudConfigured = Boolean(supabaseUrl && serviceRoleKey && anonKey);
const admin = cloudConfigured
    ? createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;

const supabaseOrigin = supabaseUrl ? (() => { try { return new URL(supabaseUrl).origin; } catch (_) { return null; } })() : null;
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com', 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://cdnjs.cloudflare.com', 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:'],
            connectSrc: ["'self'", ...(supabaseOrigin ? [supabaseOrigin] : [])],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            frameAncestors: ["'self'"]
        }
    }
}));
const corsOrigin = process.env.CORS_ORIGIN?.trim();
if (corsOrigin) app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: '1mb' }));

async function requireUser(req, res, next) {
    if (!admin) return res.status(503).json({ error: 'Cloud database is not configured on this deployment.' });
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Authentication required.' });
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Invalid or expired session.' });
    const { data: profile } = await admin.from('profiles').select('id, full_name, role, active').eq('id', user.id).single();
    if (!profile?.active) return res.status(403).json({ error: 'Account is inactive.' });
    req.user = { ...user, profile };
    next();
}

function managerOnly(req, res, next) {
    if (!['manager', 'administrator'].includes(req.user.profile.role)) return res.status(403).json({ error: 'Manager or administrator access required.' });
    next();
}

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/api/config', (_req, res) => res.json({ supabaseUrl, supabaseAnonKey: anonKey }));

app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.post('/api/staff', requireUser, managerOnly, async (req, res) => {
    const { name, email, password } = req.body || {};
    if (!name?.trim() || !email?.trim() || typeof password !== 'string' || password.length < 10) return res.status(400).json({ error: 'Name, email, and a password of at least 10 characters are required.' });
    const { data: created, error: createError } = await admin.auth.admin.createUser({ email: email.trim().toLowerCase(), password, email_confirm: true, user_metadata: { full_name: name.trim() } });
    if (createError) return res.status(400).json({ error: createError.message });
    const { error: profileError } = await admin.from('profiles').insert({ id: created.user.id, full_name: name.trim(), role: 'staff', active: true });
    if (profileError) {
        await admin.auth.admin.deleteUser(created.user.id);
        return res.status(400).json({ error: profileError.message });
    }
    await admin.from('audit_log').insert({ actor_id: req.user.id, action: 'create', entity: 'user', entity_id: null, metadata: { created_user_id: created.user.id } });
    res.status(201).json({ id: created.user.id, name: name.trim(), email: email.trim().toLowerCase(), role: 'staff', active: true });
});

app.patch('/api/staff/:id/remove', requireUser, managerOnly, async (req, res) => {
    const { error } = await admin.from('profiles').update({ active: false }).eq('id', req.params.id).eq('role', 'staff');
    if (error) return res.status(400).json({ error: error.message });
    const { error: authError } = await admin.auth.admin.updateUserById(req.params.id, { ban_duration: '876000h' });
    if (authError) return res.status(400).json({ error: authError.message });
    await admin.from('audit_log').insert({ actor_id: req.user.id, action: 'remove', entity: 'user', metadata: { removed_user_id: req.params.id } });
    res.status(204).end();
});

app.use(express.static(__dirname));

if (require.main === module) {
    app.listen(port, () => console.log(`F EMMANUEL 85 VENTURES server running at http://localhost:${port}`));
}

module.exports = app;

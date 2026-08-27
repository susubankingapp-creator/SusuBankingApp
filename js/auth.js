// ============================================================
// AUTHENTICATION - Supabase Auth with a local-only fallback
// ============================================================

const AUTH_STORAGE_KEY = 'susu_pinhin_auth';
const SESSION_STORAGE_KEY = 'susu_pinhin_session';
const SETUP_COMPLETE_KEY = 'susu_pinhin_setup_complete';
let authStore = loadAuthStore();
let currentUser = loadSession();
let cloudStaffUsers = [];

function loadAuthStore() {
    try {
        const parsed = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || '{}');
        return { users: Array.isArray(parsed.users) ? parsed.users : [] };
    } catch (_) {
        return { users: [] };
    }
}

function saveAuthStore() {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authStore));
}

function loadSession() {
    try {
        const session = JSON.parse(sessionStorage.getItem(SESSION_STORAGE_KEY) || 'null');
        return session && session.id ? session : null;
    } catch (_) {
        return null;
    }
}

function getCurrentUser() {
    return currentUser;
}

function isManager() {
    return Boolean(currentUser && ['manager', 'administrator'].includes(currentUser.role));
}

function isAuthenticated() {
    return Boolean(currentUser);
}

async function hashPassword(password) {
    const bytes = new TextEncoder().encode(password);
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function makeUserId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function setSession(user) {
    currentUser = { id: user.id, name: user.name, username: user.username, role: user.role };
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(currentUser));
}

function clearSession() {
    currentUser = null;
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

function requireAuth() {
    if (!isAuthenticated()) {
        showAuthScreen('login');
        return false;
    }
    return true;
}

function requireManager() {
    if (!isManager()) {
        showToast('Manager access is required for this action.', 'error');
        return false;
    }
    return true;
}

function getStaffUsers() {
    const users = cloudReady() ? cloudStaffUsers : authStore.users;
    return users.filter(user => user.role === 'staff' && user.active !== false);
}

function getAllStaffUsers() {
    const users = cloudReady() ? cloudStaffUsers : authStore.users;
    return users.filter(user => user.role === 'staff');
}

async function loadCloudStaff() {
    const { data: profiles, error } = await supabaseClient.from('profiles').select('id, full_name, role, active').eq('role', 'staff').order('full_name');
    if (error) throw error;
    cloudStaffUsers = (profiles || []).map(profile => ({ id: profile.id, name: profile.full_name, username: '', role: profile.role, active: profile.active }));
}

function showAuthScreen(mode) {
    const screen = document.getElementById('authScreen');
    if (!screen) return;
    screen.classList.add('visible');
    document.body.classList.add('auth-locked');
    setAuthMode(mode);
}

function hideAuthScreen() {
    const screen = document.getElementById('authScreen');
    if (screen) screen.classList.remove('visible');
    document.body.classList.remove('auth-locked');
}

function setAuthMode(mode) {
    const hasManager = authStore.users.some(user => ['manager', 'administrator'].includes(user.role))
        || localStorage.getItem(SETUP_COMPLETE_KEY) === 'true';
    const setup = mode === 'setup' && !hasManager;
    document.getElementById('authTitle').textContent = setup ? 'Create manager account' : 'Welcome back';
    document.getElementById('authSubtitle').textContent = setup
        ? 'Set up the first account for this F EMMANUEL 85 VENTURES workspace.'
        : 'Sign in to continue to your workspace.';
    document.getElementById('authSubmit').textContent = setup ? 'Create manager account' : 'Sign in';
    document.getElementById('authNameGroup').hidden = !setup;
    document.getElementById('authSwitch').hidden = setup || hasManager;
    document.getElementById('authReset').hidden = setup;
    document.getElementById('authMode').value = mode;
}

async function requestPasswordReset() {
    const username = document.getElementById('authUsername').value.trim().toLowerCase();
    if (!username) {
        showAuthMessage('Enter your email address first.');
        return;
    }
    if (!cloudReady()) {
        showAuthMessage('Password recovery is available when cloud access is enabled.');
        return;
    }
    const email = username.includes('@') ? username : `${username}@femmanuel85.local`;
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) {
        showAuthMessage(cloudError(error, 'Unable to send password reset email.'));
        return;
    }
    showAuthMessage('If that account exists, a password reset email has been sent.');
}

async function completePasswordRecovery() {
    const password = window.prompt('Enter a new password of at least 6 characters:');
    if (!password) return;
    if (password.length < 6) {
        showAuthMessage('The new password must be at least 6 characters.');
        return;
    }
    const { error } = await supabaseClient.auth.updateUser({ password });
    showAuthMessage(error ? cloudError(error, 'Unable to update password.') : 'Password updated. You can now sign in.');
    if (!error) await supabaseClient.auth.signOut();
}

async function submitAuth(event) {
    event.preventDefault();
    const mode = document.getElementById('authMode').value;
    const name = document.getElementById('authName').value.trim();
    const username = document.getElementById('authUsername').value.trim().toLowerCase();
    const password = document.getElementById('authPassword').value;
    const button = document.getElementById('authSubmit');

    if (!username || password.length < 6 || (mode === 'setup' && !name)) {
        showAuthMessage('Enter all required details. Passwords must be at least 6 characters.');
        return;
    }

    button.disabled = true;
    try {
        if (cloudReady()) {
            const email = username.includes('@') ? username : `${username}@femmanuel85.local`;
            if (mode === 'setup') {
                const { data: result, error } = await supabaseClient.auth.signUp({ email, password });
                if (error) throw error;
                if (!result.session) {
                    throw new Error('Account created. Confirm your email, then sign in to finish manager setup.');
                }
                const { data: profile, error: profileError } = await supabaseClient.rpc('setup_first_manager', { p_full_name: name });
                if (profileError) throw profileError;
                localStorage.setItem(SETUP_COMPLETE_KEY, 'true');
                await setCloudSession(result.session, profile);
                enterApp();
                showToast('Manager account created.', 'success');
            } else {
                const { data: result, error } = await supabaseClient.auth.signInWithPassword({ email, password });
                if (error) throw error;
                await loadCloudProfile(result.user);
                enterApp();
            }
            return;
        }
        const passwordHash = await hashPassword(password);
        if (mode === 'setup') {
            if (authStore.users.some(user => user.role === 'manager')) {
                setAuthMode('login');
                showAuthMessage('A manager account already exists. Please sign in.');
                return;
            }
            const manager = { id: makeUserId(), name, username, passwordHash, role: 'manager', active: true, createdAt: todayStr() };
            authStore.users.push(manager);
            saveAuthStore();
            document.getElementById('authSwitch').hidden = true;
            setSession(manager);
            enterApp();
            showToast('Manager account created.', 'success');
        } else {
            const user = authStore.users.find(candidate => candidate.username === username && candidate.active !== false);
            if (!user || user.passwordHash !== passwordHash) {
                showAuthMessage('Incorrect username or password.');
                return;
            }
            setSession(user);
            enterApp();
        }
    } catch (error) {
        showAuthMessage(cloudReady() ? cloudError(error, 'Unable to sign in.') : 'Unable to sign in.');
    } finally {
        button.disabled = false;
    }
}

async function setCloudSession(session, profile) {
    currentUser = { id: profile.id, name: profile.full_name, username: session?.user?.email || '', role: profile.role };
}

async function loadCloudProfile(user) {
    const { data: profile, error } = await supabaseClient.from('profiles').select('id, full_name, role, active').eq('id', user.id).single();
    if (error || !profile?.active) throw new Error('Your account is not active.');
    localStorage.setItem(SETUP_COMPLETE_KEY, 'true');
    await setCloudSession({ user }, profile);
}

function showAuthMessage(message) {
    const messageEl = document.getElementById('authMessage');
    if (messageEl) messageEl.textContent = message;
}

function togglePassword(inputId, button) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    button.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
    button.setAttribute('title', isHidden ? 'Hide password' : 'Show password');
    const icon = button.querySelector('i');
    if (icon) icon.className = `fas fa-eye${isHidden ? '-slash' : ''}`;
}

async function enterApp() {
    hideAuthScreen();
    applyRoleAccess();
    updateUserIdentity();
    try {
        await hydrateCloudData();
        if (cloudReady() && isManager()) await loadCloudStaff();
    } catch (error) {
        showAuthMessage(cloudError(error, 'Unable to load cloud data.'));
        return;
    }
    renderAll();
    navigate('dashboard');
}

function logout() {
    if (cloudReady()) supabaseClient.auth.signOut();
    clearSession();
    document.querySelectorAll('.modal-overlay.open').forEach(modal => modal.classList.remove('open'));
    showAuthScreen('login');
    showAuthMessage('You have been signed out.');
}

function updateUserIdentity() {
    if (!currentUser) return;
    const name = document.querySelector('.sidebar-footer .name');
    const role = document.querySelector('.sidebar-footer .role');
    const avatar = document.querySelector('.sidebar-footer .avatar');
    const avatarIcon = avatar?.querySelector('i');
    const greeting = document.getElementById('userGreeting');
    const timeGreetingElement = document.getElementById('timeGreeting');
    if (name) name.textContent = currentUser.name;
    if (role) role.textContent = currentUser.role === 'administrator' ? 'Administrator access' : currentUser.role === 'manager' ? 'Manager access' : 'Staff access';
    if (avatarIcon) avatarIcon.setAttribute('aria-label', `${currentUser.name} profile`);
    if (greeting) {
        const hour = new Date().getHours();
        const timeGreeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
        if (timeGreetingElement) timeGreetingElement.textContent = `${timeGreeting},`;
        greeting.textContent = currentUser.name;
    }
}

function applyRoleAccess() {
    const managerOnly = document.querySelectorAll('[data-manager-only]');
    managerOnly.forEach(element => { element.hidden = !isManager(); });
    const staffOnly = document.querySelectorAll('[data-staff-only]');
    staffOnly.forEach(element => { element.hidden = isManager(); });
}

async function addStaff(event) {
    event.preventDefault();
    if (!requireManager()) return;
    const name = document.getElementById('staffName').value.trim();
    const username = document.getElementById('staffUsername').value.trim().toLowerCase();
    const password = document.getElementById('staffPassword').value;
    if (!name || !username || password.length < 10) {
        showToast('Enter a name, username, and password of at least 10 characters.', 'error');
        return;
    }
    if (cloudReady()) {
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            const response = await fetch('/api/staff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({ name, email: username.includes('@') ? username : `${username}@femmanuel85.local`, password })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unable to create staff account.');
            await loadCloudStaff();
            event.target.reset();
            renderStaff();
            populateStaffDropdowns();
            closeModal('staffModal');
            showToast(`Staff account for ${name} created.`, 'success');
        } catch (error) { showToast(cloudError(error, 'Unable to create staff account.'), 'error'); }
        return;
    }
    if (authStore.users.some(user => user.username === username)) {
        showToast('That username is already in use.', 'error');
        return;
    }
    hashPassword(password).then(passwordHash => {
        authStore.users.push({ id: makeUserId(), name, username, passwordHash, role: 'staff', active: true, createdAt: todayStr() });
        saveAuthStore();
        event.target.reset();
        renderStaff();
        populateStaffDropdowns();
        closeModal('staffModal');
        showToast(`Staff account for ${name} created.`, 'success');
    });
}

async function removeStaff(id) {
    if (!requireManager()) return;
    const staff = getAllStaffUsers().find(user => user.id === id && user.role === 'staff');
    if (!staff || !confirm(`Remove staff access for ${staff.name}?`)) return;
    if (cloudReady()) {
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            const response = await fetch(`/api/staff/${encodeURIComponent(id)}/remove`, { method: 'PATCH', headers: { Authorization: `Bearer ${session.access_token}` } });
            const result = response.status === 204 ? null : await response.json();
            if (!response.ok) throw new Error(result?.error || 'Unable to remove staff account.');
            await loadCloudStaff();
        } catch (error) { showToast(cloudError(error, 'Unable to remove staff account.'), 'error'); return; }
    } else {
        staff.active = false;
    }
    if (!cloudReady()) saveAuthStore();
    renderStaff();
    populateStaffDropdowns();
    showToast(`${staff.name} no longer has access.`, 'warning');
}

function renderStaff() {
    const body = document.getElementById('staffTableBody');
    const label = document.getElementById('staffTotalLabel');
    if (!body || !label) return;
    const staff = getAllStaffUsers();
    label.textContent = `${staff.filter(user => user.active !== false).length} active staff`;
    if (!staff.length) {
        body.innerHTML = '<tr><td colspan="4"><div class="empty-state"><i class="fas fa-user-shield"></i><h3>No staff accounts</h3><p>Add staff members who can record transactions.</p></div></td></tr>';
        return;
    }
    body.innerHTML = staff.map(user => `<tr><td><strong>${escapeHtml(user.name)}</strong></td><td>${escapeHtml(user.username)}</td><td><span class="badge-status ${user.active === false ? 'out' : 'in'}">${user.active === false ? 'Removed' : 'Active'}</span></td><td style="text-align:center;">${user.active === false ? '—' : `<button class="btn btn-danger btn-xs" onclick="removeStaff('${user.id}')"><i class="fas fa-user-minus"></i> Remove</button>`}</td></tr>`).join('');
}

function populateStaffDropdowns() {
    const staff = currentUser ? [currentUser] : [];
    ['cashinReceivedBy', 'cashoutIssuedBy'].forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;
        const currentValue = select.value;
        select.innerHTML = '<option value="">— Select staff member —</option>';
        staff.forEach(user => {
            const option = document.createElement('option');
            option.value = user.name;
            option.textContent = user.name;
            select.appendChild(option);
        });
        select.disabled = staff.length === 1;
        if (staff.length === 1) select.value = staff[0].name;
        if (staff.some(user => user.name === currentValue)) select.value = currentValue;
    });
}

document.addEventListener('DOMContentLoaded', async function() {
    await initializeCloud();
    if (cloudReady()) {
        supabaseClient.auth.onAuthStateChange(event => {
            if (event === 'PASSWORD_RECOVERY') completePasswordRecovery();
        });
        supabaseClient.auth.getSession().then(async ({ data: { session } }) => {
            if (session?.user) {
                try { await loadCloudProfile(session.user); await enterApp(); } catch (error) { showAuthScreen('login'); showAuthMessage(cloudError(error, 'Unable to load your account.')); }
            } else showAuthScreen('login');
        });
    } else if (isAuthenticated()) enterApp();
    else showAuthScreen(authStore.users.some(user => ['manager', 'administrator'].includes(user.role)) ? 'login' : 'setup');
});

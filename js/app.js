// ============================================================
// NAVIGATION
// ============================================================

function navigate(page) {
    if (!requireAuth()) return;
    const managerPages = ['dashboard', 'settings', 'staff', 'activity'];
    if (managerPages.includes(page) && !isManager()) {
        showToast('This section is available to the manager only.', 'error');
        return;
    }
    // Update sidebar
    document.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
    const link = document.querySelector(`.sidebar-nav a[data-page="${page}"]`);
    if (link) link.classList.add('active');

    // Update pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(`page-${page}`);
    if (target) target.classList.add('active');

    // Update title
    const titles = {
        dashboard: 'Dashboard',
        customers: 'Customers',
        cashin: 'Cash In',
        cashout: 'Cash Out',
        balances: 'Balances',
        reports: 'Reports',
        staff: 'Staff Access',
        activity: 'Activity Log',
        settings: 'Settings'
    };
    document.getElementById('pageTitle').innerHTML = (titles[page] || 'Dashboard') + ' <small>' + 
        (page === 'dashboard' ? 'overview' : '') + '</small>';

    // Refresh content
    if (page === 'dashboard') updateDashboard();
    if (page === 'customers') renderCustomers();
    if (page === 'cashin') renderCashIn();
    if (page === 'cashout') renderCashOut();
    if (page === 'balances') renderBalances();
    if (page === 'reports') generateReport();
    if (page === 'staff') renderStaff();
    if (page === 'activity') renderActivityLog();
    if (page === 'settings') renderSettings();

    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar')?.classList.remove('open');
        document.getElementById('sidebarOverlay')?.classList.remove('open');
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar?.classList.toggle('open');
    overlay?.classList.toggle('open');
}

// ============================================================
// MODALS
// ============================================================

function openModal(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.remove('open');
        document.body.style.overflow = '';
    }
}

// ============================================================
// PWA INSTALL
// ============================================================

let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    deferredInstallPrompt = e;
    updateInstallButton();
});

window.addEventListener('appinstalled', function() {
    deferredInstallPrompt = null;
    updateInstallButton();
    showToast('App installed. You can now open it from your home screen or app list.', 'success');
});

function isAppInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function updateInstallButton() {
    const buttons = Array.from(document.querySelectorAll('[data-install-app-btn]'));
    if (buttons.length === 0) return;
    const hintEls = Array.from(document.querySelectorAll('[data-install-app-hint]'));
    if (isAppInstalled()) {
        buttons.forEach(button => {
            button.disabled = true;
            const label = button.querySelector('[data-install-app-label]');
            if (label) label.textContent = 'App installed';
        });
        hintEls.forEach(hint => { hint.textContent = 'The app is already installed on this device.'; });
        return;
    }
    buttons.forEach(button => {
        button.disabled = false;
        const label = button.querySelector('[data-install-app-label]');
        if (label) label.textContent = 'Install app';
    });
    hintEls.forEach(hint => {
        hint.textContent = deferredInstallPrompt
            ? 'Takes a few seconds — the app will appear on your home screen or in your app list.'
            : 'If no install prompt appears, open your browser menu and choose "Install app" or "Add to Home screen".';
    });
}

async function installApp() {
    if (isAppInstalled()) {
        showToast('The app is already installed on this device.', 'warning');
        return;
    }
    if (!deferredInstallPrompt) {
        showToast('Open your browser menu and choose "Install app" or "Add to Home screen".', 'warning');
        return;
    }
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    if (choice.outcome === 'accepted') deferredInstallPrompt = null;
    updateInstallButton();
}

// ============================================================
// BRAND LOGOS
// ============================================================

// Single place to swap brand artwork: 'dark' = for dark surfaces, 'light' = for light surfaces.
const BRAND_LOGOS = {
    dark: 'assets/white logo (1).jpg',
    light: 'assets/blue-black logo.jpg'
};

function syncBrandLogos() {
    document.querySelectorAll('img[data-brand-logo]').forEach(img => {
        const variant = img.getAttribute('data-brand-logo') === 'light' ? 'light' : 'dark';
        const src = BRAND_LOGOS[variant];
        if (img.getAttribute('src') !== src) img.setAttribute('src', src);
    });
}

// Close modal on overlay click
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.modal-overlay').forEach(el => {
        el.addEventListener('click', function(e) {
            if (e.target === this) {
                this.classList.remove('open');
                document.body.style.overflow = '';
            }
        });
    });
    syncBrandLogos();
    updateInstallButton();
});

// ============================================================
// RENDER ALL
// ============================================================

function renderAll() {
    updateDashboard();
    renderCustomers();
    renderCashIn();
    renderCashOut();
    renderBalances();
    renderSettings();
    populateCustomerReportDropdown();
    generateCustomerReport();
    populateCustomerDropdowns();
    populateStaffDropdowns();
    applyRoleAccess();
    
    const todayEl = document.getElementById('todayDate');
    if (todayEl) {
        todayEl.textContent = new Date().toLocaleDateString('en-GB', {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    }
}

// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', function() {
    registerAppUpdates();
    renderAll();

    // Set default report date to today
    const reportDate = document.getElementById('reportDate');
    if (reportDate) reportDate.value = todayStr();
    generateReport();

    // Set default dates in modals
    document.querySelectorAll('input[type="date"]').forEach(el => {
        if (!el.value) el.value = todayStr();
    });

    // Close on Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.open').forEach(m => {
                m.classList.remove('open');
            });
            document.body.style.overflow = '';
            if (window.innerWidth <= 768) {
                document.getElementById('sidebar')?.classList.remove('open');
                document.getElementById('sidebarOverlay')?.classList.remove('open');
            }
        }
    });

    // Hash-based navigation
    window.addEventListener('hashchange', function() {
        const hash = window.location.hash.replace('#', '');
        if (hash && document.querySelector(`.sidebar-nav a[data-page="${hash}"]`)) {
            navigate(hash);
        }
    });

    // Handle initial hash
    if (window.location.hash) {
        const hash = window.location.hash.replace('#', '');
        if (document.querySelector(`.sidebar-nav a[data-page="${hash}"]`)) {
            navigate(hash);
        }
    }

    console.log('🏦 F EMMANUEL 85 VENTURES v3.0 loaded');
    console.log(`📊 ${data.customers.length} customers, ${data.transactions.length} transactions`);
});

// ============================================================
// SIDEBAR NAVIGATION - data-page click handling
// ============================================================

// Add click handlers to sidebar links
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.sidebar-nav a[data-page]').forEach(link => {
        link.addEventListener('click', function(e) {
            const page = this.getAttribute('data-page');
            navigate(page);
            // Update URL hash
            history.pushState(null, '', '#' + page);
        });
    });
});

let refreshingCloudRecords = false;

async function refreshCloudRecords() {
    if (!requireAuth()) return;
    if (refreshingCloudRecords) return;
    if (!cloudReady()) {
        showToast('Cloud connection unavailable. Records were not refreshed.', 'error');
        return;
    }
    if (!navigator.onLine) {
        showToast('Connect to the internet to refresh records.', 'error');
        return;
    }
    if (savingCashIn || savingCashOut || savingBackdate) {
        showToast('Wait for the transaction to finish before refreshing.', 'warning');
        return;
    }
    if (document.querySelector('.modal-overlay.open')) {
        showToast('Close the open form before refreshing records.', 'warning');
        return;
    }
    refreshingCloudRecords = true;
    const areas = [document.getElementById('mainContent'), document.getElementById('sidebar')].filter(Boolean);
    const previousInert = areas.map(area => area.inert);
    areas.forEach(area => { area.inert = true; });
    try {
        await hydrateCloudData();
        renderAll();
        showToast('Records refreshed from the cloud.', 'success');
    } catch (error) {
        showToast(cloudError(error, 'Unable to refresh records.'), 'error');
    } finally {
        areas.forEach((area, index) => { area.inert = previousInert[index]; });
        refreshingCloudRecords = false;
    }
}

let appUpdateRegistration = null;
let applyingAppUpdate = false;
const watchedUpdateWorkers = new WeakSet();

function setAppUpdateState(label, enabled = false) {
    const button = document.getElementById('appUpdateButton');
    if (!button) return;
    button.disabled = !enabled;
    button.querySelector('span').textContent = label;
}

function syncAppUpdateState() {
    if (applyingAppUpdate) return;
    if (appUpdateRegistration?.waiting && navigator.serviceWorker.controller) {
        setAppUpdateState('Update app', true);
        showUpdateNotice();
    } else if (appUpdateRegistration?.installing) {
        setAppUpdateState('Checking for updates');
    } else {
        setAppUpdateState('App up to date');
    }
}

function watchAppUpdate(worker) {
    if (!worker || watchedUpdateWorkers.has(worker)) return;
    watchedUpdateWorkers.add(worker);
    worker.addEventListener('statechange', syncAppUpdateState);
}

async function checkForAppUpdates() {
    if (!appUpdateRegistration || applyingAppUpdate) return;
    if (appUpdateRegistration.waiting && navigator.serviceWorker.controller) {
        syncAppUpdateState();
        return;
    }
    setAppUpdateState('Checking for updates');
    try {
        await appUpdateRegistration.update();
        watchAppUpdate(appUpdateRegistration.installing);
        syncAppUpdateState();
    } catch (error) {
        if (appUpdateRegistration.waiting && navigator.serviceWorker.controller) syncAppUpdateState();
        else setAppUpdateState('Update check unavailable');
    }
}

function applyAppUpdate() {
    const worker = appUpdateRegistration?.waiting;
    if (!worker || applyingAppUpdate) return;
    applyingAppUpdate = true;
    setAppUpdateState('Updating');
    try {
        worker.postMessage({ type: 'SKIP_WAITING' });
        setTimeout(() => {
            if (!applyingAppUpdate) return;
            applyingAppUpdate = false;
            syncAppUpdateState();
            showToast('Update could not finish. Close other app tabs and try again.', 'error');
        }, 20000);
    } catch (error) {
        applyingAppUpdate = false;
        syncAppUpdateState();
        showToast('Update could not start. Please try again.', 'error');
    }
}

function registerAppUpdates() {
    if (!('serviceWorker' in navigator)) {
        setAppUpdateState('Updates unavailable');
        return;
    }
    navigator.serviceWorker.register('/sw.js').then(registration => {
        appUpdateRegistration = registration;
        registration.addEventListener('updatefound', () => {
            watchAppUpdate(registration.installing);
            syncAppUpdateState();
        });
        watchAppUpdate(registration.installing);
        checkForAppUpdates();
    }).catch(() => setAppUpdateState('Update check unavailable'));
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload());
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForAppUpdates();
    });
}

function showUpdateNotice() {
    if (document.getElementById('appUpdateNotice')) return;
    const notice = document.createElement('div');
    notice.id = 'appUpdateNotice';
    notice.className = 'app-update-notice';
    notice.innerHTML = '<span>A new version is ready.</span><button type="button" class="btn btn-accent btn-xs">Update</button>';
    notice.querySelector('button').addEventListener('click', applyAppUpdate);
    document.body.appendChild(notice);
}
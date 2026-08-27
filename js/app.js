// ============================================================
// NAVIGATION
// ============================================================

function navigate(page) {
    if (!requireAuth()) return;
    const managerPages = ['customers', 'balances', 'reports', 'staff'];
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
        staff: 'Staff Access'
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
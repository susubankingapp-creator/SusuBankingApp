// ============================================================
// DATA LAYER - Handles local and Supabase data operations
// ============================================================

const STORAGE_KEY = 'susu_pinhin_data';

// Default data structure
function getDefaultData() {
    return {
        customers: [],
        transactions: [], // { id, customerId, date, type: 'cashIn'|'cashOut', amount, pbNumber, receivedBy, issuedBy }
        settings: { minimumBalance: 0 }
    };
}

// Load data from localStorage
function loadData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.customers && parsed.transactions) {
                parsed.customers = parsed.customers.map(customer => ({ ...customer, pbNumber: customer.pbNumber || customer.id }));
                if (!parsed.settings) parsed.settings = { minimumBalance: 0 };
                return parsed;
            }
        }
    } catch (_) { /* ignore */ }
    return getDefaultData();
}

// Save data to localStorage
function saveData() {
    if (!cloudReady()) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    updateBadges();
    updateDashboard();
    if (cloudReady()) {
        refreshCustomerBalances().then(() => {
            renderCustomers();
            renderBalances();
        }).catch(() => { /* keep the existing client-computed balances on failure */ });
    }
}

// Global data object
let data = loadData();
let nextId = getNextId();

async function hydrateCloudData() {
    if (!cloudReady() || !isAuthenticated()) return;
    const customerQuery = supabaseClient.from('customers').select('id, name, pb_number, next_of_kin, next_of_kin_phone, phone, created_at').order('name');
    const transactionQuery = supabaseClient.from('transactions').select('id, date, type, pb_number, customer_id, amount, staff_id, received_by, issued_by, created_at').order('date', { ascending: false });
    const [{ data: customers, error: customerError }, { data: transactions, error: transactionError }] = await Promise.all([customerQuery, transactionQuery]);
    if (customerError) throw customerError;
    if (transactionError) throw transactionError;
    data = {
        customers: (customers || []).map(customer => ({ id: customer.id, name: customer.name, pbNumber: customer.pb_number, nextOfKin: customer.next_of_kin, nextOfKinPhone: customer.next_of_kin_phone, phone: customer.phone, createdAt: customer.created_at })),
        transactions: (transactions || []).map(transaction => mapCloudTransaction(transaction)),
        settings: { minimumBalance: 0 }
    };
    nextId = getNextId();
    await Promise.all([refreshCustomerBalances(), refreshMinimumBalance()]);
}

async function cloudAddCustomer(customer) {
    const { data: created, error } = await supabaseClient.from('customers').insert({ name: customer.name, pb_number: customer.pbNumber, next_of_kin: customer.nextOfKin, next_of_kin_phone: customer.nextOfKinPhone, phone: customer.phone }).select('id, name, pb_number, next_of_kin, next_of_kin_phone, phone, created_at').single();
    if (error) throw error;
    return { id: created.id, name: created.name, pbNumber: created.pb_number, nextOfKin: created.next_of_kin, nextOfKinPhone: created.next_of_kin_phone, phone: created.phone, createdAt: created.created_at };
}

async function cloudUpdateCustomer(id, customer) {
    const { data: updated, error } = await supabaseClient.from('customers')
        .update({ name: customer.name, pb_number: customer.pbNumber, next_of_kin: customer.nextOfKin, next_of_kin_phone: customer.nextOfKinPhone, phone: customer.phone })
        .eq('id', id).select('id, name, pb_number, next_of_kin, next_of_kin_phone, phone, created_at').single();
    if (error) throw error;
    return { id: updated.id, name: updated.name, pbNumber: updated.pb_number, nextOfKin: updated.next_of_kin, nextOfKinPhone: updated.next_of_kin_phone, phone: updated.phone, createdAt: updated.created_at };
}

async function cloudDeleteCustomer(id) {
    const { error } = await supabaseClient.from('customers').delete().eq('id', id);
    if (error) throw error;
}

async function cloudAddTransaction(transaction) {
    const { data: created, error } = await supabaseClient.rpc('record_transaction', {
        p_date: transaction.date, p_type: transaction.type, p_pb_number: transaction.pbNumber,
        p_customer_id: transaction.customerId, p_amount: transaction.amount,
        p_received_by: transaction.receivedBy || null, p_issued_by: transaction.issuedBy || null
    });
    if (error) throw error;
    return mapCloudTransaction(created);
}

function mapCloudTransaction(transaction) {
    return { id: transaction.id, date: transaction.date, type: transaction.type, pbNumber: transaction.pb_number, customerId: transaction.customer_id, amount: Number(transaction.amount), staffId: transaction.staff_id, receivedBy: transaction.received_by || '', issuedBy: transaction.issued_by || '', createdAt: transaction.created_at };
}

async function cloudUpdateTransaction(id, transaction) {
    const { data: updated, error } = await supabaseClient.rpc('update_transaction', {
        p_id: id, p_date: transaction.date, p_pb_number: transaction.pbNumber,
        p_customer_id: transaction.customerId, p_amount: transaction.amount,
        p_received_by: transaction.receivedBy || null, p_issued_by: transaction.issuedBy || null
    });
    if (error) throw error;
    return mapCloudTransaction(updated);
}

async function cloudDeleteTransaction(id) {
    const { error } = await supabaseClient.from('transactions').delete().eq('id', id);
    if (error) throw error;
}

// Get next available ID
function getNextId() {
    const allIds = [
        ...data.customers.map(c => c.id || 0),
        ...data.transactions.map(t => t.id || 0)
    ];
    return Math.max(0, ...allIds) + 1;
}

// Generate new ID
function genId() {
    const id = nextId;
    nextId++;
    return id;
}

// ============================================================
// HELPERS
// ============================================================

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function todayStr() {
    return new Date().toISOString().split('T')[0];
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Prefixes a leading quote to defuse spreadsheet formula injection (=, +, -, @).
function sanitizeCsvValue(value) {
    const text = String(value ?? '');
    return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function rowsToCsv(rows) {
    return rows.map(row => row.map(value => `"${sanitizeCsvValue(value).replace(/"/g, '""')}"`).join(',')).join('\n');
}

function getCustomerName(id) {
    const c = data.customers.find(c => c.id === id);
    return c ? c.name : 'Unknown';
}

let customerBalanceCache = null;

async function refreshCustomerBalances() {
    if (!cloudReady()) {
        customerBalanceCache = null;
        return;
    }
    const { data: rows, error } = await supabaseClient.from('customer_balances').select('customer_id, total_in, total_out, balance');
    if (error) { console.error(error); return; }
    const map = new Map();
    (rows || []).forEach(row => map.set(row.customer_id, { totalIn: Number(row.total_in), totalOut: Number(row.total_out), balance: Number(row.balance) }));
    customerBalanceCache = map;
}

function getCustomerBalance(customerId) {
    if (customerBalanceCache?.has(customerId)) return customerBalanceCache.get(customerId).balance;
    const ins = data.transactions.filter(t => t.customerId === customerId && t.type === 'cashIn');
    const outs = data.transactions.filter(t => t.customerId === customerId && t.type === 'cashOut');
    const totalIn = ins.reduce((s, t) => s + Number(t.amount), 0);
    const totalOut = outs.reduce((s, t) => s + Number(t.amount), 0);
    return totalIn - totalOut;
}

function getCustomerTotals(customerId) {
    if (customerBalanceCache?.has(customerId)) {
        const cached = customerBalanceCache.get(customerId);
        return { totalIn: cached.totalIn, totalOut: cached.totalOut };
    }
    const ins = data.transactions.filter(t => t.customerId === customerId && t.type === 'cashIn');
    const outs = data.transactions.filter(t => t.customerId === customerId && t.type === 'cashOut');
    return {
        totalIn: ins.reduce((s, t) => s + Number(t.amount), 0),
        totalOut: outs.reduce((s, t) => s + Number(t.amount), 0)
    };
}

function getTotalCashIn() {
    return data.transactions.filter(t => t.type === 'cashIn').reduce((s, t) => s + Number(t.amount), 0);
}

function getTotalCashOut() {
    return data.transactions.filter(t => t.type === 'cashOut').reduce((s, t) => s + Number(t.amount), 0);
}

function getNetBalance() {
    return getTotalCashIn() - getTotalCashOut();
}

let minimumBalanceCache = null;

async function refreshMinimumBalance() {
    if (!cloudReady()) { minimumBalanceCache = null; return; }
    const { data: row, error } = await supabaseClient.from('app_settings').select('minimum_balance').eq('id', true).single();
    if (error) { console.error(error); return; }
    minimumBalanceCache = Number(row?.minimum_balance || 0);
}

async function cloudUpdateMinimumBalance(value) {
    const { error } = await supabaseClient.from('app_settings').update({ minimum_balance: value }).eq('id', true);
    if (error) throw error;
    minimumBalanceCache = value;
}

function getMinimumBalance() {
    if (cloudReady()) return Number(minimumBalanceCache || 0);
    return Number(data.settings?.minimumBalance || 0);
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-check-circle' :
        type === 'error' ? 'fa-exclamation-circle' :
        type === 'warning' ? 'fa-triangle-exclamation' : 'fa-info-circle';
    const iconElement = document.createElement('i');
    iconElement.className = `fas ${icon}`;
    toast.appendChild(iconElement);
    toast.appendChild(document.createTextNode(` ${String(message ?? '')}`));
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(40px)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

async function cloudReplaceData(imported) {
    const { error: transactionError } = await supabaseClient.from('transactions').delete().neq('id', 0);
    if (transactionError) throw transactionError;
    const { error: customerError } = await supabaseClient.from('customers').delete().neq('id', 0);
    if (customerError) throw customerError;
    const customerIds = new Map();
    for (const customer of imported.customers) {
        const created = await cloudAddCustomer(customer);
        customerIds.set(customer.id, created.id);
    }
    for (const transaction of imported.transactions) {
        const customerId = customerIds.get(transaction.customerId);
        if (!customerId) throw new Error(`Customer for transaction ${transaction.id} was not found.`);
        await cloudAddTransaction({ ...transaction, customerId });
    }
    await hydrateCloudData();
}

async function cloudResetData() {
    const { error: transactionError } = await supabaseClient.from('transactions').delete().neq('id', 0);
    if (transactionError) throw transactionError;
    const { error: customerError } = await supabaseClient.from('customers').delete().neq('id', 0);
    if (customerError) throw customerError;
    await hydrateCloudData();
}
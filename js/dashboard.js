// ============================================================
// DASHBOARD
// ============================================================

function updateDashboard() {
    document.getElementById('dashCustomers').textContent = data.customers.length;

    const todayTransactions = data.transactions.filter(t => t.date === todayStr());
    const todayIn = todayTransactions
        .filter(t => t.type === 'cashIn')
        .reduce((sum, t) => sum + Number(t.amount), 0);
    const todayOut = todayTransactions
        .filter(t => t.type === 'cashOut')
        .reduce((sum, t) => sum + Number(t.amount), 0);
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    document.getElementById('dashboardGreeting').textContent = greeting;
    document.getElementById('todayCashIn').textContent = `GH₵ ${todayIn.toFixed(2)}`;
    document.getElementById('todayCashOut').textContent = `GH₵ ${todayOut.toFixed(2)}`;
    document.getElementById('todayTransactions').textContent = `${todayTransactions.length} record${todayTransactions.length === 1 ? '' : 's'}`;
    document.getElementById('dashboardStatus').textContent = data.customers.length
        ? `${data.customers.length} customer${data.customers.length === 1 ? '' : 's'} are being tracked.`
        : 'Add your first customer to begin tracking contributions.';

    updateBadges();
    renderRecentTransactions();
}

// ============================================================
// SETTINGS (financial totals + minimum balance rule)
// ============================================================

function renderSettings() {
    if (!isManager()) return;
    const cashInEl = document.getElementById('settingsCashIn');
    const cashOutEl = document.getElementById('settingsCashOut');
    const balanceEl = document.getElementById('settingsBalance');
    if (cashInEl) cashInEl.textContent = getTotalCashIn().toFixed(2);
    if (cashOutEl) cashOutEl.textContent = getTotalCashOut().toFixed(2);
    if (balanceEl) balanceEl.textContent = getNetBalance().toFixed(2);
    const minBalanceInput = document.getElementById('settingsMinBalance');
    if (minBalanceInput) minBalanceInput.value = getMinimumBalance().toFixed(2);
}

async function saveMinimumBalance(event) {
    event.preventDefault();
    if (!requireManager()) return;
    const input = document.getElementById('settingsMinBalance');
    const value = parseFloat(input.value);
    if (isNaN(value) || value < 0) {
        showToast('Enter a valid minimum balance of 0 or more.', 'error');
        return;
    }
    try {
        if (cloudReady()) await cloudUpdateMinimumBalance(value);
        else {
            data.settings = data.settings || {};
            data.settings.minimumBalance = value;
            saveData();
        }
        showToast('Minimum balance updated.', 'success');
    } catch (error) {
        showToast(cloudError(error, 'Unable to update minimum balance.'), 'error');
    }
}

function updateBadges() {
    const customerCount = document.getElementById('customerCount');
    const cashinCount = document.getElementById('cashinCount');
    const cashoutCount = document.getElementById('cashoutCount');
    
    if (customerCount) customerCount.textContent = data.customers.length;
    if (cashinCount) cashinCount.textContent = data.transactions.filter(t => t.type === 'cashIn').length;
    if (cashoutCount) cashoutCount.textContent = data.transactions.filter(t => t.type === 'cashOut').length;
}

function renderRecentTransactions() {
    const container = document.getElementById('recentTransactions');
    if (!container) return;
    
    const all = [...data.transactions].sort((a, b) => (b.id || 0) - (a.id || 0)).slice(0, 10);

    if (all.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <h3>No transactions yet</h3>
                <p>Start by recording a Cash In or Cash Out.</p>
            </div>
        `;
        return;
    }

    let html = `<table>
        <thead><tr>
            <th>Date</th>
            <th>Type</th>
            <th>PB#</th>
            <th>Customer</th>
            <th>Amount</th>
        </tr></thead><tbody>`;

    all.forEach(t => {
        const typeLabel = t.type === 'cashIn' ? 'Cash In' : 'Cash Out';
        const badgeClass = t.type === 'cashIn' ? 'in' : 'out';
        const sign = t.type === 'cashIn' ? '+' : '-';
        const colorClass = t.type === 'cashIn' ? 'text-success' : 'text-danger';
        html += `
            <tr>
                <td>${formatDate(t.date)}</td>
                <td><span class="badge-status ${badgeClass}">${typeLabel}</span></td>
                <td>#${t.pbNumber}</td>
                <td>${escapeHtml(getCustomerName(t.customerId))}</td>
                <td class="${colorClass} fw-600">${sign} GH₵ ${Number(t.amount).toFixed(2)}</td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

// ============================================================
// DATA EXPORT / IMPORT / RESET
// ============================================================

function exportData() {
    if (!requireManager()) return;
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `susu_data_${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data exported successfully.', 'success');
}

function importData() {
    if (!requireManager()) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async function(ev) {
            try {
                const imported = JSON.parse(ev.target.result);
                if (imported.customers && imported.transactions) {
                    if (!confirm('This will replace ALL current data. Continue?')) return;
                    try {
                        if (cloudReady()) await cloudReplaceData(imported);
                        else {
                            data = imported;
                            nextId = getNextId();
                            saveData();
                        }
                    } catch (error) {
                        showToast(cloudError(error, 'Unable to import data.'), 'error');
                        return;
                    }
                    renderAll();
                    showToast('Data imported successfully.', 'success');
                } else {
                    showToast('Invalid data file.', 'error');
                }
            } catch (_) {
                showToast('Failed to parse file.', 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

async function resetAllData() {
    if (!requireManager()) return;
    if (!confirm('⚠️ Are you sure you want to delete ALL data? This cannot be undone.')) return;
    if (!confirm('Type "yes" to confirm.')) return;
    try {
        if (cloudReady()) await cloudResetData();
        else {
            data = getDefaultData();
            nextId = 1;
            saveData();
        }
    } catch (error) {
        showToast(cloudError(error, 'Unable to reset data.'), 'error');
        return;
    }
    renderAll();
    showToast('All data has been reset.', 'warning');
}

function emailExportData() {
    if (!requireManager()) return;
    const rows = [['Date', 'Type', 'PB Number', 'Customer', 'Amount (GHS)', 'Staff']];
    data.transactions.forEach(transaction => rows.push([
        transaction.date,
        transaction.type === 'cashIn' ? 'Cash In' : 'Cash Out',
        transaction.pbNumber,
        getCustomerName(transaction.customerId),
        Number(transaction.amount).toFixed(2),
        transaction.type === 'cashIn' ? transaction.receivedBy : transaction.issuedBy
    ]));
    const csv = rowsToCsv(rows);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const download = document.createElement('a');
    download.href = url;
    download.download = `f-emmanuel-85-transactions-${todayStr()}.csv`;
    download.click();
    URL.revokeObjectURL(url);
    window.location.href = `mailto:?subject=${encodeURIComponent('F EMMANUEL 85 VENTURES transaction file')}&body=${encodeURIComponent('The transaction CSV has been downloaded. Please attach it to this email before sending it to the manager.')}`;
    showToast('Transaction CSV downloaded. Attach it to the manager email.', 'success');
}
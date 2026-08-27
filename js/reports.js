// ============================================================
// BALANCES
// ============================================================

function renderBalances() {
    const tbody = document.getElementById('balanceTableBody');
    if (!tbody) return;

    if (data.customers.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="6">
                <div class="empty-state" style="padding:32px 20px;">
                    <i class="fas fa-wallet"></i>
                    <h3>No customers</h3>
                    <p>Add customers to see their balances.</p>
                </div>
            </td></tr>
        `;
        return;
    }

    let html = '';
    data.customers.forEach((c, idx) => {
        const totals = getCustomerTotals(c.id);
        const balance = totals.totalIn - totals.totalOut;
        html += `
            <tr>
                <td>${idx + 1}</td>
                <td><strong>${escapeHtml(c.name)}</strong></td>
                <td>${escapeHtml(c.phone || '—')}</td>
                <td class="text-success">GH₵ ${totals.totalIn.toFixed(2)}</td>
                <td class="text-danger">GH₵ ${totals.totalOut.toFixed(2)}</td>
                <td class="${balance >= 0 ? 'text-success' : 'text-danger'} fw-600">
                    GH₵ ${balance.toFixed(2)}
                </td>
            </tr>
        `;
    });

    // Grand total row
    const totalIn = data.transactions.filter(t => t.type === 'cashIn').reduce((s, t) => s + Number(t.amount), 0);
    const totalOut = data.transactions.filter(t => t.type === 'cashOut').reduce((s, t) => s + Number(t.amount), 0);
    html += `
        <tr class="table-total">
            <td colspan="3" style="text-align:right;">GRAND TOTAL</td>
            <td class="text-success fw-600">GH₵ ${totalIn.toFixed(2)}</td>
            <td class="text-danger fw-600">GH₵ ${totalOut.toFixed(2)}</td>
            <td class="fw-600">GH₵ ${(totalIn - totalOut).toFixed(2)}</td>
        </tr>
    `;

    tbody.innerHTML = html;
}

// ============================================================
// REPORTS
// ============================================================

function generateReport() {
    const date = document.getElementById('reportDate')?.value;
    const type = document.getElementById('reportType')?.value;
    const output = document.getElementById('reportOutput');
    
    if (!output) return;

    if (!date) {
        output.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-day"></i>
                <h3>Select a date</h3>
                <p>Choose a date to generate the report.</p>
            </div>
        `;
        return;
    }

    let transactions = [];
    const selectedDate = new Date(`${date}T00:00:00`);
    if (type === 'daily') {
        transactions = data.transactions.filter(t => t.date === date);
    } else if (type === 'weekly') {
        const weekStart = new Date(selectedDate);
        weekStart.setDate(selectedDate.getDate() - selectedDate.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        transactions = data.transactions.filter(t => {
            const transactionDate = new Date(`${t.date}T00:00:00`);
            return transactionDate >= weekStart && transactionDate <= weekEnd;
        });
    } else {
        // monthly
        const month = date.substring(0, 7);
        transactions = data.transactions.filter(t => t.date && t.date.startsWith(month));
    }

    const cashIns = transactions.filter(t => t.type === 'cashIn');
    const cashOuts = transactions.filter(t => t.type === 'cashOut');
    const totalIn = cashIns.reduce((s, t) => s + Number(t.amount), 0);
    const totalOut = cashOuts.reduce((s, t) => s + Number(t.amount), 0);
    const net = totalIn - totalOut;

    if (transactions.length === 0) {
        output.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-file-alt"></i>
                <h3>No transactions found</h3>
                <p>No records for the selected ${type === 'daily' ? 'date' : type === 'weekly' ? 'week' : 'month'}.</p>
            </div>
        `;
        return;
    }

    let html = `
        <div style="background:var(--gray-50);border-radius:12px;padding:20px;margin-bottom:20px;">
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:16px;">
                <div><span class="text-muted fs-small">Total Transactions</span><br><strong>${transactions.length}</strong></div>
                <div><span class="text-muted fs-small">Total Cash In</span><br><strong class="text-success">GH₵ ${totalIn.toFixed(2)}</strong></div>
                <div><span class="text-muted fs-small">Total Cash Out</span><br><strong class="text-danger">GH₵ ${totalOut.toFixed(2)}</strong></div>
                <div><span class="text-muted fs-small">Net Balance</span><br><strong class="${net >= 0 ? 'text-success' : 'text-danger'}">GH₵ ${net.toFixed(2)}</strong></div>
            </div>
        </div>
        <div class="table-wrap">
            <table>
                <thead><tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>PB#</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Staff</th>
                </tr></thead>
                <tbody>
    `;

    transactions.sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.id - b.id);
    transactions.forEach(t => {
        const typeLabel = t.type === 'cashIn' ? 'Cash In' : 'Cash Out';
        const badgeClass = t.type === 'cashIn' ? 'in' : 'out';
        const colorClass = t.type === 'cashIn' ? 'text-success' : 'text-danger';
        const staff = t.type === 'cashIn' ? t.receivedBy : t.issuedBy;
        html += `
            <tr>
                <td>${formatDate(t.date)}</td>
                <td><span class="badge-status ${badgeClass}">${typeLabel}</span></td>
                <td>#${t.pbNumber}</td>
                <td>${escapeHtml(getCustomerName(t.customerId))}</td>
                <td class="${colorClass} fw-600">GH₵ ${Number(t.amount).toFixed(2)}</td>
                <td>${escapeHtml(staff || '—')}</td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    output.innerHTML = html;
}

function exportSummaryReport() {
    if (!requireAuth()) return;
    const date = document.getElementById('reportDate')?.value;
    const type = document.getElementById('reportType')?.value;
    if (!date) {
        showToast('Select a report date first.', 'error');
        return;
    }
    const selectedDate = new Date(`${date}T00:00:00`);
    const weekStart = new Date(selectedDate);
    weekStart.setDate(selectedDate.getDate() - selectedDate.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const month = date.substring(0, 7);
    const transactions = data.transactions
        .filter(transaction => {
            if (type === 'daily') return transaction.date === date;
            if (type === 'weekly') {
                const transactionDate = new Date(`${transaction.date}T00:00:00`);
                return transactionDate >= weekStart && transactionDate <= weekEnd;
            }
            return transaction.date?.startsWith(month);
        })
        .sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.id - b.id);
    const rows = [['Date', 'Type', 'PB Number', 'Customer', 'Amount (GHS)', 'Staff'], ...transactions.map(transaction => [
        transaction.date,
        transaction.type === 'cashIn' ? 'Cash In' : 'Cash Out',
        transaction.pbNumber,
        getCustomerName(transaction.customerId),
        Number(transaction.amount).toFixed(2),
        transaction.type === 'cashIn' ? transaction.receivedBy : transaction.issuedBy
    ])];
    const csv = rowsToCsv(rows);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const download = document.createElement('a');
    download.href = url;
    download.download = `report-${type}-${date}.csv`;
    download.click();
    URL.revokeObjectURL(url);
    showToast('Report saved successfully.', 'success');
}

function getSelectedReportCustomer() {
    const id = Number(document.getElementById('customerReportSelect')?.value);
    return data.customers.find(customer => customer.id === id);
}

function populateCustomerReportDropdown() {
    const select = document.getElementById('customerReportSelect');
    if (!select) return;
    const currentValue = select.value;
    select.innerHTML = '<option value="">— Select customer —</option>';
    const sort = document.getElementById('customerReportSort')?.value || 'name';
    const filterInput = document.getElementById('customerReportFilter');
    if (filterInput) filterInput.placeholder = sort === 'pb' ? 'Type PB number' : 'Type customer name';
    const filter = document.getElementById('customerReportFilter')?.value.trim().toLowerCase() || '';
    const customers = data.customers.filter(customer => {
        if (!filter) return true;
        const searchValue = sort === 'pb' ? String(customer.pbNumber || customer.id) : customer.name;
        return searchValue.toLowerCase().includes(filter);
    }).sort((a, b) => sort === 'pb'
        ? Number(a.pbNumber || a.id) - Number(b.pbNumber || b.id)
        : a.name.localeCompare(b.name));
    customers.forEach(customer => {
        const option = document.createElement('option');
        option.value = customer.id;
        option.textContent = customer.name;
        select.appendChild(option);
    });
    if (data.customers.some(customer => String(customer.id) === currentValue)) select.value = currentValue;
}

function generateCustomerReport() {
    const output = document.getElementById('customerReportOutput');
    if (!output) return;
    const customer = getSelectedReportCustomer();
    if (!customer) {
        output.innerHTML = '<div class="empty-state"><i class="fas fa-user-chart"></i><h3>Select a customer</h3><p>View their contributions, payouts, and current balance.</p></div>';
        return;
    }
    const history = data.transactions.filter(transaction => transaction.customerId === customer.id);
    const totals = getCustomerTotals(customer.id);
    const balance = totals.totalIn - totals.totalOut;
    const rows = history.sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.id - b.id)
        .map(transaction => `<tr><td>${formatDate(transaction.date)}</td><td>${transaction.type === 'cashIn' ? 'Cash In' : 'Cash Out'}</td><td>#${transaction.pbNumber}</td><td>GH₵ ${Number(transaction.amount).toFixed(2)}</td><td>${escapeHtml(transaction.type === 'cashIn' ? transaction.receivedBy : transaction.issuedBy)}</td></tr>`).join('');
    output.innerHTML = `
        <div class="customer-report-summary">
            <div><span class="text-muted fs-small">Customer</span><strong>${escapeHtml(customer.name)}</strong></div>
            <div><span class="text-muted fs-small">Phone</span><strong>${escapeHtml(customer.phone || '—')}</strong></div>
            <div><span class="text-muted fs-small">Cash In</span><strong class="text-success">GH₵ ${totals.totalIn.toFixed(2)}</strong></div>
            <div><span class="text-muted fs-small">Cash Out</span><strong class="text-danger">GH₵ ${totals.totalOut.toFixed(2)}</strong></div>
            <div><span class="text-muted fs-small">Balance</span><strong class="${balance >= 0 ? 'text-success' : 'text-danger'}">GH₵ ${balance.toFixed(2)}</strong></div>
        </div>
        <p class="text-muted fs-small">${history.length} transaction${history.length === 1 ? '' : 's'} recorded.</p>
        ${history.length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>PB#</th><th>Amount</th><th>Staff</th></tr></thead><tbody>${rows}</tbody></table></div>` : ''}
    `;
}

function getCustomerReportRows(customer) {
    return [
        ['Customer', customer.name],
        ['Phone', customer.phone || ''],
        ['Next of Kin', customer.nextOfKin || ''],
        [],
        ['Date', 'Type', 'PB Number', 'Amount (GHS)', 'Staff'],
        ...data.transactions
            .filter(transaction => transaction.customerId === customer.id)
            .sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.id - b.id)
            .map(transaction => [
                transaction.date,
                transaction.type === 'cashIn' ? 'Cash In' : 'Cash Out',
                transaction.pbNumber,
                Number(transaction.amount).toFixed(2),
                transaction.type === 'cashIn' ? transaction.receivedBy : transaction.issuedBy
            ])
    ];
}

function customerReportCsv(customer) {
    return rowsToCsv(getCustomerReportRows(customer));
}

function exportCustomerReport() {
    if (!requireAuth()) return;
    const customer = getSelectedReportCustomer();
    if (!customer) {
        showToast('Select a customer first.', 'error');
        return;
    }
    const url = URL.createObjectURL(new Blob([customerReportCsv(customer)], { type: 'text/csv;charset=utf-8' }));
    const download = document.createElement('a');
    download.href = url;
    download.download = `customer-${customer.id}-report-${todayStr()}.csv`;
    download.click();
    URL.revokeObjectURL(url);
    showToast(`Report for ${customer.name} downloaded.`, 'success');
}

function emailCustomerReport() {
    if (!requireAuth()) return;
    const customer = getSelectedReportCustomer();
    if (!customer) {
        showToast('Select a customer first.', 'error');
        return;
    }
    exportCustomerReport();
    const subject = `Customer report - ${customer.name}`;
    const body = `The customer report for ${customer.name} has been downloaded. Please attach the CSV file before sending this email.`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function printReportHtml(title, html) {
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
        showToast('Allow pop-ups to print this report.', 'error');
        return;
    }
    printWindow.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title><style>body{font:14px Arial,sans-serif;color:#111;padding:28px}h1{font-size:22px;border-bottom:2px solid #f59e0b;padding-bottom:10px}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left}th{background:#f1f5f9}.customer-report-summary{display:flex;gap:24px;flex-wrap:wrap;margin:18px 0}.customer-report-summary div{display:flex;flex-direction:column;gap:4px}</style></head><body><h1>${escapeHtml(title)}</h1>${html}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
}

function printSummaryReport() {
    if (!requireAuth()) return;
    const output = document.getElementById('reportOutput');
    if (!output || output.querySelector('.empty-state')) {
        showToast('Generate a report before printing.', 'error');
        return;
    }
    printReportHtml('F EMMANUEL 85 VENTURES Report', output.innerHTML);
}

function emailSummaryReport() {
    if (!requireAuth()) return;
    const date = document.getElementById('reportDate')?.value;
    const type = document.getElementById('reportType')?.value;
    const output = document.getElementById('reportOutput');
    if (!date || !output || output.querySelector('.empty-state')) {
        showToast('Generate a report before preparing an email.', 'error');
        return;
    }
    exportSummaryReport();
    const subject = `F EMMANUEL 85 VENTURES ${type} report - ${date}`;
    const body = `The ${type} report for ${date} has been downloaded. Please attach the CSV file before sending this email.`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function printCustomerReport() {
    if (!requireAuth()) return;
    const customer = getSelectedReportCustomer();
    const output = document.getElementById('customerReportOutput');
    if (!customer || !output) {
        showToast('Select a customer before printing.', 'error');
        return;
    }
    printReportHtml(`Customer Report - ${customer.name}`, output.innerHTML);
}
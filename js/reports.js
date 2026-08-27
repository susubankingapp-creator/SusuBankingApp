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
    if (type === 'daily') {
        transactions = data.transactions.filter(t => t.date === date);
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
                <p>No records for the selected ${type === 'daily' ? 'date' : 'month'}.</p>
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
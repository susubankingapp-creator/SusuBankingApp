// ============================================================
// CASH IN
// ============================================================

function openCashInModal(transactionId) {
    if (transactionId && !requireManager()) return;
    const form = document.getElementById('cashinForm');
    form.reset();
    document.getElementById('cashinEditId').value = '';
    document.getElementById('cashinDate').value = todayStr();

    if (transactionId) {
        const t = data.transactions.find(t => t.id === transactionId && t.type === 'cashIn');
        if (t) {
            document.getElementById('cashinEditId').value = t.id;
            document.getElementById('cashinDate').value = t.date || '';
            document.getElementById('cashinPb').value = t.pbNumber || '';
            document.getElementById('cashinCustomer').value = t.customerId || '';
            document.getElementById('cashinAmount').value = t.amount || '';
            document.getElementById('cashinReceivedBy').value = t.receivedBy || '';
        }
    }
    populateCustomerDropdowns();
    openModal('cashinModal');
}

async function saveCashIn(e) {
    e.preventDefault();
    if (!requireAuth()) return;
    const id = document.getElementById('cashinEditId').value;
    const date = document.getElementById('cashinDate').value;
    const pbNumber = document.getElementById('cashinPb').value;
    const customerId = Number(document.getElementById('cashinCustomer').value);
    const amount = parseFloat(document.getElementById('cashinAmount').value);
    const receivedBy = getCurrentUser().name;

    if (!date || !pbNumber || !customerId || isNaN(amount) || amount <= 0 || !receivedBy) {
        showToast('Please fill all required fields correctly.', 'error');
        return;
    }

    if (id) {
        const existing = data.transactions.find(t => t.id === Number(id));
        if (existing) {
            const values = { ...existing, date, pbNumber: Number(pbNumber), customerId, amount, receivedBy };
            let updated;
            if (cloudReady()) {
                try {
                    updated = await cloudUpdateTransaction(existing.id, values);
                } catch (error) {
                    showToast(cloudError(error, 'Unable to update Cash In.'), 'error');
                    return;
                }
            } else {
                updated = values;
            }
            data.transactions[data.transactions.indexOf(existing)] = updated;
            showToast('Cash In updated.', 'success');
        }
    } else {
        const transaction = {
            id: genId(),
            date,
            type: 'cashIn',
            pbNumber: Number(pbNumber),
            customerId,
            amount,
            receivedBy: receivedBy || '—',
            issuedBy: '',
            createdAt: todayStr()
        };
        if (cloudReady()) {
            try { data.transactions.push(await cloudAddTransaction(transaction)); }
            catch (error) { showToast(cloudError(error, 'Unable to record cash in.'), 'error'); return; }
        } else data.transactions.push(transaction);
    }

    saveData();
    closeModal('cashinModal');
    renderCashIn();
    updateDashboard();
}

function renderCashIn() {
    const tbody = document.getElementById('cashinTableBody');
    if (!tbody) return;
    
    const filterDate = document.getElementById('cashinFilterDate')?.value || '';

    let transactions = data.transactions.filter(t => t.type === 'cashIn');
    if (filterDate) {
        transactions = transactions.filter(t => t.date === filterDate);
    }
    transactions.sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.id - b.id);

    if (transactions.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="6">
                <div class="empty-state" style="padding:32px 20px;">
                    <i class="fas fa-arrow-down"></i>
                    <h3>No Cash In records</h3>
                    <p>Record your first payment.</p>
                </div>
            </td></tr>
        `;
        const label = document.getElementById('cashinTotalLabel');
        if (label) label.textContent = '0 transactions';
        return;
    }

    let html = '';
    let total = 0;
    transactions.forEach(t => {
        total += Number(t.amount);
        html += `
            <tr>
                <td>${formatDate(t.date)}</td>
                <td><button class="link-button" onclick="showCustomerHistory(${t.customerId})" title="View customer transaction history">#${t.pbNumber}</button></td>
                <td>${escapeHtml(getCustomerName(t.customerId))}</td>
                <td class="text-success fw-600">GH₵ ${Number(t.amount).toFixed(2)}</td>
                <td>${escapeHtml(t.receivedBy || '—')}</td>
                <td style="text-align:center;">
                    ${isManager() ? `<button class="btn btn-outline btn-xs" onclick="openCashInModal(${t.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-xs" onclick="deleteTransaction(${t.id},'cashIn')"><i class="fas fa-trash"></i></button>` : '—'}
                </td>
            </tr>
        `;
    });

    html += `
        <tr class="table-total">
            <td colspan="3" style="text-align:right;">TOTAL</td>
            <td class="text-success fw-600">GH₵ ${total.toFixed(2)}</td>
            <td colspan="2"></td>
        </tr>
    `;

    tbody.innerHTML = html;
    const label = document.getElementById('cashinTotalLabel');
    if (label) label.textContent = `${transactions.length} transactions`;
}

// ============================================================
// CASH OUT
// ============================================================

function openCashOutModal(transactionId) {
    if (transactionId && !requireManager()) return;
    const form = document.getElementById('cashoutForm');
    form.reset();
    document.getElementById('cashoutEditId').value = '';
    document.getElementById('cashoutDate').value = todayStr();

    if (transactionId) {
        const t = data.transactions.find(t => t.id === transactionId && t.type === 'cashOut');
        if (t) {
            document.getElementById('cashoutEditId').value = t.id;
            document.getElementById('cashoutDate').value = t.date || '';
            document.getElementById('cashoutPb').value = t.pbNumber || '';
            document.getElementById('cashoutCustomer').value = t.customerId || '';
            document.getElementById('cashoutAmount').value = t.amount || '';
            document.getElementById('cashoutIssuedBy').value = t.issuedBy || '';
        }
    }
    populateCustomerDropdowns();
    openModal('cashoutModal');
}

async function saveCashOut(e) {
    e.preventDefault();
    if (!requireAuth()) return;
    const id = document.getElementById('cashoutEditId').value;
    const date = document.getElementById('cashoutDate').value;
    const pbNumber = document.getElementById('cashoutPb').value;
    const customerId = Number(document.getElementById('cashoutCustomer').value);
    const amount = parseFloat(document.getElementById('cashoutAmount').value);
    const issuedBy = getCurrentUser().name;

    if (!date || !pbNumber || !customerId || isNaN(amount) || amount <= 0 || !issuedBy) {
        showToast('Please fill all required fields correctly.', 'error');
        return;
    }

    // Check the resulting balance, excluding the transaction being edited.
    const balance = data.transactions
        .filter(t => t.customerId === customerId && t.id !== Number(id))
        .reduce((total, t) => total + (t.type === 'cashIn' ? Number(t.amount) : -Number(t.amount)), 0);
    if (balance < amount) {
        showToast(`Insufficient balance for ${getCustomerName(customerId)}. Available: GH₵ ${balance.toFixed(2)}`, 'error');
        return;
    }

    if (id) {
        const existing = data.transactions.find(t => t.id === Number(id));
        if (existing) {
            const values = { ...existing, date, pbNumber: Number(pbNumber), customerId, amount, issuedBy };
            let updated;
            if (cloudReady()) {
                try {
                    updated = await cloudUpdateTransaction(existing.id, values);
                } catch (error) {
                    showToast(cloudError(error, 'Unable to update Cash Out.'), 'error');
                    return;
                }
            } else {
                updated = values;
            }
            data.transactions[data.transactions.indexOf(existing)] = updated;
            showToast('Cash Out updated.', 'success');
        }
    } else {
        const transaction = {
            id: genId(),
            date,
            type: 'cashOut',
            pbNumber: Number(pbNumber),
            customerId,
            amount,
            receivedBy: '',
            issuedBy: issuedBy || '—',
            createdAt: todayStr()
        };
        if (cloudReady()) {
            try { data.transactions.push(await cloudAddTransaction(transaction)); }
            catch (error) { showToast(cloudError(error, 'Unable to record cash out.'), 'error'); return; }
        } else data.transactions.push(transaction);
        showToast(`Cash Out of GH₵ ${amount.toFixed(2)} recorded.`, 'success');
    }

    saveData();
    closeModal('cashoutModal');
    renderCashOut();
    updateDashboard();
}

function renderCashOut() {
    const tbody = document.getElementById('cashoutTableBody');
    if (!tbody) return;
    const filterDate = document.getElementById('cashoutFilterDate')?.value || '';

    let transactions = data.transactions.filter(t => t.type === 'cashOut');
    if (filterDate) {
        transactions = transactions.filter(t => t.date === filterDate);
    }
    transactions.sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.id - b.id);

    if (transactions.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="6">
                <div class="empty-state" style="padding:32px 20px;">
                    <i class="fas fa-arrow-up"></i>
                    <h3>No Cash Out records</h3>
                    <p>Record your first receipt.</p>
                </div>
            </td></tr>
        `;
        const label = document.getElementById('cashoutTotalLabel');
        if (label) label.textContent = '0 transactions';
        return;
    }

    let html = '';
    let total = 0;
    transactions.forEach(t => {
        total += Number(t.amount);
        html += `
            <tr>
                <td>${formatDate(t.date)}</td>
                <td><button class="link-button" onclick="showCustomerHistory(${t.customerId})" title="View customer transaction history">#${t.pbNumber}</button></td>
                <td>${escapeHtml(getCustomerName(t.customerId))}</td>
                <td class="text-danger fw-600">GH₵ ${Number(t.amount).toFixed(2)}</td>
                <td>${escapeHtml(t.issuedBy || '—')}</td>
                <td style="text-align:center;">
                    ${isManager() ? `<button class="btn btn-outline btn-xs" onclick="openCashOutModal(${t.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-xs" onclick="deleteTransaction(${t.id},'cashOut')"><i class="fas fa-trash"></i></button>` : '—'}
                </td>
            </tr>
        `;
    });

    html += `
        <tr class="table-total">
            <td colspan="3" style="text-align:right;">TOTAL</td>
            <td class="text-danger fw-600">GH₵ ${total.toFixed(2)}</td>
            <td colspan="2"></td>
        </tr>
    `;

    tbody.innerHTML = html;
    const label = document.getElementById('cashoutTotalLabel');
    if (label) label.textContent = `${transactions.length} transactions`;
}

// ============================================================
// DELETE TRANSACTION
// ============================================================

async function deleteTransaction(id, type) {
    if (!isManager()) {
        showToast('Only the manager can delete transaction records.', 'error');
        return;
    }
    const t = data.transactions.find(t => t.id === id);
    if (!t) return;
    if (!confirm(`Delete this ${type === 'cashIn' ? 'Cash In' : 'Cash Out'} record?`)) return;
    try {
        if (cloudReady()) await cloudDeleteTransaction(id);
        data.transactions = data.transactions.filter(t => t.id !== id);
    } catch (error) {
        showToast(cloudError(error, 'Unable to delete transaction.'), 'error');
        return;
    }
    saveData();
    if (type === 'cashIn') renderCashIn();
    else renderCashOut();
    updateDashboard();
    showToast('Transaction deleted.', 'warning');
}
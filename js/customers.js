// ============================================================
// CUSTOMERS CRUD
// ============================================================

function openCustomerModal(customerId) {
    if (!requireManager()) return;
    const modal = document.getElementById('customerModal');
    const form = document.getElementById('customerForm');
    form.reset();
    document.getElementById('customerEditId').value = '';
    document.getElementById('customerModalTitle').innerHTML = '<i class="fas fa-user"></i> Add Customer';
    const openingBalanceGroup = document.getElementById('customerOpeningBalanceGroup');
    if (openingBalanceGroup) openingBalanceGroup.style.display = customerId ? 'none' : '';

    if (customerId) {
        const c = data.customers.find(c => c.id === customerId);
        if (c) {
            document.getElementById('customerEditId').value = c.id;
            document.getElementById('customerName').value = c.name || '';
            document.getElementById('customerPbNumber').value = c.pbNumber || c.id || '';
            document.getElementById('customerNextOfKin').value = c.nextOfKin || '';
            document.getElementById('customerNextOfKinPhone').value = localGhanaPhone(c.nextOfKinPhone);
            document.getElementById('customerPhone').value = localGhanaPhone(c.phone);
            document.getElementById('customerModalTitle').innerHTML = '<i class="fas fa-user-edit"></i> Edit Customer';
        }
    }
    openModal('customerModal');
}

async function saveCustomer(e) {
    e.preventDefault();
    if (!requireManager()) return;
    const id = document.getElementById('customerEditId').value;
    const name = document.getElementById('customerName').value.trim();
    const pbNumber = Number(document.getElementById('customerPbNumber').value);
    const nextOfKin = document.getElementById('customerNextOfKin').value.trim();
    const nextOfKinPhoneLocal = document.getElementById('customerNextOfKinPhone').value.trim();
    const phoneLocal = document.getElementById('customerPhone').value.trim();
    const phone = phoneLocal ? `+233${phoneLocal}` : '';
    const nextOfKinPhone = nextOfKinPhoneLocal ? `+233${nextOfKinPhoneLocal}` : '';
    const ghanaPhone = value => !value || /^\+233[235][0-9]{8}$/.test(value);
    const openingBalanceRaw = document.getElementById('customerOpeningBalance').value.trim();
    const openingBalance = openingBalanceRaw ? parseFloat(openingBalanceRaw) : 0;

    if (!name || !Number.isInteger(pbNumber) || pbNumber <= 0 || !ghanaPhone(phone) || !ghanaPhone(nextOfKinPhone)) {
        showToast('Enter a valid PB number and Ghana telephone numbers.', 'error');
        return;
    }
    if (isNaN(openingBalance) || openingBalance < 0) {
        showToast('Enter a valid opening balance of 0 or more.', 'error');
        return;
    }

    if (id) {
        const existing = data.customers.find(c => c.id === Number(id));
        if (existing) {
            let updated;
            if (cloudReady()) {
                try {
                    updated = await cloudUpdateCustomer(existing.id, { name, pbNumber, nextOfKin, nextOfKinPhone, phone });
                } catch (error) {
                    showToast(cloudError(error, 'Unable to update customer.'), 'error');
                    return;
                }
            } else {
                updated = { ...existing, name, pbNumber, nextOfKin, nextOfKinPhone, phone };
            }
            data.customers[data.customers.indexOf(existing)] = updated;
            showToast('Customer updated successfully.', 'success');
        }
    } else {
        const customer = {
            id: genId(),
            name,
            pbNumber,
            nextOfKin,
            nextOfKinPhone,
            phone,
            createdAt: todayStr()
        };
        let created;
        if (cloudReady()) {
            try { created = await cloudAddCustomer(customer); }
            catch (error) { showToast(cloudError(error, 'Unable to save customer.'), 'error'); return; }
        } else created = customer;
        data.customers.push(created);

        if (openingBalance > 0) {
            const transaction = {
                id: genId(),
                date: todayStr(),
                type: 'cashIn',
                pbNumber: created.pbNumber,
                customerId: created.id,
                amount: openingBalance,
                receivedBy: getCurrentUser().name,
                issuedBy: '',
                createdAt: todayStr()
            };
            if (cloudReady()) {
                try { data.transactions.push(await cloudAddTransaction(transaction)); }
                catch (error) { showToast(cloudError(error, 'Customer added, but the opening balance could not be recorded.'), 'error'); }
            } else data.transactions.push(transaction);
        }
        showToast(`Customer "${name}" added.`, 'success');
    }

    saveData();
    closeModal('customerModal');
    renderCustomers();
    updateDashboard();
    populateCustomerDropdowns();
    populateCustomerReportDropdown();
}

async function deleteCustomer(id) {
    if (!requireManager()) return;
    const c = data.customers.find(c => c.id === id || c.id === Number(id));
    if (!c) return;

    // Check for existing transactions
    const hasTransactions = data.transactions && data.transactions.some(t => t.customerId === c.id || Number(t.customerId) === Number(c.id));
    if (hasTransactions) {
        showToast(`Cannot delete "${c.name}" because they have existing transaction records.`, 'error');
        return;
    }

    if (!confirm(`Delete customer "${c.name}"?`)) return;

    try {
        if (cloudReady()) await cloudDeleteCustomer(c.id);
        data.customers = data.customers.filter(item => item.id !== c.id);
    } catch (error) {
        if (error && (error.code === '23503' || String(error.code) === '23503')) {
            showToast(`Cannot delete "${c.name}" because they have existing transaction records.`, 'error');
        } else {
            showToast(cloudError(error, 'Unable to delete customer.'), 'error');
        }
        return;
    }
    saveData();
    renderCustomers();
    updateDashboard();
    populateCustomerDropdowns();
    showToast(`Customer "${c.name}" removed.`, 'warning');
}

const CUSTOMERS_PER_PAGE = 25;
let customerPage = 1;

function renderCustomers() {
    const tbody = document.getElementById('customerTableBody');
    if (!tbody) return;
    
    const search = document.getElementById('customerSearch')?.value?.toLowerCase().trim() || '';

    let filtered = data.customers;
    if (search) {
        filtered = filtered.filter(c =>
            c.name.toLowerCase().includes(search) ||
            String(c.pbNumber || c.id).includes(search) ||
            (c.phone && c.phone.includes(search))
        );
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="7">
                <div class="empty-state" style="padding:32px 20px;">
                    <i class="fas fa-user-slash"></i>
                    <h3>No customers found</h3>
                    <p>Add your first customer to get started.</p>
                </div>
            </td></tr>
        `;
        const label = document.getElementById('customerTotalLabel');
        if (label) label.textContent = '0 customers';
        renderCustomerPagination(0);
        return;
    }

    const totalPages = Math.max(1, Math.ceil(filtered.length / CUSTOMERS_PER_PAGE));
    if (customerPage > totalPages) customerPage = totalPages;
    const start = (customerPage - 1) * CUSTOMERS_PER_PAGE;
    const pageItems = filtered.slice(start, start + CUSTOMERS_PER_PAGE);

    let html = '';
    pageItems.forEach((c, idx) => {
        const balance = getCustomerBalance(c.id);
        html += `
            <tr>
                <td>${start + idx + 1}</td>
                <td><strong>${escapeHtml(c.name)}</strong></td>
                <td>${escapeHtml(c.pbNumber || c.id || '—')}</td>
                <td>${escapeHtml(c.nextOfKin || '—')}</td>
                <td>${escapeHtml(c.phone || '—')}</td>
                <td class="${balance >= 0 ? 'text-success' : 'text-danger'} fw-600">
                    GH₵ ${balance.toFixed(2)}
                </td>
                <td style="text-align:center;">
                    ${isManager() ? `<button class="btn btn-outline btn-xs" onclick="openCustomerModal(${c.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-xs" onclick="deleteCustomer(${c.id})"><i class="fas fa-trash"></i></button>` : '—'}
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    const label = document.getElementById('customerTotalLabel');
    if (label) label.textContent = `${filtered.length} customers`;
    renderCustomerPagination(totalPages);
}

function renderCustomerPagination(totalPages) {
    const container = document.getElementById('customerPagination');
    if (!container) return;
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    container.innerHTML = `
        <button class="btn btn-outline btn-xs" type="button" onclick="goToCustomerPage(${customerPage - 1})" ${customerPage <= 1 ? 'disabled' : ''}>Prev</button>
        <span class="pagination-status">Page ${customerPage} of ${totalPages}</span>
        <button class="btn btn-outline btn-xs" type="button" onclick="goToCustomerPage(${customerPage + 1})" ${customerPage >= totalPages ? 'disabled' : ''}>Next</button>
    `;
}

function goToCustomerPage(page) {
    customerPage = page;
    renderCustomers();
}

let customerSearchDebounce = null;
function filterCustomers() {
    clearTimeout(customerSearchDebounce);
    customerSearchDebounce = setTimeout(() => {
        customerPage = 1;
        renderCustomers();
    }, 200);
}

function refreshCustomers() {
    const search = document.getElementById('customerSearch');
    if (search) search.value = '';
    customerPage = 1;
    renderCustomers();
}


function populateCustomerDropdowns() {
    const selects = ['cashinCustomer', 'cashoutCustomer'];
    selects.forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const currentVal = sel.value;
        sel.innerHTML = '<option value="">— Select Customer —</option>';
        data.customers.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            sel.appendChild(opt);
        });
        if (currentVal && data.customers.some(c => c.id === Number(currentVal))) {
            sel.value = currentVal;
        }
    });
}

function showCustomerHistory(customerId) {
    const customer = data.customers.find(item => item.id === Number(customerId));
    if (!customer) return;
    const history = data.transactions.filter(item => item.customerId === Number(customerId)).sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.id - b.id);
    const body = document.getElementById('customerHistoryBody');
    document.getElementById('customerHistoryTitle').innerHTML = `<i class="fas fa-user-clock"></i> ${escapeHtml(customer.name)} <span class="text-muted fs-small">${escapeHtml(customer.phone || 'No phone')}</span>`;
    body.innerHTML = history.length ? `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>PB#</th><th>Amount</th></tr></thead><tbody>${history.map(item => `<tr><td>${formatDate(item.date)}</td><td><span class="badge-status ${item.type === 'cashIn' ? 'in' : 'out'}">${item.type === 'cashIn' ? 'Cash In' : 'Cash Out'}</span></td><td>#${item.pbNumber}</td><td class="${item.type === 'cashIn' ? 'text-success' : 'text-danger'} fw-600">GH₵ ${Number(item.amount).toFixed(2)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state"><i class="fas fa-inbox"></i><h3>No transactions yet</h3><p>This customer has no transaction history.</p></div>';
    openModal('customerHistoryModal');
}

function matchCustomerByPb(kind) {
    const pb = Number(document.getElementById(`${kind}Pb`)?.value);
    const select = document.getElementById(`${kind}Customer`);
    const customer = data.customers.find(item => Number(item.pbNumber || item.id) === pb);
    if (select) select.value = customer ? customer.id : '';
    if (select) select.title = customer ? customer.name : 'No customer matches this PB number';
}

function localGhanaPhone(value) {
    const phone = String(value || '');
    if (phone.startsWith('+233')) return phone.slice(4);
    if (/^0[235][0-9]{8}$/.test(phone)) return phone.slice(1);
    return '';
}

function validateGhanaPhone(input) {
    const original = input.value;
    input.value = original.replace(/\D/g, '').slice(0, 9);
    const valid = !input.value || /^[235][0-9]{8}$/.test(input.value);
    const error = document.getElementById(`${input.id}Error`);
    input.setCustomValidity(valid ? '' : 'Enter 9 digits beginning with 2, 3, or 5.');
    if (error) error.textContent = valid || !input.value ? '' : 'Enter 9 digits beginning with 2, 3, or 5.';
}
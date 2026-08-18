// ===================================
// BRANDFLETCH PORTAL — Dashboard
// Fetches and displays customer data from Supabase
// ===================================

async function initDashboard() {
    const auth = await requireAuth();
    if (!auth) return;

    const { client, user } = auth;

    // Display user info
    const fullName = user.user_metadata?.full_name || user.email.split('@')[0];
    document.getElementById('userName').textContent = fullName;
    document.getElementById('userEmail').textContent = user.email;

    // Sign out
    document.getElementById('signOutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        signOut();
    });

    // Fetch data
    await Promise.all([
        loadHostingAccounts(client),
        loadWebsites(client),
        loadDomains(client),
        loadOrders(client),
        loadCustomerInvoices(client)
    ]);
}

// Get customer record matching the auth user
async function getCustomer(client) {
    // The customers table has auth_id = auth.users.id
    // With RLS, we can query our own record
    const { data, error } = await client
        .from('customers')
        .select('id')
        .eq('email', user.email)
        .single();

    if (error || !data) {
        // Fallback: try auth_id match
        const { data: data2 } = await client
            .from('customers')
            .select('id')
            .eq('auth_id', user.id)
            .single();
        return data2;
    }

    return data;
}

async function loadHostingAccounts(client) {
    const container = document.getElementById('hostingAccounts');
    const statEl = document.getElementById('statHosting');

    try {
        // Query hosting_accounts where customer matches our auth
        const { data, error } = await client
            .from('hosting_accounts')
            .select('cpanel_user, domain, plan_name, plan_type, status, created_at')
            .order('created_at', { ascending: false });

        if (error) throw error;

        statEl.textContent = data ? data.length : 0;

        if (!data || data.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No hosting accounts yet.</p><a href="/#hosting" class="btn btn-ghost btn-sm">Order Hosting</a></div>';
            return;
        }

        let html = '<table class="data-table"><thead><tr><th>Domain</th><th>Plan</th><th>Type</th><th>Status</th><th>Created</th></tr></thead><tbody>';
        for (const acc of data) {
            const statusClass = acc.status === 'active' ? 'badge-success' : acc.status === 'suspended' ? 'badge-warning' : 'badge-danger';
            const date = new Date(acc.created_at).toLocaleDateString();
            html += `<tr>
                <td>${acc.domain}</td>
                <td>${acc.plan_name}</td>
                <td>${acc.plan_type}</td>
                <td><span class="badge ${statusClass}">${acc.status}</span></td>
                <td>${date}</td>
            </tr>`;
        }
        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (err) {
        console.error('Hosting accounts error:', err);
        container.innerHTML = '<div class="empty-state"><p>Unable to load hosting accounts.</p></div>';
        statEl.textContent = '0';
    }
}

async function loadDomains(client) {
    const container = document.getElementById('domainsList');
    const statEl = document.getElementById('statDomains');

    try {
        const { data, error } = await client
            .from('domains')
            .select('domain, registration_status, nameservers, registered_at, expires_at, auto_renew')
            .order('created_at', { ascending: false });

        if (error) throw error;

        statEl.textContent = data ? data.length : 0;

        if (!data || data.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No registered domains yet.</p></div>';
            return;
        }

        let html = '<table class="data-table"><thead><tr><th>Domain</th><th>Status</th><th>Expires</th><th>Auto-Renew</th></tr></thead><tbody>';
        for (const dom of data) {
            const statusClass = dom.registration_status === 'registered' ? 'badge-success' : 
                dom.registration_status === 'pending' ? 'badge-warning' :
                dom.registration_status === 'expired' ? 'badge-danger' : 'badge-neutral';
            const expires = dom.expires_at ? new Date(dom.expires_at).toLocaleDateString() : 'N/A';
            const renew = dom.auto_renew ? 'Yes' : 'No';
            html += `<tr>
                <td>${dom.domain}</td>
                <td><span class="badge ${statusClass}">${dom.registration_status}</span></td>
                <td>${expires}</td>
                <td>${renew}</td>
            </tr>`;
        }
        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (err) {
        console.error('Domains error:', err);
        container.innerHTML = '<div class="empty-state"><p>Unable to load domains.</p></div>';
        statEl.textContent = '0';
    }
}

async function loadOrders(client) {
    const container = document.getElementById('ordersList');
    const statEl = document.getElementById('statOrders');

    try {
        const { data, error } = await client
            .from('orders')
            .select('tx_ref, plan_name, plan_type, billing_cycle, price_mwk, domain, payment_status, provisioning_status, created_at')
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        statEl.textContent = data ? data.length : 0;

        if (!data || data.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No orders yet.</p><a href="/#hosting" class="btn btn-ghost btn-sm">Browse Plans</a></div>';
            return;
        }

        let html = '<table class="data-table"><thead><tr><th>Order ID</th><th>Plan</th><th>Domain</th><th>Amount</th><th>Payment</th><th>Provisioning</th><th>Date</th></tr></thead><tbody>';
        for (const order of data) {
            const payClass = order.payment_status === 'paid' ? 'badge-success' : 
                order.payment_status === 'failed' ? 'badge-danger' : 'badge-warning';
            const provClass = order.provisioning_status === 'provisioned' ? 'badge-success' :
                order.provisioning_status === 'failed' ? 'badge-danger' :
                order.provisioning_status === 'manual' ? 'badge-neutral' : 'badge-warning';
            const date = new Date(order.created_at).toLocaleDateString();
            const amount = 'MK' + order.price_mwk.toLocaleString();
            html += `<tr>
                <td style="font-family: var(--font-mono); font-size: 0.8rem;">${order.tx_ref.substring(0, 16)}...</td>
                <td>${order.plan_name}</td>
                <td>${order.domain}</td>
                <td>${amount}</td>
                <td><span class="badge ${payClass}">${order.payment_status}</span></td>
                <td><span class="badge ${provClass}">${order.provisioning_status}</span></td>
                <td>${date}</td>
            </tr>`;
        }
        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (err) {
        console.error('Orders error:', err);
        container.innerHTML = '<div class="empty-state"><p>Unable to load orders.</p></div>';
        statEl.textContent = '0';
    }
}

// Initialize
initDashboard();

// ===================================
// CUSTOM WEBSITES (Projects)
// ===================================

async function loadWebsites(client) {
    const container = document.getElementById('websitesList');
    const statEl = document.getElementById('statWebsites');

    try {
        const { data, error } = await client
            .from('projects')
            .select('project_name, domain, description, status, project_type, management_fee_mwk, billing_cycle, billing_active, next_billing_date, deployed_at, technologies, notes')
            .order('created_at', { ascending: false });

        if (error) throw error;

        statEl.textContent = data ? data.length : 0;

        if (!data || data.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No custom websites assigned to your account yet.</p><a href="/#services" class="btn btn-ghost btn-sm">Request a Quote</a></div>';
            return;
        }

        let html = '<table class="data-table"><thead><tr><th>Project</th><th>Domain</th><th>Type</th><th>Status</th><th>Annual Fee</th><th>Billing</th></tr></thead><tbody>';
        for (const p of data) {
            const statusClass = p.status === 'deployed' || p.status === 'maintenance' ? 'badge-success' :
                p.status === 'in_development' ? 'badge-warning' :
                p.status === 'paused' ? 'badge-neutral' : 'badge-neutral';
            const billingClass = p.billing_active ? 'badge-success' : 'badge-neutral';
            const fee = p.management_fee_mwk > 0 ? 'MK ' + p.management_fee_mwk.toLocaleString() + '/' + (p.billing_cycle || 'year') : 'N/A';
            html += `<tr>
                <td>${p.project_name}</td>
                <td>${p.domain || 'N/A'}</td>
                <td>${(p.project_type || '').replace('_', ' ')}</td>
                <td><span class="badge ${statusClass}">${(p.status || '').replace('_', ' ')}</span></td>
                <td>${fee}</td>
                <td><span class="badge ${billingClass}">${p.billing_active ? 'active' : 'inactive'}</span></td>
            </tr>`;
        }
        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (err) {
        console.error('Websites error:', err);
        container.innerHTML = '<div class="empty-state"><p>Unable to load your websites.</p></div>';
        statEl.textContent = '0';
    }
}

// ===================================
// INVOICES (Customer-facing)
// ===================================

async function loadCustomerInvoices(client) {
    const container = document.getElementById('invoicesList');
    const statEl = document.getElementById('statInvoices');

    try {
        const { data, error } = await client
            .from('invoices')
            .select('invoice_number, description, amount_mwk, billing_period, status, due_date, paid_at, created_at')
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        const pending = data ? data.filter(i => i.status === 'pending' || i.status === 'overdue').length : 0;
        statEl.textContent = pending;

        if (!data || data.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No invoices yet.</p></div>';
            return;
        }

        let html = '<table class="data-table"><thead><tr><th>Invoice #</th><th>Description</th><th>Amount</th><th>Period</th><th>Status</th><th>Due Date</th></tr></thead><tbody>';
        for (const inv of data) {
            const statusClass = inv.status === 'paid' ? 'badge-success' :
                inv.status === 'overdue' ? 'badge-danger' :
                inv.status === 'pending' ? 'badge-warning' : 'badge-neutral';
            const amount = 'MK ' + inv.amount_mwk.toLocaleString();
            const due = inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'N/A';
            html += `<tr>
                <td style="font-family: var(--font-mono); font-size: 0.8rem;">${inv.invoice_number}</td>
                <td>${inv.description}</td>
                <td>${amount}</td>
                <td>${inv.billing_period || ''}</td>
                <td><span class="badge ${statusClass}">${inv.status}</span></td>
                <td>${due}</td>
            </tr>`;
        }
        html += '</tbody></table>';
        container.innerHTML = html;
    } catch (err) {
        console.error('Invoices error:', err);
        container.innerHTML = '<div class="empty-state"><p>Unable to load invoices.</p></div>';
        statEl.textContent = '0';
    }
}

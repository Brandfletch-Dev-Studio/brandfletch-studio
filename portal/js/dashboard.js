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
        loadDomains(client),
        loadOrders(client)
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

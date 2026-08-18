/* ===================================
   BRANDFLETCH ADMIN PANEL
   Admin Logic
   =================================== */

// --- State ---
let token = localStorage.getItem('adminToken') || null;
let content = null;

// --- API Helpers ---
async function api(path, method = 'GET', body = null) {
    const opts = {
        method,
        headers: {
            'Content-Type': 'application/json',
        }
    };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(path, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
}

// --- Auth ---
async function login(password) {
    try {
        const data = await api('/api/auth', 'POST', { password });
        token = data.token;
        localStorage.setItem('adminToken', token);
        showDashboard();
    } catch (err) {
        document.getElementById('loginError').textContent = 'Invalid password';
    }
}

function logout() {
    token = null;
    localStorage.removeItem('adminToken');
    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('loginPassword').value = '';
}

async function checkAuth() {
    if (!token) return false;
    try {
        // /api/content is public now (the homepage needs it), so use
        // /api/messages — a strictly auth-required endpoint — to verify
        // this token is still valid.
        await api('/api/messages');
        return true;
    } catch {
        localStorage.removeItem('adminToken');
        token = null;
        return false;
    }
}

// --- Content ---
async function fetchContent() {
    content = await api('/api/content');
    return content;
}

async function saveContent() {
    return api('/api/content', 'PUT', content);
}

// --- Init ---
document.addEventListener('DOMContentLoaded', async () => {
    // Login form
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('loginPassword').value;
        await login(password);
    });

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', logout);

    // Nav switching
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => switchView(btn.dataset.view));
    });

    // About form
    document.getElementById('aboutForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveAbout();
    });

    // Project form
    document.getElementById('projectForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveProject();
    });

    // Service form
    document.getElementById('serviceForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveService();
    });

    // Hosting form
    document.getElementById('hostingForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveHosting();
    });

    // Add-on form
    document.getElementById('addonForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveAddon();
    });

    // Check existing auth
    const authed = await checkAuth();
    if (authed) showDashboard();
});

async function showDashboard() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
    await fetchContent();
    renderAll();
}

function switchView(view) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.getElementById('view-' + view).classList.add('active');
    document.querySelector(`[data-view="${view}"]`).classList.add('active');
}

// --- Render ---
function renderAll() {
    renderOverview();
    renderProjects();
    renderServices();
    renderHosting();
    renderAddons();
    renderAbout();
    renderMessages();
}

function renderOverview() {
    document.getElementById('statProjects').textContent = content.projects?.length || 0;
    document.getElementById('statServices').textContent = content.services?.length || 0;
    const wpCount = (content.hostingWordPress || []).length;
    const cpCount = (content.hostingCpanel || []).length;
    document.getElementById('statHosting').textContent = wpCount + cpCount;
    const unread = (content.messages || []).filter(m => !m.read).length;
    document.getElementById('statMessages').textContent = unread;

    const badge = document.getElementById('msgBadge');
    if (unread > 0) {
        badge.textContent = unread;
        badge.classList.remove('hidden');
    } else {
        badge.classList.add('hidden');
    }

    const recent = (content.messages || []).slice(0, 5);
    const list = document.getElementById('recentMsgList');
    if (recent.length === 0) {
        list.innerHTML = '<p class="muted">No messages yet.</p>';
    } else {
        list.innerHTML = recent.map(m => `
            <div class="recent-item">
                <div>
                    <div class="recent-item-name">${escape(m.name)}</div>
                    <div class="recent-item-subject">${escape(m.subject)}</div>
                </div>
                <span class="recent-item-date">${formatDate(m.date)}</span>
            </div>
        `).join('');
    }
}

function renderProjects() {
    const list = document.getElementById('projectsList');
    const projects = content.projects || [];
    if (projects.length === 0) {
        list.innerHTML = '<p class="muted">No projects yet. Click "Add Project" to create one.</p>';
        return;
    }
    list.innerHTML = projects.map(p => `
        <div class="data-item">
            <div class="data-item-main">
                <span class="data-item-tag">${escape(p.tag)}${p.featured ? " &middot; <span class='featured-badge'>Featured</span>" : ''}</span>
                <h3>${escape(p.title)}</h3>
                <p>${escape(p.desc)}</p>
                <div class="data-stack">${(p.stack || []).map(s => `<span>${escape(s)}</span>`).join('')}</div>
            </div>
            <div class="data-item-actions">
                <button class="btn btn-ghost" onclick="openProjectEditor('${p.id}')">Edit</button>
                <button class="btn btn-danger" onclick="deleteProject('${p.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

function renderServices() {
    const list = document.getElementById('servicesList');
    const services = content.services || [];
    if (services.length === 0) {
        list.innerHTML = '<p class="muted">No services yet.</p>';
        return;
    }
    list.innerHTML = services.map(s => `
        <div class="data-item">
            <div class="data-item-main">
                <h3>${escape(s.title)}</h3>
                ${s.model ? `<span class="data-item-tag">${escape(s.model)}</span>` : ''}
                <p>${escape(s.desc)}</p>
            </div>
            <div class="data-item-actions">
                <button class="btn btn-ghost" onclick="openServiceEditor('${s.id}')">Edit</button>
                <button class="btn btn-danger" onclick="deleteService('${s.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

function renderHosting() {
    const list = document.getElementById('hostingList');
    document.getElementById('hostingNoteInput').value = content.hostingNote || '';
    const wp = content.hostingWordPress || [];
    const cp = content.hostingCpanel || [];
    if (wp.length === 0 && cp.length === 0) {
        list.innerHTML = '<p class="muted">No hosting packages yet.</p>';
        return;
    }
    const renderGroup = (label, packages) => {
        if (!packages.length) return '';
        return `<h3 class="hosting-group-label">${label}</h3>` + packages.map(p => `
            <div class="data-item">
                <div class="data-item-main">
                    <span class="data-item-tag">${formatMWK(p.priceMonthlyMWK)}/mo${p.highlighted ? " &middot; <span class='featured-badge'>Highlighted</span>" : ''}</span>
                    <h3>${escape(p.name)}</h3>
                    <p>${escape(p.tagline)}</p>
                    <div class="data-stack">${(p.features || []).map(f => `<span>${escape(f)}</span>`).join('')}</div>
                </div>
                <div class="data-item-actions">
                    <button class="btn btn-ghost" onclick="openHostingEditor('${p.id}')">Edit</button>
                    <button class="btn btn-danger" onclick="deleteHosting('${p.id}')">Delete</button>
                </div>
            </div>
        `).join('');
    };
    list.innerHTML = renderGroup('WordPress Hosting', wp) + renderGroup('cPanel Hosting', cp);
}

function renderAddons() {
    const list = document.getElementById('addonsList');
    const addons = content.addons || [];
    if (addons.length === 0) {
        list.innerHTML = '<p class="muted">No add-ons yet.</p>';
        return;
    }
    list.innerHTML = addons.map(a => `
        <div class="data-item">
            <div class="data-item-main">
                <h3>${escape(a.title)}</h3>
                ${a.model ? `<span class="data-item-tag">${escape(a.model)}</span>` : ''}
                <p>${escape(a.desc)}</p>
            </div>
            <div class="data-item-actions">
                <button class="btn btn-ghost" onclick="openAddonEditor('${a.id}')">Edit</button>
                <button class="btn btn-danger" onclick="deleteAddon('${a.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

function renderAbout() {
    const about = content.about || {};
    document.getElementById('aboutHeading').value = about.heading || '';
    document.getElementById('aboutP1').value = about.paragraphs?.[0] || '';
    document.getElementById('aboutP2').value = about.paragraphs?.[1] || '';

    const statsEditor = document.getElementById('statsEditor');
    const stats = content.stats || [];
    statsEditor.innerHTML = stats.map((s, i) => `
        <div class="stat-edit-row">
            <input type="text" value="${escape(s.num)}" data-stat="num" data-idx="${i}" placeholder="50+">
            <input type="text" value="${escape(s.label)}" data-stat="label" data-idx="${i}" placeholder="Label">
        </div>
    `).join('');
}

async function renderMessages() {
    const list = document.getElementById('messagesList');
    try {
        const messages = await api('/api/messages');
        if (messages.length === 0) {
            list.innerHTML = '<p class="muted">No messages yet.</p>';
            return;
        }
        list.innerHTML = messages.map(m => `
            <div class="message-item ${m.read ? '' : 'unread'}">
                <div class="message-header">
                    <div>
                        <span class="message-name">${escape(m.name)}</span>
                        <span class="message-email"> — ${escape(m.email)}</span>
                    </div>
                    <span class="message-date">${formatDate(m.date)}</span>
                </div>
                <div class="message-subject">${escape(m.subject)}</div>
                <div class="message-body">${escape(m.message)}</div>
                <div class="message-actions">
                    <a href="mailto:${escape(m.email)}?subject=Re: ${escape(m.subject)}" class="btn btn-ghost">Reply</a>
                    <button class="btn btn-ghost" onclick="toggleMessageRead('${m.id}')">${m.read ? 'Mark Unread' : 'Mark Read'}</button>
                    <button class="btn btn-danger" onclick="deleteMessage('${m.id}')">Delete</button>
                </div>
            </div>
        `).join('');
    } catch {
        list.innerHTML = '<p class="muted">Could not load messages.</p>';
    }
}

// --- Project CRUD ---
function openProjectEditor(id) {
    const modal = document.getElementById('projectModal');
    const form = document.getElementById('projectForm');
    form.reset();

    if (id) {
        const p = content.projects.find(x => x.id === id);
        if (!p) return;
        document.getElementById('projectModalTitle').textContent = 'Edit Project';
        document.getElementById('projectId').value = p.id;
        document.getElementById('projectTitle').value = p.title;
        document.getElementById('projectTag').value = p.tag;
        document.getElementById('projectDesc').value = p.desc;
        document.getElementById('projectStack').value = (p.stack || []).join(', ');
        document.getElementById('projectLink').value = p.link;
        document.getElementById('projectFeatured').checked = !!p.featured;
    } else {
        document.getElementById('projectModalTitle').textContent = 'Add Project';
        document.getElementById('projectId').value = '';
    }

    modal.classList.remove('hidden');
}

function closeProjectModal() {
    document.getElementById('projectModal').classList.add('hidden');
}

async function saveProject() {
    const id = document.getElementById('projectId').value;
    const project = {
        id: id || 'p' + Date.now(),
        title: document.getElementById('projectTitle').value,
        tag: document.getElementById('projectTag').value,
        desc: document.getElementById('projectDesc').value,
        stack: document.getElementById('projectStack').value.split(',').map(s => s.trim()).filter(Boolean),
        link: document.getElementById('projectLink').value,
        featured: document.getElementById('projectFeatured').checked
    };

    if (id) {
        const idx = content.projects.findIndex(p => p.id === id);
        if (idx >= 0) content.projects[idx] = project;
    } else {
        content.projects.unshift(project);
    }

    await saveContent();
    closeProjectModal();
    renderProjects();
    renderOverview();
}

async function deleteProject(id) {
    if (!confirm('Delete this project?')) return;
    content.projects = content.projects.filter(p => p.id !== id);
    await saveContent();
    renderProjects();
    renderOverview();
}

// --- Service CRUD ---
function openServiceEditor(id) {
    const modal = document.getElementById('serviceModal');
    const form = document.getElementById('serviceForm');
    form.reset();

    if (id) {
        const s = content.services.find(x => x.id === id);
        if (!s) return;
        document.getElementById('serviceModalTitle').textContent = 'Edit Service';
        document.getElementById('serviceId').value = s.id;
        document.getElementById('serviceTitle').value = s.title;
        document.getElementById('serviceDesc').value = s.desc;
    } else {
        document.getElementById('serviceModalTitle').textContent = 'Add Service';
        document.getElementById('serviceId').value = '';
    }

    modal.classList.remove('hidden');
}

function closeServiceModal() {
    document.getElementById('serviceModal').classList.add('hidden');
}

async function saveService() {
    const id = document.getElementById('serviceId').value;
    const service = {
        id: id || 's' + Date.now(),
        title: document.getElementById('serviceTitle').value,
        desc: document.getElementById('serviceDesc').value
    };

    if (id) {
        const idx = content.services.findIndex(s => s.id === id);
        if (idx >= 0) content.services[idx] = service;
    } else {
        content.services.push(service);
    }

    await saveContent();
    closeServiceModal();
    renderServices();
    renderOverview();
}

async function deleteService(id) {
    if (!confirm('Delete this service?')) return;
    content.services = content.services.filter(s => s.id !== id);
    await saveContent();
    renderServices();
    renderOverview();
}

// --- Hosting Package CRUD ---
function openHostingEditor(id) {
    const modal = document.getElementById('hostingModal');
    const form = document.getElementById('hostingForm');
    form.reset();

    if (id) {
        const all = [...(content.hostingWordPress || []), ...(content.hostingCpanel || [])];
        const p = all.find(x => x.id === id);
        if (!p) return;
        document.getElementById('hostingModalTitle').textContent = 'Edit Package';
        document.getElementById('hostingId').value = p.id;
        document.getElementById('hostingName').value = p.name;
        document.getElementById('hostingTagline').value = p.tagline || '';
        document.getElementById('hostingPriceMonthly').value = p.priceMonthlyMWK;
        document.getElementById('hostingPriceYearly').value = p.priceYearlyMWK;
        document.getElementById('hostingFeatures').value = (p.features || []).join('\n');
        document.getElementById('hostingHighlighted').checked = !!p.highlighted;
        document.getElementById('hostingCategory').value = (content.hostingCpanel || []).some(x => x.id === id) ? 'cpanel' : 'wordpress';
    } else {
        document.getElementById('hostingModalTitle').textContent = 'Add Package';
        document.getElementById('hostingId').value = '';
    }

    modal.classList.remove('hidden');
}

function closeHostingModal() {
    document.getElementById('hostingModal').classList.add('hidden');
}

async function saveHosting() {
    const id = document.getElementById('hostingId').value;
    const category = document.getElementById('hostingCategory').value;
    const key = category === 'cpanel' ? 'hostingCpanel' : 'hostingWordPress';
    const pkg = {
        id: id || 'h' + Date.now(),
        name: document.getElementById('hostingName').value,
        tagline: document.getElementById('hostingTagline').value,
        priceMonthlyMWK: Number(document.getElementById('hostingPriceMonthly').value) || 0,
        priceYearlyMWK: Number(document.getElementById('hostingPriceYearly').value) || 0,
        features: document.getElementById('hostingFeatures').value.split('\n').map(s => s.trim()).filter(Boolean),
        highlighted: document.getElementById('hostingHighlighted').checked
    };

    if (!content[key]) content[key] = [];

    // Remove from old array if editing (might have switched category)
    if (id) {
        if (content.hostingWordPress) content.hostingWordPress = content.hostingWordPress.filter(p => p.id !== id);
        if (content.hostingCpanel) content.hostingCpanel = content.hostingCpanel.filter(p => p.id !== id);
    }

    content[key].push(pkg);

    await saveContent();
    closeHostingModal();
    renderHosting();
    renderOverview();
}

async function deleteHosting(id) {
    if (!confirm('Delete this hosting package?')) return;
    if (content.hostingWordPress) content.hostingWordPress = content.hostingWordPress.filter(p => p.id !== id);
    if (content.hostingCpanel) content.hostingCpanel = content.hostingCpanel.filter(p => p.id !== id);
    await saveContent();
    renderHosting();
    renderOverview();
}

async function saveHostingNote() {
    const status = document.getElementById('hostingNoteStatus');
    content.hostingNote = document.getElementById('hostingNoteInput').value;
    status.className = 'form-status';
    status.textContent = 'Saving...';
    try {
        await saveContent();
        status.className = 'form-status success';
        status.textContent = 'Saved!';
    } catch {
        status.className = 'form-status error';
        status.textContent = 'Failed to save.';
    }
    setTimeout(() => { status.textContent = ''; }, 4000);
}

// --- Add-on CRUD ---
function openAddonEditor(id) {
    const modal = document.getElementById('addonModal');
    const form = document.getElementById('addonForm');
    form.reset();

    if (id) {
        const a = content.addons.find(x => x.id === id);
        if (!a) return;
        document.getElementById('addonModalTitle').textContent = 'Edit Add-on';
        document.getElementById('addonId').value = a.id;
        document.getElementById('addonTitle').value = a.title;
        document.getElementById('addonDesc').value = a.desc;
    } else {
        document.getElementById('addonModalTitle').textContent = 'Add Add-on';
        document.getElementById('addonId').value = '';
    }

    modal.classList.remove('hidden');
}

function closeAddonModal() {
    document.getElementById('addonModal').classList.add('hidden');
}

async function saveAddon() {
    const id = document.getElementById('addonId').value;
    const addon = {
        id: id || 'a' + Date.now(),
        title: document.getElementById('addonTitle').value,
        desc: document.getElementById('addonDesc').value
    };

    if (!content.addons) content.addons = [];

    if (id) {
        const idx = content.addons.findIndex(a => a.id === id);
        if (idx >= 0) content.addons[idx] = addon;
    } else {
        content.addons.push(addon);
    }

    await saveContent();
    closeAddonModal();
    renderAddons();
    renderOverview();
}

async function deleteAddon(id) {
    if (!confirm('Delete this add-on?')) return;
    content.addons = content.addons.filter(a => a.id !== id);
    await saveContent();
    renderAddons();
    renderOverview();
}

// --- About Save ---
async function saveAbout() {
    const status = document.getElementById('aboutStatus');
    status.className = 'form-status';
    status.textContent = 'Saving...';

    content.about = {
        heading: document.getElementById('aboutHeading').value,
        paragraphs: [
            document.getElementById('aboutP1').value,
            document.getElementById('aboutP2').value
        ].filter(Boolean),
    };

    // Stats
    const statRows = document.querySelectorAll('.stat-edit-row');
    content.stats = [];
    statRows.forEach(row => {
        const num = row.querySelector('[data-stat="num"]').value;
        const label = row.querySelector('[data-stat="label"]').value;
        if (num || label) content.stats.push({ num, label });
    });

    try {
        await saveContent();
        status.className = 'form-status success';
        status.textContent = 'Saved!';
    } catch {
        status.className = 'form-status error';
        status.textContent = 'Failed to save.';
    }

    setTimeout(() => { status.textContent = ''; }, 4000);
}

// --- Messages ---
async function toggleMessageRead(id) {
    try {
        await api('/api/messages', 'PATCH', { id, action: 'toggleRead' });
        renderMessages();
        renderOverview();
    } catch (err) {
        alert('Failed to update message');
    }
}

async function deleteMessage(id) {
    if (!confirm('Delete this message?')) return;
    try {
        await api('/api/messages', 'PATCH', { id, action: 'delete' });
        renderMessages();
        renderOverview();
    } catch (err) {
        alert('Failed to delete message');
    }
}

// --- Helpers ---
function escape(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}

function formatMWK(amount) {
    if (amount === null || amount === undefined) return '';
    return 'MWK ' + Number(amount).toLocaleString('en-US');
}

function formatDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diff = (now - d) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return d.toLocaleDateString();
}

// ===================================
// CLIENT MANAGEMENT
// ===================================

let adminCustomers = [];

async function loadClients() {
    try {
        const data = await api('/api/admin?action=customers');
        adminCustomers = data.customers || [];

        // Update overview stats
        const clientsCount = adminCustomers.length;
        const totalAnnual = adminCustomers.reduce((sum, c) => sum + (c.total_annual_fees || 0), 0);
        document.getElementById('statClients').textContent = clientsCount;
        document.getElementById('statAnnualFees').textContent = totalAnnual > 0 ? (totalAnnual / 1000).toFixed(0) + 'K' : '0';

        const list = document.getElementById('clientsList');
        if (!adminCustomers.length) {
            list.innerHTML = '<p class="muted">No clients yet. Customers appear here after placing an order or registering on the portal.</p>';
            return;
        }

        let html = '<table class="data-table"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Projects</th><th>Hosting</th><th>Annual Fees</th><th>Status</th></tr></thead><tbody>';
        for (const c of adminCustomers) {
            const annualFee = (c.total_annual_fees || 0).toLocaleString();
            const statusClass = c.status === 'active' ? 'badge-success' : c.status === 'suspended' ? 'badge-warning' : 'badge-danger';
            html += `<tr>
                <td>${c.full_name || 'Unknown'}</td>
                <td>${c.email || ''}</td>
                <td>${c.phone || 'N/A'}</td>
                <td>${c.project_count || 0}</td>
                <td>${c.hosting_count || 0}</td>
                <td>MK ${annualFee}</td>
                <td><span class="badge ${statusClass}">${c.status || 'active'}</span></td>
            </tr>`;
        }
        html += '</tbody></table>';
        list.innerHTML = html;
    } catch (err) {
        document.getElementById('clientsList').innerHTML = '<p class="muted">Unable to load clients: ' + err.message + '</p>';
    }
}

// ===================================
// CLIENT SITES / PROJECTS
// ===================================

let clientProjects = [];

async function loadClientProjects() {
    try {
        const data = await api('/api/admin?action=projects');
        clientProjects = data.projects || [];

        // Populate customer dropdowns
        const customerSelects = ['projectCustomer', 'invoiceCustomer'];
        for (const selId of customerSelects) {
            const sel = document.getElementById(selId);
            if (!sel) continue;
            const currentVal = sel.value;
            sel.innerHTML = '<option value="">Select a client...</option>';
            for (const c of adminCustomers) {
                sel.innerHTML += `<option value="${c.id}">${c.full_name} (${c.email})</option>`;
            }
            sel.value = currentVal;
        }

        const list = document.getElementById('clientProjectsList');
        if (!clientProjects.length) {
            list.innerHTML = '<p class="muted">No client websites assigned yet. Click "Assign Website" to add one.</p>';
            return;
        }

        let html = '<table class="data-table"><thead><tr><th>Project</th><th>Client</th><th>Domain</th><th>Type</th><th>Status</th><th>Annual Fee</th><th>Billing</th><th>Actions</th></tr></thead><tbody>';
        for (const p of clientProjects) {
            const statusClass = p.status === 'deployed' ? 'badge-success' :
                p.status === 'in_development' ? 'badge-warning' :
                p.status === 'maintenance' ? 'badge-success' :
                p.status === 'paused' ? 'badge-neutral' : 'badge-neutral';
            const billingClass = p.billing_active ? 'badge-success' : 'badge-neutral';
            const fee = p.management_fee_mwk ? 'MK ' + p.management_fee_mwk.toLocaleString() : 'N/A';
            html += `<tr>
                <td>${p.project_name}</td>
                <td>${p.customer_name || 'Unassigned'}</td>
                <td>${p.domain || 'N/A'}</td>
                <td>${(p.project_type || '').replace('_', ' ')}</td>
                <td><span class="badge ${statusClass}">${(p.status || '').replace('_', ' ')}</span></td>
                <td>${fee}</td>
                <td><span class="badge ${billingClass}">${p.billing_active ? 'active' : 'inactive'}</span></td>
                <td>
                    <button class="btn btn-sm btn-ghost" onclick="editProject('${p.id}')">Edit</button>
                    <button class="btn btn-sm btn-ghost" onclick="deleteProject('${p.id}')" style="color: var(--danger);">Delete</button>
                </td>
            </tr>`;
        }
        html += '</tbody></table>';
        list.innerHTML = html;
    } catch (err) {
        document.getElementById('clientProjectsList').innerHTML = '<p class="muted">Unable to load projects: ' + err.message + '</p>';
    }
}

function openProjectEditor() {
    document.getElementById('projectModal').classList.remove('hidden');
    document.getElementById('projectModalTitle').textContent = 'Assign Website to Client';
    document.getElementById('projectId').value = '';
    document.getElementById('projectForm').reset();
    document.getElementById('projectFee').value = '500000';
}

function closeProjectModal() {
    document.getElementById('projectModal').classList.add('hidden');
}

async function editProject(id) {
    const p = clientProjects.find(x => x.id === id);
    if (!p) return;

    document.getElementById('projectModal').classList.remove('hidden');
    document.getElementById('projectModalTitle').textContent = 'Edit: ' + p.project_name;
    document.getElementById('projectId').value = p.id;
    document.getElementById('projectCustomer').value = p.customer_id || '';
    document.getElementById('projectName').value = p.project_name || '';
    document.getElementById('projectDomain').value = p.domain || '';
    document.getElementById('projectType').value = p.project_type || 'custom_website';
    document.getElementById('projectStatus').value = p.status || 'planning';
    document.getElementById('projectFee').value = p.management_fee_mwk || 500000;
    document.getElementById('projectBillingCycle').value = p.billing_cycle || 'annual';
    document.getElementById('projectDescription').value = p.description || '';
    document.getElementById('projectBillingActive').checked = p.billing_active !== false;
    document.getElementById('projectNotes').value = p.notes || '';
}

async function deleteProject(id) {
    if (!confirm('Delete this project? This cannot be undone.')) return;
    try {
        await api('/api/admin?action=projects?id=' + id, 'DELETE');
        loadClientProjects();
    } catch (err) {
        alert('Failed to delete: ' + err.message);
    }
}

// Project form submit
document.addEventListener('DOMContentLoaded', () => {
    const projectForm = document.getElementById('projectForm');
    if (projectForm) {
        projectForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('projectId').value;
            const techStr = '';
            const data = {
                customerId: document.getElementById('projectCustomer').value || null,
                projectName: document.getElementById('projectName').value,
                domain: document.getElementById('projectDomain').value,
                projectType: document.getElementById('projectType').value,
                status: document.getElementById('projectStatus').value,
                managementFeeMwk: parseInt(document.getElementById('projectFee').value) || 500000,
                billingCycle: document.getElementById('projectBillingCycle').value,
                description: document.getElementById('projectDescription').value,
                billingActive: document.getElementById('projectBillingActive').checked,
                notes: document.getElementById('projectNotes').value,
                technologies: []
            };
            if (id) data.id = id;

            try {
                await api('/api/admin?action=projects', id ? 'PUT' : 'POST', data);
                closeProjectModal();
                loadClientProjects();
            } catch (err) {
                alert('Failed to save: ' + err.message);
            }
        });
    }

    const invoiceForm = document.getElementById('invoiceForm');
    if (invoiceForm) {
        invoiceForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                customerId: document.getElementById('invoiceCustomer').value || null,
                description: document.getElementById('invoiceDescription').value,
                amountMwk: parseInt(document.getElementById('invoiceAmount').value) || 0,
                billingPeriod: document.getElementById('invoiceBillingPeriod').value,
                dueDate: document.getElementById('invoiceDueDate').value || null,
                notes: document.getElementById('invoiceNotes').value
            };

            try {
                await api('/api/admin?action=invoices', 'POST', data);
                closeInvoiceModal();
                loadInvoices();
            } catch (err) {
                alert('Failed to create invoice: ' + err.message);
            }
        });
    }
});

// ===================================
// INVOICES
// ===================================

let adminInvoices = [];

async function loadInvoices() {
    try {
        const data = await api('/api/admin?action=invoices');
        adminInvoices = data.invoices || [];

        // Update overview stats
        const pending = adminInvoices.filter(i => i.status === 'pending' || i.status === 'overdue').length;
        document.getElementById('statPendingInvoices').textContent = pending;

        const list = document.getElementById('invoicesList');
        if (!adminInvoices.length) {
            list.innerHTML = '<p class="muted">No invoices yet. Invoices are auto-generated when you assign a website with billing active, or you can create one manually.</p>';
            return;
        }

        let html = '<table class="data-table"><thead><tr><th>Invoice #</th><th>Client</th><th>Description</th><th>Amount</th><th>Period</th><th>Status</th><th>Due Date</th><th>Actions</th></tr></thead><tbody>';
        for (const inv of adminInvoices) {
            const statusClass = inv.status === 'paid' ? 'badge-success' :
                inv.status === 'overdue' ? 'badge-danger' :
                inv.status === 'pending' ? 'badge-warning' : 'badge-neutral';
            const amount = 'MK ' + inv.amount_mwk.toLocaleString();
            const due = inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'N/A';
            html += `<tr>
                <td style="font-family: var(--font-mono); font-size: 0.8rem;">${inv.invoice_number}</td>
                <td>${inv.customer_name || 'N/A'}</td>
                <td>${inv.description}</td>
                <td>${amount}</td>
                <td>${inv.billing_period || ''}</td>
                <td><span class="badge ${statusClass}">${inv.status}</span></td>
                <td>${due}</td>
                <td>
                    ${inv.status === 'pending' || inv.status === 'overdue'
                        ? `<button class="btn btn-sm btn-ghost" onclick="markInvoicePaid('${inv.id}')" style="color: var(--success);">Mark Paid</button>`
                        : ''}
                </td>
            </tr>`;
        }
        html += '</tbody></table>';
        list.innerHTML = html;
    } catch (err) {
        document.getElementById('invoicesList').innerHTML = '<p class="muted">Unable to load invoices: ' + err.message + '</p>';
    }
}

function openInvoiceEditor() {
    document.getElementById('invoiceModal').classList.remove('hidden');
    document.getElementById('invoiceForm').reset();
    document.getElementById('invoiceAmount').value = '500000';

    // Default due date to 30 days from now
    const due = new Date();
    due.setDate(due.getDate() + 30);
    document.getElementById('invoiceDueDate').value = due.toISOString().split('T')[0];
}

function closeInvoiceModal() {
    document.getElementById('invoiceModal').classList.add('hidden');
}

async function markInvoicePaid(id) {
    try {
        await api('/api/admin?action=invoices', 'PUT', { id, status: 'paid', paymentMethod: 'manual' });
        loadInvoices();
    } catch (err) {
        alert('Failed to update: ' + err.message);
    }
}

// ===================================
// VIEW SWITCHING — hook into existing nav
// ===================================

const originalSwitchView = window.switchView || function() {};
document.addEventListener('DOMContentLoaded', () => {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            if (view === 'clients') loadClients();
            if (view === 'clientsites') loadClientProjects();
            if (view === 'invoices') loadInvoices();
        });
    });

    // Also load on initial dashboard show
    setTimeout(() => {
        if (document.getElementById('dashboard') && !document.getElementById('dashboard').classList.contains('hidden')) {
            loadClients();
            loadInvoices();
        }
    }, 500);
});

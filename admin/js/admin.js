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
        await fetchContent();
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
    renderAbout();
    renderMessages();
}

function renderOverview() {
    document.getElementById('statProjects').textContent = content.projects?.length || 0;
    document.getElementById('statServices').textContent = content.services?.length || 0;
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
                <span class="data-item-tag">${escape(p.tag)}${p.featured ? ' · <span class=\'featured-badge\'>★ Featured</span>' : ''}</span>
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
                <h3><span style="font-size:1.3rem;margin-right:8px">${escape(s.icon)}</span>${escape(s.title)}</h3>
                <p>${escape(s.desc)}</p>
            </div>
            <div class="data-item-actions">
                <button class="btn btn-ghost" onclick="openServiceEditor('${s.id}')">Edit</button>
                <button class="btn btn-danger" onclick="deleteService('${s.id}')">Delete</button>
            </div>
        </div>
    `).join('');
}

function renderAbout() {
    const about = content.about || {};
    document.getElementById('aboutHeading').value = about.heading || '';
    document.getElementById('aboutP1').value = about.paragraphs?.[0] || '';
    document.getElementById('aboutP2').value = about.paragraphs?.[1] || '';
    document.getElementById('aboutGithub').value = about.githubUrl || '';

    const statsEditor = document.getElementById('statsEditor');
    const stats = content.stats || [];
    statsEditor.innerHTML = stats.map((s, i) => `
        <div class="stat-edit-row">
            <input type="text" value="${escape(s.num)}" data-stat="num" data-idx="${i}" placeholder="∞">
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
        document.getElementById('serviceIcon').value = s.icon;
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
        icon: document.getElementById('serviceIcon').value,
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
        githubUrl: document.getElementById('aboutGithub').value
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

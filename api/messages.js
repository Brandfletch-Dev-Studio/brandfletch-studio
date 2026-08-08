// /api/messages — Handle contact form submissions and list messages
// Stores messages in content.json via GitHub API

const crypto = require('crypto');

const REPO_OWNER = 'Brandfletch-Dev-Studio';
const REPO_NAME = 'brandfletch-studio';
const FILE_PATH = 'content.json';

function verifyToken(token, secret) {
    if (!token) return null;
    const [data, sig] = token.split('.');
    if (!data || !sig) return null;
    const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
    if (sig !== expected) return null;
    try {
        const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
        if (payload.exp && Date.now() > payload.exp) return null;
        return payload;
    } catch {
        return null;
    }
}

function getAuthHeader(req) {
    const auth = req.headers.authorization || '';
    return auth.replace('Bearer ', '');
}

async function fetchContent() {
    const token = process.env.GITHUB_TOKEN;
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
    const res = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'Brandfletch-Admin'
        }
    });
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
    const data = await res.json();
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    return { content: JSON.parse(content), sha: data.sha };
}

async function updateContent(newContent, sha) {
    const token = process.env.GITHUB_TOKEN;
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
    const res = await fetch(url, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'Brandfletch-Admin',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: 'New contact form message',
            content: Buffer.from(JSON.stringify(newContent, null, 2)).toString('base64'),
            sha: sha
        })
    });
    if (!res.ok) throw new Error(`GitHub update error: ${res.status}`);
    return res.json();
}

module.exports = async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    const adminPassword = process.env.ADMIN_PASSWORD;

    // POST — submit a new message (public, no auth)
    if (req.method === 'POST') {
        const { name, email, subject, message } = req.body || {};

        if (!name || !email || !subject || !message) {
            res.status(400).json({ error: 'All fields are required' });
            return;
        }

        if (message.length > 5000 || subject.length > 200) {
            res.status(400).json({ error: 'Message too long' });
            return;
        }

        try {
            const { content, sha } = await fetchContent();
            const newMsg = {
                id: 'm' + Date.now(),
                name: String(name).slice(0, 100),
                email: String(email).slice(0, 200),
                subject: String(subject).slice(0, 200),
                message: String(message).slice(0, 5000),
                date: new Date().toISOString(),
                read: false
            };
            content.messages = content.messages || [];
            content.messages.unshift(newMsg);
            // Keep max 500 messages
            if (content.messages.length > 500) {
                content.messages = content.messages.slice(0, 500);
            }
            await updateContent(content, sha);
            res.status(200).json({ success: true, message: 'Message sent' });
        } catch (err) {
            res.status(500).json({ error: 'Failed to save message' });
        }
        return;
    }

    // GET — list messages (requires auth)
    if (req.method === 'GET') {
        const token = getAuthHeader(req);
        if (!verifyToken(token, adminPassword)) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        try {
            const { content } = await fetchContent();
            res.status(200).json(content.messages || []);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
        return;
    }

    // PATCH — mark message as read/unread or delete (requires auth)
    if (req.method === 'PATCH') {
        const token = getAuthHeader(req);
        if (!verifyToken(token, adminPassword)) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        const { id, action } = req.body || {};
        if (!id || !action) {
            res.status(400).json({ error: 'Missing id or action' });
            return;
        }
        try {
            const { content, sha } = await fetchContent();
            content.messages = content.messages || [];
            if (action === 'toggleRead') {
                const msg = content.messages.find(m => m.id === id);
                if (msg) msg.read = !msg.read;
            } else if (action === 'delete') {
                content.messages = content.messages.filter(m => m.id !== id);
            }
            await updateContent(content, sha);
            res.status(200).json({ success: true, messages: content.messages });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
        return;
    }

    res.status(405).json({ error: 'Method not allowed' });
};

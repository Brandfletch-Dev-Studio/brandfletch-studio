// /api/content — Read and update site content
// Uses GitHub API to read/write content.json in the repo
// GET is public (the homepage needs it) but strips private message data
// unless the caller is authenticated. PUT always requires auth.

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
            message: 'Update site content via admin panel',
            content: Buffer.from(JSON.stringify(newContent, null, 2)).toString('base64'),
            sha: sha
        })
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`GitHub update error: ${res.status} ${err}`);
    }
    return res.json();
}

module.exports = async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    const token = getAuthHeader(req);
    const adminPassword = process.env.ADMIN_PASSWORD;
    const isAuthed = !!verifyToken(token, adminPassword);

    // GET — read content. Public (homepage needs it), but only an
    // authenticated admin gets the private `messages` array back.
    if (req.method === 'GET') {
        try {
            const { content } = await fetchContent();
            if (!isAuthed) {
                const { messages, ...publicContent } = content;
                res.status(200).json(publicContent);
            } else {
                res.status(200).json(content);
            }
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
        return;
    }

    // PUT — update content (requires auth)
    if (req.method === 'PUT') {
        if (!isAuthed) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        try {
            const { sha } = await fetchContent();
            const newContent = req.body;
            await updateContent(newContent, sha);
            res.status(200).json({ success: true, message: 'Content updated' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
        return;
    }

    res.status(405).json({ error: 'Method not allowed' });
};

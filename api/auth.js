// /api/auth — Login endpoint
// Verifies password and returns a signed token

const crypto = require('crypto');

function signToken(payload, secret) {
    const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
    return `${data}.${sig}`;
}

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

module.exports = (req, res) => {
    // Handle OPTIONS for CORS
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const { password } = req.body || {};

    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
        res.status(500).json({ error: 'Admin password not configured' });
        return;
    }

    if (password !== adminPassword) {
        res.status(401).json({ error: 'Invalid password' });
        return;
    }

    const token = signToken(
        { exp: Date.now() + 7 * 24 * 60 * 60 * 1000, role: 'admin' },
        adminPassword
    );

    res.status(200).json({ token });
};

// Export verify for use by other endpoints
module.exports.verifyToken = verifyToken;
module.exports.signToken = signToken;

// /api/domains/check — Check domain availability via RDAP
// No authentication needed — uses the free RDAP protocol.
// GET /api/domains/check?domain=example.com

module.exports = async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    const domain = (req.query.domain || '').toLowerCase().trim();

    if (!domain) {
        res.status(400).json({ error: 'Domain parameter is required' });
        return;
    }

    // Basic domain validation
    const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z]{2,})+$/;
    if (!domainRegex.test(domain)) {
        res.status(400).json({ error: 'Invalid domain format' });
        return;
    }

    try {
        const rdapUrl = `https://rdap.org/domain/${domain}`;
        const response = await fetch(rdapUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/rdap+json' },
            signal: AbortSignal.timeout(8000)
        });

        if (response.status === 404) {
            res.status(200).json({
                domain,
                available: true,
                message: 'Domain is available for registration'
            });
        } else if (response.ok) {
            const data = await response.json();
            const registrar = data.events?.find(e => e.eventAction === 'registration');
            const expiry = data.events?.find(e => e.eventAction === 'expiration');

            res.status(200).json({
                domain,
                available: false,
                message: 'Domain is already registered',
                registered: true,
                registrar: registrar?.eventActor || null,
                expiresAt: expiry?.eventDate || null
            });
        } else {
            res.status(200).json({
                domain,
                available: true,
                message: 'Domain appears to be available'
            });
        }
    } catch (err) {
        res.status(200).json({
            domain,
            available: null,
            message: 'Could not verify domain status. Proceed with manual verification.',
            error: err.message
        });
    }
};

// /api/domains/check — Check domain availability
// Uses name.com API when configured (real availability + real registry price).
// Falls back to free RDAP lookup if name.com credentials are not set.
// GET /api/domains/check?domain=example.com

const { checkAvailability } = require('../lib/namecom');

const MWK_PER_USD = 6000;
const MARKUP = 1.15; // 15% markup over registry cost

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

    // Prefer name.com — gives real availability and real registry pricing
    if (process.env.NAMECOM_USERNAME && process.env.NAMECOM_API_TOKEN) {
        try {
            const result = await checkAvailability(domain);

            if (!result.purchasable) {
                res.status(200).json({
                    domain,
                    available: false,
                    message: result.premium ? 'Domain is a premium listing' : 'Domain is already registered',
                    premium: result.premium
                });
                return;
            }

            const priceUsd = result.purchasePrice || 0;
            const priceMwk = Math.round(priceUsd * MWK_PER_USD * MARKUP);

            res.status(200).json({
                domain,
                available: true,
                message: 'Domain is available for registration',
                premium: result.premium,
                priceMwk,
                priceUsd,
                source: 'namecom'
            });
            return;
        } catch (err) {
            console.error('name.com availability check failed, falling back to RDAP:', err.message);
            // fall through to RDAP fallback below
        }
    }

    // Fallback — free RDAP lookup (availability only, no live pricing)
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
                message: 'Domain is available for registration',
                source: 'rdap'
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
                expiresAt: expiry?.eventDate || null,
                source: 'rdap'
            });
        } else {
            res.status(200).json({
                domain,
                available: true,
                message: 'Domain appears to be available',
                source: 'rdap'
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

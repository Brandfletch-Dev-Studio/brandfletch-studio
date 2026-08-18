// /api/domains/check — Check domain availability
// Uses Namecheap API when configured (real availability + premium pricing).
// Falls back to free RDAP lookup if Namecheap credentials are not set.
// GET /api/domains/check?domain=example.com

const MWK_PER_USD = 6000;
const DOMAIN_MARKUP = 1.15;

// Fixed domain pricing per year (at MWK 6000/$ with 15% markup)
const DOMAIN_PRICES = {
    '.com': 15000, '.net': 16000, '.org': 14000,
    '.co': 20000, '.io': 42000, '.biz': 12000,
    '.info': 12000, '.co.uk': 8000, '.org.uk': 8000,
    '.me': 18000, '.xyz': 10000, '.online': 25000,
    '.store': 40000, '.tech': 35000, '.site': 12000
};

function getDomainPriceFallback(domain) {
    const parts = domain.split('.');
    if (parts.length >= 3) {
        const tld2 = '.' + parts.slice(-2).join('.');
        if (DOMAIN_PRICES[tld2]) return DOMAIN_PRICES[tld2];
    }
    const tld = '.' + parts[parts.length - 1];
    return DOMAIN_PRICES[tld] || 18000;
}

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

    const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z]{2,})+$/;
    if (!domainRegex.test(domain)) {
        res.status(400).json({ error: 'Invalid domain format' });
        return;
    }

    // Prefer Namecheap — gives real availability
    const { checkAvailability, isConfigured } = require('../lib/namecheap');
    if (isConfigured()) {
        try {
            const result = await checkAvailability(domain);

            if (!result.available) {
                res.status(200).json({
                    domain,
                    available: false,
                    message: result.premium ? 'Domain is a premium listing' : 'Domain is already registered',
                    premium: result.premium
                });
                return;
            }

            // Pricing: use premium price from Namecheap if available, else fallback table
            let priceMwk;
            let priceUsd = null;
            if (result.premium && result.premiumPriceUsd) {
                priceUsd = result.premiumPriceUsd;
                priceMwk = Math.round(priceUsd * MWK_PER_USD * DOMAIN_MARKUP);
            } else {
                priceMwk = getDomainPriceFallback(domain);
            }

            res.status(200).json({
                domain,
                available: true,
                message: 'Domain is available for registration',
                premium: result.premium,
                priceMwk,
                priceUsd,
                source: 'namecheap'
            });
            return;
        } catch (err) {
            console.error('Namecheap availability check failed, falling back to RDAP:', err.message);
        }
    }

    // Fallback — free RDAP lookup (availability only, no live pricing)
    try {
        const rdapUrl = 'https://rdap.org/domain/' + domain;
        const response = await fetch(rdapUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/rdap+json' },
            signal: AbortSignal.timeout(8000)
        });

        if (response.status === 404) {
            const priceMwk = getDomainPriceFallback(domain);
            res.status(200).json({
                domain,
                available: true,
                message: 'Domain is available for registration',
                priceMwk,
                source: 'rdap'
            });
        } else if (response.ok) {
            const data = await response.json();
            const registrar = data.events && data.events.find(e => e.eventAction === 'registration');
            const expiry = data.events && data.events.find(e => e.eventAction === 'expiration');

            res.status(200).json({
                domain,
                available: false,
                message: 'Domain is already registered',
                registered: true,
                registrar: registrar ? registrar.eventActor : null,
                expiresAt: expiry ? expiry.eventDate : null,
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

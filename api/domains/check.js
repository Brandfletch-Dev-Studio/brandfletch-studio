// /api/domains/check — Check domain availability
// Uses Namecheap API when configured (real availability + premium pricing).
// Falls back to free RDAP lookup if Namecheap credentials are not set.
// Domain pricing is admin-configured via content.json (domainPricing array).
// GET /api/domains/check?domain=example.com

const MWK_PER_USD = 6000;
const DOMAIN_MARKUP = 1.15;

function getContent() {
    try {
        const fs = require('fs');
        const path = require('path');
        const raw = fs.readFileSync(path.join(process.cwd(), 'content.json'), 'utf-8');
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

function getDomainPriceFromConfig(domain) {
    const content = getContent();
    const pricing = content.domainPricing || [];
    const parts = domain.split('.');
    const tld = parts.length >= 3
        ? '.' + parts.slice(-2).join('.')
        : '.' + parts[parts.length - 1];

    // Try exact TLD match first (e.g. .co.uk), then single-level
    for (const entry of pricing) {
        if (entry.tld === tld && entry.priceMwk) {
            return entry.priceMwk;
        }
    }
    const simpleTld = '.' + parts[parts.length - 1];
    for (const entry of pricing) {
        if (entry.tld === simpleTld && entry.priceMwk) {
            return entry.priceMwk;
        }
    }

    // No match — return null (price determined manually)
    return null;
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

    // Get admin-configured price for this domain
    const configuredPrice = getDomainPriceFromConfig(domain);

    // Prefer Namecheap — gives real availability
    const { checkAvailability, isConfigured } = require('../../lib/namecheap');
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

            // Pricing: use premium price from Namecheap if available, else admin config, else null
            let priceMwk = null;
            let priceUsd = null;
            if (result.premium && result.premiumPriceUsd) {
                priceUsd = result.premiumPriceUsd;
                priceMwk = Math.round(priceUsd * MWK_PER_USD * DOMAIN_MARKUP);
            } else {
                priceMwk = configuredPrice;
            }

            res.status(200).json({
                domain,
                available: true,
                message: priceMwk ? 'Domain is available for registration' : 'Domain is available — pricing confirmed at checkout',
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

    // Fallback — free RDAP lookup (availability only)
    try {
        const rdapUrl = 'https://rdap.org/domain/' + domain;
        const response = await fetch(rdapUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/rdap+json' },
            signal: AbortSignal.timeout(8000)
        });

        if (response.status === 404) {
            res.status(200).json({
                domain,
                available: true,
                message: configuredPrice ? 'Domain is available for registration' : 'Domain is available — pricing confirmed at checkout',
                priceMwk: configuredPrice,
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
                priceMwk: configuredPrice,
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

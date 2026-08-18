// api/lib/namecom.js — name.com Domain API v4 client
// Docs: https://www.name.com/api-docs/domains
// Auth: HTTP Basic (username:token)
// Production base: https://api.name.com/v4
// Dev/test base: https://api.dev.name.com/v4

function getConfig() {
    const username = process.env.NAMECOM_USERNAME;
    const token = process.env.NAMECOM_API_TOKEN;
    const useDev = process.env.NAMECOM_ENV === 'dev';
    const baseUrl = useDev ? 'https://api.dev.name.com/v4' : 'https://api.name.com/v4';

    if (!username || !token) {
        throw new Error('name.com API credentials not configured');
    }

    return { username, token, baseUrl };
}

function authHeader(username, token) {
    return 'Basic ' + Buffer.from(`${username}:${token}`).toString('base64');
}

// Check whether a domain is purchasable and get the real registry price (USD)
async function checkAvailability(domainName) {
    const { username, token, baseUrl } = getConfig();

    const response = await fetch(`${baseUrl}/domains:checkAvailability`, {
        method: 'POST',
        headers: {
            'Authorization': authHeader(username, token),
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ domainNames: [domainName] }),
        signal: AbortSignal.timeout(10000)
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || `name.com checkAvailability failed (${response.status})`);
    }

    const result = (data.results || [])[0];
    if (!result) {
        throw new Error('No availability result returned for domain');
    }

    return {
        domainName: result.domainName,
        purchasable: !!result.purchasable,
        premium: !!result.premium,
        purchasePrice: result.purchasePrice,   // USD
        renewalPrice: result.renewalPrice,     // USD
        purchaseType: result.purchaseType || 'registration'
    };
}

// Register (purchase) a domain. Registers under the account's default
// registrant contact — Brandfletch Dev Studio is listed as registrant.
async function createDomain(domainName, { years = 1, purchasePrice, purchaseType = 'registration' } = {}) {
    const { username, token, baseUrl } = getConfig();

    const body = {
        domain: { domainName },
        years,
        purchaseType
    };

    // purchasePrice is required for premium domains / non-standard purchase types
    if (purchasePrice !== undefined) {
        body.purchasePrice = purchasePrice;
    }

    const response = await fetch(`${baseUrl}/domains`, {
        method: 'POST',
        headers: {
            'Authorization': authHeader(username, token),
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000)
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || `name.com domain purchase failed (${response.status})`);
    }

    return {
        success: true,
        domainName: data.domain?.domainName || domainName,
        order: data.order,
        totalPaid: data.totalPaid,
        expireDate: data.domain?.expireDate
    };
}

// Point a registered domain's nameservers at the hosting server
async function setNameservers(domainName, nameservers) {
    const { username, token, baseUrl } = getConfig();

    const response = await fetch(`${baseUrl}/domains/${domainName}:setNameservers`, {
        method: 'POST',
        headers: {
            'Authorization': authHeader(username, token),
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ nameservers }),
        signal: AbortSignal.timeout(15000)
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || `name.com setNameservers failed (${response.status})`);
    }

    return { success: true, domainName, nameservers };
}

module.exports = { checkAvailability, createDomain, setNameservers };

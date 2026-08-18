// /api/provision/whm — Create a cPanel account via WHM API 1
// Called internally by the verify endpoint after payment confirmation.

// WHM API 1 createacct:
// GET https://server:2087/json-api/createacct?api.version=1&username=X&domain=X&plan=X&password=X&contactemail=X
// Auth header: "Authorization: whm username:APITOKEN"

async function createCpanelAccount(order) {
    const WHM_HOST = process.env.WHM_HOST;
    const WHM_USER = process.env.WHM_USER;
    const WHM_TOKEN = process.env.WHM_API_TOKEN;

    if (!WHM_HOST || !WHM_USER || !WHM_TOKEN) {
        throw new Error('WHM credentials not configured');
    }

    const params = new URLSearchParams({
        'api.version': '1',
        username: order.cpanelUser,
        domain: order.domain,
        plan: order.whmPlan,
        password: order.cpanelPassword,
        contactemail: order.email
    });

    const url = `https://${WHM_HOST}:2087/json-api/createacct?${params.toString()}`;

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `whm ${WHM_USER}:${WHM_TOKEN}`,
            'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(30000)
    });

    const data = await response.json();

    if (data.metadata && data.metadata.result === 1) {
        return {
            success: true,
            username: order.cpanelUser,
            domain: order.domain,
            message: 'cPanel account created successfully'
        };
    } else {
        const errMsg = data.metadata?.reason || data.errors?.join(', ') || 'Unknown WHM API error';
        throw new Error(`WHM provisioning failed: ${errMsg}`);
    }
}

// Register a domain via ResellerClub API
// ResellerClub API is free for resellers
// https://http.kb.corelogic.com/kb/resellerclub/api
async function registerDomain(order) {
    const RESELLER_ID = process.env.RESELLERCLUB_ID;
    const RESELLER_KEY = process.env.RESELLERCLUB_API_KEY;

    if (!RESELLER_ID || !RESELLER_KEY) {
        throw new Error('Domain registrar not configured');
    }

    // ResellerClub API — register domain
    // This is a simplified version. The full flow requires:
    // 1. Check availability
    // 2. Add funds to reseller account
    // 3. Register domain with customer details
    // For now, we return a pending status and handle manually
    return {
        success: false,
        pending: true,
        domain: order.domain,
        message: 'Domain registration requires manual completion. Account created but domain DNS needs manual configuration.'
    };
}

module.exports = { createCpanelAccount, registerDomain };

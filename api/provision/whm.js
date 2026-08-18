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

// Register a domain via name.com API and point it at our hosting nameservers.
// Domain is registered under the Brandfletch Dev Studio account as registrant.
const { createDomain, setNameservers } = require('../lib/namecom');

// Nameservers your reseller hosting plan uses for cPanel/WordPress hosting.
// Update these to match unlimitedwebhosting.co.uk's assigned nameservers.
const HOSTING_NAMESERVERS = (process.env.HOSTING_NAMESERVERS || '')
    .split(',')
    .map(ns => ns.trim())
    .filter(Boolean);

async function registerDomain(order) {
    if (!process.env.NAMECOM_USERNAME || !process.env.NAMECOM_API_TOKEN) {
        return {
            success: false,
            pending: true,
            domain: order.domain,
            message: 'Domain registrar not configured. Account created but domain needs manual registration.'
        };
    }

    try {
        const purchaseOptions = { years: 1 };
        if (order.domainPurchasePriceUsd) {
            purchaseOptions.purchasePrice = order.domainPurchasePriceUsd;
        }

        const result = await createDomain(order.domain, purchaseOptions);

        // Point the new domain at our hosting nameservers so the site resolves
        if (HOSTING_NAMESERVERS.length >= 2) {
            try {
                await setNameservers(order.domain, HOSTING_NAMESERVERS);
                result.nameserversSet = true;
            } catch (nsErr) {
                console.error('setNameservers failed:', nsErr.message);
                result.nameserversSet = false;
                result.nameserverError = nsErr.message;
            }
        }

        return {
            success: true,
            domain: order.domain,
            order: result.order,
            totalPaid: result.totalPaid,
            nameserversSet: result.nameserversSet || false,
            message: 'Domain registered successfully'
        };
    } catch (err) {
        return {
            success: false,
            pending: true,
            domain: order.domain,
            message: `Domain registration failed: ${err.message}. Account created but domain needs manual registration.`
        };
    }
}

module.exports = { createCpanelAccount, registerDomain };

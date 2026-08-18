// /api/provision/whm — Create a cPanel account via WHM API 1
// Called internally by the verify endpoint after payment confirmation.

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

    const url = 'https://' + WHM_HOST + ':2087/json-api/createacct?' + params.toString();

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': 'whm ' + WHM_USER + ':' + WHM_TOKEN,
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
        const errMsg = (data.metadata && data.metadata.reason) || (data.errors && data.errors.join(', ')) || 'Unknown WHM API error';
        throw new Error('WHM provisioning failed: ' + errMsg);
    }
}

// Register a domain via Namecheap API and point it at our hosting nameservers.
// Domain is registered under the Brandfletch Dev Studio Namecheap account.
const { createDomain, setNameservers } = require('../lib/namecheap');

const HOSTING_NAMESERVERS = (process.env.HOSTING_NAMESERVERS || '')
    .split(',')
    .map(ns => ns.trim())
    .filter(Boolean);

async function registerDomain(order) {
    if (!process.env.NAMECHEAP_API_USER || !process.env.NAMECHEAP_API_KEY) {
        return {
            success: false,
            pending: true,
            domain: order.domain,
            message: 'Domain registrar not configured. Account created but domain needs manual registration.'
        };
    }

    try {
        // Register domain with hosting nameservers set during creation
        const result = await createDomain(order.domain, {
            years: 1,
            nameservers: HOSTING_NAMESERVERS
        });

        // If nameservers weren't set during create (less than 2 provided),
        // try setting them separately
        if (HOSTING_NAMESERVERS.length >= 2 && !result.nameserversSet) {
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
            orderId: result.orderId,
            transactionId: result.transactionId,
            chargedAmount: result.chargedAmount,
            nameserversSet: result.nameserversSet || (HOSTING_NAMESERVERS.length >= 2),
            message: 'Domain registered successfully'
        };
    } catch (err) {
        return {
            success: false,
            pending: true,
            domain: order.domain,
            message: 'Domain registration failed: ' + err.message + '. Account created but domain needs manual registration.'
        };
    }
}

module.exports = { createCpanelAccount, registerDomain };

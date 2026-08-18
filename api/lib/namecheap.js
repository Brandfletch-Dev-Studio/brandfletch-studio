// api/lib/namecheap.js — Namecheap Domain API client
// Docs: https://www.namecheap.com/support/api/intro/
//
// Two modes:
// 1. PROXY mode (recommended): Routes through a PHP proxy on the WHM server
//    whose static IP is whitelisted in Namecheap. Vercel only needs the
//    proxy URL + shared secret. API credentials stay on the server.
//    Env: NAMECHEAP_PROXY_URL + NAMECHEAP_PROXY_SECRET
//
// 2. DIRECT mode: Calls Namecheap API directly. Requires Vercel's IP
//    to be whitelisted in Namecheap (dynamic IPs — may not work reliably).
//    Env: NAMECHEAP_API_USER + NAMECHEAP_API_KEY + NAMECHEAP_CLIENT_IP

const MWK_PER_USD = 6000;
const DOMAIN_MARKUP = 1.15;

function getConfig() {
    const proxyUrl = process.env.NAMECHEAP_PROXY_URL;
    const proxySecret = process.env.NAMECHEAP_PROXY_SECRET;

    if (proxyUrl && proxySecret) {
        return { mode: 'proxy', proxyUrl, proxySecret };
    }

    const apiUser = process.env.NAMECHEAP_API_USER;
    const apiKey = process.env.NAMECHEAP_API_KEY;
    const clientIp = process.env.NAMECHEAP_CLIENT_IP;
    const sandbox = process.env.NAMECHEAP_SANDBOX === 'true';
    const baseUrl = sandbox
        ? 'https://api.sandbox.namecheap.com/xml.response'
        : 'https://api.namecheap.com/xml.response';

    if (!apiUser || !apiKey) {
        throw new Error('Namecheap API not configured — set either NAMECHEAP_PROXY_URL+SECRET or NAMECHEAP_API_USER+KEY');
    }

    return { mode: 'direct', apiUser, apiKey, clientIp, baseUrl };
}

// Core API call — handles both proxy and direct modes
async function apiCall(command, extraParams) {
    const config = getConfig();

    if (config.mode === 'proxy') {
        // Proxy mode: send JSON { command, params } with Bearer token
        const response = await fetch(config.proxyUrl, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + config.proxySecret,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ command, params: extraParams || {} }),
            signal: AbortSignal.timeout(30000)
        });

        const xml = await response.text();

        if (!response.ok) {
            let errMsg = 'Proxy error (' + response.status + ')';
            try {
                const j = JSON.parse(xml);
                if (j.error) errMsg = j.error;
            } catch (e) {
                // Response is XML — check for API error
            }
            throw new Error(errMsg);
        }

        return xml;
    } else {
        // Direct mode: form-encoded POST with auth params
        const params = {
            ApiUser: config.apiUser,
            ApiKey: config.apiKey,
            UserName: config.apiUser,
            ClientIp: config.clientIp || '127.0.0.1',
            Command: command,
            ...(extraParams || {})
        };

        const body = new URLSearchParams(params).toString();

        const response = await fetch(config.baseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
            signal: AbortSignal.timeout(30000)
        });

        return response.text();
    }
}

// --- XML helpers (lightweight, no external deps) ---

function xmlAttr(xml, tag, attr) {
    const re = new RegExp('<' + tag + '\\b[^>]*\\b' + attr + '="([^"]*)"', 'i');
    const m = xml.match(re);
    return m ? m[1] : null;
}

function xmlTagAttrs(xml, tag) {
    const re = new RegExp('<' + tag + '\\b([^>]*)/?>', 'i');
    const m = xml.match(re);
    if (!m) return null;
    const attrStr = m[1];
    const attrs = {};
    const attrRe = /(\w+)="([^"]*)"/g;
    let am;
    while ((am = attrRe.exec(attrStr)) !== null) {
        attrs[am[1]] = am[2];
    }
    return attrs;
}

function checkApiStatus(xml) {
    const status = xmlAttr(xml, 'ApiResponse', 'Status');
    if (status !== 'OK') {
        const errNo = xml.match(/<Error\s+Number="(\d+)"/i);
        const errMsg = xml.match(/<Error>(.*?)<\/Error>/is);
        const msg = errMsg ? errMsg[1].trim() : 'Unknown Namecheap API error';
        const num = errNo ? errNo[1] : '';
        throw new Error('Namecheap API error' + (num ? ' #' + num : '') + ': ' + msg);
    }
    return true;
}

// --- API methods ---

async function checkAvailability(domainName) {
    const xml = await apiCall('namecheap.domains.check', {
        DomainList: domainName
    });
    checkApiStatus(xml);

    const attrs = xmlTagAttrs(xml, 'DomainCheckResult');
    if (!attrs) {
        throw new Error('No domain check result in Namecheap response');
    }

    const available = attrs.Available === 'true';
    const isPremium = attrs.IsPremium === 'true';
    const premiumPrice = attrs.PremiumRegistrationPrice
        ? parseFloat(attrs.PremiumRegistrationPrice)
        : null;

    return {
        domainName,
        available,
        premium: isPremium,
        premiumPriceUsd: premiumPrice
    };
}

async function createDomain(domainName, opts) {
    opts = opts || {};
    const years = opts.years || 1;
    const nameservers = opts.nameservers || [];

    const params = {
        DomainName: domainName,
        Years: String(years),
        AddFreeWhoisguard: 'yes',
        WGEnabled: 'yes'
    };

    if (nameservers.length >= 2) {
        params.Nameserver1 = nameservers[0];
        params.Nameserver2 = nameservers[1];
    }

    // Contact info — in proxy mode, the proxy server can inject these.
    // In direct mode, they come from Vercel env vars.
    if (process.env.NAMECHEAP_CONTACT_FIRST_NAME)
        params.RegistrantFirstName = process.env.NAMECHEAP_CONTACT_FIRST_NAME;
    if (process.env.NAMECHEAP_CONTACT_LAST_NAME)
        params.RegistrantLastName = process.env.NAMECHEAP_CONTACT_LAST_NAME;
    if (process.env.NAMECHEAP_CONTACT_ADDRESS1)
        params.RegistrantAddress1 = process.env.NAMECHEAP_CONTACT_ADDRESS1;
    if (process.env.NAMECHEAP_CONTACT_CITY)
        params.RegistrantCity = process.env.NAMECHEAP_CONTACT_CITY;
    if (process.env.NAMECHEAP_CONTACT_STATE)
        params.RegistrantStateProvince = process.env.NAMECHEAP_CONTACT_STATE;
    if (process.env.NAMECHEAP_CONTACT_POSTAL)
        params.RegistrantPostalCode = process.env.NAMECHEAP_CONTACT_POSTAL;
    if (process.env.NAMECHEAP_CONTACT_COUNTRY)
        params.RegistrantCountry = process.env.NAMECHEAP_CONTACT_COUNTRY;
    if (process.env.NAMECHEAP_CONTACT_EMAIL)
        params.RegistrantEmailAddress = process.env.NAMECHEAP_CONTACT_EMAIL;
    if (process.env.NAMECHEAP_CONTACT_PHONE)
        params.RegistrantPhone = process.env.NAMECHEAP_CONTACT_PHONE;

    const xml = await apiCall('namecheap.domains.create', params);
    checkApiStatus(xml);

    const attrs = xmlTagAttrs(xml, 'DomainCreateResult');
    if (!attrs) {
        throw new Error('No domain create result in Namecheap response');
    }

    if (attrs.Registered !== 'true') {
        throw new Error('Domain registration was not completed');
    }

    return {
        success: true,
        domainName,
        orderId: attrs.OrderId || null,
        transactionId: attrs.TransactionId || null,
        chargedAmount: attrs.ChargedAmount || null
    };
}

async function setNameservers(domainName, nameservers) {
    const xml = await apiCall('namecheap.domains.dns.setCustom', {
        SLDomain: domainName,
        Nameservers: nameservers.join(',')
    });
    checkApiStatus(xml);

    const attrs = xmlTagAttrs(xml, 'DomainDNSSetCustomResult');
    if (!attrs || attrs.Update !== 'true') {
        throw new Error('Failed to set nameservers on domain');
    }

    return { success: true, domainName, nameservers };
}

// Check if Namecheap is configured (either proxy or direct mode)
function isConfigured() {
    return !!(
        (process.env.NAMECHEAP_PROXY_URL && process.env.NAMECHEAP_PROXY_SECRET) ||
        (process.env.NAMECHEAP_API_USER && process.env.NAMECHEAP_API_KEY)
    );
}

module.exports = { checkAvailability, createDomain, setNameservers, isConfigured };

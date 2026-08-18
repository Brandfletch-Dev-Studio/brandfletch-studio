// api/lib/namecheap.js — Namecheap Domain API client
// Docs: https://www.namecheap.com/support/api/intro/
// Auth: ApiUser + ApiKey + UserName + ClientIp (form-encoded, not REST)
// Response: XML (parsed with lightweight regex, no external deps)
// Production: https://api.namecheap.com/xml.response
// Sandbox:    https://api.sandbox.namecheap.com/xml.response
//
// NOTE: Namecheap requires the IP making the request to be whitelisted
// in the dashboard (Profile > Tools > Namecheap API Access).
// Vercel serverless IPs are dynamic — you may need a fixed-IP proxy
// or make calls from your WHM server (which has a static IP).

const MWK_PER_USD = 6000;
const DOMAIN_MARKUP = 1.15;

function getConfig() {
    const apiUser = process.env.NAMECHEAP_API_USER;
    const apiKey = process.env.NAMECHEAP_API_KEY;
    const userName = process.env.NAMECHEAP_API_USER;
    const clientIp = process.env.NAMECHEAP_CLIENT_IP;
    const sandbox = process.env.NAMECHEAP_SANDBOX === 'true';
    const baseUrl = sandbox
        ? 'https://api.sandbox.namecheap.com/xml.response'
        : 'https://api.namecheap.com/xml.response';

    if (!apiUser || !apiKey) {
        throw new Error('Namecheap API credentials not configured');
    }

    return { apiUser, apiKey, userName, clientIp, baseUrl };
}

function baseParams(extra) {
    const { apiUser, apiKey, userName, clientIp } = getConfig();
    return {
        ApiUser: apiUser,
        ApiKey: apiKey,
        UserName: userName,
        ClientIp: clientIp || '127.0.0.1',
        ...extra
    };
}

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

async function checkAvailability(domainName) {
    const { baseUrl } = getConfig();

    const params = baseParams({
        Command: 'namecheap.domains.check',
        DomainList: domainName
    });

    const body = new URLSearchParams(params).toString();

    const response = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(12000)
    });

    const xml = await response.text();
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

async function createDomain(domainName, { years, nameservers }) {
    years = years || 1;
    nameservers = nameservers || [];
    const { baseUrl } = getConfig();

    const params = baseParams({
        Command: 'namecheap.domains.create',
        DomainName: domainName,
        Years: String(years),
        AddFreeWhoisguard: 'yes',
        WGEnabled: 'yes'
    });

    if (nameservers.length >= 2) {
        params.Nameserver1 = nameservers[0];
        params.Nameserver2 = nameservers[1];
    }

    // Registrant contact — uses env vars for business address,
    // falls back to Namecheap account default if not set
    const contactPrefixes = ['Registrant', 'Tech', 'Admin', 'AuxBilling'];
    for (const prefix of contactPrefixes) {
        if (process.env.NAMECHEAP_CONTACT_FIRST_NAME)
            params[prefix + 'FirstName'] = process.env.NAMECHEAP_CONTACT_FIRST_NAME;
        if (process.env.NAMECHEAP_CONTACT_LAST_NAME)
            params[prefix + 'LastName'] = process.env.NAMECHEAP_CONTACT_LAST_NAME;
        if (process.env.NAMECHEAP_CONTACT_ADDRESS1)
            params[prefix + 'Address1'] = process.env.NAMECHEAP_CONTACT_ADDRESS1;
        if (process.env.NAMECHEAP_CONTACT_CITY)
            params[prefix + 'City'] = process.env.NAMECHEAP_CONTACT_CITY;
        if (process.env.NAMECHEAP_CONTACT_STATE)
            params[prefix + 'StateProvince'] = process.env.NAMECHEAP_CONTACT_STATE;
        if (process.env.NAMECHEAP_CONTACT_POSTAL)
            params[prefix + 'PostalCode'] = process.env.NAMECHEAP_CONTACT_POSTAL;
        if (process.env.NAMECHEAP_CONTACT_COUNTRY)
            params[prefix + 'Country'] = process.env.NAMECHEAP_CONTACT_COUNTRY;
        if (process.env.NAMECHEAP_CONTACT_EMAIL)
            params[prefix + 'EmailAddress'] = process.env.NAMECHEAP_CONTACT_EMAIL;
        if (process.env.NAMECHEAP_CONTACT_PHONE)
            params[prefix + 'Phone'] = process.env.NAMECHEAP_CONTACT_PHONE;
    }

    const body = new URLSearchParams(params).toString();

    const response = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(30000)
    });

    const xml = await response.text();
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
    const { baseUrl } = getConfig();

    const params = baseParams({
        Command: 'namecheap.domains.dns.setCustom',
        SLDomain: domainName,
        Nameservers: nameservers.join(',')
    });

    const body = new URLSearchParams(params).toString();

    const response = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(15000)
    });

    const xml = await response.text();
    checkApiStatus(xml);

    const attrs = xmlTagAttrs(xml, 'DomainDNSSetCustomResult');
    if (!attrs || attrs.Update !== 'true') {
        throw new Error('Failed to set nameservers on domain');
    }

    return { success: true, domainName, nameservers };
}

module.exports = { checkAvailability, createDomain, setNameservers };

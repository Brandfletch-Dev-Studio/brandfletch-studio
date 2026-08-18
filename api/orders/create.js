// /api/orders/create — Create a hosting order and initiate Paychangu payment
// POST /api/orders/create
// Body: { plan, category, billing, domain, domainAction, firstName, lastName, email, password }

const crypto = require('crypto');
// Domain check now uses Namecheap (loaded dynamically in getDomainPrice)

const MWK_PER_USD = 6000;
const DOMAIN_MARKUP = 1.15;

const PLANS = {
    'wordpress-starter':    { name: 'WordPress Starter',  priceMonthly: 30000,  priceYearly: 300000,  whmPlan: 'wp_starter' },
    'wordpress-business':   { name: 'WordPress Business', priceMonthly: 60000,  priceYearly: 600000,  whmPlan: 'wp_business' },
    'wordpress-agency':     { name: 'WordPress Agency',   priceMonthly: 120000, priceYearly: 1200000, whmPlan: 'wp_agency' },
    'cpanel-starter':       { name: 'cPanel Starter',    priceMonthly: 18000,  priceYearly: 180000,  whmPlan: 'cp_starter' },
    'cpanel-business':      { name: 'cPanel Business',   priceMonthly: 36000,  priceYearly: 360000,  whmPlan: 'cp_business' },
    'cpanel-agency':        { name: 'cPanel Agency',     priceMonthly: 72000,  priceYearly: 720000,  whmPlan: 'cp_agency' }
};

// Domain pricing per year (at MWK 6000/$)
const DOMAIN_PRICES = {
    '.com': 15000, '.net': 16000, '.org': 14000,
    '.co': 20000, '.io': 42000, '.biz': 12000,
    '.info': 12000, '.co.uk': 8000, '.org.uk': 8000,
    '.me': 18000, '.xyz': 10000, '.online': 25000,
    '.store': 40000, '.tech': 35000, '.site': 12000
};

function generateTxRef() {
    return 'BF-' + Date.now() + '-' + crypto.randomBytes(3).toString('hex');
}

function generatePassword() {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#';
    let pwd = '';
    for (let i = 0; i < 16; i++) {
        pwd += chars[crypto.randomInt(chars.length)];
    }
    return pwd;
}

function getDomainPriceFallback(domain) {
    const parts = domain.split('.');
    // Try matching 2-level TLD first (e.g. .co.uk)
    if (parts.length >= 3) {
        const tld2 = '.' + parts.slice(-2).join('.');
        if (DOMAIN_PRICES[tld2]) return DOMAIN_PRICES[tld2];
    }
    const tld = '.' + parts[parts.length - 1];
    return DOMAIN_PRICES[tld] || 18000; // default
}

// Authoritative domain price — re-checked server-side against Namecheap
// so the charged amount can never be manipulated by the client.
async function getDomainPrice(domain) {
    if (process.env.NAMECHEAP_API_USER && process.env.NAMECHEAP_API_KEY) {
        try {
            const { checkAvailability } = require('../lib/namecheap');
            const result = await checkAvailability(domain);
            if (result.available) {
                let priceMwk;
                let priceUsd = null;
                if (result.premium && result.premiumPriceUsd) {
                    priceUsd = result.premiumPriceUsd;
                    priceMwk = Math.round(priceUsd * MWK_PER_USD * DOMAIN_MARKUP);
                } else {
                    priceMwk = getDomainPriceFallback(domain);
                }
                return { price: priceMwk, purchasePriceUsd: priceUsd, premium: result.premium };
            }
        } catch (err) {
            console.error('Namecheap price check failed, using fallback pricing:', err.message);
        }
    }
    return { price: getDomainPriceFallback(domain), purchasePriceUsd: null, premium: false };
}

module.exports = async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { plan, billing, domain, domainAction, firstName, lastName, email, password } = req.body;

        // Validate plan
        if (!PLANS[plan]) {
            res.status(400).json({ error: 'Invalid plan selected' });
            return;
        }

        if (!domain || !email) {
            res.status(400).json({ error: 'Domain and email are required' });
            return;
        }

        const planDetails = PLANS[plan];
        const billingCycle = billing === 'yearly' ? 'yearly' : 'monthly';
        const amount = billingCycle === 'yearly' ? planDetails.priceYearly : planDetails.priceMonthly;

        // Add domain registration fee if new domain — re-checked server-side
        let domainFee = 0;
        let domainPurchasePriceUsd = null;
        if (domainAction === 'register') {
            const domainPricing = await getDomainPrice(domain);
            domainFee = domainPricing.price;
            domainPurchasePriceUsd = domainPricing.purchasePriceUsd;
        }

        const totalAmount = amount + domainFee;
        const txRef = generateTxRef();
        const cpanelPassword = password || generatePassword();
        const cpanelUser = domain.split('.')[0].toLowerCase().substring(0, 8) + crypto.randomBytes(1).toString('hex');

        // Store order in GitHub (orders.json)
        const order = {
            txRef,
            plan,
            planName: planDetails.name,
            billing: billingCycle,
            amount: totalAmount,
            hostingFee: amount,
            domainFee,
            domain,
            domainAction: domainAction || 'existing',
            domainPurchasePriceUsd,
            email,
            firstName: firstName || '',
            lastName: lastName || '',
            cpanelUser,
            cpanelPassword,
            whmPlan: planDetails.whmPlan,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        // Save order to GitHub
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
        const REPO_OWNER = 'Brandfletch-Dev-Studio';
        const REPO_NAME = 'brandfletch-studio';

        try {
            // Read current orders
            const ordersUrl = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/orders.json`;
            let existingOrders = [];
            let sha = null;

            const readRes = await fetch(ordersUrl, {
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github+json',
                    'User-Agent': 'Brandfletch-Orders'
                }
            });

            if (readRes.ok) {
                const fileData = await readRes.json();
                sha = fileData.sha;
                existingOrders = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf-8'));
            }

            existingOrders.push(order);

            // Write back
            await fetch(ordersUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github+json',
                    'User-Agent': 'Brandfletch-Orders',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: `New order: ${txRef} — ${planDetails.name} for ${domain}`,
                    content: Buffer.from(JSON.stringify(existingOrders, null, 2)).toString('base64'),
                    sha: sha || undefined
                })
            });
        } catch (storeErr) {
            console.error('Failed to store order:', storeErr.message);
            // Continue anyway — we still have the tx_ref for verification
        }

        // Initiate Paychangu payment
        const PAYCHANGU_SECRET = process.env.PAYCHANGU_SECRET_KEY;
        if (!PAYCHANGU_SECRET) {
            res.status(500).json({ error: 'Payment gateway not configured' });
            return;
        }

        const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://brandfletch-studio.vercel.app';

        const paymentResponse = await fetch('https://api.paychangu.com/payment', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PAYCHANGU_SECRET}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: String(totalAmount),
                currency: 'MWK',
                email,
                first_name: firstName || '',
                last_name: lastName || '',
                callback_url: `${baseUrl}/api/orders/verify`,
                return_url: `${baseUrl}/order/status?tx_ref=${txRef}`,
                tx_ref: txRef,
                customization: {
                    title: `${planDetails.name} — ${billingCycle}`,
                    description: domainAction === 'register'
                        ? `Hosting (${billingCycle}) + Domain registration`
                        : `Hosting (${billingCycle})`
                },
                meta: {
                    order_id: txRef,
                    plan: plan,
                    domain: domain,
                    domain_action: domainAction || 'existing',
                    billing: billingCycle
                }
            })
        });

        const paymentData = await paymentResponse.json();

        if (paymentData.status !== 'success') {
            res.status(400).json({
                error: 'Failed to initiate payment',
                details: paymentData
            });
            return;
        }

        res.status(200).json({
            success: true,
            txRef,
            checkoutUrl: paymentData.data.checkout_url,
            amount: totalAmount,
            currency: 'MWK'
        });

    } catch (err) {
        console.error('Order creation error:', err);
        res.status(500).json({ error: 'Internal server error', message: err.message });
    }
};

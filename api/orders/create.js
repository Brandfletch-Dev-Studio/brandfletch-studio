// /api/orders/create — Create a hosting order and initiate Paychangu payment
// POST /api/orders/create
// Body: { plan, category, billing, domain, domainAction, firstName, lastName, email, password }
// Stores orders in Supabase (replaces GitHub JSON approach)

const crypto = require('crypto');

const MWK_PER_USD = 6000;
const DOMAIN_MARKUP = 1.15;

const PLANS = {
    'wordpress-starter':    { name: 'WordPress Starter',  priceMonthly: 30000,  priceYearly: 300000,  whmPlan: 'wp_starter',    type: 'wordpress' },
    'wordpress-business':   { name: 'WordPress Business', priceMonthly: 60000,  priceYearly: 600000,  whmPlan: 'wp_business',   type: 'wordpress' },
    'wordpress-agency':     { name: 'WordPress Agency',   priceMonthly: 120000, priceYearly: 1200000, whmPlan: 'wp_agency',     type: 'wordpress' },
    'cpanel-starter':       { name: 'cPanel Starter',    priceMonthly: 18000,  priceYearly: 180000,  whmPlan: 'cp_starter',    type: 'cpanel' },
    'cpanel-business':      { name: 'cPanel Business',   priceMonthly: 36000,  priceYearly: 360000,  whmPlan: 'cp_business',   type: 'cpanel' },
    'cpanel-agency':        { name: 'cPanel Agency',     priceMonthly: 72000,  priceYearly: 720000,  whmPlan: 'cp_agency',     type: 'cpanel' }
};

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
    if (parts.length >= 3) {
        const tld2 = '.' + parts.slice(-2).join('.');
        if (DOMAIN_PRICES[tld2]) return DOMAIN_PRICES[tld2];
    }
    const tld = '.' + parts[parts.length - 1];
    return DOMAIN_PRICES[tld] || 18000;
}

async function getDomainPrice(domain) {
    if (require('../lib/namecheap').isConfigured()) {
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

        // Find or create customer record
        const supabase = require('../lib/supabase');
        let customerId = null;
        
        if (supabase.isConfigured()) {
            try {
                // Look up existing customer by email
                let customer = await supabase.select('customers', { email }, true);
                if (!customer) {
                    // Create new customer
                    customer = await supabase.insert('customers', {
                        full_name: (firstName + ' ' + lastName).trim(),
                        email,
                        status: 'active'
                    });
                }
                customerId = customer.id;
            } catch (custErr) {
                console.error('Customer lookup/creation failed:', custErr.message);
            }

            // Store order in Supabase
            try {
                await supabase.insert('orders', {
                    tx_ref: txRef,
                    customer_id: customerId,
                    plan_name: planDetails.name,
                    plan_type: planDetails.type,
                    plan_tier: planDetails.whmPlan,
                    billing_cycle: billingCycle,
                    price_mwk: totalAmount,
                    domain: domain,
                    domain_action: domainAction || 'existing',
                    domain_price_mwk: domainFee,
                    payment_status: 'pending',
                    provisioning_status: 'pending',
                    cpanel_user: cpanelUser,
                    cpanel_password: cpanelPassword,
                    whm_plan: planDetails.whmPlan,
                    order_data: {
                        hostingFee: amount,
                        domainPurchasePriceUsd,
                        firstName: firstName || '',
                        lastName: lastName || '',
                        plan: plan,
                        planName: planDetails.name
                    }
                });
            } catch (orderErr) {
                console.error('Supabase order insert failed:', orderErr.message);
                // Continue — we still have the tx_ref for payment
            }
        } else {
            console.warn('Supabase not configured — order not persisted');
        }

        // Initiate Paychangu payment
        const PAYCHANGU_SECRET = process.env.PAYCHANGU_SECRET_KEY;
        if (!PAYCHANGU_SECRET) {
            res.status(500).json({ error: 'Payment gateway not configured' });
            return;
        }

        const baseUrl = process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'https://brandfletch-studio.vercel.app';

        const paymentResponse = await fetch('https://api.paychangu.com/payment', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + PAYCHANGU_SECRET,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: String(totalAmount),
                currency: 'MWK',
                email,
                first_name: firstName || '',
                last_name: lastName || '',
                callback_url: baseUrl + '/api/orders/verify',
                return_url: baseUrl + '/order/status?tx_ref=' + txRef,
                tx_ref: txRef,
                customization: {
                    title: planDetails.name + ' — ' + billingCycle,
                    description: domainAction === 'register'
                        ? 'Hosting (' + billingCycle + ') + Domain registration'
                        : 'Hosting (' + billingCycle + ')'
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

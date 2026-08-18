// /api/orders/verify — Verify Paychangu payment and trigger auto-provisioning
// GET /api/orders/verify?tx_ref=BF-xxxx  (redirect from Paychangu after payment)
// POST /api/orders/verify (webhook from Paychangu)
// Uses Supabase for order storage (replaces GitHub JSON approach)

const { createCpanelAccount, registerDomain } = require('../provision/whm');

async function findOrder(txRef) {
    const supabase = require('../lib/supabase');
    if (!supabase.isConfigured()) return { order: null };
    
    const order = await supabase.select('orders', { tx_ref: txRef }, true);
    if (!order) return { order: null };
    
    // Normalize to the shape expected by the provisioning code
    return {
        order: {
            txRef: order.tx_ref,
            plan: order.order_data?.plan,
            planName: order.plan_name,
            billing: order.billing_cycle,
            amount: order.price_mwk,
            hostingFee: order.order_data?.hostingFee,
            domainFee: order.domain_price_mwk,
            domain: order.domain,
            domainAction: order.domain_action,
            domainPurchasePriceUsd: order.order_data?.domainPurchasePriceUsd,
            email: order.order_data?.email || '',
            firstName: order.order_data?.firstName || '',
            lastName: order.order_data?.lastName || '',
            cpanelUser: order.cpanel_user,
            cpanelPassword: order.cpanel_password,
            whmPlan: order.whm_plan,
            status: order.payment_status === 'paid' ? 'paid' : 'pending',
            customerId: order.customer_id,
            orderId: order.id
        },
        dbOrder: order
    };
}

async function updateOrderStatus(txRef, updates) {
    const supabase = require('../lib/supabase');
    if (!supabase.isConfigured()) return;
    
    // Map the legacy update keys to Supabase columns
    const dbUpdates = {};
    
    if (updates.status === 'paid' || updates.paymentVerified) {
        dbUpdates.payment_status = 'paid';
        if (updates.paidAt) dbUpdates.paid_at = updates.paidAt;
        if (updates.paymentAmount) dbUpdates.payment_amount = String(updates.paymentAmount);
        if (updates.paymentCurrency) dbUpdates.payment_currency = updates.paymentCurrency;
        if (updates.paymentChannel) dbUpdates.payment_method = updates.paymentChannel;
        if (updates.paymentReference) dbUpdates.payment_reference = updates.paymentReference;
    }
    
    if (updates.status === 'provisioned') {
        dbUpdates.provisioning_status = 'provisioned';
        if (updates.provisionedAt) dbUpdates.provisioned_at = updates.provisionedAt;
    }
    
    if (updates.status === 'provisioning_failed') {
        dbUpdates.provisioning_status = 'failed';
        if (updates.provisioningError) dbUpdates.provisioning_error = updates.provisioningError;
    }
    
    if (updates.domainRegistrationStatus === 'registered') {
        dbUpdates.domain_registration_status = 'registered';
    }
    
    if (updates.domainRegistrationStatus === 'failed' || updates.domainResult?.success === false) {
        dbUpdates.domain_registration_status = 'failed';
        dbUpdates.domain_registration_result = updates.domainResult;
    }
    
    if (updates.provisioningResult) {
        dbUpdates.provisioning_result = updates.provisioningResult;
    }
    
    try {
        await supabase.update('orders', { tx_ref: txRef }, dbUpdates);
    } catch (err) {
        console.error('Order update failed:', err.message);
    }
}

module.exports = async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    const txRef = req.query.tx_ref || req.body?.tx_ref;

    if (!txRef) {
        res.status(400).json({ error: 'Transaction reference is required' });
        return;
    }

    try {
        // Verify payment with Paychangu
        const PAYCHANGU_SECRET = process.env.PAYCHANGU_SECRET_KEY;
        if (!PAYCHANGU_SECRET) {
            res.status(500).json({ error: 'Payment gateway not configured' });
            return;
        }

        const verifyResponse = await fetch('https://api.paychangu.com/verify-payment/' + txRef, {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + PAYCHANGU_SECRET,
                'Accept': 'application/json'
            }
        });

        const verifyData = await verifyResponse.json();

        if (verifyData.status !== 'success' || verifyData.data?.status !== 'success') {
            if (req.method === 'GET') {
                res.redirect(302, '/order/status?tx_ref=' + txRef + '&status=failed');
            } else {
                res.status(400).json({ success: false, status: 'payment_failed', data: verifyData });
            }
            return;
        }

        // Payment verified — find order
        const { order, dbOrder } = await findOrder(txRef);

        if (!order) {
            res.status(404).json({ error: 'Order not found', txRef });
            return;
        }

        if (dbOrder && dbOrder.provisioning_status === 'provisioned') {
            if (req.method === 'GET') {
                res.redirect(302, '/order/status?tx_ref=' + txRef + '&status=success&provisioned=true');
            } else {
                res.status(200).json({ success: true, message: 'Already provisioned', order });
            }
            return;
        }

        // Update order to paid
        await updateOrderStatus(txRef, {
            paymentVerified: true,
            paymentAmount: verifyData.data.amount,
            paymentCurrency: verifyData.data.currency,
            paymentChannel: verifyData.data.authorization?.channel,
            paymentReference: verifyData.data.reference,
            paidAt: new Date().toISOString()
        });

        // Auto-provision cPanel account via WHM API
        let provisioningResult = null;
        let domainResult = null;
        let provisioningError = null;

        try {
            provisioningResult = await createCpanelAccount(order);
            await updateOrderStatus(txRef, {
                status: 'provisioned',
                provisionedAt: new Date().toISOString(),
                provisioningResult
            });
        } catch (provErr) {
            provisioningError = provErr.message;
            await updateOrderStatus(txRef, {
                status: 'provisioning_failed',
                provisioningError
            });
            console.error('Provisioning error:', provErr.message);
        }

        // Register domain if requested
        if (order.domainAction === 'register') {
            try {
                domainResult = await registerDomain(order);
                await updateOrderStatus(txRef, {
                    domainRegistrationStatus: domainResult.success ? 'registered' : 'failed',
                    domainResult
                });
            } catch (domErr) {
                domainResult = { success: false, error: domErr.message };
                await updateOrderStatus(txRef, {
                    domainRegistrationStatus: 'failed',
                    domainResult
                });
                console.error('Domain registration error:', domErr.message);
            }
        }

        // Create hosting account record in Supabase if provisioned
        if (provisioningResult && provisioningResult.success) {
            const supabase = require('../lib/supabase');
            if (supabase.isConfigured()) {
                try {
                    await supabase.insert('hosting_accounts', {
                        order_id: dbOrder?.id,
                        customer_id: order.customerId,
                        cpanel_user: order.cpanelUser,
                        domain: order.domain,
                        plan_name: order.planName,
                        plan_type: order.plan,
                        status: 'active'
                    });
                } catch (haErr) {
                    console.error('Hosting account record failed:', haErr.message);
                }
            }
        }

        // Create domain record in Supabase if registered
        if (domainResult && domainResult.success) {
            const supabase = require('../lib/supabase');
            if (supabase.isConfigured()) {
                try {
                    const ns = (process.env.HOSTING_NAMESERVERS || '').split(',').map(s => s.trim()).filter(Boolean);
                    await supabase.insert('domains', {
                        order_id: dbOrder?.id,
                        customer_id: order.customerId,
                        domain: order.domain,
                        registration_status: 'registered',
                        nameservers: ns,
                        registered_at: new Date().toISOString()
                    });
                } catch (domErr) {
                    console.error('Domain record failed:', domErr.message);
                }
            }
        }

        if (req.method === 'GET') {
            const status = provisioningError ? 'provisioning_failed' : 'success';
            res.redirect(302, '/order/status?tx_ref=' + txRef + '&status=' + status);
        } else {
            res.status(200).json({
                success: true,
                status: provisioningError ? 'provisioning_failed' : 'provisioned',
                order,
                provisioning: provisioningResult,
                domain: domainResult,
                provisioningError
            });
        }

    } catch (err) {
        console.error('Verify error:', err);
        if (req.method === 'GET') {
            res.redirect(302, '/order/status?tx_ref=' + txRef + '&status=error');
        } else {
            res.status(500).json({ error: 'Internal server error', message: err.message });
        }
    }
};

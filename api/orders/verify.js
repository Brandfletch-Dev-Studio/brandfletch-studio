// /api/orders/verify — Verify Paychangu payment and trigger auto-provisioning
// GET /api/orders/verify?tx_ref=BF-xxxx  (redirect from Paychangu after payment)
// POST /api/orders/verify (webhook from Paychangu)

const { createCpanelAccount, registerDomain } = require('../provision/whm');

async function findOrder(txRef) {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const REPO_OWNER = 'Brandfletch-Dev-Studio';
    const REPO_NAME = 'brandfletch-studio';

    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/orders.json`;
    const res = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'Brandfletch-Orders'
        }
    });

    if (!res.ok) return null;

    const fileData = await res.json();
    const orders = JSON.parse(Buffer.from(fileData.content, 'base64').toString('utf-8'));
    const order = orders.find(o => o.txRef === txRef);

    return { order, orders, sha: fileData.sha };
}

async function updateOrderStatus(txRef, updates) {
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const REPO_OWNER = 'Brandfletch-Dev-Studio';
    const REPO_NAME = 'brandfletch-studio';

    const { orders, sha } = await findOrder(txRef);
    if (!orders) return;

    const orderIndex = orders.findIndex(o => o.txRef === txRef);
    if (orderIndex === -1) return;

    orders[orderIndex] = { ...orders[orderIndex], ...updates, updatedAt: new Date().toISOString() };

    await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/orders.json`, {
        method: 'PUT',
        headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github+json',
            'User-Agent': 'Brandfletch-Orders',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message: `Order ${txRef} updated — ${updates.status || 'processed'}`,
            content: Buffer.from(JSON.stringify(orders, null, 2)).toString('base64'),
            sha
        })
    });
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

        const verifyResponse = await fetch(`https://api.paychangu.com/verify-payment/${txRef}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${PAYCHANGU_SECRET}`,
                'Accept': 'application/json'
            }
        });

        const verifyData = await verifyResponse.json();

        if (verifyData.status !== 'success' || verifyData.data?.status !== 'success') {
            // Payment not successful — redirect to status page with failed info
            if (req.method === 'GET') {
                res.redirect(302, `/order/status?tx_ref=${txRef}&status=failed`);
            } else {
                res.status(400).json({ success: false, status: 'payment_failed', data: verifyData });
            }
            return;
        }

        // Payment verified — find order and provision
        const { order } = await findOrder(txRef);

        if (!order) {
            res.status(404).json({ error: 'Order not found', txRef });
            return;
        }

        if (order.status === 'provisioned') {
            // Already provisioned — redirect to success
            if (req.method === 'GET') {
                res.redirect(302, `/order/status?tx_ref=${txRef}&status=success&provisioned=true`);
            } else {
                res.status(200).json({ success: true, message: 'Already provisioned', order });
            }
            return;
        }

        // Update order to paid
        await updateOrderStatus(txRef, {
            status: 'paid',
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
            await updateOrderStatus(txRef, { status: 'provisioned', provisionedAt: new Date().toISOString() });
        } catch (provErr) {
            provisioningError = provErr.message;
            await updateOrderStatus(txRef, { status: 'provisioning_failed', provisioningError });
            console.error('Provisioning error:', provErr.message);
        }

        // Register domain if requested
        if (order.domainAction === 'register') {
            try {
                domainResult = await registerDomain(order);
            } catch (domErr) {
                domainResult = { success: false, error: domErr.message };
                console.error('Domain registration error:', domErr.message);
            }
        }

        // Redirect or respond
        if (req.method === 'GET') {
            const status = provisioningError ? 'provisioning_failed' : 'success';
            res.redirect(302, `/order/status?tx_ref=${txRef}&status=${status}`);
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
            res.redirect(302, `/order/status?tx_ref=${txRef}&status=error`);
        } else {
            res.status(500).json({ error: 'Internal server error', message: err.message });
        }
    }
};

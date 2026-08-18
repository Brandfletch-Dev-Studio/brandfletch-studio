// /api/admin/invoices — Manage invoices
// GET: list all invoices
// POST: create an invoice
// PUT: update invoice status

const { verifyToken } = require('../auth');

module.exports = async (req, res) => {
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }

    const token = (req.headers.authorization || '').replace('Bearer ', '');
    const payload = verifyToken(token, process.env.ADMIN_PASSWORD);
    if (!payload) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const supabase = require('../lib/supabase');
    if (!supabase.isConfigured()) { res.status(500).json({ error: 'Database not configured' }); return; }

    try {
        if (req.method === 'GET') {
            const result = await supabase.query(`
                SELECT i.*, c.full_name as customer_name, c.email as customer_email,
                       p.project_name, p.domain as project_domain
                FROM invoices i
                LEFT JOIN customers c ON i.customer_id = c.id
                LEFT JOIN projects p ON i.project_id = p.id
                ORDER BY i.created_at DESC;
            `);
            res.status(200).json({ invoices: result || [] });

        } else if (req.method === 'POST') {
            const { customerId, projectId, description, amountMwk, billingPeriod, dueDate, notes } = req.body;

            if (!description || !amountMwk) { res.status(400).json({ error: 'Description and amount are required' }); return; }

            const now = new Date();
            const invoiceNum = 'INV-' + now.getFullYear() + '-' + Date.now().toString().slice(-6);

            const invoice = await supabase.insert('invoices', {
                invoice_number: invoiceNum,
                customer_id: customerId || null,
                project_id: projectId || null,
                description,
                amount_mwk: amountMwk,
                billing_period: billingPeriod || 'one_time',
                status: 'pending',
                due_date: dueDate || null,
                notes: notes || null
            });

            res.status(201).json({ success: true, invoice });

        } else if (req.method === 'PUT') {
            const { id, status, paymentMethod, paymentReference } = req.body;
            if (!id) { res.status(400).json({ error: 'Invoice ID is required' }); return; }

            const dbUpdates = {};
            if (status) dbUpdates.status = status;
            if (paymentMethod) dbUpdates.payment_method = paymentMethod;
            if (paymentReference) dbUpdates.payment_reference = paymentReference;
            if (status === 'paid') {
                dbUpdates.paid_at = new Date().toISOString();
            }

            const updated = await supabase.update('invoices', { id }, dbUpdates);
            res.status(200).json({ success: true, invoice: updated });

        } else {
            res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (err) {
        console.error('Admin invoices error:', err);
        res.status(500).json({ error: 'Internal server error', message: err.message });
    }
};

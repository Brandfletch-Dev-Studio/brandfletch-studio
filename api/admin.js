// /api/admin — Consolidated admin API for projects, customers, and invoices
// Routes based on the "action" query parameter: ?action=projects|customers|invoices

const { verifyToken } = require('./auth');

function checkAuth(req, res) {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    const payload = verifyToken(token, process.env.ADMIN_PASSWORD);
    if (!payload) { res.status(401).json({ error: 'Unauthorized' }); return false; }
    return true;
}

module.exports = async (req, res) => {
    if (req.method === 'OPTIONS') { res.status(204).end(); return; }

    if (!checkAuth(req, res)) return;

    const supabase = require('../lib/supabase');
    if (!supabase.isConfigured()) { res.status(500).json({ error: 'Database not configured' }); return; }

    const action = req.query.action || 'projects';

    try {
        if (action === 'customers') {
            // ---- CUSTOMERS ----
            if (req.method === 'GET') {
                const result = await supabase.query(`
                    SELECT c.*,
                        COUNT(DISTINCT p.id) as project_count,
                        COUNT(DISTINCT ha.id) as hosting_count,
                        COALESCE(SUM(p.management_fee_mwk) FILTER (WHERE p.billing_active = true), 0) as total_annual_fees
                    FROM customers c
                    LEFT JOIN projects p ON p.customer_id = c.id
                    LEFT JOIN hosting_accounts ha ON ha.customer_id = c.id
                    GROUP BY c.id
                    ORDER BY c.created_at DESC;
                `);
                res.status(200).json({ customers: result || [] });
            } else {
                res.status(405).json({ error: 'Method not allowed' });
            }

        } else if (action === 'invoices') {
            // ---- INVOICES ----
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
                if (status === 'paid') dbUpdates.paid_at = new Date().toISOString();
                const updated = await supabase.update('invoices', { id }, dbUpdates);
                res.status(200).json({ success: true, invoice: updated });

            } else {
                res.status(405).json({ error: 'Method not allowed' });
            }

        } else {
            // ---- PROJECTS (default) ----
            if (req.method === 'GET') {
                const result = await supabase.query(`
                    SELECT p.*, c.full_name as customer_name, c.email as customer_email
                    FROM projects p
                    LEFT JOIN customers c ON p.customer_id = c.id
                    ORDER BY p.created_at DESC;
                `);
                res.status(200).json({ projects: result || [] });

            } else if (req.method === 'POST') {
                const { customerId, projectName, domain, description, status,
                    managementFeeMwk, billingCycle, projectType, technologies,
                    deployedAt, notes, billingActive } = req.body;

                if (!projectName) { res.status(400).json({ error: 'Project name is required' }); return; }

                const project = await supabase.insert('projects', {
                    customer_id: customerId || null,
                    project_name: projectName,
                    domain: domain || null,
                    description: description || null,
                    status: status || 'planning',
                    management_fee_mwk: managementFeeMwk || 500000,
                    billing_cycle: billingCycle || 'annual',
                    project_type: projectType || 'custom_website',
                    technologies: technologies || [],
                    deployed_at: deployedAt || null,
                    notes: notes || null,
                    billing_active: billingActive !== false
                });

                // Auto-generate first annual invoice
                if (billingActive !== false && (managementFeeMwk || 500000) > 0 && customerId) {
                    const now = new Date();
                    const invoiceNum = 'INV-' + now.getFullYear() + '-' + Date.now().toString().slice(-6);
                    const dueDate = new Date(now);
                    dueDate.setDate(dueDate.getDate() + 30);
                    try {
                        await supabase.insert('invoices', {
                            invoice_number: invoiceNum,
                            customer_id: customerId,
                            project_id: project.id,
                            description: 'Annual management fee — ' + projectName,
                            amount_mwk: managementFeeMwk || 500000,
                            billing_period: 'annual',
                            period_start: now.toISOString().split('T')[0],
                            period_end: new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString().split('T')[0],
                            status: 'pending',
                            due_date: dueDate.toISOString().split('T')[0]
                        });
                    } catch (invErr) {
                        console.error('Invoice creation failed:', invErr.message);
                    }
                }
                res.status(201).json({ success: true, project });

            } else if (req.method === 'PUT') {
                const { id, ...updates } = req.body;
                if (!id) { res.status(400).json({ error: 'Project ID is required' }); return; }
                const fieldMap = {
                    customerId: 'customer_id', projectName: 'project_name',
                    domain: 'domain', description: 'description', status: 'status',
                    managementFeeMwk: 'management_fee_mwk', billingCycle: 'billing_cycle',
                    projectType: 'project_type', technologies: 'technologies',
                    deployedAt: 'deployed_at', notes: 'notes',
                    billingActive: 'billing_active', lastBilledAt: 'last_billed_at',
                    nextBillingDate: 'next_billing_date'
                };
                const dbUpdates = {};
                for (const [key, value] of Object.entries(updates)) {
                    if (fieldMap[key]) dbUpdates[fieldMap[key]] = value;
                }
                const updated = await supabase.update('projects', { id }, dbUpdates);
                res.status(200).json({ success: true, project: updated });

            } else if (req.method === 'DELETE') {
                const { id } = req.query;
                if (!id) { res.status(400).json({ error: 'Project ID is required' }); return; }
                await supabase.query("DELETE FROM projects WHERE id = '" + id + "';");
                res.status(200).json({ success: true });

            } else {
                res.status(405).json({ error: 'Method not allowed' });
            }
        }
    } catch (err) {
        console.error('Admin API error:', err);
        res.status(500).json({ error: 'Internal server error', message: err.message });
    }
};

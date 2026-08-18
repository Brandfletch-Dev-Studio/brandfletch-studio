// /api/admin/projects — Manage client projects/websites
// GET: list all projects with customer info
// POST: create a new project
// PUT: update a project
// DELETE: delete a project

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
                SELECT p.*, c.full_name as customer_name, c.email as customer_email
                FROM projects p
                LEFT JOIN customers c ON p.customer_id = c.id
                ORDER BY p.created_at DESC;
            `);
            res.status(200).json({ projects: result || [] });

        } else if (req.method === 'POST') {
            const {
                customerId, projectName, domain, description, status,
                managementFeeMwk, billingCycle, projectType, technologies,
                deployedAt, notes, billingActive
            } = req.body;

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

            // Auto-generate first annual management fee invoice
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
                customerId: 'customer_id',
                projectName: 'project_name',
                domain: 'domain',
                description: 'description',
                status: 'status',
                managementFeeMwk: 'management_fee_mwk',
                billingCycle: 'billing_cycle',
                projectType: 'project_type',
                technologies: 'technologies',
                deployedAt: 'deployed_at',
                notes: 'notes',
                billingActive: 'billing_active',
                lastBilledAt: 'last_billed_at',
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
    } catch (err) {
        console.error('Admin projects error:', err);
        res.status(500).json({ error: 'Internal server error', message: err.message });
    }
};

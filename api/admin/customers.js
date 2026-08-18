// /api/admin/customers — List all customers with their project/hosting counts
// GET: list all customers

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
    } catch (err) {
        console.error('Admin customers error:', err);
        res.status(500).json({ error: 'Internal server error', message: err.message });
    }
};

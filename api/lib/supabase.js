// api/lib/supabase.js — Lightweight Supabase REST API client
// Uses fetch only (no npm deps needed for Vercel serverless functions)
// Uses service_role key server-side to bypass RLS

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function headers() {
    return {
        'apikey': SERVICE_KEY,
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'Content-Type': 'application/json'
    };
}

// Insert a row into a table — returns the created row
async function insert(table, data) {
    const res = await fetch(SUPABASE_URL + '/rest/v1/' + table, {
        method: 'POST',
        headers: { ...headers(), 'Prefer': 'return=representation' },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Supabase insert failed');
    }
    const rows = await res.json();
    return Array.isArray(rows) ? rows[0] : rows;
}

// Select rows from a table with optional filters
async function select(table, filters, single) {
    let url = SUPABASE_URL + '/rest/v1/' + table + '?select=*';
    if (filters) {
        for (const [key, value] of Object.entries(filters)) {
            url += '&' + key + '=eq.' + encodeURIComponent(String(value));
        }
    }
    if (single) url += '&limit=1';
    
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Supabase select failed');
    }
    const rows = await res.json();
    if (single) return rows[0] || null;
    return rows;
}

// Update rows matching a filter — returns the updated row(s)
async function update(table, filters, data) {
    let url = SUPABASE_URL + '/rest/v1/' + table + '?select=*';
    for (const [key, value] of Object.entries(filters)) {
        url += '&' + key + '=eq.' + encodeURIComponent(String(value));
    }
    
    const res = await fetch(url, {
        method: 'PATCH',
        headers: { ...headers(), 'Prefer': 'return=representation' },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Supabase update failed');
    }
    const rows = await res.json();
    return Array.isArray(rows) ? rows[0] : rows;
}

// Upsert: insert or update based on a conflict column
async function upsert(table, data, conflictColumn) {
    const res = await fetch(SUPABASE_URL + '/rest/v1/' + table, {
        method: 'POST',
        headers: { 
            ...headers(), 
            'Prefer': 'resolution=merge-duplicate,return=representation'
        },
        body: JSON.stringify({ ...data, [conflictColumn]: data[conflictColumn] })
    });
    if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Supabase upsert failed');
    }
    const rows = await res.json();
    return Array.isArray(rows) ? rows[0] : rows;
}

// Execute raw SQL via the Management API (for complex queries)
async function query(sql) {
    const ref = process.env.SUPABASE_PROJECT_REF;
    const token = process.env.SUPABASE_ACCESS_TOKEN;
    if (!ref || !token) throw new Error('SUPABASE_PROJECT_REF or SUPABASE_ACCESS_TOKEN not set');
    
    const res = await fetch('https://api.supabase.com/v1/projects/' + ref + '/database/query', {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: sql })
    });
    if (!res.ok) throw new Error('Supabase query failed: ' + res.statusText);
    return res.json();
}

function isConfigured() {
    return !!(SUPABASE_URL && SERVICE_KEY);
}

module.exports = { insert, select, update, upsert, query, isConfigured };

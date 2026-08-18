// /api/config — Returns public Supabase config for the front-end
// GET /api/config
// The anon key is safe to expose — it's designed for client-side use with RLS

module.exports = (req, res) => {
    res.status(200).json({
        supabaseUrl: process.env.SUPABASE_URL || null,
        supabaseAnonKey: process.env.SUPABASE_ANON_KEY || null
    });
};

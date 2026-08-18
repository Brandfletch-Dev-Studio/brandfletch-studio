// ===================================
// BRANDFLETCH PORTAL — Auth
// Handles Supabase auth init, login, register, session check
// ===================================

let supabase = null;
let sbConfig = null;

async function initSupabase() {
    if (supabase) return supabase;
    
    try {
        const res = await fetch('/api/config');
        sbConfig = await res.json();
        
        if (!sbConfig.supabaseUrl || !sbConfig.supabaseAnonKey) {
            console.error('Supabase not configured');
            return null;
        }
    } catch (err) {
        console.error('Failed to load config:', err);
        return null;
    }

    // Load Supabase JS from CDN
    if (!window.supabaseClient) {
        await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js');
    }

    supabase = window.supabase.createClient(
        sbConfig.supabaseUrl,
        sbConfig.supabaseAnonKey,
        { auth: { persistSession: true, autoRefreshToken: true } }
    );

    return supabase;
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

// Check if user is authenticated — redirect to login if not
async function requireAuth() {
    const client = await initSupabase();
    if (!client) {
        window.location.href = '/portal/login.html';
        return null;
    }

    const { data: { session } } = await client.auth.getSession();
    if (!session) {
        window.location.href = '/portal/login.html';
        return null;
    }

    return { client, session, user: session.user };
}

// Get current user (null if not logged in)
async function getCurrentUser() {
    const client = await initSupabase();
    if (!client) return null;

    const { data: { session } } = await client.auth.getSession();
    return session ? session.user : null;
}

// Sign out
async function signOut() {
    const client = await initSupabase();
    if (client) {
        await client.auth.signOut();
    }
    window.location.href = '/portal/login.html';
}

// ===================================
// LOGIN PAGE LOGIC
// ===================================
async function initLoginPage() {
    const client = await initSupabase();
    if (!client) return;

    // Redirect if already logged in
    const { data: { session } } = await client.auth.getSession();
    if (session) {
        window.location.href = '/portal/dashboard.html';
        return;
    }

    // Toggle between login and register
    const showRegister = document.getElementById('showRegister');
    const showLogin = document.getElementById('showLogin');
    const loginView = document.getElementById('loginView');
    const registerView = document.getElementById('registerView');

    if (showRegister) {
        showRegister.addEventListener('click', (e) => {
            e.preventDefault();
            loginView.classList.add('hidden');
            registerView.classList.remove('hidden');
        });
    }

    if (showLogin) {
        showLogin.addEventListener('click', (e) => {
            e.preventDefault();
            registerView.classList.remove('hidden');
            loginView.classList.remove('hidden');
            registerView.classList.add('hidden');
        });
    }

    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('loginBtn');
            const errEl = document.getElementById('loginError');
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;

            btn.disabled = true;
            btn.textContent = 'Signing in...';
            errEl.textContent = '';

            try {
                const { error } = await client.auth.signInWithPassword({ email, password });
                if (error) throw error;
                window.location.href = '/portal/dashboard.html';
            } catch (err) {
                errEl.textContent = err.message || 'Invalid email or password';
                btn.disabled = false;
                btn.textContent = 'Sign In';
            }
        });
    }

    // Register form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('registerBtn');
            const errEl = document.getElementById('registerError');
            const successEl = document.getElementById('registerSuccess');
            const fullName = document.getElementById('regName').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const phone = document.getElementById('regPhone').value.trim();
            const password = document.getElementById('regPassword').value;

            btn.disabled = true;
            btn.textContent = 'Creating account...';
            errEl.textContent = '';
            successEl.textContent = '';

            try {
                const { data, error } = await client.auth.signUp({
                    email,
                    password,
                    options: {
                        data: { full_name: fullName, phone: phone }
                    }
                });

                if (error) throw error;

                if (data.user && !data.session) {
                    // Email confirmation required
                    successEl.textContent = 'Account created. Check your email to verify, then sign in.';
                    btn.disabled = false;
                    btn.textContent = 'Create Account';
                    
                    // Switch to login view after a delay
                    setTimeout(() => {
                        loginView.classList.remove('hidden');
                        registerView.classList.add('hidden');
                        document.getElementById('loginEmail').value = email;
                    }, 2500);
                } else if (data.session) {
                    // Auto-confirmed — go to dashboard
                    window.location.href = '/portal/dashboard.html';
                }
            } catch (err) {
                errEl.textContent = err.message || 'Registration failed';
                btn.disabled = false;
                btn.textContent = 'Create Account';
            }
        });
    }
}

// Auto-init on page load
(async () => {
    const path = window.location.pathname;
    
    if (path.includes('/portal/login.html') || path.includes('/portal/login')) {
        await initLoginPage();
    }
})();

// Checkout module — multi-step self-serve hosting ordering flow
// Steps: 1) Plan & billing  2) Domain  3) Account details  4) Review & pay
// Payment: Paychangu redirect
// Domain: name.com API (availability + live pricing + registration)
// Hosting: WHM API (cPanel account creation)

(function() {
    'use strict';

    // --- State ---
    let selectedPlan = null;
    let selectedPlanName = null;
    let selectedCategory = null;
    let selectedBilling = 'monthly';
    let currentStep = 1;
    let domainAction = 'register';
    let domainAvailable = null;
    let domainPriceMwk = null;
    let domainCheckTimer = null;

    // Persisted form values (survive step transitions)
    let savedDomain = '';
    let savedExistingDomain = '';
    let savedFirstName = '';
    let savedLastName = '';
    let savedEmail = '';
    let savedPassword = '';

    // --- Plan data (mirrors backend) ---
    const PLANS = {
        'wordpress-starter':    { name: 'WordPress Starter',  priceMonthly: 30000,  priceYearly: 300000  },
        'wordpress-business':   { name: 'WordPress Business', priceMonthly: 60000,  priceYearly: 600000  },
        'wordpress-agency':     { name: 'WordPress Agency',   priceMonthly: 120000, priceYearly: 1200000 },
        'cpanel-starter':       { name: 'cPanel Starter',     priceMonthly: 18000,  priceYearly: 180000  },
        'cpanel-business':      { name: 'cPanel Business',   priceMonthly: 36000,  priceYearly: 360000  },
        'cpanel-agency':        { name: 'cPanel Agency',      priceMonthly: 72000,  priceYearly: 720000  }
    };

    // --- Helpers ---
    function fmtMWK(amount) {
        return 'MWK ' + Number(amount).toLocaleString('en-US');
    }

    function getCurrentPrice() {
        if (!selectedPlan || !PLANS[selectedPlan]) return 0;
        return selectedBilling === 'yearly' ? PLANS[selectedPlan].priceYearly : PLANS[selectedPlan].priceMonthly;
    }

    function getTotal() {
        const hosting = getCurrentPrice();
        const domain = (domainAction === 'register' && domainAvailable === true && domainPriceMwk) ? domainPriceMwk : 0;
        return hosting + domain;
    }

    // Save form values from current DOM before navigating away
    function saveFormValues() {
        const di = document.getElementById('domainInput');
        if (di) savedDomain = di.value.trim().toLowerCase();
        const de = document.getElementById('domainExistingInput');
        if (de) savedExistingDomain = de.value.trim().toLowerCase();
        const fn = document.getElementById('firstNameInput');
        if (fn) savedFirstName = fn.value.trim();
        const ln = document.getElementById('lastNameInput');
        if (ln) savedLastName = ln.value.trim();
        const em = document.getElementById('emailInput');
        if (em) savedEmail = em.value.trim();
        const pw = document.getElementById('passwordInput');
        if (pw) savedPassword = pw.value.trim();
    }

    // --- Step templates ---
    function stepIndicator() {
        const steps = ['Plan', 'Domain', 'Account', 'Review'];
        let html = '<div class="ck-steps">';
        steps.forEach((label, i) => {
            const num = i + 1;
            const cls = num === currentStep ? 'ck-step active' : (num < currentStep ? 'ck-step done' : 'ck-step');
            html += '<div class="' + cls + '">';
            html += '<span class="ck-step-num">' + (num < currentStep ? '' : num) + '</span>';
            html += '<span class="ck-step-label">' + label + '</span>';
            html += '</div>';
            if (i < steps.length - 1) html += '<div class="ck-step-line' + (num < currentStep ? ' done' : '') + '"></div>';
        });
        html += '</div>';
        return html;
    }

    function step1HTML() {
        const price = getCurrentPrice();
        return `
            <div class="ck-step-content" id="step1Content">
                ${stepIndicator()}
                <div class="ck-section">
                    <p class="ck-label">Selected plan</p>
                    <div class="ck-plan-box">
                        <div>
                            <span class="ck-plan-badge">${selectedPlanName}</span>
                            <div class="ck-plan-price">
                                <span class="ck-price-amount">${fmtMWK(price)}</span>
                                <span class="ck-price-period">/${selectedBilling === 'yearly' ? 'year' : 'month'}</span>
                            </div>
                        </div>
                        <div class="ck-billing-toggle" id="billingToggle">
                            <button class="ck-toggle-btn ${selectedBilling==='monthly'?'active':''}" data-billing="monthly">Monthly</button>
                            <button class="ck-toggle-btn ${selectedBilling==='yearly'?'active':''}" data-billing="yearly">Yearly</button>
                        </div>
                    </div>
                    <p class="ck-hint">Yearly billing saves roughly 2 months compared to monthly.</p>
                </div>
                <div class="ck-actions">
                    <button class="ck-btn-secondary" id="ckCancel">Cancel</button>
                    <button class="ck-btn-primary" id="ckNext1">Continue</button>
                </div>
            </div>
        `;
    }

    function step2HTML() {
        return `
            <div class="ck-step-content" id="step2Content">
                ${stepIndicator()}
                <div class="ck-section">
                    <p class="ck-label">Domain</p>
                    <div class="ck-domain-tabs" id="domainTabs">
                        <button class="ck-tab ${domainAction==='register'?'active':''}" data-action="register">Register new domain</button>
                        <button class="ck-tab ${domainAction==='existing'?'active':''}" data-action="existing">Use existing domain</button>
                    </div>
                    <div id="domainRegisterBlock" style="display:${domainAction==='register'?'block':'none'};">
                        <div class="ck-input-group">
                            <input type="text" id="domainInput" class="ck-input" placeholder="example.com" value="${savedDomain}" autocomplete="off">
                            <button id="domainCheckBtn" class="ck-btn-input">Check</button>
                        </div>
                        <div id="domainResult" class="ck-domain-result"></div>
                    </div>
                    <div id="domainExistingBlock" style="display:${domainAction==='existing'?'block':'none'};">
                        <input type="text" id="domainExistingInput" class="ck-input" placeholder="yourdomain.com" value="${savedExistingDomain}" autocomplete="off">
                        <p class="ck-hint">Point your domain's nameservers to us after checkout. We will send instructions.</p>
                    </div>
                </div>
                <div class="ck-actions">
                    <button class="ck-btn-secondary" id="ckBack2">Back</button>
                    <button class="ck-btn-primary" id="ckNext2">Continue</button>
                </div>
            </div>
        `;
    }

    function step3HTML() {
        return `
            <div class="ck-step-content" id="step3Content">
                ${stepIndicator()}
                <div class="ck-section">
                    <p class="ck-label">Account details</p>
                    <div class="ck-form-grid">
                        <input type="text" id="firstNameInput" class="ck-input" placeholder="First name" value="${savedFirstName}" autocomplete="given-name">
                        <input type="text" id="lastNameInput" class="ck-input" placeholder="Last name" value="${savedLastName}" autocomplete="family-name">
                    </div>
                    <input type="email" id="emailInput" class="ck-input ck-input-full" placeholder="Email address" value="${savedEmail}" autocomplete="email">
                    <input type="password" id="passwordInput" class="ck-input ck-input-full" placeholder="cPanel password (leave blank to auto-generate)" value="${savedPassword}" autocomplete="new-password">
                    <p class="ck-hint">Your cPanel login credentials will be sent to this email address.</p>
                </div>
                <div class="ck-actions">
                    <button class="ck-btn-secondary" id="ckBack3">Back</button>
                    <button class="ck-btn-primary" id="ckNext3">Review order</button>
                </div>
            </div>
        `;
    }

    function step4HTML() {
        const price = getCurrentPrice();
        const domainFee = (domainAction === 'register' && domainAvailable === true && domainPriceMwk) ? domainPriceMwk : 0;
        const domainName = domainAction === 'register' ? savedDomain : savedExistingDomain;
        const billingLabel = selectedBilling === 'yearly' ? 'yearly' : 'monthly';

        return `
            <div class="ck-step-content" id="step4Content">
                ${stepIndicator()}
                <div class="ck-review">
                    <div class="ck-review-section">
                        <p class="ck-label">Plan</p>
                        <div class="ck-review-row"><span>${selectedPlanName}</span><span>${fmtMWK(price)} /${billingLabel}</span></div>
                    </div>
                    <div class="ck-review-section">
                        <p class="ck-label">Domain</p>
                        <div class="ck-review-row"><span>${domainName || '—'}</span><span>${domainAction === 'register' ? (domainFee ? fmtMWK(domainFee) + ' /year' : '—') : 'Existing domain'}</span></div>
                    </div>
                    <div class="ck-review-section">
                        <p class="ck-label">Account</p>
                        <div class="ck-review-row"><span>Name</span><span>${savedFirstName} ${savedLastName}</span></div>
                        <div class="ck-review-row"><span>Email</span><span>${savedEmail}</span></div>
                    </div>
                    <div class="ck-review-total">
                        <div class="ck-review-row"><span>Total due now</span><span class="ck-total-amount">${fmtMWK(getTotal())}</span></div>
                    </div>
                </div>
                <div class="ck-actions">
                    <button class="ck-btn-secondary" id="ckBack4">Back</button>
                    <button class="ck-btn-primary ck-btn-pay" id="ckSubmit">Continue to payment</button>
                </div>
                <div id="orderError" class="ck-error" style="display:none;"></div>
            </div>
        `;
    }

    // --- Modal ---
    function buildModal() {
        const modal = document.createElement('div');
        modal.id = 'checkoutModal';
        modal.className = 'ck-overlay';
        modal.innerHTML = '<div class="ck-modal"><div class="ck-modal-header"><h2 class="ck-title">Checkout</h2><button class="ck-close" id="checkoutClose">&times;</button></div><div class="ck-modal-body" id="checkoutBody"></div></div>';
        document.body.appendChild(modal);
        modal.querySelector('#checkoutClose').addEventListener('click', closeModal);
        modal.addEventListener('click', function(e) { if (e.target === modal) closeModal(); });
    }

    function closeModal() {
        const modal = document.getElementById('checkoutModal');
        if (modal) modal.style.display = 'none';
        document.body.style.overflow = '';
    }

    function renderStep() {
        const body = document.getElementById('checkoutBody');
        if (currentStep === 1) body.innerHTML = step1HTML();
        else if (currentStep === 2) body.innerHTML = step2HTML();
        else if (currentStep === 3) body.innerHTML = step3HTML();
        else if (currentStep === 4) body.innerHTML = step4HTML();
        attachListeners();
    }

    function goToStep(n) {
        saveFormValues();
        currentStep = n;
        renderStep();
    }

    // --- Domain check ---
    async function checkDomain() {
        const input = document.getElementById('domainInput');
        const result = document.getElementById('domainResult');
        if (!input || !result) return;
        const domain = input.value.trim().toLowerCase();

        if (!domain) {
            result.className = 'ck-domain-result ck-domain-error';
            result.textContent = 'Please enter a domain name';
            return;
        }

        const btn = document.getElementById('domainCheckBtn');
        if (btn) { btn.disabled = true; btn.textContent = 'Checking...'; }

        result.className = 'ck-domain-result ck-domain-checking';
        result.textContent = 'Checking availability...';
        domainAvailable = null;
        domainPriceMwk = null;

        try {
            const res = await fetch('/api/domains/check?domain=' + encodeURIComponent(domain));
            const data = await res.json();

            if (data.available === true) {
                domainAvailable = true;
                if (data.priceMwk) {
                    domainPriceMwk = data.priceMwk;
                    result.className = 'ck-domain-result ck-domain-ok';
                    result.innerHTML = 'Available — <strong>' + fmtMWK(data.priceMwk) + '/year</strong>';
                } else {
                    result.className = 'ck-domain-result ck-domain-ok';
                    result.textContent = 'Available — pricing confirmed at checkout';
                }
            } else if (data.available === false) {
                domainAvailable = false;
                result.className = 'ck-domain-result ck-domain-error';
                result.textContent = data.premium ? 'This is a premium domain — contact us for pricing.' : 'Already registered. Try another name.';
            } else {
                domainAvailable = null;
                result.className = 'ck-domain-result ck-domain-warn';
                result.textContent = 'Could not verify — proceed and we will confirm manually.';
            }
        } catch (err) {
            domainAvailable = null;
            result.className = 'ck-domain-result ck-domain-warn';
            result.textContent = 'Connection error — proceed and we will confirm manually.';
        }

        if (btn) { btn.disabled = false; btn.textContent = 'Check'; }
    }

    // --- Validation ---
    function validateStep1() { return null; }

    function validateStep2() {
        if (domainAction === 'register') {
            if (!savedDomain) return 'Please enter a domain name';
            if (domainAvailable !== true) return 'Please check domain availability first';
        } else {
            if (!savedExistingDomain) return 'Please enter your existing domain name';
        }
        return null;
    }

    function validateStep3() {
        if (!savedEmail) return 'Please enter your email address';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(savedEmail)) return 'Please enter a valid email address';
        return null;
    }

    // --- Submit order ---
    async function submitOrder() {
        const errorEl = document.getElementById('orderError');
        const submitBtn = document.getElementById('ckSubmit');
        if (errorEl) errorEl.style.display = 'none';

        const domain = domainAction === 'register' ? savedDomain : savedExistingDomain;

        if (submitBtn) { submitBtn.textContent = 'Processing...'; submitBtn.disabled = true; }

        try {
            const res = await fetch('/api/orders/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan: selectedPlan,
                    category: selectedCategory,
                    billing: selectedBilling,
                    domain, domainAction,
                    firstName: savedFirstName,
                    lastName: savedLastName,
                    email: savedEmail,
                    password: savedPassword || undefined
                })
            });
            const data = await res.json();

            if (data.success && data.checkoutUrl) {
                window.location.href = data.checkoutUrl;
            } else {
                if (errorEl) {
                    errorEl.textContent = data.error || 'Failed to create order. Please try again.';
                    errorEl.style.display = 'block';
                }
                if (submitBtn) { submitBtn.textContent = 'Continue to payment'; submitBtn.disabled = false; }
            }
        } catch (err) {
            if (errorEl) {
                errorEl.textContent = 'Connection error. Please try again.';
                errorEl.style.display = 'block';
            }
            if (submitBtn) { submitBtn.textContent = 'Continue to payment'; submitBtn.disabled = false; }
        }
    }

    // --- Event listeners ---
    function attachListeners() {
        // Step 1
        const billingToggle = document.getElementById('billingToggle');
        if (billingToggle) {
            billingToggle.querySelectorAll('.ck-toggle-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    selectedBilling = this.dataset.billing;
                    billingToggle.querySelectorAll('.ck-toggle-btn').forEach(b => b.classList.toggle('active', b.dataset.billing === selectedBilling));
                    const priceEl = document.querySelector('.ck-price-amount');
                    const periodEl = document.querySelector('.ck-price-period');
                    if (priceEl) priceEl.textContent = fmtMWK(getCurrentPrice());
                    if (periodEl) periodEl.textContent = '/' + (selectedBilling === 'yearly' ? 'year' : 'month');
                });
            });
        }

        const ckCancel = document.getElementById('ckCancel');
        if (ckCancel) ckCancel.addEventListener('click', closeModal);
        const ckNext1 = document.getElementById('ckNext1');
        if (ckNext1) ckNext1.addEventListener('click', () => { const err = validateStep1(); if (err) { /* show inline */ } else goToStep(2); });

        // Step 2
        const domainTabs = document.getElementById('domainTabs');
        if (domainTabs) {
            domainTabs.querySelectorAll('.ck-tab').forEach(tab => {
                tab.addEventListener('click', function() {
                    domainAction = this.dataset.action;
                    domainTabs.querySelectorAll('.ck-tab').forEach(t => t.classList.toggle('active', t.dataset.action === domainAction));
                    document.getElementById('domainRegisterBlock').style.display = domainAction === 'register' ? 'block' : 'none';
                    document.getElementById('domainExistingBlock').style.display = domainAction === 'existing' ? 'block' : 'none';
                    const result = document.getElementById('domainResult');
                    if (result && domainAction === 'existing') { result.textContent = ''; domainAvailable = null; }
                });
            });
        }

        const domainCheckBtn = document.getElementById('domainCheckBtn');
        if (domainCheckBtn) domainCheckBtn.addEventListener('click', checkDomain);
        const domainInput = document.getElementById('domainInput');
        if (domainInput) {
            domainInput.addEventListener('keypress', function(e) { if (e.key === 'Enter') { e.preventDefault(); checkDomain(); } });
            domainInput.addEventListener('input', function() {
                clearTimeout(domainCheckTimer);
                domainCheckTimer = setTimeout(() => {
                    if (this.value.trim().length >= 4) checkDomain();
                }, 800);
            });
        }

        const ckBack2 = document.getElementById('ckBack2');
        if (ckBack2) ckBack2.addEventListener('click', () => goToStep(1));
        const ckNext2 = document.getElementById('ckNext2');
        if (ckNext2) ckNext2.addEventListener('click', () => {
            saveFormValues();
            const err = validateStep2();
            if (err) {
                const result = document.getElementById('domainResult');
                if (result) { result.className = 'ck-domain-result ck-domain-error'; result.textContent = err; }
            } else goToStep(3);
        });

        // Step 3
        const ckBack3 = document.getElementById('ckBack3');
        if (ckBack3) ckBack3.addEventListener('click', () => goToStep(2));
        const ckNext3 = document.getElementById('ckNext3');
        if (ckNext3) ckNext3.addEventListener('click', () => {
            saveFormValues();
            const err = validateStep3();
            if (err) {
                const emailInput = document.getElementById('emailInput');
                if (emailInput) { emailInput.style.borderColor = '#ef4444'; emailInput.focus(); setTimeout(() => emailInput.style.borderColor = '', 2000); }
            } else goToStep(4);
        });

        // Step 4
        const ckBack4 = document.getElementById('ckBack4');
        if (ckBack4) ckBack4.addEventListener('click', () => goToStep(3));
        const ckSubmit = document.getElementById('ckSubmit');
        if (ckSubmit) ckSubmit.addEventListener('click', submitOrder);
    }

    // --- Public API ---
    function openCheckout(planKey, planName, category) {
        selectedPlan = planKey;
        selectedPlanName = planName;
        selectedCategory = category;
        selectedBilling = 'monthly';
        currentStep = 1;
        domainAction = 'register';
        domainAvailable = null;
        domainPriceMwk = null;
        savedDomain = '';
        savedExistingDomain = '';
        savedFirstName = '';
        savedLastName = '';
        savedEmail = '';
        savedPassword = '';

        if (!document.getElementById('checkoutModal')) {
            buildModal();
        }
        renderStep();
        document.getElementById('checkoutModal').style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    window.BrandfletchCheckout = { openCheckout };
})();

// Checkout module — self-serve hosting ordering flow
// Handles: plan selection, domain check, account details, Paychangu payment redirect

(function() {
    'use strict';

    let selectedPlan = null;
    let selectedPlanName = null;
    let selectedCategory = null;
    let selectedBilling = 'monthly';

    // Plan data (matches backend)
    const PLANS = {
        'wordpress-starter':    { name: 'WordPress Starter',  priceMonthly: 30000,  priceYearly: 300000  },
        'wordpress-business':   { name: 'WordPress Business', priceMonthly: 60000,  priceYearly: 600000  },
        'wordpress-agency':      { name: 'WordPress Agency',   priceMonthly: 120000, priceYearly: 1200000 },
        'cpanel-starter':       { name: 'cPanel Starter',     priceMonthly: 18000,  priceYearly: 180000  },
        'cpanel-business':      { name: 'cPanel Business',    priceMonthly: 36000,  priceYearly: 360000  },
        'cpanel-agency':         { name: 'cPanel Agency',      priceMonthly: 72000,  priceYearly: 720000  }
    };

    const DOMAIN_PRICES = {
        '.com': 15000, '.net': 16000, '.org': 14000,
        '.co': 20000, '.io': 42000, '.biz': 12000,
        '.info': 12000, '.co.uk': 8000, '.me': 18000,
        '.xyz': 10000, '.online': 25000, '.store': 40000
    };

    function formatMWK(amount) {
        return 'MWK ' + amount.toLocaleString();
    }

    function getDomainPrice(domain) {
        const parts = domain.split('.');
        if (parts.length >= 3) {
            const tld2 = '.' + parts.slice(-2).join('.');
            if (DOMAIN_PRICES[tld2]) return DOMAIN_PRICES[tld2];
        }
        const tld = '.' + parts[parts.length - 1];
        return DOMAIN_PRICES[tld] || 18000;
    }

    // Build the checkout modal
    function buildModal() {
        const modal = document.createElement('div');
        modal.id = 'checkoutModal';
        modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:9999;overflow-y:auto;padding:1rem;';
        modal.innerHTML = `
            <div style="max-width:560px;margin:2rem auto;background:#18181b;border:1px solid #27272a;border-radius:12px;overflow:hidden;">
                <div style="display:flex;justify-content:space-between;align-items:center;padding:1.5rem;border-bottom:1px solid #27272a;">
                    <h2 style="font-size:1.25rem;font-weight:600;color:#f4f4f5;" id="checkoutTitle">Checkout</h2>
                    <button id="checkoutClose" style="background:none;border:none;color:#71717a;font-size:1.5rem;cursor:pointer;">&times;</button>
                </div>
                <div style="padding:1.5rem;" id="checkoutBody">
                    ${buildStep1()}
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('#checkoutClose').addEventListener('click', closeModal);
        modal.addEventListener('click', function(e) {
            if (e.target === modal) closeModal();
        });
    }

    function buildStep1() {
        return `
            <div id="step1">
                <div style="margin-bottom:1.5rem;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
                        <span style="color:#71717a;font-size:0.85rem;font-family:'JetBrains Mono',monospace;">SELECTED PLAN</span>
                        <span style="background:#8b5cf6;color:#fff;padding:0.25rem 0.75rem;border-radius:6px;font-size:0.8rem;" id="planBadge">${selectedPlanName}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div>
                            <span style="font-size:1.5rem;font-weight:600;color:#f4f4f5;" id="planPriceAmount">${formatMWK(selectedBilling === 'yearly' ? PLANS[selectedPlan]?.priceYearly : PLANS[selectedPlan]?.priceMonthly)}</span>
                            <span style="color:#71717a;font-size:0.9rem;">/${selectedBilling === 'yearly' ? 'year' : 'month'}</span>
                        </div>
                        <div id="billingToggle" style="display:flex;gap:0.5rem;">
                            <button data-billing="monthly" style="padding:0.4rem 0.8rem;border-radius:6px;border:1px solid #27272a;background:${selectedBilling==='monthly'?'#8b5cf6':'#0a0a0a'};color:${selectedBilling==='monthly'?'#fff':'#a1a1aa'};font-size:0.8rem;cursor:pointer;">Monthly</button>
                            <button data-billing="yearly" style="padding:0.4rem 0.8rem;border-radius:6px;border:1px solid #27272a;background:${selectedBilling==='yearly'?'#8b5cf6':'#0a0a0a'};color:${selectedBilling==='yearly'?'#fff':'#a1a1aa'};font-size:0.8rem;cursor:pointer;">Yearly</button>
                        </div>
                    </div>
                </div>

                <div style="margin-bottom:1.5rem;">
                    <label style="display:block;color:#71717a;font-size:0.85rem;font-family:'JetBrains Mono',monospace;margin-bottom:0.75rem;">DOMAIN</label>
                    <div style="display:flex;gap:0.5rem;margin-bottom:0.75rem;">
                        <button data-action="register" id="actionRegister" style="flex:1;padding:0.6rem;border-radius:8px;border:1px solid #27272a;background:#0a0a0a;color:#a1a1aa;font-size:0.85rem;cursor:pointer;">Register new domain</button>
                        <button data-action="existing" id="actionExisting" style="flex:1;padding:0.6rem;border-radius:8px;border:1px solid #27272a;background:#0a0a0a;color:#a1a1aa;font-size:0.85rem;cursor:pointer;">Use existing domain</button>
                    </div>
                    <div style="display:flex;gap:0.5rem;">
                        <input type="text" id="domainInput" placeholder="example.com" style="flex:1;padding:0.65rem;border-radius:8px;border:1px solid #27272a;background:#0a0a0a;color:#f4f4f5;font-size:0.95rem;">
                        <button id="domainCheckBtn" style="padding:0.65rem 1rem;border-radius:8px;border:none;background:#8b5cf6;color:#fff;font-weight:500;cursor:pointer;font-size:0.85rem;">Check</button>
                    </div>
                    <div id="domainResult" style="margin-top:0.5rem;font-size:0.85rem;min-height:1.2rem;"></div>
                </div>

                <div style="margin-bottom:1.5rem;">
                    <label style="display:block;color:#71717a;font-size:0.85rem;font-family:'JetBrains Mono',monospace;margin-bottom:0.75rem;">ACCOUNT DETAILS</label>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.75rem;">
                        <input type="text" id="firstNameInput" placeholder="First name" style="padding:0.65rem;border-radius:8px;border:1px solid #27272a;background:#0a0a0a;color:#f4f4f5;font-size:0.9rem;">
                        <input type="text" id="lastNameInput" placeholder="Last name" style="padding:0.65rem;border-radius:8px;border:1px solid #27272a;background:#0a0a0a;color:#f4f4f5;font-size:0.9rem;">
                    </div>
                    <input type="email" id="emailInput" placeholder="Email address" style="width:100%;padding:0.65rem;border-radius:8px;border:1px solid #27272a;background:#0a0a0a;color:#f4f4f5;font-size:0.9rem;margin-bottom:0.75rem;box-sizing:border-box;">
                    <input type="password" id="passwordInput" placeholder="cPanel password (leave blank to auto-generate)" style="width:100%;padding:0.65rem;border-radius:8px;border:1px solid #27272a;background:#0a0a0a;color:#f4f4f5;font-size:0.9rem;box-sizing:border-box;">
                </div>

                <div style="border-top:1px solid #27272a;padding-top:1rem;margin-bottom:1rem;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:0.5rem;">
                        <span style="color:#a1a1aa;font-size:0.9rem;">Hosting (${selectedBilling})</span>
                        <span style="color:#f4f4f5;font-size:0.9rem;" id="summaryHosting">${formatMWK(selectedBilling === 'yearly' ? PLANS[selectedPlan]?.priceYearly : PLANS[selectedPlan]?.priceMonthly)}</span>
                    </div>
                    <div id="summaryDomainRow" style="display:none;justify-content:space-between;margin-bottom:0.5rem;">
                        <span style="color:#a1a1aa;font-size:0.9rem;">Domain registration (1 year)</span>
                        <span style="color:#f4f4f5;font-size:0.9rem;" id="summaryDomain">MWK 0</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;padding-top:0.5rem;border-top:1px solid #27272a;">
                        <span style="color:#f4f4f5;font-weight:600;font-size:1rem;">Total</span>
                        <span style="color:#8b5cf6;font-weight:600;font-size:1.1rem;" id="summaryTotal">${formatMWK(selectedBilling === 'yearly' ? PLANS[selectedPlan]?.priceYearly : PLANS[selectedPlan]?.priceMonthly)}</span>
                    </div>
                </div>

                <button id="submitOrder" style="width:100%;padding:0.85rem;border-radius:8px;border:none;background:#8b5cf6;color:#fff;font-weight:600;font-size:1rem;cursor:pointer;">Continue to payment</button>
                <div id="orderError" style="margin-top:0.75rem;color:#ef4444;font-size:0.85rem;display:none;"></div>
            </div>
        `;
    }

    let domainAction = 'register';
    let domainAvailable = null;

    function openCheckout(planKey, planName, category) {
        selectedPlan = planKey;
        selectedPlanName = planName;
        selectedCategory = category;
        domainAction = 'register';
        domainAvailable = null;

        if (!document.getElementById('checkoutModal')) {
            buildModal();
        } else {
            document.getElementById('checkoutBody').innerHTML = buildStep1();
        }

        attachEventListeners();
        document.getElementById('checkoutModal').style.display = 'block';
        document.body.style.overflow = 'hidden';
        updateActionButtons();
    }

    function closeModal() {
        const modal = document.getElementById('checkoutModal');
        if (modal) modal.style.display = 'none';
        document.body.style.overflow = '';
    }

    function updateActionButtons() {
        const reg = document.getElementById('actionRegister');
        const ext = document.getElementById('actionExisting');
        if (!reg || !ext) return;

        if (domainAction === 'register') {
            reg.style.cssText = 'flex:1;padding:0.6rem;border-radius:8px;border:1px solid #8b5cf6;background:#8b5cf6;color:#fff;font-size:0.85rem;cursor:pointer;';
            ext.style.cssText = 'flex:1;padding:0.6rem;border-radius:8px;border:1px solid #27272a;background:#0a0a0a;color:#a1a1aa;font-size:0.85rem;cursor:pointer;';
        } else {
            reg.style.cssText = 'flex:1;padding:0.6rem;border-radius:8px;border:1px solid #27272a;background:#0a0a0a;color:#a1a1aa;font-size:0.85rem;cursor:pointer;';
            ext.style.cssText = 'flex:1;padding:0.6rem;border-radius:8px;border:1px solid #8b5cf6;background:#8b5cf6;color:#fff;font-size:0.85rem;cursor:pointer;';
        }
    }

    function updateSummary() {
        if (!selectedPlan) return;
        const hostingPrice = selectedBilling === 'yearly' ? PLANS[selectedPlan].priceYearly : PLANS[selectedPlan].priceMonthly;
        document.getElementById('planPriceAmount').textContent = formatMWK(hostingPrice);
        document.getElementById('summaryHosting').textContent = formatMWK(hostingPrice);

        let total = hostingPrice;
        const domainRow = document.getElementById('summaryDomainRow');
        if (domainAction === 'register' && domainAvailable === true) {
            const domainInput = document.getElementById('domainInput');
            const domain = domainInput.value.trim().toLowerCase();
            if (domain) {
                const domainPrice = getDomainPrice(domain);
                document.getElementById('summaryDomain').textContent = formatMWK(domainPrice);
                domainRow.style.display = 'flex';
                total += domainPrice;
            } else {
                domainRow.style.display = 'none';
            }
        } else {
            domainRow.style.display = 'none';
        }
        document.getElementById('summaryTotal').textContent = formatMWK(total);
    }

    function attachEventListeners() {
        // Billing toggle
        document.querySelectorAll('#billingToggle button').forEach(btn => {
            btn.addEventListener('click', function() {
                selectedBilling = this.dataset.billing;
                document.querySelectorAll('#billingToggle button').forEach(b => {
                    if (b.dataset.billing === selectedBilling) {
                        b.style.cssText = 'padding:0.4rem 0.8rem;border-radius:6px;border:1px solid #27272a;background:#8b5cf6;color:#fff;font-size:0.8rem;cursor:pointer;';
                    } else {
                        b.style.cssText = 'padding:0.4rem 0.8rem;border-radius:6px;border:1px solid #27272a;background:#0a0a0a;color:#a1a1aa;font-size:0.8rem;cursor:pointer;';
                    }
                });
                updateSummary();
            });
        });

        // Domain action toggle
        document.getElementById('actionRegister').addEventListener('click', function() {
            domainAction = 'register';
            updateActionButtons();
            updateSummary();
        });
        document.getElementById('actionExisting').addEventListener('click', function() {
            domainAction = 'existing';
            domainAvailable = null;
            document.getElementById('domainResult').textContent = '';
            updateActionButtons();
            updateSummary();
        });

        // Domain check
        document.getElementById('domainCheckBtn').addEventListener('click', checkDomain);
        document.getElementById('domainInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') checkDomain();
        });

        // Submit order
        document.getElementById('submitOrder').addEventListener('click', submitOrder);
    }

    async function checkDomain() {
        const input = document.getElementById('domainInput');
        const result = document.getElementById('domainResult');
        const domain = input.value.trim().toLowerCase();

        if (!domain) {
            result.style.color = '#ef4444';
            result.textContent = 'Please enter a domain name';
            return;
        }

        result.style.color = '#a1a1aa';
        result.textContent = 'Checking availability...';

        try {
            const res = await fetch(`/api/domains/check?domain=${encodeURIComponent(domain)}`);
            const data = await res.json();

            if (data.available === true) {
                result.style.color = '#22c55e';
                result.textContent = 'Available — MWK ' + getDomainPrice(domain).toLocaleString() + '/year';
                domainAvailable = true;
                updateSummary();
            } else if (data.available === false) {
                result.style.color = '#ef4444';
                result.textContent = 'Already registered. Choose another or use "existing domain" option.';
                domainAvailable = false;
            } else {
                result.style.color = '#f59e0b';
                result.textContent = 'Could not verify. You can proceed and we will confirm manually.';
                domainAvailable = null;
            }
        } catch (err) {
            result.style.color = '#f59e0b';
            result.textContent = 'Connection error. You can proceed and we will confirm manually.';
            domainAvailable = null;
        }
    }

    async function submitOrder() {
        const errorEl = document.getElementById('orderError');
        errorEl.style.display = 'none';

        const domain = document.getElementById('domainInput').value.trim().toLowerCase();
        const firstName = document.getElementById('firstNameInput').value.trim();
        const lastName = document.getElementById('lastNameInput').value.trim();
        const email = document.getElementById('emailInput').value.trim();
        const password = document.getElementById('passwordInput').value.trim();

        if (!domain) {
            errorEl.textContent = 'Please enter a domain name';
            errorEl.style.display = 'block';
            return;
        }
        if (!email) {
            errorEl.textContent = 'Please enter your email address';
            errorEl.style.display = 'block';
            return;
        }
        if (domainAction === 'register' && domainAvailable !== true) {
            errorEl.textContent = 'Please check domain availability first';
            errorEl.style.display = 'block';
            return;
        }

        const submitBtn = document.getElementById('submitOrder');
        submitBtn.textContent = 'Processing...';
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.6';

        try {
            const res = await fetch('/api/orders/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan: selectedPlan,
                    category: selectedCategory,
                    billing: selectedBilling,
                    domain: domain,
                    domainAction: domainAction,
                    firstName: firstName,
                    lastName: lastName,
                    email: email,
                    password: password || undefined
                })
            });

            const data = await res.json();

            if (data.success && data.checkoutUrl) {
                window.location.href = data.checkoutUrl;
            } else {
                errorEl.textContent = data.error || 'Failed to create order. Please try again.';
                errorEl.style.display = 'block';
                submitBtn.textContent = 'Continue to payment';
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
            }
        } catch (err) {
            errorEl.textContent = 'Connection error. Please try again.';
            errorEl.style.display = 'block';
            submitBtn.textContent = 'Continue to payment';
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
        }
    }

    // Export
    window.BrandfletchCheckout = { openCheckout };
})();

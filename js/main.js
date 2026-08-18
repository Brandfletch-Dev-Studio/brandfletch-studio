/* ===================================
   BRANDFLETCH DEV STUDIO
   Main JS
   =================================== */

// --- State ---
let siteContent = null;

// --- Default content (fallback if API is unreachable) ---
const defaultContent = {
    hero: {
        tag: 'Brandfletch Dev Studio',
        headingPre: 'We build',
        headingAccent: 'custom websites',
        headingPost: 'and host them right.',
        sub: 'From custom web apps to cPanel web hosting — we design, build, and host everything your business needs online. Billed in Malawi Kwacha.',
        ctaPrimaryLabel: 'See Hosting Plans',
        ctaPrimaryHref: '#hosting',
        ctaSecondaryLabel: 'Start a Project',
        ctaSecondaryHref: '#contact'
    },
    services: [
        { title: 'Custom Website Development', desc: 'Custom-designed and built from scratch. No templates, no bloated plugins — just clean code tailored to your business.', model: 'Project-based' },
        { title: 'Full cPanel Hosting', desc: 'Complete web hosting with cPanel access. Host any platform — WordPress, Joomla, custom, or anything else.', model: 'From MWK 18,000/mo' },
        { title: 'Care & Maintenance', desc: 'Ongoing security patches, updates, and daily backups. Your site stays current and protected.', model: 'From MWK 30,000/mo' },
        { title: 'Website Migration', desc: 'Already hosted elsewhere? We move your site with zero downtime.', model: 'One-time fee' },
        { title: 'Custom Web Apps & Systems', desc: 'Outgrown your current setup? We build the custom app, API, or platform your business needs next.', model: 'Project-based' }
    ],
    hostingCpanel: [
        { name: 'Starter', tagline: 'Full cPanel hosting — host any platform on unlimited sites.', priceMonthlyMWK: 18000, priceYearlyMWK: 180000, features: ['Unlimited websites', '20GB NVMe SSD storage', 'Full cPanel access', 'Free SSL certificate', '5 email accounts', 'Weekly automatic backups', 'Standard support'] },
        { name: 'Business', tagline: 'cPanel hosting for growing businesses with multiple sites.', priceMonthlyMWK: 36000, priceYearlyMWK: 360000, features: ['Unlimited websites', '50GB NVMe SSD storage', 'Full cPanel access', 'Free SSL certificate', 'Unlimited email accounts', 'Daily automatic backups', 'Free site migration', 'Priority support'], highlighted: true },
        { name: 'Agency', tagline: 'Full cPanel hosting with dedicated resources and room to scale.', priceMonthlyMWK: 72000, priceYearlyMWK: 720000, features: ['Unlimited websites', '100GB NVMe SSD storage', 'Full cPanel access', 'Free SSL certificate', 'Unlimited email accounts', 'Daily backups + malware scanning', 'Dedicated IP address available', 'Dedicated support'] }
    ],
    hostingNote: 'Prices shown in Malawi Kwacha. Pay yearly and get 2 months free versus paying monthly. Every plan includes free SSL, free CDN, and active uptime monitoring.',
    addons: [
        { title: 'Domain Registration', desc: 'Registered and pointed to your site for you.', model: 'From MWK 25,000/year' },
        { title: 'Business Email', desc: 'Professional @yourdomain email addresses.', model: 'From MWK 2,000/mo' },
        { title: 'E-commerce Setup', desc: 'Full online store setup with local payment options.', model: 'One-time fee' },
        { title: 'SEO & Speed Optimization', desc: 'Get found on Google and load fast.', model: 'One-time fee' }
    ],
    projects: [
        { tag: 'Web App', title: 'Project Name One', desc: 'A brief one-liner about what this app does and why it matters.', stack: ['React', 'Node.js', 'PostgreSQL'] }
    ],
    about: {
        heading: 'Brandfletch Dev Studio',
        paragraphs: [
            'Brandfletch Dev Studio is a Malawian software studio that designs, builds, and hosts websites and web applications. We build custom platforms from scratch — not templates — tailored to the specific needs of each business we work with.',
            'Beyond custom development, we offer full web hosting with cPanel access. Whether we build your site or you bring your own, we keep it fast, secure, and online. Everything is billed locally in Malawi Kwacha.',
            'We have built and maintain a portfolio of platforms serving thousands of users across e-commerce, education, accounting, advertising, and communications. Every project we take on is built to scale.'
        ],
    },
    stats: [
        { num: '50+', label: 'Websites built' },
        { num: '6', label: 'Platform products shipped' },
        { num: '99.9%', label: 'Uptime guarantee' },
        { num: '24/7', label: 'Support monitoring' }
    ],
    capabilities: [
        { title: 'Custom Web Development', desc: 'Custom websites and web applications from scratch.', items: ['React & Next.js', 'Node.js & Express', 'PostgreSQL & MongoDB', 'REST & WebSocket APIs'] },
        { title: 'Web Hosting', desc: 'Full hosting with cPanel access.', items: ['Web hosting', 'Full cPanel hosting', 'Free SSL certificates', 'Daily backups & monitoring'] },
        { title: 'Design & User Experience', desc: 'Fast, intuitive interfaces that work on any connection.', items: ['Responsive design', 'Mobile-first approach', 'Performance optimization', 'SEO foundations'] },
        { title: 'Ongoing Support', desc: 'Security patches, updates, backups, and maintenance.', items: ['Security patches', 'Software updates', 'Daily backups', 'Dedicated support contact'] }
    ],
    industries: ['E-commerce', 'Education', 'Accounting & Finance', 'Advertising', 'Communications', 'Professional Services', 'Real Estate', 'Hospitality'],
    aboutCta: { text: 'Want to see what we can build for you?', linkLabel: 'Start a Project' },
    contact: {
        heading: "Let's build your website.",
        sub: "Tell us about your business — whether you need a custom build, cPanel web hosting, or all of the above.",
        email: 'hello@brandfletch.dev',
    }
};
function formatMWK(amount) {
    if (amount === null || amount === undefined) return '';
    return 'MWK ' + Number(amount).toLocaleString('en-US');
}

// --- Load content from API ---
async function loadContent() {
    try {
        const res = await fetch('/api/content');
        if (res.ok) {
            siteContent = await res.json();
        }
    } catch (e) {
        // Use defaults
    }
    if (!siteContent) siteContent = defaultContent;
}

// --- Render Hero ---
function renderHero() {
    const hero = siteContent.hero || defaultContent.hero;
    document.getElementById('heroTag').textContent = hero.tag || '';
    document.getElementById('heroHeading').innerHTML =
        `${hero.headingPre || ''} <span class="accent">${hero.headingAccent || ''}</span><br>${hero.headingPost || ''}`;
    document.getElementById('heroSub').textContent = hero.sub || '';

    const ctaPrimary = document.getElementById('heroCtaPrimary');
    ctaPrimary.textContent = hero.ctaPrimaryLabel || 'See Hosting Plans';
    ctaPrimary.href = hero.ctaPrimaryHref || '#hosting';

    const ctaSecondary = document.getElementById('heroCtaSecondary');
    ctaSecondary.textContent = hero.ctaSecondaryLabel || 'Start a Project';
    ctaSecondary.href = hero.ctaSecondaryHref || '#contact';
}

// --- Render Projects ---
function renderProjects() {
    const grid = document.getElementById('workGrid');
    const all = siteContent.projects || defaultContent.projects;
    // Only show projects marked "featured" in the admin panel.
    // Falls back to showing everything if nothing has been marked yet,
    // so the section is never empty.
    const featured = all.filter(p => p.featured);
    const projects = featured.length > 0 ? featured : all;
    grid.innerHTML = projects.map(p => `
        <a href="${p.link || '#'}" target="_blank" rel="noopener" class="work-card reveal">
            <span class="work-card-tag">${p.tag || ''}</span>
            <h3>${p.title || ''}</h3>
            <p>${p.desc || ''}</p>
            <div class="work-stack">
                ${(p.stack || []).map(s => `<span>${s}</span>`).join('')}
            </div>
        </a>
    `).join('');
}

// --- Render Services ---
function renderServices() {
    const grid = document.getElementById('servicesGrid');
    const services = siteContent.services || defaultContent.services;
    grid.innerHTML = services.map(s => `
        <div class="service-card reveal">
            ${s.model ? `<span class="service-model">${s.model}</span>` : ''}
            <h3>${s.title || ''}</h3>
            <p>${s.desc || ''}</p>
        </div>
    `).join('');
}

// --- Render Hosting Packages ---
function renderHosting() {
    const cpGrid = document.getElementById('cpanelPricingGrid');
    const cpPackages = siteContent.hostingCpanel || defaultContent.hostingCpanel;

    const cardHTML = (p) => `
        <div class="pricing-card reveal ${p.highlighted ? 'pricing-card-highlight' : ''}">
            ${p.highlighted ? '<span class="pricing-badge">Most Popular</span>' : ''}
            <h3>${p.name || ''}</h3>
            <p class="pricing-tagline">${p.tagline || ''}</p>
            <div class="pricing-amount">
                <span class="pricing-price">${formatMWK(p.priceMonthlyMWK)}</span>
                <span class="pricing-period">/month</span>
            </div>
            <p class="pricing-yearly">or ${formatMWK(p.priceYearlyMWK)}/year</p>
            <ul class="pricing-features">
                ${(p.features || []).map(f => `<li>${f}</li>`).join('')}
            </ul>
            <button class="btn btn-ghost pricing-cta" data-plan-key="cpanel-${p.name.toLowerCase()}" data-plan-name="${p.name}" data-category="cpanel">Order Now</button>
        </div>
    `;

    if (cpGrid) cpGrid.innerHTML = cpPackages.map(cardHTML).join('');

    // Wire up Order Now buttons to checkout
    document.querySelectorAll('.pricing-cta[data-plan-key]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            if (window.BrandfletchCheckout) {
                window.BrandfletchCheckout.openCheckout(
                    this.getAttribute('data-plan-key'),
                    this.getAttribute('data-plan-name'),
                    this.getAttribute('data-category')
                );
            }
        });
    });

    document.getElementById('hostingNote').textContent = siteContent.hostingNote || defaultContent.hostingNote || '';
}

// --- Render Add-ons ---
function renderAddons() {
    const grid = document.getElementById('addonGrid');
    const addons = siteContent.addons || defaultContent.addons;
    grid.innerHTML = addons.map(a => `
        <div class="addon-card reveal">
            ${a.model ? `<span class="service-model">${a.model}</span>` : ''}
            <h3>${a.title || ''}</h3>
            <p>${a.desc || ''}</p>
        </div>
    `).join('');
}

// --- Render About ---
function renderAbout() {
    const about = siteContent.about || defaultContent.about;
    document.getElementById('aboutHeading').textContent = about.heading || '';
    const p1 = document.getElementById('aboutP1');
    const p2 = document.getElementById('aboutP2');
    const p3 = document.getElementById('aboutP3');
    if (p1) p1.textContent = (about.paragraphs && about.paragraphs[0]) || '';
    if (p2) p2.textContent = (about.paragraphs && about.paragraphs[1]) || '';
    if (p3) p3.textContent = (about.paragraphs && about.paragraphs[2]) || '';

    const statsWrap = document.getElementById('aboutStats');
    const stats = siteContent.stats || defaultContent.stats;
    statsWrap.innerHTML = stats.map(s => `
        <div class="stat">
            <span class="stat-num">${s.num || ''}</span>
            <span class="stat-label">${s.label || ''}</span>
        </div>
    `).join('');

    // Render capabilities grid
    const capGrid = document.getElementById('aboutCapabilities');
    const capabilities = siteContent.capabilities || defaultContent.capabilities;
    if (capGrid && capabilities) {
        capGrid.innerHTML = capabilities.map(c => `
            <div class="capability-card reveal">
                <h3>${c.title || ''}</h3>
                <p>${c.desc || ''}</p>
                <ul class="capability-items">
                    ${(c.items || []).map(i => `<li>${i}</li>`).join('')}
                </ul>
            </div>
        `).join('');
    }

    // Render industries
    const indTags = document.getElementById('industryTags');
    const industries = siteContent.industries || defaultContent.industries;
    if (indTags && industries) {
        indTags.innerHTML = industries.map(i => `<span>${i}</span>`).join('');
    }

    // Render CTA
    const cta = siteContent.aboutCta || defaultContent.aboutCta;
    const ctaText = document.getElementById('aboutCtaText');
    const ctaLink = document.getElementById('aboutCtaLink');
    if (ctaText && cta.text) ctaText.textContent = cta.text;
    if (ctaLink && cta.linkLabel) ctaLink.textContent = cta.linkLabel;
}

// --- Render Contact ---
function renderContact() {
    const contact = siteContent.contact || defaultContent.contact;
    document.getElementById('contactHeading').textContent = contact.heading || '';
    document.getElementById('contactSub').textContent = contact.sub || '';

    const emailLink = document.getElementById('contactEmailLink');
    if (emailLink && contact.email) {
        emailLink.href = 'mailto:' + contact.email;
        emailLink.querySelector('span').textContent = contact.email;
    }
}

// --- Nav Scroll Effect ---
function initNavScroll() {
    const nav = document.getElementById('nav');
    window.addEventListener('scroll', () => {
        nav.classList.toggle('scrolled', window.scrollY > 40);
    });
}

// --- Mobile Menu ---
function initMobileMenu() {
    const toggle = document.getElementById('navToggle');
    const links = document.getElementById('navLinks');

    toggle.addEventListener('click', () => {
        toggle.classList.toggle('active');
        links.classList.toggle('open');
    });

    links.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            toggle.classList.remove('active');
            links.classList.remove('open');
        });
    });
}

// --- Scroll Reveal ---
function initReveal() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

    document.querySelectorAll('.reveal, .work-card, .service-card, .pricing-card, .addon-card, .stat, .section-head, .about-text, .contact-wrap')
        .forEach(el => {
            el.classList.add('reveal');
            observer.observe(el);
        });
}

// --- Contact Form ---
function initContactForm() {
    const form = document.getElementById('contactForm');
    const status = document.getElementById('formStatus');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        status.className = 'form-status sending';
        status.textContent = 'Sending...';

        const data = {
            name: form.name.value,
            email: form.email.value,
            subject: form.subject.value,
            message: form.message.value
        };

        try {
            const res = await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (res.ok) {
                status.className = 'form-status success';
                status.textContent = "Message sent! We'll get back to you soon.";
                form.reset();
            } else {
                const err = await res.json();
                throw new Error(err.error || 'Server error');
            }
        } catch (err) {
            status.className = 'form-status error';
            status.textContent = 'Something went wrong. Try emailing us directly.';
        }

        setTimeout(() => {
            status.textContent = '';
            status.className = 'form-status';
        }, 6000);
    });
}

// --- Init ---
document.addEventListener('DOMContentLoaded', async () => {
    await loadContent();
    renderHero();
    renderServices();
    renderHosting();
    renderAddons();
    renderProjects();
    renderAbout();
    renderContact();
    initNavScroll();
    initMobileMenu();
    initReveal();
    initContactForm();
});

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
        headingAccent: 'WordPress websites',
        headingPost: 'and host them right.',
        sub: 'Tell us what you need, we design and build your WordPress site, then keep it fast, secure, and online — with hosting billed simply in Malawi Kwacha.',
        ctaPrimaryLabel: 'See Hosting Plans',
        ctaPrimaryHref: '#hosting',
        ctaSecondaryLabel: 'Start a Project',
        ctaSecondaryHref: '#contact'
    },
    services: [
        { title: 'WordPress Website Design & Build', desc: 'A custom-designed WordPress site built around your business.' },
        { title: 'Website Migration', desc: 'Already have a site elsewhere? We move it over with zero downtime.' },
        { title: 'Care & Maintenance Plans', desc: 'Ongoing updates, security patches, and backups.' },
        { title: 'Custom Web Apps & Automations', desc: 'Outgrown WordPress? We can build the custom system you need next.' }
    ],
    hostingPackages: [
        { name: 'Starter', tagline: 'For a single site.', priceMonthlyMWK: 8000, priceYearlyMWK: 80000, features: ['1 website', 'Free SSL', 'Weekly backups'] },
        { name: 'Business', tagline: 'For a few sites.', priceMonthlyMWK: 18000, priceYearlyMWK: 180000, features: ['Up to 5 websites', 'Free SSL', 'Daily backups'], highlighted: true },
        { name: 'Agency', tagline: 'For agencies.', priceMonthlyMWK: 35000, priceYearlyMWK: 350000, features: ['Unlimited websites', 'Free SSL', 'Dedicated support'] }
    ],
    hostingNote: 'Prices shown in Malawi Kwacha.',
    addons: [
        { title: 'Domain Registration', desc: 'Registered and pointed to your site for you.' },
        { title: 'Business Email', desc: 'Professional @yourdomain email addresses.' },
        { title: 'E-commerce Setup', desc: 'WooCommerce store setup with local payment options.' },
        { title: 'SEO & Speed Optimization', desc: 'Get found on Google and load fast.' }
    ],
    projects: [
        { tag: 'Web App', title: 'Project Name One', desc: 'A brief one-liner about what this app does and why it matters.', stack: ['React', 'Node.js', 'PostgreSQL'], link: 'https://github.com/Brandfletch-Dev-Studio' }
    ],
    about: {
        heading: 'A dev studio that also hosts what it builds.',
        paragraphs: [
            'Brandfletch Dev Studio designs and builds WordPress websites, then hosts them.',
            'Because we are also a full software studio, we are not limited to WordPress.'
        ],
        githubUrl: 'https://github.com/Brandfletch-Dev-Studio'
    },
    stats: [
        { num: '50+', label: 'Websites built' },
        { num: '99.9%', label: 'Uptime guarantee' },
        { num: '24/7', label: 'Support monitoring' }
    ],
    contact: {
        heading: "Let's build your website.",
        sub: "Tell us about your business — we'll design, build, and host your WordPress site.",
        email: 'hello@brandfletch.dev',
        githubUrl: 'https://github.com/Brandfletch-Dev-Studio'
    }
};

// --- Formatting helpers ---
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
            <h3>${s.title || ''}</h3>
            <p>${s.desc || ''}</p>
        </div>
    `).join('');
}

// --- Render Hosting Packages ---
function renderHosting() {
    const grid = document.getElementById('pricingGrid');
    const packages = siteContent.hostingPackages || defaultContent.hostingPackages;
    grid.innerHTML = packages.map(p => `
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
            <a href="#contact" class="btn btn-ghost pricing-cta">Get Started</a>
        </div>
    `).join('');

    document.getElementById('hostingNote').textContent = siteContent.hostingNote || defaultContent.hostingNote || '';
}

// --- Render Add-ons ---
function renderAddons() {
    const grid = document.getElementById('addonGrid');
    const addons = siteContent.addons || defaultContent.addons;
    grid.innerHTML = addons.map(a => `
        <div class="addon-card reveal">
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
    if (p1) p1.textContent = (about.paragraphs && about.paragraphs[0]) || '';
    if (p2) p2.textContent = (about.paragraphs && about.paragraphs[1]) || '';
    const githubLink = document.getElementById('aboutGithubLink');
    if (githubLink && about.githubUrl) githubLink.href = about.githubUrl;

    const statsWrap = document.getElementById('aboutStats');
    const stats = siteContent.stats || defaultContent.stats;
    statsWrap.innerHTML = stats.map(s => `
        <div class="stat">
            <span class="stat-num">${s.num || ''}</span>
            <span class="stat-label">${s.label || ''}</span>
        </div>
    `).join('');
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
    const githubLink = document.getElementById('contactGithubLink');
    if (githubLink && contact.githubUrl) githubLink.href = contact.githubUrl;
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

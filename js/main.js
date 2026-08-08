/* ===================================
   BRANDFLETCH DEV STUDIO
   Main JS
   =================================== */

// --- Project Data ---
// Add your projects here — they'll render automatically.
const projects = [
    {
        tag: 'Web App',
        title: 'Project Name One',
        desc: 'A brief one-liner about what this app does and why it matters.',
        stack: ['React', 'Node.js', 'PostgreSQL'],
        link: 'https://github.com/Brandfletch-Dev-Studio'
    },
    {
        tag: 'Automation',
        title: 'Project Name Two',
        desc: 'Another solid project description that explains the value.',
        stack: ['Python', 'Redis', 'Docker'],
        link: 'https://github.com/Brandfletch-Dev-Studio'
    },
    {
        tag: 'API',
        title: 'Project Name Three',
        desc: 'Something about this service, what it powers, who uses it.',
        stack: ['TypeScript', 'Express', 'MongoDB'],
        link: 'https://github.com/Brandfletch-Dev-Studio'
    },
    {
        tag: 'Mobile',
        title: 'Project Name Four',
        desc: 'Cross-platform app that does X for Y audience.',
        stack: ['React Native', 'Firebase'],
        link: 'https://github.com/Brandfletch-Dev-Studio'
    },
    {
        tag: 'Tool',
        title: 'Project Name Five',
        desc: 'A dev tool or CLI that makes life easier for developers.',
        stack: ['Go', 'CLI', 'OSS'],
        link: 'https://github.com/Brandfletch-Dev-Studio'
    },
    {
        tag: 'Web App',
        title: 'Project Name Six',
        desc: 'Full-stack application with real-time features.',
        stack: ['Next.js', 'WebSocket', 'Redis'],
        link: 'https://github.com/Brandfletch-Dev-Studio'
    }
];

// --- Render Projects ---
function renderProjects() {
    const grid = document.getElementById('workGrid');
    grid.innerHTML = projects.map(p => `
        <a href="${p.link}" target="_blank" rel="noopener" class="work-card reveal">
            <span class="work-card-tag">${p.tag}</span>
            <h3>${p.title}</h3>
            <p>${p.desc}</p>
            <div class="work-stack">
                ${p.stack.map(s => `<span>${s}</span>`).join('')}
            </div>
        </a>
    `).join('');
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

    document.querySelectorAll('.reveal, .work-card, .service-card, .stat, .section-head, .about-text, .contact-wrap')
        .forEach(el => {
            el.classList.add('reveal');
            observer.observe(el);
        });
}

// --- Contact Form (Vercel Forms) ---
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
            const res = await fetch('/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams(data).toString()
            });

            if (res.ok || res.status === 201 || res.status === 200) {
                status.className = 'form-status success';
                status.textContent = 'Message sent! We\'ll get back to you soon.';
                form.reset();
            } else {
                throw new Error('Server error');
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
document.addEventListener('DOMContentLoaded', () => {
    renderProjects();
    initNavScroll();
    initMobileMenu();
    initReveal();
    initContactForm();
});

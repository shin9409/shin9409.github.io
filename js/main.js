const DEFAULT_SITE_SETTINGS = {
    heroEyebrow: 'LOOKUP MEDIA / SEOUL',
    heroTitle: 'PRODUCTION\n& LIGHTING',
    heroSubtitle: 'FILM · MUSIC VIDEO · COMMERCIAL',
    heroWorkIds: ['work002', 'work003'],
    introTitle: 'EVERY FRAME BEGINS WITH A CLEAR POINT OF VIEW.',
    introBody: 'LOOKUP MEDIA는 아이디어에서 현장, 마지막 프레임까지 하나의 시선으로 연결합니다. 프로덕션과 조명을 통해 이야기의 가장 정확한 분위기를 만듭니다.',
    contactEmail: 'lookupmedia@naver.com',
    contactPhone: '010-2433-0583',
    contactAddress: '경기도 고양시 덕양구 지축4로 45 101,102호',
    instagramUrl: 'https://www.instagram.com/lookupmedia_'
};

let allWorks = [];
let siteSettings = { ...DEFAULT_SITE_SETTINGS };
let siteNavigation = [];

document.addEventListener('DOMContentLoaded', async () => {
    setupShell();

    const [works, site] = await Promise.all([fetchWorks(), fetchSite()]);
    allWorks = works;
    siteSettings = { ...DEFAULT_SITE_SETTINGS, ...(site.settings || {}) };
    siteNavigation = site.navigation || [];
    updateSharedContent();

    switch (document.body.dataset.page) {
        case 'home':
            renderHome();
            break;
        case 'works':
            renderWorksArchive();
            break;
        case 'detail':
            renderWorkDetail();
            break;
        default:
            break;
    }

    setupRevealObserver();
});

async function fetchWorks() {
    try {
        const response = await fetch('/api/works', { headers: { accept: 'application/json' } });
        if (!response.ok) throw new Error(`API returned ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data.works)) throw new Error('Invalid works response');
        return data.works;
    } catch (error) {
        console.warn('Works API unavailable; using static fallback', error);
        return loadStaticWorksFallback();
    }
}

async function loadStaticWorksFallback() {
    if (window.portfolioData?.works) return window.portfolioData.works;
    await new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'js/data.js';
        script.onload = resolve;
        script.onerror = resolve;
        document.head.appendChild(script);
    });
    return window.portfolioData?.works || [];
}

async function fetchSite() {
    try {
        const response = await fetch('/api/site', { headers: { accept: 'application/json' } });
        if (!response.ok) throw new Error(`API returned ${response.status}`);
        return response.json();
    } catch (error) {
        console.warn('Site settings unavailable; using defaults', error);
        return { settings: DEFAULT_SITE_SETTINGS, navigation: [] };
    }
}

function setupShell() {
    const header = document.getElementById('site-header');
    const menuButton = document.querySelector('.menu-toggle');
    const nav = document.getElementById('primary-nav');
    const mobileMenu = window.matchMedia('(max-width: 760px)');

    const updateHeader = () => header?.classList.toggle('is-scrolled', window.scrollY > 24);
    const syncMenuAccessibility = () => {
        if (!nav || !menuButton) return;
        const open = menuButton.getAttribute('aria-expanded') === 'true';
        if (mobileMenu.matches) {
            nav.inert = !open;
            nav.setAttribute('aria-hidden', String(!open));
        } else {
            nav.inert = false;
            nav.removeAttribute('aria-hidden');
        }
    };
    updateHeader();
    syncMenuAccessibility();
    window.addEventListener('scroll', updateHeader, { passive: true });
    window.addEventListener('resize', syncMenuAccessibility, { passive: true });

    menuButton?.addEventListener('click', () => {
        const open = menuButton.getAttribute('aria-expanded') !== 'true';
        menuButton.setAttribute('aria-expanded', String(open));
        nav?.classList.toggle('is-open', open);
        document.body.classList.toggle('menu-open', open);
        menuButton.querySelector('.menu-toggle__label').textContent = open ? 'Close' : 'Menu';
        syncMenuAccessibility();
        if (open) nav?.querySelector('a')?.focus();
        else menuButton.focus();
    });

    nav?.addEventListener('click', (event) => {
        if (!event.target.closest('a')) return;
        menuButton?.setAttribute('aria-expanded', 'false');
        nav.classList.remove('is-open');
        document.body.classList.remove('menu-open');
        syncMenuAccessibility();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || !nav?.classList.contains('is-open')) return;
        menuButton?.click();
        menuButton?.focus();
    });

    const year = document.getElementById('footer-year');
    if (year) year.textContent = new Date().getFullYear();
}

function updateSharedContent() {
    const dynamicNav = document.getElementById('dynamic-nav');
    if (dynamicNav) {
        dynamicNav.innerHTML = siteNavigation.map((item) => (
            `<a href="page.html?slug=${encodeURIComponent(item.slug)}">${escapeHtml(item.title)}</a>`
        )).join('');
    }

    setLink('footer-email', `mailto:${siteSettings.contactEmail}`, siteSettings.contactEmail);
    setLink('footer-instagram', siteSettings.instagramUrl, 'Instagram ↗');
    setLink('contact-email', `mailto:${siteSettings.contactEmail}`, siteSettings.contactEmail);
    setLink('contact-phone', `tel:${siteSettings.contactPhone.replace(/[^\d+]/g, '')}`, siteSettings.contactPhone);
    const instagramHandle = siteSettings.instagramUrl.match(/instagram\.com\/([^/?#]+)/i)?.[1];
    setLink('contact-instagram', siteSettings.instagramUrl, instagramHandle ? `@${instagramHandle} ↗` : 'Instagram ↗');
    setText('contact-address', siteSettings.contactAddress);
}

function renderHome() {
    setText('hero-eyebrow', siteSettings.heroEyebrow);
    setText('hero-title', siteSettings.heroTitle);
    setText('hero-subtitle', siteSettings.heroSubtitle);
    setText('featured-archive-count', String(allWorks.length).padStart(2, '0'));

    const selected = allWorks.filter((work) => work.featured);
    renderWorkGrid('featured-works-grid', (selected.length ? selected : allWorks).slice(0, 6));
    setupHeroSequence(resolveHeroWorks());
}

function resolveHeroWorks() {
    const configured = (siteSettings.heroWorkIds || [])
        .map((id) => allWorks.find((work) => work.id === id))
        .filter(Boolean);
    return (configured.length ? configured : allWorks.slice(0, 3)).slice(0, 5);
}

function setupHeroSequence(works) {
    const media = document.getElementById('hero-media');
    const progress = document.getElementById('hero-progress');
    const hero = document.getElementById('hero-sequence');
    const toggle = document.getElementById('hero-toggle');
    const projectTitle = document.getElementById('hero-project-title');
    const projectMeta = document.getElementById('hero-project-meta');
    const projectLink = document.getElementById('hero-project-link');
    if (!media || !works.length) return;

    media.innerHTML = works.map((work, index) => {
        const image = sequenceImage(work);
        return `<div class="hero-frame${index === 0 ? ' is-active' : ''}" data-src="${escapeAttribute(image)}">${index === 0 ? `<img src="${escapeAttribute(image)}" alt="" fetchpriority="high">` : ''}</div>`;
    }).join('');
    progress.innerHTML = works.map((_, index) => `<span class="${index === 0 ? 'is-active' : ''}"></span>`).join('');

    const frames = [...media.querySelectorAll('.hero-frame')];
    const bars = [...progress.querySelectorAll('span')];
    let current = 0;
    let paused = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ensureLoaded = (index) => {
        const frame = frames[index];
        if (!frame || frame.querySelector('img')) return;
        const image = document.createElement('img');
        image.src = frame.dataset.src;
        image.alt = '';
        image.decoding = 'async';
        frame.appendChild(image);
    };

    const show = (index) => {
        current = index;
        ensureLoaded(index);
        frames.forEach((frame, frameIndex) => frame.classList.toggle('is-active', frameIndex === index));
        bars.forEach((bar, barIndex) => {
            bar.classList.remove('is-active');
            if (barIndex === index) requestAnimationFrame(() => bar.classList.add('is-active'));
        });
        const work = works[index];
        projectTitle.textContent = work.title;
        projectMeta.textContent = `${labelFor(work.majorCategory)} / ${work.role || work.date || ''}`;
        projectLink.href = `work-detail.html?id=${encodeURIComponent(work.id)}`;
        if (works.length > 1) window.setTimeout(() => ensureLoaded((index + 1) % works.length), 3800);
    };

    const updateToggle = () => {
        if (!toggle) return;
        const canCycle = works.length > 1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        toggle.hidden = !canCycle;
        toggle.setAttribute('aria-pressed', String(paused));
        toggle.textContent = paused ? 'Play sequence' : 'Pause sequence';
        hero?.classList.toggle('is-paused', paused);
    };

    show(0);
    updateToggle();
    toggle?.addEventListener('click', () => {
        paused = !paused;
        updateToggle();
    });
    if (works.length > 1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        window.setInterval(() => {
            if (!paused) show((current + 1) % works.length);
        }, 6000);
    }
}

function renderWorksArchive() {
    setText('archive-total', String(allWorks.length).padStart(2, '0'));
    const params = new URLSearchParams(window.location.search);
    const initialMajor = ['production', 'lighting'].includes(params.get('filter')) ? params.get('filter') : 'all';
    const initialMinor = ['musicvideo', 'film', 'commercial', 'etc'].includes(params.get('type')) ? params.get('type') : 'all';
    setupFilters(initialMajor, initialMinor);
}

function setupFilters(initialMajor, initialMinor) {
    const majorButtons = [...document.querySelectorAll('.filter-btn')];
    const minorButtons = [...document.querySelectorAll('.sub-filter-btn')];
    let currentMajor = initialMajor;
    let currentMinor = initialMinor;

    const apply = () => {
        majorButtons.forEach((button) => {
            const active = button.dataset.filter === currentMajor;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', String(active));
        });
        minorButtons.forEach((button) => {
            const active = button.dataset.filter === currentMinor;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', String(active));
        });
        const filtered = allWorks.filter((work) => (
            (currentMajor === 'all' || work.majorCategory === currentMajor)
            && (currentMinor === 'all' || work.minorCategory === currentMinor)
        ));
        setText('filter-count', filtered.length);
        renderWorkGrid('all-works-grid', filtered);

        const url = new URL(window.location.href);
        currentMajor === 'all' ? url.searchParams.delete('filter') : url.searchParams.set('filter', currentMajor);
        currentMinor === 'all' ? url.searchParams.delete('type') : url.searchParams.set('type', currentMinor);
        window.history.replaceState({}, '', url);
    };

    majorButtons.forEach((button) => button.addEventListener('click', () => {
        currentMajor = button.dataset.filter;
        apply();
    }));
    minorButtons.forEach((button) => button.addEventListener('click', () => {
        currentMinor = button.dataset.filter;
        apply();
    }));
    apply();
}

function renderWorkGrid(containerId, works) {
    const grid = document.getElementById(containerId);
    if (!grid) return;
    if (!works.length) {
        grid.innerHTML = '<p class="empty-state">No projects match this selection.</p>';
        return;
    }
    grid.innerHTML = works.map(createWorkCard).join('');
    grid.querySelectorAll('.work-card').forEach((card, index) => {
        card.style.setProperty('--delay', `${Math.min(index * 55, 330)}ms`);
        card.classList.add('reveal');
    });
    setupRevealObserver();
}

function createWorkCard(work, index) {
    return `
        <a class="work-card" href="work-detail.html?id=${encodeURIComponent(work.id)}" aria-label="View ${escapeAttribute(work.title)}">
            <div class="work-card__media">
                <img src="${escapeAttribute(work.thumbnail)}" alt="${escapeAttribute(work.title)}" loading="lazy" decoding="async">
                <span class="work-card__index">${String(index + 1).padStart(2, '0')}</span>
                <span class="work-card__arrow" aria-hidden="true">↗</span>
            </div>
            <div class="work-card__info">
                <h3>${escapeHtml(work.title)}</h3>
                <p>${escapeHtml(labelFor(work.majorCategory))}<br>${escapeHtml(work.date || '')} / ${escapeHtml(work.role || '')}</p>
            </div>
        </a>
    `;
}

function renderWorkDetail() {
    const id = new URLSearchParams(window.location.search).get('id');
    const index = allWorks.findIndex((work) => work.id === id);
    const work = allWorks[index];
    const container = document.getElementById('work-detail-container');
    if (!container || !work) {
        if (container) container.innerHTML = '<div class="detail-skeleton"><p>Project not found.</p><a class="text-link" href="works.html">Back to works</a></div>';
        return;
    }

    document.title = `${work.title} — LOOKUP MEDIA`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', `${work.title}, ${work.role || labelFor(work.majorCategory)} — LOOKUP MEDIA`);

    const previous = allWorks[(index - 1 + allWorks.length) % allWorks.length];
    const next = allWorks[(index + 1) % allWorks.length];
    const videoId = getYouTubeId(work.youtubeUrl);
    const credits = Array.isArray(work.credits) ? work.credits : [];
    const stills = Array.isArray(work.stills) ? work.stills : [];

    container.innerHTML = `
        <section class="project-hero">
            <div class="project-hero__media" id="project-media"><img src="${escapeAttribute(heroImage(work))}" alt="${escapeAttribute(work.title)}"></div>
            <div class="project-hero__shade"></div>
            <div class="project-hero__content">
                <div class="project-hero__topline"><a class="project-hero__back" href="works.html">← All works</a><p class="eyebrow">${escapeHtml(labelFor(work.majorCategory))} / ${escapeHtml(work.minorCategory || '')}</p></div>
                <h1>${escapeHtml(work.title)}</h1>
                <div class="project-hero__bottom">
                    <div class="project-hero__meta"><span>${escapeHtml(work.date || 'Undated')}</span><span>${escapeHtml(work.role || '')}</span></div>
                    ${videoId ? '<button type="button" class="play-button" id="play-film"><span>▶</span> Play film</button>' : ''}
                </div>
            </div>
        </section>
        <section class="project-info shell">
            <div class="project-info__sticky reveal"><p class="eyebrow">ABOUT THE PROJECT</p><p>${escapeHtml(work.description || 'Project information will be updated soon.')}</p></div>
            <div class="project-credits reveal">
                ${credits.length ? credits.map((credit) => `<div class="credit-item"><span class="credit-item__role">${escapeHtml(credit.role || '')}</span><p>${escapeHtml(credit.name || '')}</p></div>`).join('') : '<div class="credit-item"><span class="credit-item__role">Role</span><p>' + escapeHtml(work.role || 'LOOKUP MEDIA') + '</p></div>'}
            </div>
        </section>
        ${stills.length ? `<section aria-label="Project stills"><div class="stills-heading"><span>Project stills</span><span>${String(stills.length).padStart(2, '0')} images</span></div><div class="stills-gallery">${stills.map((src, stillIndex) => `<button type="button" class="still-button reveal" data-index="${stillIndex}" aria-label="Open still ${stillIndex + 1} of ${stills.length}"><img src="${escapeAttribute(src)}" alt="Still ${stillIndex + 1} from ${escapeAttribute(work.title)}" loading="lazy" decoding="async"></button>`).join('')}</div></section>` : ''}
        <nav class="project-pagination" aria-label="Adjacent projects">
            <a href="work-detail.html?id=${encodeURIComponent(previous.id)}"><span>Previous project</span><strong>← ${escapeHtml(previous.title)}</strong></a>
            <a href="work-detail.html?id=${encodeURIComponent(next.id)}"><span>Next project</span><strong>${escapeHtml(next.title)} →</strong></a>
        </nav>
        <section class="contact-cta section"><div class="shell"><p class="eyebrow">WORK WITH LOOKUP MEDIA</p><a href="contact.html" class="contact-cta__link">Start a project.<span>↗</span></a></div></section>
    `;

    if (videoId) setupVideoModal(videoId, work.title);
    if (stills.length) setupLightbox(stills, work.title);
}

function setupVideoModal(videoId, title) {
    const modal = document.getElementById('video-modal');
    const frame = document.getElementById('video-modal-frame');
    const closeButton = modal?.querySelector('.video-modal__close');
    const trigger = document.getElementById('play-film');
    if (!modal || !frame || !closeButton || !trigger) return;

    const close = () => {
        modal.classList.add('hidden');
        frame.innerHTML = '';
        document.body.style.overflow = '';
        trigger.focus();
    };
    const open = () => {
        frame.innerHTML = `<iframe src="https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&rel=0&playsinline=1&modestbranding=1" title="${escapeAttribute(title)} video" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        closeButton.focus();
    };

    trigger.addEventListener('click', open);
    closeButton.addEventListener('click', close);
    modal.addEventListener('click', (event) => { if (event.target === modal) close(); });
    modal.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') close();
        if (event.key === 'Tab') {
            event.preventDefault();
            closeButton.focus();
        }
    });
}

function setupLightbox(stills, title) {
    const lightbox = document.getElementById('lightbox');
    const image = document.getElementById('lightbox-img');
    const currentLabel = document.getElementById('lightbox-current');
    const totalLabel = document.getElementById('lightbox-total');
    const closeButton = lightbox.querySelector('.lightbox-close');
    const focusable = [...lightbox.querySelectorAll('button')];
    let current = 0;
    let previousFocus = null;
    totalLabel.textContent = stills.length;

    const show = (index) => {
        current = (index + stills.length) % stills.length;
        image.src = stills[current];
        image.alt = `Still ${current + 1} from ${title}`;
        currentLabel.textContent = current + 1;
    };
    const open = (index, trigger) => {
        previousFocus = trigger;
        show(index);
        lightbox.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        closeButton.focus();
    };
    const close = () => {
        lightbox.classList.add('hidden');
        document.body.style.overflow = '';
        previousFocus?.focus();
    };

    document.querySelectorAll('.still-button').forEach((button) => button.addEventListener('click', () => open(Number(button.dataset.index), button)));
    closeButton.addEventListener('click', close);
    lightbox.querySelector('.lightbox-prev').addEventListener('click', () => show(current - 1));
    lightbox.querySelector('.lightbox-next').addEventListener('click', () => show(current + 1));
    lightbox.addEventListener('click', (event) => { if (event.target === lightbox) close(); });
    lightbox.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') close();
        if (event.key === 'ArrowLeft') show(current - 1);
        if (event.key === 'ArrowRight') show(current + 1);
        if (event.key === 'Tab') {
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
    });

    let startX = 0;
    lightbox.addEventListener('touchstart', (event) => { startX = event.changedTouches[0].screenX; }, { passive: true });
    lightbox.addEventListener('touchend', (event) => {
        const distance = startX - event.changedTouches[0].screenX;
        if (Math.abs(distance) > 50) show(current + (distance > 0 ? 1 : -1));
    }, { passive: true });
}

function setupRevealObserver() {
    const items = document.querySelectorAll('.reveal:not(.is-visible)');
    if (!items.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
        items.forEach((item) => item.classList.add('is-visible'));
        return;
    }
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.style.transitionDelay = entry.target.style.getPropertyValue('--delay');
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
        });
    }, { threshold: .08, rootMargin: '0px 0px -4% 0px' });
    items.forEach((item) => observer.observe(item));
}

function heroImage(work) {
    return work.stills?.[0] || work.thumbnail || '';
}

function sequenceImage(work) {
    return work.thumbnail || work.stills?.[0] || '';
}

function labelFor(value) {
    if (value === 'production') return 'Production';
    if (value === 'lighting') return 'Lighting';
    return String(value || 'Project');
}

function getYouTubeId(url = '') {
    const match = String(url).match(/(?:youtu\.be\/|v\/|embed\/|watch\?v=|&v=)([^#&?]{6,})/);
    return match?.[1] || '';
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value ?? '';
}

function setLink(id, href, label) {
    const element = document.getElementById(id);
    if (!element) return;
    element.href = href || '#';
    element.textContent = label || '';
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, '&#096;');
}

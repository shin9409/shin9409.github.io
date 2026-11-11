const DEFAULT_SITE_SETTINGS = {
    heroEyebrow: 'LOOKUP MEDIA / SEOUL',
    heroTitle: 'Video Production',
    heroSubtitle: 'Music Video · Brand Film · Highlight Film · Web Content',
    heroWorkIds: ['work002', 'work003'],
    introTitle: 'EVERY FRAME BEGINS WITH A CLEAR POINT OF VIEW.',
    introBody: 'LOOKUP MEDIA는 아이디어에서 현장, 마지막 프레임까지 하나의 시선으로 연결합니다.',
    contactEmail: 'contact@lookupmedia.co.kr',
    contactPhone: '010-2433-0583',
    contactAddress: '경기도 고양시 덕양구 지축4로 45 101,102호',
    instagramUrl: 'https://www.instagram.com/lookupmedia_'
};

let allWorks = [];
let siteSettings = { ...DEFAULT_SITE_SETTINGS };
let siteNavigation = [];

// Both API requests start as soon as this script runs instead of waiting for DOMContentLoaded.
const worksRequest = fetchWorks();
const siteRequest = fetchSite();

document.addEventListener('DOMContentLoaded', async () => {
    setupShell();

    const [works, site] = await Promise.all([worksRequest, siteRequest]);
    allWorks = works;
    siteSettings = { ...DEFAULT_SITE_SETTINGS, ...(site.settings || {}) };
    siteNavigation = site.navigation || [];
    updateSharedContent();

    switch (document.body.dataset.page) {
        case 'home':
            renderHome();
            break;
        case 'works':
            renderArchive('production');
            break;
        case 'lighting':
            renderArchive('lighting');
            break;
        case 'detail':
            renderWorkDetail();
            break;
        case 'about':
            renderAboutFlow();
            setupAboutFields();
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
            `<a href="/page?slug=${encodeURIComponent(item.slug)}">${escapeHtml(item.title)}</a>`
        )).join('');
    }

    setLink('footer-email', `mailto:${siteSettings.contactEmail}`, siteSettings.contactEmail);
    setLink('footer-instagram', siteSettings.instagramUrl, 'Instagram ↗');
    setLink('footer-phone', `tel:${siteSettings.contactPhone.replace(/[^\d+]/g, '')}`, siteSettings.contactPhone);
    setText('footer-address', siteSettings.contactAddress);
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
    renderHomeFeatured();
    setupHeroSequence(resolveHeroWorks());
}

// Selected Works uses the admin "Featured" checkbox; without any, the latest production work fills in.
function renderHomeFeatured() {
    const list = document.getElementById('home-featured-list');
    if (!list) return;
    const production = allWorks.filter((work) => work.majorCategory === 'production');
    const featured = production.filter((work) => work.featured);
    const works = (featured.length ? featured : production).slice(0, 4);
    list.closest('.home-featured').hidden = !works.length;
    list.innerHTML = works.map(featureCard).join('');
}

// About shows every work as three drifting rows: production large in the middle, lighting small above and below.
function renderAboutFlow() {
    const flow = document.getElementById('about-flow');
    if (!flow) return;
    const works = allWorks.filter((work) => work.thumbnail);
    flow.closest('.about-works').hidden = !works.length;
    if (!works.length) return;
    const production = works.filter((work) => work.majorCategory === 'production');
    const lighting = works.filter((work) => work.majorCategory !== 'production');
    // Production leads (owner: promote production first); lighting follows as one smaller row.
    const rows = [
        { items: production, speed: 34, dir: 1, main: true },
        { items: lighting, speed: 20, dir: -1 },
    ].filter((row) => row.items.length);
    flow.innerHTML = rows.map((row) => {
        // Repeat short rows so each half is wider than the screen, then double once for a seamless loop.
        const set = row.items.map(aboutTile).join('').repeat(Math.max(1, Math.ceil(12 / row.items.length)));
        return `<div class="about-flow__row${row.main ? ' is-main' : ''}" data-speed="${row.speed}" data-dir="${row.dir}">${set}${set}</div>`;
    }).join('');
    // The second copy of each row is only there for the loop, so keep it away from screen readers and the tab order.
    flow.querySelectorAll('.about-flow__row').forEach((row) => {
        const tiles = [...row.children];
        tiles.slice(tiles.length / 2).forEach((tile) => { tile.setAttribute('aria-hidden', 'true'); tile.tabIndex = -1; });
    });
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) startAboutFlow(flow);
}

// About fields: panels with several scenes take turns cross-fading to the next one, so only one panel changes at a time.
// A hovered panel holds its scene; with reduced motion only the first scene shows.
function setupAboutFields() {
    const panels = [...document.querySelectorAll('.about-field')].filter((panel) => panel.querySelectorAll('img').length > 1);
    if (!panels.length || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let turn = 0;
    window.setInterval(() => {
        const panel = panels[turn % panels.length];
        turn += 1;
        if (document.hidden || panel.matches(':hover')) return;
        const scenes = [...panel.querySelectorAll('img')];
        const current = scenes.findIndex((img) => img.classList.contains('is-on'));
        scenes[current].classList.remove('is-on');
        scenes[(current + 1) % scenes.length].classList.add('is-on');
    }, 2000);
}

function aboutTile(work) {
    const group = work.majorCategory === 'production' ? 'production' : 'lighting';
    const type = typeLabelFor(group, workTypeKey(work));
    const label = group === 'production' ? type : `Lighting${type ? ` · ${type}` : ''}`;
    return `<a class="about-tile" href="/work-detail?id=${encodeURIComponent(work.id)}"><img ${imageSourceAttrs(work.thumbnail, '480px')} alt="" decoding="async"><span class="about-tile__over"><b>${escapeHtml(work.title)}</b><i>${escapeHtml(label)}</i></span></a>`;
}

// Constant drift; scrolling the page adds speed that eases off, and hovering a row slows it right down.
function startAboutFlow(flow) {
    const rows = [...flow.querySelectorAll('.about-flow__row')].map((el) => ({ el, x: 0, speed: Number(el.dataset.speed), dir: Number(el.dataset.dir), hover: false }));
    rows.forEach((row) => {
        row.el.addEventListener('mouseenter', () => { row.hover = true; });
        row.el.addEventListener('mouseleave', () => { row.hover = false; });
    });
    let boost = 0;
    let lastY = window.scrollY;
    let last = performance.now();
    window.addEventListener('scroll', () => {
        boost = Math.min(boost + Math.abs(window.scrollY - lastY) * 4, 900);
        lastY = window.scrollY;
    }, { passive: true });
    const frame = (now) => {
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        boost *= Math.pow(0.04, dt);
        rows.forEach((row) => {
            const half = row.el.scrollWidth / 2;
            const speed = (row.speed + boost * (row.speed / 30)) * (row.hover ? 0.2 : 1);
            row.x += speed * row.dir * dt;
            if (row.x <= -half) row.x += half;
            if (row.x > 0) row.x -= half;
            row.el.style.transform = `translate3d(${row.x.toFixed(2)}px, 0, 0)`;
        });
        requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
}

function featureCard(work) {
    return `
        <a class="home-feature reveal" href="/work-detail?id=${encodeURIComponent(work.id)}">
            <div class="home-feature__media"><img ${imageSourceAttrs(work.thumbnail, '(max-width: 760px) 100vw, 66vw')} alt="${escapeAttribute(work.title)}" loading="lazy" decoding="async"></div>
            <div class="home-feature__text">
                <p class="home-feature__type">${escapeHtml(typeLabelFor(work.majorCategory, workTypeKey(work)))}</p>
                <h3>${escapeHtml(work.title)}</h3>
                <p class="home-feature__meta">${escapeHtml(joinMeta([work.role, displayYear(work.date)]))}</p>
                <span class="home-feature__more">View project <span aria-hidden="true">→</span></span>
            </div>
        </a>
    `;
}

function resolveHeroWorks() {
    const configured = (siteSettings.heroWorkIds || [])
        .map((id) => allWorks.find((work) => work.id === id))
        .filter(Boolean);
    const production = allWorks.filter((work) => work.majorCategory === 'production');
    return (configured.length ? configured : (production.length ? production : allWorks).slice(0, 3)).slice(0, 5);
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
        return `<div class="hero-frame${index === 0 ? ' is-active' : ''}" data-src="${escapeAttribute(image)}">${index === 0 ? `<img ${imageSourceAttrs(image, SIZES_COVER)} alt="" fetchpriority="high">` : ''}</div>`;
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
        setImageSource(image, frame.dataset.src, SIZES_COVER);
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
        projectMeta.textContent = joinMeta([typeLabelFor(work.majorCategory, workTypeKey(work)) || labelFor(work.majorCategory), work.role || displayYear(work.date)]);
        projectLink.href = `/work-detail?id=${encodeURIComponent(work.id)}`;
        if (works.length > 1) window.setTimeout(() => ensureLoaded((index + 1) % works.length), 3800);
    };

    const updateToggle = () => {
        if (!toggle) return;
        const canCycle = works.length > 1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        toggle.hidden = !canCycle;
        toggle.setAttribute('aria-pressed', String(paused));
        toggle.textContent = paused ? 'Play' : 'Pause';
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

const PRODUCTION_TYPES = ['musicvideo', 'commercial', 'highlight', 'webcontent'];
const LIGHTING_TYPES = ['film', 'commercial', 'musicvideo', 'etc'];

function renderArchive(group) {
    const params = new URLSearchParams(window.location.search);
    // Old links pointed at works.html?filter=lighting; lighting now has its own page.
    // Old links pointed at works.html?filter=lighting; lighting now has its own page.
    if (group === 'production' && params.get('filter') === 'lighting') {
        const type = LIGHTING_TYPES.includes(params.get('type')) ? `?type=${params.get('type')}` : '';
        window.location.replace(`/lighting${type}`);
        return;
    }

    const works = allWorks.filter((work) => work.majorCategory === group);
    const typeOf = group === 'production' ? contentTypeOf : (work) => work.minorCategory;
    // Only types that already have work are offered, so an empty type never shows up as a dead filter.
    const types = (group === 'production' ? PRODUCTION_TYPES : LIGHTING_TYPES)
        .filter((type) => works.some((work) => typeOf(work) === type));

    const filterRow = document.getElementById('type-filters');
    if (filterRow) {
        filterRow.innerHTML = ['all', ...types].map((type) => (
            `<button class="filter-btn" data-filter="${type}" type="button" aria-pressed="false">${escapeHtml(type === 'all' ? 'All' : typeLabelFor(group, type))}</button>`
        )).join('');
    }
    const buttons = [...document.querySelectorAll('#type-filters .filter-btn')];
    let current = types.includes(params.get('type')) ? params.get('type') : 'all';

    const apply = () => {
        buttons.forEach((button) => {
            const active = button.dataset.filter === current;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', String(active));
        });
        const filtered = current === 'all' ? works : works.filter((work) => typeOf(work) === current);
        setText('filter-count', filtered.length);
        // The tab already shows the total; the count only appears once a type filter narrows the list.
        const countWrap = document.getElementById('filter-count-wrap');
        if (countWrap) countWrap.hidden = current === 'all';
        renderWorkGrid('all-works-grid', filtered);

        const url = new URL(window.location.href);
        url.searchParams.delete('filter');
        current === 'all' ? url.searchParams.delete('type') : url.searchParams.set('type', current);
        window.history.replaceState({}, '', url);
    };

    buttons.forEach((button) => button.addEventListener('click', () => {
        current = button.dataset.filter;
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
        <a class="work-card" href="/work-detail?id=${encodeURIComponent(work.id)}" aria-label="View ${escapeAttribute(work.title)}">
            <div class="work-card__media">
                <img ${imageSourceAttrs(work.thumbnail, SIZES_HALF)} alt="${escapeAttribute(work.title)}" loading="lazy" decoding="async">
            </div>
            <div class="work-card__info">
                <h3>${escapeHtml(work.title)}</h3>
                <p>${escapeHtml(joinMeta([typeLabelFor(work.majorCategory, workTypeKey(work)), work.role, displayYear(work.date)]))}</p>
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
        if (container) container.innerHTML = '<div class="detail-skeleton"><p>Project not found.</p><a class="text-link" href="/works">Back to works</a></div>';
        return;
    }

    // Same format as the server-rendered title in functions/work-detail.js, so crawlers that run JS see no change.
    const titleLabel = work.majorCategory === 'lighting'
        ? joinMeta(['Lighting', typeLabelFor(work.majorCategory, workTypeKey(work))])
        : typeLabelFor(work.majorCategory, workTypeKey(work));
    document.title = `${work.title}${titleLabel ? ` | ${titleLabel}` : ''} — 룩업미디어 LOOKUP MEDIA`;
    document.querySelector('meta[name="description"]')?.setAttribute('content', `${work.title}, ${work.role || labelFor(work.majorCategory)} — LOOKUP MEDIA`);

    // Previous/next stay inside the same group so production and lighting work never mix.
    const siblings = allWorks.filter((item) => item.majorCategory === work.majorCategory);
    const siblingIndex = siblings.indexOf(work);
    const previous = siblings[(siblingIndex - 1 + siblings.length) % siblings.length];
    const next = siblings[(siblingIndex + 1) % siblings.length];
    const isLighting = work.majorCategory === 'lighting';
    const videoId = getYouTubeId(work.youtubeUrl);
    const credits = Array.isArray(work.credits) ? work.credits : [];
    const stills = Array.isArray(work.stills) ? work.stills : [];

    container.innerHTML = `
        <section class="project-hero${videoId ? ' project-hero--video' : ''}">
            <div class="project-hero__media" id="project-media"><img ${imageSourceAttrs(heroImage(work), SIZES_COVER)} alt="${escapeAttribute(work.title)}"></div>
            ${videoId ? '<button type="button" class="project-hero__play" tabindex="-1" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l12.5-7.5z"/></svg></button>' : ''}
            <div class="project-hero__shade"></div>
            <div class="project-hero__content">
                <div class="project-hero__topline"><a class="project-hero__back" href="${isLighting ? '/lighting' : '/works'}">← ${isLighting ? 'Lighting' : 'Works'}</a><p class="project-hero__group">${escapeHtml(joinMeta([isLighting ? '조명 참여' : '제작', typeLabelFor(work.majorCategory, workTypeKey(work))]))}</p></div>
                <h1>${escapeHtml(work.title)}</h1>
                <div class="project-hero__bottom">
                    <div class="project-hero__meta"><span>${escapeHtml(displayYear(work.date))}</span><span>${escapeHtml(work.role || '')}</span></div>
                    ${videoId ? '<button type="button" class="play-button" id="play-film"><span>▶</span> 영상 보기</button>' : ''}
                </div>
            </div>
        </section>
        <section class="project-info shell${work.description?.trim() ? '' : ' project-info--no-desc'}">
            ${work.description?.trim() ? `<div class="project-info__sticky reveal"><p class="eyebrow">About</p><p>${escapeHtml(work.description)}</p></div>` : ''}
            <div class="project-credits reveal">
                ${credits.length ? credits.map((credit) => `<div class="credit-item"><span class="credit-item__role">${escapeHtml(credit.role || '')}</span><p>${escapeHtml(credit.name || '')}</p></div>`).join('') : '<div class="credit-item"><span class="credit-item__role">Role</span><p>' + escapeHtml(work.role || 'LOOKUP MEDIA') + '</p></div>'}
            </div>
        </section>
        ${stills.length ? `<section aria-label="Project stills"><div class="stills-heading"><span>Stills</span><span>${stills.length}</span></div><div class="stills-gallery">${stills.map((src, stillIndex) => `<button type="button" class="still-button reveal" data-index="${stillIndex}" aria-label="Open still ${stillIndex + 1} of ${stills.length}"><img ${imageSourceAttrs(src, stillIndex % 5 === 0 ? '(max-width: 760px) 100vw, 92vw' : SIZES_HALF)} alt="Still ${stillIndex + 1} from ${escapeAttribute(work.title)}" loading="lazy" decoding="async"></button>`).join('')}</div></section>` : ''}
        <nav class="project-pagination" aria-label="Adjacent projects">
            <a href="/work-detail?id=${encodeURIComponent(previous.id)}"><span>Previous</span><strong>← ${escapeHtml(previous.title)}</strong></a>
            <a href="/work-detail?id=${encodeURIComponent(next.id)}"><span>Next</span><strong>${escapeHtml(next.title)} →</strong></a>
        </nav>
        <section class="contact-cta section"><div class="shell"><a href="/contact" class="contact-cta__link">프로젝트 문의<span>→</span></a></div></section>
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
    // The hero image and its centre play mark open the same film; the bottom button stays the keyboard control.
    document.getElementById('project-media')?.addEventListener('click', open);
    document.querySelector('.project-hero__play')?.addEventListener('click', open);
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

// Dates are stored as YYYY or YYYY-MM; lists show the year only so the two forms read the same.
function displayYear(date) {
    const match = String(date || '').match(/^\d{4}/);
    return match ? match[0] : '';
}

function sequenceImage(work) {
    return work.thumbnail || work.stills?.[0] || '';
}

function labelFor(value) {
    if (value === 'production') return 'Production';
    if (value === 'lighting') return 'Lighting';
    return String(value || 'Project');
}

// Works saved before content types existed (or the static fallback) map from the legacy minor category.
function contentTypeOf(work) {
    if (work.majorCategory !== 'production') return '';
    if (PRODUCTION_TYPES.includes(work.contentType)) return work.contentType;
    return PRODUCTION_TYPES.includes(work.minorCategory) ? work.minorCategory : '';
}

function workTypeKey(work) {
    return work.majorCategory === 'production' ? contentTypeOf(work) : work.minorCategory;
}

function typeLabelFor(group, type) {
    if (group === 'production') {
        return { musicvideo: 'Music Video', commercial: 'Brand & Commercial', highlight: 'Highlight Film', webcontent: 'Web Content' }[type] || '';
    }
    return { musicvideo: 'Music Video', film: 'Film', commercial: 'Commercial', etc: 'Etc' }[type] || '';
}

function joinMeta(parts) {
    const seen = new Set();
    return parts
        .map((part) => String(part || '').trim())
        .filter((part) => part && !seen.has(part.toLowerCase()) && seen.add(part.toLowerCase()))
        .join(' · ');
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

// Cloudflare Image Transformations serve screen-sized copies of R2 images; the 3840px / 0.96 originals
// stay untouched for the lightbox. If resizing is unavailable the img falls back to the original.
const RESIZE_HOST = 'lookupmedia.co.kr';
const RESIZE_WIDTHS = [960, 1600, 2400, 3840];
const RESIZE_FALLBACK = "this.onerror=null;this.removeAttribute('srcset');this.src=this.dataset.original";
// Phones show cover images in a full-width 16:9 frame (css/style.css, max-width 760px); wider screens fill the viewport.
const SIZES_COVER = '(max-width: 760px) 100vw, (max-aspect-ratio: 16/9) 178vh, 100vw';
const SIZES_HALF = '(max-width: 760px) 100vw, 50vw';

function resizedSources(src, sizes) {
    if (!src || location.hostname !== RESIZE_HOST) return null;
    const url = new URL(src, location.origin);
    if (url.origin !== location.origin || !url.pathname.startsWith('/api/assets/')) return null;
    const at = (width) => `/cdn-cgi/image/width=${width},quality=96,fit=scale-down,format=auto${url.pathname}`;
    return { src: at(1600), srcset: RESIZE_WIDTHS.map((width) => `${at(width)} ${width}w`).join(', '), sizes };
}

function imageSourceAttrs(src, sizes) {
    const resized = resizedSources(src, sizes);
    if (!resized) return `src="${escapeAttribute(src)}"`;
    return `src="${resized.src}" srcset="${resized.srcset}" sizes="${resized.sizes}" data-original="${escapeAttribute(src)}" onerror="${RESIZE_FALLBACK}"`;
}

function setImageSource(image, src, sizes) {
    const resized = resizedSources(src, sizes);
    if (!resized) {
        image.src = src;
        return;
    }
    image.dataset.original = src;
    image.onerror = () => {
        image.onerror = null;
        image.removeAttribute('srcset');
        image.src = src;
    };
    image.sizes = resized.sizes;
    image.srcset = resized.srcset;
    image.src = resized.src;
}

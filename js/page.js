document.addEventListener('DOMContentLoaded', async () => {
    const container = document.getElementById('page-content');
    const slug = new URLSearchParams(window.location.search).get('slug');

    if (!slug) {
        container.innerHTML = '<p style="color:#fff;">Page slug is missing.</p>';
        return;
    }

    try {
        const response = await fetch(`/api/pages/${encodeURIComponent(slug)}`);
        if (!response.ok) throw new Error(`Page API returned ${response.status}`);
        const { page } = await response.json();
        const blocks = parsePageBlocks(page.body);
        const description = blocks
            .filter((block) => block.type === 'text' || block.type === 'heading')
            .map((block) => block.text)
            .join(' ')
            .slice(0, 155) || `${page.title} — LOOKUP MEDIA`;

        document.title = `${page.title} — LOOKUP MEDIA`;
        setMeta('description', description);
        setMeta('og:title', `${page.title} — LOOKUP MEDIA`, 'property');
        setMeta('og:description', description, 'property');
        container.innerHTML = `
            <header class="page-article__head reveal is-visible">
                <p class="eyebrow">LOOKUP MEDIA / PAGE</p>
                <h1>${escapeHtml(page.title)}</h1>
            </header>
            <div class="page-blocks-public reveal is-visible">${blocks.map(renderBlock).join('')}</div>
        `;
    } catch (error) {
        console.error(error);
        container.innerHTML = '<p style="color:#fff;">Page not found.</p>';
    }
});

function parsePageBlocks(body) {
    const value = String(body || '').trim();
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
            return parsed.filter((block) => ['heading', 'text', 'image', 'link', 'divider'].includes(block?.type));
        }
    } catch {
        // Older pages remain available as plain text.
    }
    return [{ type: 'text', text: value }];
}

function renderBlock(block) {
    if (block.type === 'heading') return `<h2 class="page-block__heading">${escapeHtml(block.text || '')}</h2>`;
    if (block.type === 'text') return `<p class="page-block__text">${escapeHtml(block.text || '')}</p>`;
    if (block.type === 'image') {
        const src = safeUrl(block.src);
        return src ? `<figure class="page-block__image"><img src="${escapeHtml(src)}" alt="${escapeHtml(block.alt || '')}" loading="lazy" decoding="async">${block.alt ? `<figcaption>${escapeHtml(block.alt)}</figcaption>` : ''}</figure>` : '';
    }
    if (block.type === 'link') {
        const url = safeUrl(block.url);
        const external = /^https?:\/\//i.test(url);
        return url && block.label ? `<a class="text-link page-block__link" href="${escapeHtml(url)}"${external ? ' target="_blank" rel="noreferrer"' : ''}>${escapeHtml(block.label)} <span>↗</span></a>` : '';
    }
    if (block.type === 'divider') return '<hr class="page-block__divider">';
    return '';
}

function safeUrl(value) {
    const url = String(value || '').trim();
    if (!url) return '';
    if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) return url;
    try {
        const parsed = new URL(url);
        return ['http:', 'https:', 'mailto:'].includes(parsed.protocol) ? url : '';
    } catch {
        return '';
    }
}

function setMeta(name, content, attribute = 'name') {
    let element = document.querySelector(`meta[${attribute}="${name}"]`);
    if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attribute, name);
        document.head.appendChild(element);
    }
    element.setAttribute('content', content);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

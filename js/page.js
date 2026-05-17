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
        document.title = `${page.title} - LOOKUP MEDIA`;
        container.innerHTML = `
            <div class="detail-header">
                <h1 class="section-title">${escapeHtml(page.title)}</h1>
            </div>
            <div class="detail-desc dynamic-page-body">${escapeHtml(page.body).replace(/\n/g, '<br>')}</div>
        `;
    } catch (error) {
        console.error(error);
        container.innerHTML = '<p style="color:#fff;">Page not found.</p>';
    }
});

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

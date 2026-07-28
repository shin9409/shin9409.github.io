const state = {
    authenticated: false,
    works: [],
    pages: [],
    siteSettings: {
        heroEyebrow: '',
        heroTitle: '',
        heroSubtitle: '',
        heroWorkIds: [],
        introTitle: '',
        introBody: '',
        contactEmail: '',
        contactPhone: '',
        contactAddress: '',
        instagramUrl: ''
    },
    selectedIds: new Set(),
    currentWorkIndex: -1,
    currentPageSlug: "",
    currentStills: [],
    pendingThumbFile: null,
    pendingStillFiles: []
};

const $ = (selector) => document.querySelector(selector);

const IMAGE_UPLOAD_SETTINGS = {
    thumbMaxSize: 1920,
    stillMaxSize: 3840,
    webpQuality: 0.96
};

const elements = {
    app: $('#admin-app'),
    loginPanel: $('#login-panel'),
    loginForm: $('#login-form'),
    sessionLabel: $('#admin-session-label'),
    logoutBtn: $('#logout-btn'),
    tbody: $('#works-tbody'),
    pagesTbody: $('#pages-tbody'),
    searchInput: $('#search-input'),
    filterMajor: $('#filter-major'),
    filterMinor: $('#filter-minor'),
    dashboard: {
        total: $('#stat-total'),
        production: $('#stat-production'),
        lighting: $('#stat-lighting'),
        featured: $('#stat-featured')
    },
    bulkActions: $('#bulk-actions'),
    selectedCount: $('#selected-count'),
    selectAll: $('#select-all'),
    workForm: $('#work-form'),
    pageForm: $('#page-form'),
    pageBlocks: $('#page-blocks'),
    siteForm: $('#site-form'),
    editorSection: $('#editor-section'),
    pageEditorSection: $('#page-editor-section'),
    modal: $('#preview-modal'),
    previewContainer: $('#preview-frame-container')
};

const commonRoles = [
    "Client", "Director", "Assistant Director", "DOP",
    "Lighting Director", "Gaffer", "Art Director",
    "Editor", "Colorist", "VFX", "Sound", "Stylist",
    "Hair & Makeup", "Producer", "Production Manager"
];

document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    await checkSession();
});

function setupEventListeners() {
    elements.loginForm.addEventListener('submit', handleLogin);
    elements.logoutBtn.addEventListener('click', handleLogout);

    document.querySelectorAll('.tab-btn').forEach((button) => {
        button.addEventListener('click', () => activateTab(button.dataset.tab));
    });

    elements.searchInput.addEventListener('input', renderWorksTable);
    elements.filterMajor.addEventListener('change', renderWorksTable);
    elements.filterMinor.addEventListener('change', renderWorksTable);
    elements.selectAll.addEventListener('change', toggleSelectAll);
    elements.tbody.addEventListener('change', handleSelectionChange);
    elements.tbody.addEventListener('click', handleWorksTableClick);
    elements.pagesTbody.addEventListener('click', handlePagesTableClick);
    $('#hero-selection').addEventListener('click', handleHeroSelectionClick);
    $('#hero-candidates').addEventListener('click', handleHeroCandidateClick);

    $('#add-new-btn').addEventListener('click', () => openWorkEditor(-1));
    $('#add-page-btn').addEventListener('click', () => openPageEditor());
    $('#close-editor-btn').addEventListener('click', closeWorkEditor);
    $('#close-page-editor-btn').addEventListener('click', closePageEditor);
    $('#add-credit-btn').addEventListener('click', () => addCreditRow());
    $('#delete-btn').addEventListener('click', handleDeleteWork);
    $('#delete-page-btn').addEventListener('click', handleDeletePage);
    document.querySelectorAll('[data-add-page-block]').forEach((button) => {
        button.addEventListener('click', () => addPageBlock(button.dataset.addPageBlock));
    });
    elements.pageBlocks.addEventListener('click', handlePageBlockClick);
    $('#preview-btn').addEventListener('click', showPreview);
    $('#bulk-delete-btn').addEventListener('click', handleBulkDelete);
    $('#bulk-category-change').addEventListener('change', handleBulkCategoryChange);
    $('#thumb-file').addEventListener('change', (event) => handleThumbSelect(event.target.files[0]));
    $('#stills-file').addEventListener('change', (event) => handleStillsSelect(Array.from(event.target.files)));
    $('#clear-stills-btn').addEventListener('click', clearAllStills);
    $('#work-youtube').addEventListener('change', handleYoutubeInput);

    elements.workForm.addEventListener('submit', handleSaveWork);
    elements.pageForm.addEventListener('submit', handleSavePage);
    elements.siteForm.addEventListener('submit', handleSaveSite);

    $('.close-modal').addEventListener('click', closePreview);
    elements.modal.addEventListener('click', (event) => {
        if (event.target === elements.modal) closePreview();
    });
}

async function checkSession() {
    const session = await api('/api/admin/session', { publicRequest: true }).catch(() => ({ authenticated: false }));
    state.authenticated = Boolean(session.authenticated);
    setAuthUI();
    if (state.authenticated) await loadAdminData();
}

async function handleLogin(event) {
    event.preventDefault();
    const password = $('#admin-password').value;
    await api('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
        publicRequest: true
    });
    $('#admin-password').value = '';
    state.authenticated = true;
    setAuthUI();
    await loadAdminData();
}

async function handleLogout() {
    await api('/api/admin/logout', { method: 'POST', publicRequest: true }).catch(() => null);
    state.authenticated = false;
    setAuthUI();
}

function setAuthUI() {
    elements.loginPanel.classList.toggle('hidden', state.authenticated);
    elements.app.classList.toggle('hidden', !state.authenticated);
    elements.logoutBtn.classList.toggle('hidden', !state.authenticated);
    elements.sessionLabel.textContent = state.authenticated ? 'Logged in' : 'Not logged in';
}

async function loadAdminData() {
    const [worksData, pagesData, siteData] = await Promise.all([
        api('/api/admin/works'),
        api('/api/admin/pages'),
        api('/api/admin/site')
    ]);
    state.works = worksData.works || [];
    state.pages = pagesData.pages || [];
    state.siteSettings = siteData.settings || state.siteSettings;
    updateStats();
    renderWorksTable();
    renderPagesTable();
    renderSiteSettings();
}

function updateStats() {
    elements.dashboard.total.textContent = state.works.length;
    elements.dashboard.production.textContent = state.works.filter((work) => work.majorCategory === 'production').length;
    elements.dashboard.lighting.textContent = state.works.filter((work) => work.majorCategory === 'lighting').length;
    elements.dashboard.featured.textContent = state.works.filter((work) => work.featured).length;
}

function renderWorksTable() {
    const searchTerm = elements.searchInput.value.toLowerCase();
    const majorFilter = elements.filterMajor.value;
    const minorFilter = elements.filterMinor.value;

    const filteredWorks = state.works.filter((work, index) => {
        work._index = index;
        const matchesSearch = work.title.toLowerCase().includes(searchTerm) || work.id.toLowerCase().includes(searchTerm);
        const matchesMajor = majorFilter === 'all' || work.majorCategory === majorFilter;
        const matchesMinor = minorFilter === 'all' || work.minorCategory === minorFilter;
        return matchesSearch && matchesMajor && matchesMinor;
    });

    elements.tbody.innerHTML = filteredWorks.map((work) => `
        <tr draggable="true" data-index="${work._index}" class="${state.selectedIds.has(work.id) ? 'selected' : ''}">
            <td><input type="checkbox" class="select-row" value="${escapeHtml(work.id)}" ${state.selectedIds.has(work.id) ? 'checked' : ''}></td>
            <td class="cursor-grab">☰</td>
            <td>${escapeHtml(work.id)}</td>
            <td>
                <strong>${escapeHtml(work.title)}</strong><br>
                <small>${work.featured ? '<span style="color:var(--accent)">Featured</span>' : ''}</small>
            </td>
            <td>${escapeHtml(work.majorCategory)} / ${escapeHtml(work.minorCategory)}</td>
            <td>${escapeHtml(work.date || '')}</td>
            <td>
                <div style="display:flex; gap:5px;">
                    <button class="btn btn-sm btn-outline edit-btn" data-index="${work._index}">Edit</button>
                    <button class="btn btn-sm btn-secondary clone-btn" data-index="${work._index}">Copy</button>
                </div>
            </td>
        </tr>
    `).join('');

    setupWorkRowDrag();
    updateBulkActionUI();
}

function renderPagesTable() {
    elements.pagesTbody.innerHTML = state.pages.map((page) => `
        <tr>
            <td>${escapeHtml(page.slug)}</td>
            <td><strong>${escapeHtml(page.title)}</strong><br><small>page.html?slug=${escapeHtml(page.slug)}</small></td>
            <td>${page.published ? 'Published' : 'Draft'}</td>
            <td>
                <button class="btn btn-sm btn-outline page-edit-btn" data-slug="${escapeHtml(page.slug)}">Edit</button>
                <a class="btn btn-sm btn-secondary" href="page.html?slug=${encodeURIComponent(page.slug)}" target="_blank">View</a>
            </td>
        </tr>
    `).join('');
}

function renderSiteSettings() {
    const settings = state.siteSettings;
    $('#site-hero-eyebrow').value = settings.heroEyebrow || '';
    $('#site-hero-title').value = settings.heroTitle || '';
    $('#site-hero-subtitle').value = settings.heroSubtitle || '';
    $('#site-intro-title').value = settings.introTitle || '';
    $('#site-intro-body').value = settings.introBody || '';
    $('#site-contact-email').value = settings.contactEmail || '';
    $('#site-contact-phone').value = settings.contactPhone || '';
    $('#site-contact-address').value = settings.contactAddress || '';
    $('#site-instagram-url').value = settings.instagramUrl || '';
    renderHeroPicker();
}

function renderHeroPicker() {
    const selectedIds = state.siteSettings.heroWorkIds || [];
    const selectedWorks = selectedIds.map((id) => state.works.find((work) => work.id === id)).filter(Boolean);
    $('#hero-selection').innerHTML = selectedWorks.length
        ? selectedWorks.map((work, index) => `
            <article class="hero-work-card" draggable="true" data-id="${escapeHtml(work.id)}">
                <span class="hero-work-card__order">${index + 1}</span>
                <img src="${escapeHtml(work.thumbnail)}" alt="">
                <div><strong>${escapeHtml(work.title)}</strong><small>${escapeHtml(work.role || work.majorCategory)}</small></div>
                <button type="button" class="hero-remove" data-id="${escapeHtml(work.id)}" aria-label="Remove ${escapeHtml(work.title)}">×</button>
            </article>
        `).join('')
        : '<p class="hero-picker-empty">선택한 작품이 없으면 최신 작품 3개가 자동으로 표시됩니다.</p>';

    const candidates = state.works.filter((work) => !selectedIds.includes(work.id));
    $('#hero-candidates').innerHTML = candidates.map((work) => `
        <button type="button" class="hero-candidate" data-id="${escapeHtml(work.id)}" ${selectedIds.length >= 5 ? 'disabled' : ''}>
            <img src="${escapeHtml(work.thumbnail)}" alt=""><span><strong>${escapeHtml(work.title)}</strong><small>+ Add to hero</small></span>
        </button>
    `).join('');
    setupHeroDrag();
}

function handleHeroSelectionClick(event) {
    const button = event.target.closest('.hero-remove');
    if (!button) return;
    state.siteSettings.heroWorkIds = (state.siteSettings.heroWorkIds || []).filter((id) => id !== button.dataset.id);
    renderHeroPicker();
}

function handleHeroCandidateClick(event) {
    const button = event.target.closest('.hero-candidate');
    if (!button || button.disabled) return;
    const selected = state.siteSettings.heroWorkIds || [];
    if (selected.length >= 5 || selected.includes(button.dataset.id)) return;
    state.siteSettings.heroWorkIds = [...selected, button.dataset.id];
    renderHeroPicker();
}

function setupHeroDrag() {
    let draggedId = '';
    document.querySelectorAll('.hero-work-card').forEach((card) => {
        card.addEventListener('dragstart', () => {
            draggedId = card.dataset.id;
            card.classList.add('dragging');
        });
        card.addEventListener('dragover', (event) => event.preventDefault());
        card.addEventListener('drop', () => {
            const targetId = card.dataset.id;
            if (!draggedId || draggedId === targetId) return;
            const ids = [...state.siteSettings.heroWorkIds];
            const from = ids.indexOf(draggedId);
            const to = ids.indexOf(targetId);
            ids.splice(to, 0, ids.splice(from, 1)[0]);
            state.siteSettings.heroWorkIds = ids;
            renderHeroPicker();
        });
        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            draggedId = '';
        });
    });
}

function handleWorksTableClick(event) {
    if (event.target.classList.contains('edit-btn')) {
        openWorkEditor(Number(event.target.dataset.index));
    }
    if (event.target.classList.contains('clone-btn')) {
        cloneWork(Number(event.target.dataset.index));
    }
}

function handlePagesTableClick(event) {
    if (event.target.classList.contains('page-edit-btn')) {
        const page = state.pages.find((item) => item.slug === event.target.dataset.slug);
        if (page) openPageEditor(page);
    }
}

function openWorkEditor(index) {
    state.currentWorkIndex = index;
    state.pendingThumbFile = null;
    state.pendingStillFiles = [];
    state.currentStills = [];
    elements.editorSection.classList.remove('hidden');
    elements.pageEditorSection.classList.add('hidden');
    elements.workForm.reset();
    $('#credits-container').innerHTML = '';
    $('#stills-preview').innerHTML = '';
    $('#stills-path-display').textContent = '';
    $('#thumb-preview').innerHTML = '<span class="text-muted">No image selected</span>';
    $('#thumb-path-display').value = '';

    if (index === -1) {
        $('#editor-title').textContent = 'Add New Work';
        $('#delete-btn').classList.add('hidden');
        $('#work-id').readOnly = true;
        $('#work-id').value = generateNextId();
        $('#work-date').value = new Date().getFullYear();
        updateUploadPathDisplays();
        addCreditRow();
        return;
    }

    const work = state.works[index];
    $('#editor-title').textContent = 'Edit Work';
    $('#delete-btn').classList.remove('hidden');
    $('#work-id').readOnly = true;
    $('#work-id').value = work.id;
    $('#work-title').value = work.title;
    $('#work-featured').checked = work.featured;
    $('#work-major').value = work.majorCategory;
    $('#work-minor').value = work.minorCategory;
    $('#work-date').value = work.date || '';
    $('#work-role').value = work.role || '';
    $('#work-youtube').value = work.youtubeUrl || '';
    $('#work-desc').value = work.description || '';
    $('#thumb-path-display').value = work.thumbnailKey || work.thumbnail || '';
    if (work.thumbnail) $('#thumb-preview').innerHTML = `<img src="${work.thumbnail}" alt="">`;

    (work.credits || []).forEach((credit) => addCreditRow(credit.role, credit.name));
    if (!work.credits || work.credits.length === 0) addCreditRow();

    state.currentStills = [...(work.stillKeys || work.stills || [])];
    renderStillsPreview(work.stills || state.currentStills);
    updateUploadPathDisplays();
}

function closeWorkEditor() {
    elements.editorSection.classList.add('hidden');
    state.currentWorkIndex = -1;
}

function openPageEditor(page = null) {
    state.currentPageSlug = page ? page.slug : "";
    elements.pageEditorSection.classList.remove('hidden');
    elements.editorSection.classList.add('hidden');
    elements.pageForm.reset();
    $('#page-editor-title').textContent = page ? 'Edit Page' : 'Add Page';
    $('#delete-page-btn').classList.toggle('hidden', !page);
    $('#page-slug').disabled = Boolean(page);
    $('#page-slug').value = page ? page.slug : '';
    $('#page-title').value = page ? page.title : '';
    renderPageBlocks(parsePageBlocks(page?.body || ''));
    $('#page-published').checked = page ? page.published : true;
}

function closePageEditor() {
    elements.pageEditorSection.classList.add('hidden');
    state.currentPageSlug = "";
}

function parsePageBlocks(body) {
    const value = String(body || '').trim();
    if (!value) return [{ type: 'text', text: '' }];
    try {
        const blocks = JSON.parse(value);
        if (Array.isArray(blocks)) {
            return blocks.filter((block) => ['heading', 'text', 'image', 'link', 'divider'].includes(block?.type));
        }
    } catch {
        // Existing plain-text pages remain editable as one text block.
    }
    return [{ type: 'text', text: value }];
}

function renderPageBlocks(blocks) {
    elements.pageBlocks.innerHTML = '';
    (blocks.length ? blocks : [{ type: 'text', text: '' }]).forEach((block) => addPageBlock(block.type, block));
}

function addPageBlock(type, block = {}) {
    const labels = { heading: 'Heading', text: 'Text', image: 'Image', link: 'Link', divider: 'Divider' };
    const content = pageBlockFields(type, block);
    elements.pageBlocks.insertAdjacentHTML('beforeend', `
        <section class="page-block" data-type="${type}">
            <div class="page-block__bar"><strong>${labels[type]}</strong><div><button type="button" class="btn btn-text" data-page-block-action="up" aria-label="Move block up">↑</button><button type="button" class="btn btn-text" data-page-block-action="down" aria-label="Move block down">↓</button><button type="button" class="btn btn-text page-block__remove" data-page-block-action="remove">Remove</button></div></div>
            ${content}
        </section>
    `);
}

function pageBlockFields(type, block) {
    if (type === 'heading') return `<label>Heading text<input class="page-block-text" type="text" value="${escapeHtml(block.text || '')}" placeholder="Section heading"></label>`;
    if (type === 'text') return `<label>Text<textarea class="page-block-text" rows="5" placeholder="본문을 입력하세요.">${escapeHtml(block.text || '')}</textarea></label>`;
    if (type === 'image') return `
        <label>Upload image<input class="page-image-file" type="file" accept="image/*"></label>
        <label>Image URL<input class="page-block-image-src" type="url" value="${escapeHtml(block.src || '')}" placeholder="업로드하면 자동으로 입력됩니다."></label>
        <label>Alt text<input class="page-block-image-alt" type="text" value="${escapeHtml(block.alt || '')}" placeholder="이미지 설명"></label>`;
    if (type === 'link') return `
        <label>Link label<input class="page-block-link-label" type="text" value="${escapeHtml(block.label || '')}" placeholder="View project"></label>
        <label>URL<input class="page-block-link-url" type="url" value="${escapeHtml(block.url || '')}" placeholder="https://..."></label>`;
    return '<p class="text-muted">섹션 사이에 구분선을 넣습니다.</p>';
}

function handlePageBlockClick(event) {
    const action = event.target.closest('[data-page-block-action]');
    if (!action) return;
    const block = action.closest('.page-block');
    if (!block) return;
    if (action.dataset.pageBlockAction === 'remove') block.remove();
    if (action.dataset.pageBlockAction === 'up' && block.previousElementSibling) {
        elements.pageBlocks.insertBefore(block, block.previousElementSibling);
    }
    if (action.dataset.pageBlockAction === 'down' && block.nextElementSibling) {
        elements.pageBlocks.insertBefore(block.nextElementSibling, block);
    }
}

function collectPageBlocks() {
    return Array.from(elements.pageBlocks.querySelectorAll('.page-block')).map((element) => {
        const type = element.dataset.type;
        if (type === 'heading' || type === 'text') {
            return { type, text: element.querySelector('.page-block-text')?.value.trim() || '' };
        }
        if (type === 'image') {
            return {
                type,
                src: element.querySelector('.page-block-image-src')?.value.trim() || '',
                alt: element.querySelector('.page-block-image-alt')?.value.trim() || '',
                file: element.querySelector('.page-image-file')?.files?.[0] || null
            };
        }
        if (type === 'link') {
            return {
                type,
                label: element.querySelector('.page-block-link-label')?.value.trim() || '',
                url: element.querySelector('.page-block-link-url')?.value.trim() || ''
            };
        }
        return { type: 'divider' };
    }).filter((block) => block.type === 'divider' || block.file || block.text || block.src || (block.label && block.url));
}

async function handleSaveWork(event) {
    event.preventDefault();
    const submitButton = elements.workForm.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Saving...';

    try {
        const formData = new FormData(elements.workForm);
        const id = getCurrentWorkId();
        let thumbnailKey = savedAssetKey($('#thumb-path-display').value);

        if (state.pendingThumbFile) {
            const upload = await uploadOptimizedImage(state.pendingThumbFile, {
                workId: id,
                kind: 'thumb',
                maxSize: IMAGE_UPLOAD_SETTINGS.thumbMaxSize,
                index: 0
            });
            thumbnailKey = upload.key;
        }

        for (let index = 0; index < state.pendingStillFiles.length; index += 1) {
            const pending = state.pendingStillFiles[index];
            const upload = await uploadOptimizedImage(pending.file, {
                workId: id,
                kind: 'still',
                maxSize: IMAGE_UPLOAD_SETTINGS.stillMaxSize,
                index: pending.index
            });
            state.currentStills[pending.index] = upload.key;
        }

        const payload = {
            id,
            title: formData.get('title'),
            majorCategory: formData.get('majorCategory'),
            minorCategory: formData.get('minorCategory'),
            date: formData.get('date'),
            role: formData.get('role'),
            featured: formData.get('featured') === 'on',
            youtubeUrl: formData.get('youtubeUrl'),
            description: formData.get('description'),
            thumbnailKey,
            stillKeys: state.currentStills.filter(Boolean),
            credits: collectCredits(),
            position: state.currentWorkIndex === -1 ? Date.now() * -1 : state.works[state.currentWorkIndex].position
        };

        const endpoint = state.currentWorkIndex === -1 ? '/api/admin/works' : `/api/admin/works/${encodeURIComponent(state.works[state.currentWorkIndex].id)}`;
        const method = state.currentWorkIndex === -1 ? 'POST' : 'PUT';
        await api(endpoint, { method, body: JSON.stringify(payload) });
        await loadAdminData();
        closeWorkEditor();
        showToast('작품이 저장되었습니다.');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
    }
}

async function handleDeleteWork() {
    const work = state.works[state.currentWorkIndex];
    if (!work || !confirm(`'${work.title}' 작업물을 삭제할까요?`)) return;
    await api(`/api/admin/works/${encodeURIComponent(work.id)}`, { method: 'DELETE' });
    state.selectedIds.delete(work.id);
    await loadAdminData();
    closeWorkEditor();
    showToast('작품이 삭제되었습니다.');
}

async function handleSavePage(event) {
    event.preventDefault();
    const formData = new FormData(elements.pageForm);
    const slug = slugify(formData.get('slug') || state.currentPageSlug);
    if (!slug) throw new Error('페이지 주소를 입력해 주세요.');
    const blocks = collectPageBlocks();
    const submitButton = elements.pageForm.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Saving...';
    try {
        for (const block of blocks) {
            if (block.type !== 'image' || !block.file) continue;
            const upload = await uploadOptimizedImage(block.file, {
                kind: 'page',
                pageSlug: slug,
                maxSize: IMAGE_UPLOAD_SETTINGS.stillMaxSize,
                index: 0
            });
            block.src = upload.url;
            delete block.file;
        }
        const body = JSON.stringify(blocks.filter((block) => block.type !== 'image' || block.src));
        $('#page-body').value = body;
        const payload = {
            slug,
            title: formData.get('title'),
            body,
            published: formData.get('published') === 'on'
        };
        const endpoint = state.currentPageSlug ? `/api/admin/pages/${encodeURIComponent(state.currentPageSlug)}` : '/api/admin/pages';
        const method = state.currentPageSlug ? 'PUT' : 'POST';
        await api(endpoint, { method, body: JSON.stringify(payload) });
        await loadAdminData();
        closePageEditor();
        showToast('페이지가 저장되었습니다.');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
    }
}

async function handleDeletePage() {
    if (!state.currentPageSlug || !confirm('이 페이지를 삭제할까요?')) return;
    await api(`/api/admin/pages/${encodeURIComponent(state.currentPageSlug)}`, { method: 'DELETE' });
    await loadAdminData();
    closePageEditor();
    showToast('페이지가 삭제되었습니다.');
}

async function handleSaveSite(event) {
    event.preventDefault();
    const submitButton = elements.siteForm.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Saving...';
    try {
        const formData = new FormData(elements.siteForm);
        const payload = {
            heroEyebrow: formData.get('heroEyebrow'),
            heroTitle: formData.get('heroTitle'),
            heroSubtitle: formData.get('heroSubtitle'),
            heroWorkIds: state.siteSettings.heroWorkIds || [],
            introTitle: formData.get('introTitle'),
            introBody: formData.get('introBody'),
            contactEmail: formData.get('contactEmail'),
            contactPhone: formData.get('contactPhone'),
            contactAddress: formData.get('contactAddress'),
            instagramUrl: formData.get('instagramUrl')
        };
        const response = await api('/api/admin/site', { method: 'PUT', body: JSON.stringify(payload) });
        state.siteSettings = response.settings;
        renderSiteSettings();
        showToast('사이트 설정이 저장되었습니다. 공개 사이트에 바로 반영됩니다.');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = originalText;
    }
}

function addCreditRow(role = "", name = "") {
    const container = $('#credits-container');
    const row = document.createElement('div');
    const isCustom = role && !commonRoles.includes(role);
    row.className = 'credit-row';
    row.draggable = true;
    row.innerHTML = `
        <div class="drag-handle">☰</div>
        <select class="role-select">
            <option value="">Role Select...</option>
            ${commonRoles.map((item) => `<option value="${item}" ${role === item ? 'selected' : ''}>${item}</option>`).join('')}
            <option value="custom" ${isCustom ? 'selected' : ''}>직접 입력</option>
        </select>
        <input type="text" class="custom-role-input ${isCustom ? '' : 'hidden'}" placeholder="Role" value="${escapeAttr(isCustom ? role : '')}">
        <input type="text" class="credit-name-input" placeholder="Name" value="${escapeAttr(name)}">
        <button type="button" class="remove-credit-btn">&times;</button>
    `;
    row.querySelector('.role-select').addEventListener('change', (event) => {
        row.querySelector('.custom-role-input').classList.toggle('hidden', event.target.value !== 'custom');
    });
    row.querySelector('.remove-credit-btn').addEventListener('click', () => row.remove());
    container.appendChild(row);
    setupCreditDrag(row);
}

function collectCredits() {
    return Array.from(document.querySelectorAll('.credit-row')).map((row) => {
        const select = row.querySelector('.role-select');
        const customRole = row.querySelector('.custom-role-input').value;
        return {
            role: select.value === 'custom' ? customRole : select.value,
            name: row.querySelector('.credit-name-input').value
        };
    }).filter((credit) => credit.role || credit.name);
}

function handleThumbSelect(file) {
    if (!file) return;
    state.pendingThumbFile = file;
    $('#thumb-path-display').value = thumbKeyFor(getCurrentWorkId());
    previewImage(file, $('#thumb-preview'));
}

function handleStillsSelect(files) {
    if (!files.length) return;
    const mode = document.querySelector('input[name="stills-mode"]:checked').value;
    if (mode === 'replace') {
        state.currentStills = [];
        state.pendingStillFiles = [];
    }

    files.forEach((file) => {
        const index = state.currentStills.length;
        const key = stillKeyFor(getCurrentWorkId(), index);
        state.currentStills.push(key);
        state.pendingStillFiles.push({ index, file });
    });
    renderStillsPreview();
    $('#stills-file').value = '';
}

function renderStillsPreview(urls = state.currentStills) {
    $('#stills-preview').innerHTML = urls.map((url, index) => `
        <div class="still-preview-item" draggable="true" data-index="${index}">
            <img src="${url}" alt="">
            <button type="button" class="btn-remove-still" onclick="removeStill(${index})">&times;</button>
        </div>
    `).join('');
    $('#stills-path-display').textContent = state.currentStills.join('\n');
    setupStillDrag();
}

window.removeStill = function removeStill(index) {
    state.currentStills.splice(index, 1);
    state.pendingStillFiles = state.pendingStillFiles
        .filter((item) => item.index !== index)
        .map((item) => ({ ...item, index: item.index > index ? item.index - 1 : item.index }));
    renderStillsPreview();
};

function clearAllStills() {
    if (!confirm('모든 스틸컷을 목록에서 제거할까요?')) return;
    state.currentStills = [];
    state.pendingStillFiles = [];
    renderStillsPreview();
}

async function uploadOptimizedImage(file, { workId = '', pageSlug = '', kind, maxSize, index }) {
    const blob = await resizeToWebp(file, maxSize);
    const formData = new FormData();
    formData.append('file', blob, `${kind}.webp`);
    if (workId) formData.append('workId', workId);
    if (pageSlug) formData.append('pageSlug', pageSlug);
    formData.append('kind', kind);
    formData.append('index', String(index));
    return api('/api/admin/assets', { method: 'POST', body: formData, rawBody: true });
}

function resizeToWebp(file, maxSize) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(image.width * scale);
            canvas.height = Math.round(image.height * scale);
            const context = canvas.getContext('2d');
            context.imageSmoothingEnabled = true;
            context.imageSmoothingQuality = 'high';
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
                URL.revokeObjectURL(image.src);
                if (!blob) reject(new Error('이미지 최적화에 실패했습니다.'));
                else resolve(blob);
            }, 'image/webp', IMAGE_UPLOAD_SETTINGS.webpQuality);
        };
        image.onerror = reject;
        image.src = URL.createObjectURL(file);
    });
}

function previewImage(file, container) {
    const reader = new FileReader();
    reader.onload = (event) => {
        container.innerHTML = `<img src="${event.target.result}" alt="">`;
    };
    reader.readAsDataURL(file);
}

function handleYoutubeInput(event) {
    const videoId = extractYoutubeId(event.target.value);
    if (!videoId) return;
    if (confirm('유튜브 썸네일을 미리보기로 사용할까요? 실제 저장은 이미지 업로드 시에만 변경됩니다.')) {
        $('#thumb-preview').innerHTML = `<img src="https://img.youtube.com/vi/${videoId}/maxresdefault.jpg" alt="">`;
    }
}

function cloneWork(index) {
    const original = state.works[index];
    const clone = {
        ...JSON.parse(JSON.stringify(original)),
        id: `${original.id}-copy`,
        title: `${original.title} (Copy)`,
        featured: false
    };
    state.works.unshift(clone);
    renderWorksTable();
    openWorkEditor(0);
}

function generateNextId() {
    const maxNum = state.works.reduce((max, work) => {
        const match = work.id.match(/work(\d+)/);
        return match ? Math.max(max, Number(match[1])) : max;
    }, 0);
    return `work${String(maxNum + 1).padStart(3, '0')}`;
}

function getCurrentWorkId() {
    const currentId = slugify($('#work-id').value);
    if (currentId) return currentId;
    const nextId = generateNextId();
    $('#work-id').value = nextId;
    return nextId;
}

function thumbKeyFor(workId) {
    return `works/${workId}/thumb.webp`;
}

function stillKeyFor(workId, index) {
    return `works/${workId}/stills/${String(index + 1).padStart(3, '0')}.webp`;
}

function updateUploadPathDisplays() {
    const workId = getCurrentWorkId();
    if (state.pendingThumbFile) {
        $('#thumb-path-display').value = thumbKeyFor(workId);
    } else if (!$('#thumb-path-display').value) {
        $('#thumb-path-display').value = `자동 저장 위치: ${thumbKeyFor(workId)}`;
    }
    if (!state.currentStills.length) {
        $('#stills-path-display').textContent = `자동 저장 위치: ${stillKeyFor(workId, 0)}`;
    }
}

function savedAssetKey(value) {
    const key = String(value || '').trim();
    return key.startsWith('자동 저장 위치:') ? '' : key;
}

function showPreview() {
    const formData = new FormData(elements.workForm);
    const thumb = $('#thumb-preview img')?.src || '';
    elements.previewContainer.innerHTML = `
        <div style="color:#fff; padding:40px;">
            <h1 style="font-size:3rem; margin-bottom:20px;">${escapeHtml(formData.get('title') || 'Untitled Project')}</h1>
            <div style="color:var(--accent); margin-bottom:30px;">${escapeHtml(formData.get('majorCategory'))} / ${escapeHtml(formData.get('minorCategory'))} | ${escapeHtml(formData.get('date'))}</div>
            <div style="aspect-ratio:16/9; background:#111; margin-bottom:30px; overflow:hidden;">
                ${thumb ? `<img src="${thumb}" style="width:100%; height:100%; object-fit:cover;">` : ''}
            </div>
            <p style="white-space:pre-wrap; line-height:1.8;">${escapeHtml(formData.get('description') || '')}</p>
        </div>
    `;
    elements.modal.classList.remove('hidden');
}

function closePreview() {
    elements.modal.classList.add('hidden');
    elements.previewContainer.innerHTML = '';
}

async function handleBulkDelete() {
    if (!state.selectedIds.size || !confirm(`선택한 ${state.selectedIds.size}개 항목을 삭제할까요?`)) return;
    for (const id of state.selectedIds) {
        await api(`/api/admin/works/${encodeURIComponent(id)}`, { method: 'DELETE' });
    }
    state.selectedIds.clear();
    await loadAdminData();
    showToast('선택한 작품이 삭제되었습니다.');
}

async function handleBulkCategoryChange(event) {
    const newMajor = event.target.value;
    if (!newMajor) return;
    for (const work of state.works.filter((item) => state.selectedIds.has(item.id))) {
        await api(`/api/admin/works/${encodeURIComponent(work.id)}`, {
            method: 'PUT',
            body: JSON.stringify({ ...work, majorCategory: newMajor })
        });
    }
    event.target.value = '';
    await loadAdminData();
}

function toggleSelectAll(event) {
    document.querySelectorAll('.select-row').forEach((checkbox) => {
        checkbox.checked = event.target.checked;
        if (event.target.checked) state.selectedIds.add(checkbox.value);
        else state.selectedIds.delete(checkbox.value);
    });
    updateBulkActionUI();
}

function handleSelectionChange(event) {
    if (!event.target.classList.contains('select-row')) return;
    if (event.target.checked) state.selectedIds.add(event.target.value);
    else state.selectedIds.delete(event.target.value);
    updateBulkActionUI();
}

function updateBulkActionUI() {
    elements.bulkActions.classList.toggle('hidden', state.selectedIds.size === 0);
    elements.selectedCount.textContent = state.selectedIds.size;
}

function activateTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach((button) => button.classList.toggle('active', button.dataset.tab === tabId));
    document.querySelectorAll('.tab-panel').forEach((panel) => panel.classList.toggle('hidden', panel.id !== tabId));
    closeWorkEditor();
    closePageEditor();
}

function setupWorkRowDrag() {
    let dragIndex = null;
    elements.tbody.querySelectorAll('tr').forEach((row) => {
        row.addEventListener('dragstart', () => {
            dragIndex = Number(row.dataset.index);
            row.classList.add('dragging');
        });
        row.addEventListener('dragover', (event) => {
            event.preventDefault();
            row.classList.add('drag-over');
        });
        row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
        row.addEventListener('drop', async () => {
            const targetIndex = Number(row.dataset.index);
            if (dragIndex === null || dragIndex === targetIndex) return;
            const [moved] = state.works.splice(dragIndex, 1);
            state.works.splice(targetIndex, 0, moved);
            await Promise.all(state.works.map((work, index) => api(`/api/admin/works/${encodeURIComponent(work.id)}`, {
                method: 'PUT',
                body: JSON.stringify({ ...work, position: index })
            })));
            await loadAdminData();
        });
        row.addEventListener('dragend', () => {
            row.classList.remove('dragging', 'drag-over');
            dragIndex = null;
        });
    });
}

function setupCreditDrag(row) {
    row.addEventListener('dragover', (event) => event.preventDefault());
    row.addEventListener('drop', (event) => {
        event.preventDefault();
        const dragging = document.querySelector('.credit-row.dragging');
        if (dragging && dragging !== row) row.parentElement.insertBefore(dragging, row);
    });
    row.addEventListener('dragstart', () => row.classList.add('dragging'));
    row.addEventListener('dragend', () => row.classList.remove('dragging'));
}

function setupStillDrag() {
    let dragIndex = null;
    document.querySelectorAll('.still-preview-item').forEach((item) => {
        item.addEventListener('dragstart', () => {
            dragIndex = Number(item.dataset.index);
            item.classList.add('dragging');
        });
        item.addEventListener('dragover', (event) => event.preventDefault());
        item.addEventListener('drop', () => {
            const targetIndex = Number(item.dataset.index);
            if (dragIndex === null || dragIndex === targetIndex) return;
            const [moved] = state.currentStills.splice(dragIndex, 1);
            state.currentStills.splice(targetIndex, 0, moved);
            renderStillsPreview();
        });
        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            dragIndex = null;
        });
    });
}

async function api(url, options = {}) {
    const headers = options.rawBody ? {} : { 'content-type': 'application/json' };
    const response = await fetch(url, {
        method: options.method || 'GET',
        headers,
        body: options.body,
        credentials: 'same-origin'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        if (!options.publicRequest) alert(data.error || '요청 처리에 실패했습니다.');
        throw new Error(data.error || `Request failed: ${response.status}`);
    }
    return data;
}

function showToast(message) {
    const toast = $('#autosave-notice');
    toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 2500);
}

function extractYoutubeId(url) {
    const match = String(url).match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
    return match && match[2] ? match[2] : '';
}

function slugify(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, '&#096;');
}

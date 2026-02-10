// Admin JS Logic (Enhanced)

let worksData = [];
// Assuming window.portfolioData is loaded from data.js
if (window.portfolioData && window.portfolioData.works) {
    worksData = window.portfolioData.works;
}

// State
let selectedIds = new Set();
let currentEditIndex = -1;
let autoSaveTimer = null;

// DOM Elements
const elements = {
    tbody: document.getElementById('works-tbody'),
    searchInput: document.getElementById('search-input'),
    filterMajor: document.getElementById('filter-major'),
    filterMinor: document.getElementById('filter-minor'),
    dashboard: {
        total: document.getElementById('stat-total'),
        production: document.getElementById('stat-production'),
        lighting: document.getElementById('stat-lighting'),
        featured: document.getElementById('stat-featured')
    },
    bulkActions: document.getElementById('bulk-actions'),
    selectedCount: document.getElementById('selected-count'),
    selectAll: document.getElementById('select-all'),
    form: document.getElementById('work-form'),
    editorSection: document.getElementById('editor-section'),
    modal: document.getElementById('preview-modal'),
    previewContainer: document.getElementById('preview-frame-container'),
    autosaveNotice: document.getElementById('autosave-notice')
};

document.addEventListener('DOMContentLoaded', () => {
    checkAutoSave();
    updateStats();
    renderTable();
    setupEventListeners();
    setupAutoSave();
});

// --- Rendering & Stats ---

function updateStats() {
    elements.dashboard.total.textContent = worksData.length;
    elements.dashboard.production.textContent = worksData.filter(w => w.majorCategory === 'production').length;
    elements.dashboard.lighting.textContent = worksData.filter(w => w.majorCategory === 'lighting').length;
    elements.dashboard.featured.textContent = worksData.filter(w => w.featured).length;
}

function renderTable() {
    const tbody = elements.tbody;
    tbody.innerHTML = '';

    const searchTerm = elements.searchInput.value.toLowerCase();
    const majorFilter = elements.filterMajor.value;
    const minorFilter = elements.filterMinor.value;

    const filteredWorks = worksData.filter((work, index) => {
        work._originalIndex = index; // Keep track of original index
        const matchesSearch = work.title.toLowerCase().includes(searchTerm) || work.id.toLowerCase().includes(searchTerm);
        const matchesMajor = majorFilter === 'all' || work.majorCategory === majorFilter;
        const matchesMinor = minorFilter === 'all' || work.minorCategory === minorFilter;
        return matchesSearch && matchesMajor && matchesMinor;
    });

    filteredWorks.forEach(work => {
        const tr = document.createElement('tr');
        tr.draggable = true;
        tr.dataset.index = work._originalIndex;
        if (selectedIds.has(work.id)) tr.classList.add('selected');

        tr.innerHTML = `
            <td><input type="checkbox" class="select-row" value="${work.id}" ${selectedIds.has(work.id) ? 'checked' : ''}></td>
            <td class="cursor-grab">☰</td>
            <td>${work.id}</td>
            <td>
                <strong>${work.title}</strong><br>
                <small>${work.featured ? '<span style="color:var(--accent)">⭐ Featured</span>' : ''}</small>
            </td>
            <td>${work.majorCategory} / ${work.minorCategory}</td>
            <td>${work.date}</td>
            <td>
                <div style="display:flex; gap:5px;">
                    <button class="btn btn-sm btn-outline edit-btn" data-index="${work._originalIndex}">Edit</button>
                    <button class="btn btn-sm btn-secondary clone-btn" data-index="${work._originalIndex}">Copy</button>
                </div>
            </td>
        `;

        tr.addEventListener('dragstart', handleDragStart);
        tr.addEventListener('dragover', handleDragOver);
        tr.addEventListener('drop', handleDrop);

        tbody.appendChild(tr);
    });

    updateBulkActionUI();
}

function updateBulkActionUI() {
    if (selectedIds.size > 0) {
        elements.bulkActions.classList.remove('hidden');
        elements.selectedCount.textContent = selectedIds.size;
    } else {
        elements.bulkActions.classList.add('hidden');
    }
}

// --- Event Listeners ---

function setupEventListeners() {
    // Search & Filter
    elements.searchInput.addEventListener('input', renderTable);
    elements.filterMajor.addEventListener('change', renderTable);
    elements.filterMinor.addEventListener('change', renderTable);

    // Selection
    elements.selectAll.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.select-row');
        checkboxes.forEach(cb => {
            cb.checked = e.target.checked;
            if (e.target.checked) selectedIds.add(cb.value);
            else selectedIds.delete(cb.value);
        });
        updateBulkActionUI();
    });

    elements.tbody.addEventListener('change', (e) => {
        if (e.target.classList.contains('select-row')) {
            if (e.target.checked) selectedIds.add(e.target.value);
            else selectedIds.delete(e.target.value);
            updateBulkActionUI();
        }
    });

    // Buttons inside table
    elements.tbody.addEventListener('click', (e) => {
        if (e.target.classList.contains('edit-btn')) {
            openEditor(e.target.dataset.index);
        } else if (e.target.classList.contains('clone-btn')) {
            cloneWork(e.target.dataset.index);
        }
    });

    // Editor
    document.getElementById('add-new-btn').addEventListener('click', () => openEditor(-1));
    document.getElementById('close-editor-btn').addEventListener('click', closeEditor);
    elements.form.addEventListener('submit', handleFormSubmit);
    document.getElementById('delete-btn').addEventListener('click', handleDelete);
    document.getElementById('preview-btn').addEventListener('click', showPreview);

    // Bulk Actions
    document.getElementById('bulk-delete-btn').addEventListener('click', handleBulkDelete);
    document.getElementById('bulk-category-change').addEventListener('change', handleBulkCategoryChange);

    // Import/Export
    document.getElementById('export-json-btn').addEventListener('click', () => downloadData('json'));
    document.getElementById('export-js-btn').addEventListener('click', () => downloadData('js'));
    const importBtn = document.getElementById('import-btn');
    const importFile = document.getElementById('import-file');
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', handleImport);

    // Auto ID & Path Auto-gen
    const idInput = document.getElementById('work-id');
    idInput.addEventListener('input', () => {
        updateThumbPath();
        updateStillsPath();
    });

    // YouTube Helper
    const youtubeInput = document.getElementById('work-youtube');
    youtubeInput.addEventListener('change', handleYoutubeInput);

    // File Inputs
    document.getElementById('thumb-file').addEventListener('change', (e) => handleThumbSelect(e.target.files[0]));
    document.getElementById('stills-file').addEventListener('change', (e) => handleStillsSelect(Array.from(e.target.files)));

    // Modal
    document.querySelector('.close-modal').addEventListener('click', () => elements.modal.classList.add('hidden'));

    // Auto Save Restore
    document.getElementById('restore-btn').addEventListener('click', restoreAutoSave);
    document.getElementById('discard-btn').addEventListener('click', () => {
        localStorage.removeItem('admin_autosave');
        elements.autosaveNotice.classList.add('hidden');
    });
}

// --- Core Logic ---

function generateNextId() {
    let maxNum = 0;
    worksData.forEach(w => {
        const match = w.id.match(/work(\d+)/);
        if (match) {
            const num = parseInt(match[1]);
            if (num > maxNum) maxNum = num;
        }
    });
    const nextNum = maxNum + 1;
    return `work${String(nextNum).padStart(3, '0')}`;
}

function cloneWork(index) {
    const original = worksData[index];
    const newWork = JSON.parse(JSON.stringify(original)); // Deep copy
    newWork.id = `${original.id}_copy`;
    newWork.title = `${original.title} (Copy)`;
    newWork.featured = false; // Reset featured
    worksData.unshift(newWork);
    updateStats();
    renderTable();
}

function openEditor(index) {
    currentEditIndex = parseInt(index);
    elements.editorSection.classList.remove('hidden');
    const deleteBtn = document.getElementById('delete-btn');
    elements.form.reset();

    // Reset previews
    document.getElementById('thumb-preview').innerHTML = '<span class="text-muted">No image</span>';
    document.getElementById('stills-preview').innerHTML = '';
    document.getElementById('thumb-path-display').textContent = '';
    document.getElementById('stills-path-display').textContent = '';

    if (currentEditIndex === -1) {
        // New
        document.getElementById('editor-title').textContent = 'Add New Work';
        deleteBtn.classList.add('hidden');
        document.getElementById('work-today-date');
        document.getElementById('work-id').value = generateNextId();
        document.getElementById('work-date').value = new Date().getFullYear();
    } else {
        // Edit
        document.getElementById('editor-title').textContent = 'Edit Work';
        deleteBtn.classList.remove('hidden');
        const work = worksData[currentEditIndex];

        document.getElementById('work-id').value = work.id;
        document.getElementById('work-title').value = work.title;
        document.getElementById('work-featured').checked = work.featured;
        document.getElementById('work-major').value = work.majorCategory;
        document.getElementById('work-minor').value = work.minorCategory;

        // Date formatting for edit (if legacy data exists)
        // If data is YYYY-MM-DD, we might want to keep it or slice it?
        // User wants YYYY-MM or YYYY. Let's show as is, user can edit.
        document.getElementById('work-date').value = work.date;

        document.getElementById('work-youtube').value = work.youtubeUrl || '';
        document.getElementById('work-desc').value = work.description || '';

        // Credits
        if (work.credits) {
            document.getElementById('credit-client').value = work.credits.client || '';
            document.getElementById('credit-director').value = work.credits.director || '';
            document.getElementById('credit-cinema').value = work.credits.cinematographer || '';
            document.getElementById('credit-lighting').value = work.credits.lighting || '';
            document.getElementById('credit-editor').value = work.credits.editor || '';
        }

        // Images preview
        document.getElementById('thumb-path-display').textContent = work.thumbnail;
        if (work.thumbnail) {
            document.getElementById('thumb-preview').innerHTML = `<img src="${work.thumbnail}" onerror="this.src='https://placehold.co/600x400?text=No+Image'">`;
        }

        const stillsContainer = document.getElementById('stills-preview');
        stillsContainer.innerHTML = '';
        if (work.stills) {
            work.stills.forEach(path => {
                const div = document.createElement('div');
                div.className = 'still-preview-item';
                div.innerHTML = `<img src="${path}" onclick="removeStill(this)">`;
                stillsContainer.appendChild(div);
            });
            document.getElementById('stills-path-display').textContent = work.stills.join('\n');
        }
    }
}

function handleYoutubeInput(e) {
    const url = e.target.value;
    if (!url) return;

    // Extract ID (simple regex for v= parameter or short url)
    let videoId = '';
    if (url.includes('v=')) {
        videoId = url.split('v=')[1].split('&')[0];
    } else if (url.includes('youtu.be/')) {
        videoId = url.split('youtu.be/')[1];
    }

    if (videoId) {
        const thumbUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        if (confirm('유튜브 썸네일을 대표 이미지로 사용하시겠습니까?')) {
            document.getElementById('thumb-preview').innerHTML = `<img src="${thumbUrl}">`;
            // Note: We can't save this URL directly for local files, but we can set the path display roughly
            // Actually, user wants to use youtube thumbnail. We can suggest saving it.
            // For now, let's just preview it.
        }
    }
}

// --- Image Handling Helpers ---

function updateThumbPath() {
    const id = document.getElementById('work-id').value || '{id}';
    const input = document.getElementById('thumb-file');
    if (input.files[0]) {
        document.getElementById('thumb-path-display').textContent = `images/works/${id}/${input.files[0].name}`;
    }
}

function updateStillsPath() {
    const id = document.getElementById('work-id').value || '{id}';
    const input = document.getElementById('stills-file');
    // For stills, since we want to allow reordering/deleting, we should mainly rely on what's in the DOM preview
    // But for the PATHS, we generate based on the CURRENT visual list + new files
    // This is complex. Let's simplify:
    if (input.files.length > 0) {
        const paths = Array.from(input.files).map(f => `images/works/${id}/${f.name}`);
        // Append to existing display? Or replace? Logic: Append new files.
        const existing = document.getElementById('stills-path-display').textContent.split('\n').filter(s => s);
        const combined = [...existing, ...paths];
        // Unique
        const unique = [...new Set(combined)];
        document.getElementById('stills-path-display').textContent = unique.join('\n');
    }
}

function handleThumbSelect(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById('thumb-preview').innerHTML = `<img src="${e.target.result}">`;
    };
    reader.readAsDataURL(file);
    updateThumbPath();
}

function handleStillsSelect(files) {
    const container = document.getElementById('stills-preview');
    // Don't clear container, append
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = e => {
            const div = document.createElement('div');
            div.className = 'still-preview-item';
            div.innerHTML = `<img src="${e.target.result}" onclick="removeStill(this)">`; // Add remove handler
            container.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
    updateStillsPath();
}

// Global scope for onclick
window.removeStill = function (imgElement) {
    if (confirm('이 이미지를 목록에서 제외하시겠습니까?')) {
        const div = imgElement.parentElement;
        div.remove();
        // Also update text paths? This is tricky without syncing file names. 
        // For simplicty in this pure JS version:
        // We will rebuild styles paths on SAVE based on the ID and standard naming or just keep existing.
        // Let's rely on the user to put files correctly.
    }
};

// --- Form Handling ---

function handleFormSubmit(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const id = formData.get('id');

    // Reconstruct Stills paths from the Preview list images source? 
    // No, that's base64 or paths. 
    // Simplified strategy: Read from the text display area which we update.
    const thumbnailPath = document.getElementById('thumb-path-display').textContent;
    const stillsPaths = document.getElementById('stills-path-display').textContent.split('\n').filter(s => s.trim());

    const newWork = {
        id: id,
        title: formData.get('title'),
        majorCategory: formData.get('majorCategory'),
        minorCategory: formData.get('minorCategory'),
        date: formData.get('date'),
        featured: formData.get('featured') === 'on',
        youtubeUrl: formData.get('youtubeUrl'),
        description: formData.get('description'),
        thumbnail: thumbnailPath || `images/works/${id}/thumb.jpg`,
        stills: stillsPaths,
        credits: {
            client: formData.get('credits.client'),
            director: formData.get('credits.director'),
            cinematographer: formData.get('credits.cinematographer'),
            lighting: formData.get('credits.lighting'),
            editor: formData.get('credits.editor')
        }
    };

    if (currentEditIndex === -1) {
        worksData.unshift(newWork);
    } else {
        worksData[currentEditIndex] = newWork;
    }

    updateStats();
    renderTable();
    closeEditor();

    // Clear autosave
    localStorage.removeItem('admin_autosave');
}

function handleDelete() {
    if (confirm('정말 삭제하시겠습니까?')) {
        worksData.splice(currentEditIndex, 1);
        renderTable();
        closeEditor();
        updateStats();
    }
}

// --- Bulk Actions ---

function handleBulkDelete() {
    if (confirm(`선택한 ${selectedIds.size}개 항목을 삭제하시겠습니까?`)) {
        worksData = worksData.filter(w => !selectedIds.has(w.id));
        selectedIds.clear();
        updateStats();
        renderTable();
    }
}

function handleBulkCategoryChange(e) {
    const newMajor = e.target.value;
    if (!newMajor) return;

    if (confirm(`선택한 ${selectedIds.size}개 항목의 대분류를 '${newMajor}'로 변경하시겠습니까?`)) {
        worksData.forEach(w => {
            if (selectedIds.has(w.id)) {
                w.majorCategory = newMajor;
            }
        });
        e.target.value = ''; // Reset select
        renderTable();
        updateStats();
    }
}

// --- Auto Save ---

function setupAutoSave() {
    elements.form.addEventListener('input', () => {
        if (autoSaveTimer) clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(() => {
            const data = {
                formData: Object.fromEntries(new FormData(elements.form)),
                editIndex: currentEditIndex,
                timestamp: new Date().toISOString()
            };
            localStorage.setItem('admin_autosave', JSON.stringify(data));
        }, 1000);
    });
}

function checkAutoSave() {
    const saved = localStorage.getItem('admin_autosave');
    if (saved) {
        elements.autosaveNotice.classList.remove('hidden');
    }
}

function restoreAutoSave() {
    const saved = JSON.parse(localStorage.getItem('admin_autosave'));
    if (!saved) return;

    if (saved.editIndex !== -1) {
        // Was editing an existing item
        openEditor(saved.editIndex);
    } else {
        openEditor(-1);
    }

    // Restore fields
    const data = saved.formData;
    document.getElementById('work-id').value = data.id;
    document.getElementById('work-title').value = data.title;
    document.getElementById('work-desc').value = data.description;
    // ... restore others as needed ...

    elements.autosaveNotice.classList.add('hidden');
    alert('임시 저장된 내용을 복구했습니다.');
}

// --- Preview ---

function showPreview() {
    const formData = new FormData(elements.form);
    const youtubeUrl = formData.get('youtubeUrl');
    const thumbUrl = document.getElementById('thumb-preview').querySelector('img')?.src || '';

    // Video Fallback Logic
    let heroContent = '';
    if (youtubeUrl) {
        heroContent = `
            <div style="width: 100%; aspect-ratio: 16/9; background: #222; display:flex; align-items:center; justify-content:center;">
                <p>YouTube Video Preview</p>
            </div>`;
    } else {
        heroContent = `
            <div style="width: 100%; aspect-ratio: 16/9; background: #222; overflow:hidden;">
                <img src="${thumbUrl}" style="width:100%; height:100%; object-fit:cover;">
            </div>`;
    }

    // Date Logic
    let dateStr = formData.get('date');
    // If user typed YYYY-MM-DD, maybe slice it? 
    // The user wants "Year Only" if Month empty (which means short string), or "Year Month".
    // We display exactly what is typed for now, as Admin input is flexible.

    // Construct HTML for preview (Simulating work-detail.html structure)
    // In a real app we might load the iframe, but here we inject HTML
    const html = `
        <div style="color: #fff; padding: 40px;">
            <h1 style="font-family: 'Playfair Display'; font-size:3rem; margin-bottom: 20px;">${formData.get('title')}</h1>
            <div style="font-size: 1.2rem; color: var(--accent); margin-bottom: 40px;">
                ${formData.get('majorCategory').toUpperCase()} / ${formData.get('minorCategory').toUpperCase()}
                &nbsp;|&nbsp;
                ${dateStr}
            </div>
            
            <div style="margin-bottom: 50px;">
                ${heroContent}
            </div>

            <div style="max-width: 800px; margin-bottom: 50px;">
                <p style="font-size: 1.1rem; line-height: 1.8;">${formData.get('description')}</p>
            </div>

            <div style="border-top: 1px solid #333; padding-top: 30px;">
                <h4>Director: ${formData.get('credits.director')}</h4>
                <h4>Client: ${formData.get('credits.client')}</h4>
            </div>
        </div>
    `;

    elements.previewContainer.innerHTML = html;
    elements.modal.classList.remove('hidden');
}

function closeEditor() {
    elements.editorSection.classList.add('hidden');
    currentEditIndex = -1;
}

// Download
function downloadData(type) {
    const dataObj = { works: worksData };
    let content = '';
    let filename = '';
    let mimeType = '';

    if (type === 'json') {
        content = JSON.stringify(dataObj, null, 2);
        filename = 'data.json';
        mimeType = 'application/json';
    } else {
        content = `window.portfolioData = ${JSON.stringify(dataObj, null, 2)};`;
        filename = 'data.js';
        mimeType = 'text/javascript';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Drag & Drop
let dragSrcEl = null;
function handleDragStart(e) {
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    this.classList.add('dragging');
}
function handleDragOver(e) {
    if (e.preventDefault) e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
}
function handleDrop(e) {
    if (e.stopPropagation) e.stopPropagation();
    const dragIdx = this.dataset.index; // Note: using filtered index might be tricky. 
    // For strict array reordering, drag/drop works best when no filter is active.
    // We can disable drag if filter is active, or map indexes back to original data.
    // For simplicity, we only allow reordering when showing all data.
    if (elements.searchInput.value || elements.filterMajor.value !== 'all') {
        alert('Please clear filters to reorder.');
        return false;
    }

    // Swap logic
    const item = worksData.splice(dragIdx, 1)[0];
    worksData.splice(this.dataset.index, 0, item);
    renderTable();
    return false;
}


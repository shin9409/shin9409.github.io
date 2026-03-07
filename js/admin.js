// Admin JS Logic (Final Fix)

let worksData = [];
// data.js 기본 데이터 + localStorage 병합
const basePortfolioWorks = (window.portfolioData && window.portfolioData.works)
    ? [...window.portfolioData.works] : [];
const savedPortfolioData = localStorage.getItem('portfolioWorksData');

// 스틸컷 경로 관리용 전역 배열 (DOM 의존성 제거)
let currentStills = [];

if (savedPortfolioData) {
    try {
        const savedWorks = JSON.parse(savedPortfolioData);
        // localStorage의 stills가 비어있는데 data.js에는 있으면 data.js 우선
        worksData = savedWorks.map(sw => {
            const bw = basePortfolioWorks.find(b => b.id === sw.id);
            if (bw) {
                const mergedWork = { ...sw };
                if ((!sw.stills || sw.stills.length === 0) && bw.stills && bw.stills.length > 0) {
                    mergedWork.stills = bw.stills;
                }
                if (!sw.role && bw.role) {
                    mergedWork.role = bw.role;
                }
                return mergedWork;
            }
            return sw;
        });
        // data.js에만 있는 새 작업 추가
        basePortfolioWorks.forEach(bw => {
            if (!worksData.find(w => w.id === bw.id)) worksData.push(bw);
        });
    } catch (e) {
        console.warn('localStorage 파싱 실패, data.js 사용:', e);
        worksData = basePortfolioWorks;
    }
} else {
    worksData = basePortfolioWorks;
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

    // Prefill GitHub Token
    const savedToken = localStorage.getItem('github_pat');
    if (savedToken) {
        const tokenInput = document.getElementById('github-token');
        if (tokenInput) tokenInput.value = savedToken;
    }
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
        tr.dataset.index = work._originalIndex; // Use original index for correct editing/reordering
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
        tr.addEventListener('dragenter', handleDragEnter);
        tr.addEventListener('dragleave', handleDragLeave);
        tr.addEventListener('dragend', handleDragEnd);

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

const commonRoles = [
    "Client", "Director", "Assistant Director", "DOP",
    "Lighting Director", "Gaffer", "Art Director",
    "Editor", "Colorist", "VFX", "Sound", "Stylist",
    "Hair & Makeup", "Producer", "Production Manager"
];

function addCreditRow(role = "", name = "") {
    const container = document.getElementById('credits-container');
    const row = document.createElement('div');
    row.className = 'credit-row';

    // Role Select
    let roleOptions = commonRoles.map(r => `<option value="${r}" ${role === r ? 'selected' : ''}>${r}</option>`).join('');
    const isCustom = role && !commonRoles.includes(role);

    row.draggable = true; // Make row draggable

    row.innerHTML = `
        <div class="drag-handle" style="cursor:grab; padding:0 10px; color:#888;">☰</div>
        <select class="role-select">
            <option value="">Role Select...</option>
            ${roleOptions}
            <option value="custom" ${isCustom ? 'selected' : ''}>직접 입력</option>
        </select>
        <input type="text" class="custom-role-input ${isCustom ? '' : 'hidden'}" placeholder="Role" value="${isCustom ? role : ''}">
        <input type="text" class="credit-name-input" placeholder="Name" value="${name}">
        <button type="button" class="remove-credit-btn">&times;</button>
    `;

    // Toggle custom input
    const select = row.querySelector('.role-select');
    const customInput = row.querySelector('.custom-role-input');
    select.addEventListener('change', () => {
        if (select.value === 'custom') {
            customInput.classList.remove('hidden');
            customInput.focus();
        } else {
            customInput.classList.add('hidden');
        }
    });

    // Remove row
    row.querySelector('.remove-credit-btn').addEventListener('click', () => row.remove());

    // Drag events
    row.addEventListener('dragstart', handleCreditDragStart);
    row.addEventListener('dragover', handleCreditDragOver);
    row.addEventListener('drop', handleCreditDrop);
    row.addEventListener('dragenter', handleCreditDragEnter);
    row.addEventListener('dragleave', handleCreditDragLeave);
    row.addEventListener('dragend', handleCreditDragEnd);

    container.appendChild(row);
}

// Credits Drag & Drop Handlers
let creditDragSrcEl = null;

function handleCreditDragStart(e) {
    creditDragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
    this.classList.add('dragging');
}

function handleCreditDragOver(e) {
    if (e.preventDefault) e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleCreditDragEnter(e) {
    this.classList.add('drag-over');
}

function handleCreditDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleCreditDragEnd(e) {
    this.classList.remove('dragging');
    const rows = document.querySelectorAll('.credit-row');
    rows.forEach(row => row.classList.remove('drag-over'));
}

function handleCreditDrop(e) {
    if (e.stopPropagation) e.stopPropagation();

    if (creditDragSrcEl !== this) {
        // Swap DOM elements
        const container = document.getElementById('credits-container');
        // Get all rows as array
        const rows = Array.from(container.children);
        const srcIndex = rows.indexOf(creditDragSrcEl);
        const targetIndex = rows.indexOf(this);

        if (srcIndex < targetIndex) {
            container.insertBefore(creditDragSrcEl, this.nextSibling);
        } else {
            container.insertBefore(creditDragSrcEl, this);
        }
    }
    return false;
}

function setupEventListeners() {
    // ...
    document.getElementById('add-credit-btn').addEventListener('click', () => addCreditRow());
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
    const importBtn = document.getElementById('import-btn');
    const importFile = document.getElementById('import-file');
    if (importBtn) importBtn.addEventListener('click', () => importFile.click());
    if (importFile) importFile.addEventListener('change', handleImport);

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
    // File Inputs
    document.getElementById('thumb-file').addEventListener('change', (e) => handleThumbSelect(e.target.files[0]));
    document.getElementById('stills-file').addEventListener('change', (e) => handleStillsSelect(Array.from(e.target.files)));
    document.getElementById('clear-stills-btn').addEventListener('click', clearAllStills);

    // Modal Close
    document.querySelector('.close-modal').addEventListener('click', (e) => {
        e.stopPropagation();
        elements.modal.classList.add('hidden');
        elements.previewContainer.innerHTML = '';
    });

    elements.modal.addEventListener('click', (e) => {
        if (e.target === elements.modal) {
            elements.modal.classList.add('hidden');
            elements.previewContainer.innerHTML = '';
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !elements.modal.classList.contains('hidden')) {
            elements.modal.classList.add('hidden');
            elements.previewContainer.innerHTML = '';
        }
    });

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
    document.getElementById('thumb-preview').innerHTML = '<span class="text-muted">No image selected</span>';
    document.getElementById('stills-preview').innerHTML = '';
    document.getElementById('thumb-path-display').value = '';
    document.getElementById('stills-path-display').textContent = '';

    // **스틸컷 배열 안전 초기화**
    currentStills = [];

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
        document.getElementById('work-date').value = work.date;
        document.getElementById('work-role').value = work.role || '';
        document.getElementById('work-youtube').value = work.youtubeUrl || '';
        document.getElementById('work-desc').value = work.description || '';

        // Credits
        // Render Credits (Array or Old Object)
        const container = document.getElementById('credits-container');
        container.innerHTML = '';

        if (work.credits) {
            if (Array.isArray(work.credits)) {
                work.credits.forEach(c => addCreditRow(c.role, c.name));
            } else {
                // Backward compatibility: Convert object to array
                const roleMap = {
                    client: "Client",
                    director: "Director",
                    cinematographer: "DOP",
                    lighting: "Lighting Director",
                    editor: "Editor"
                };
                Object.entries(work.credits).forEach(([key, name]) => {
                    if (name) addCreditRow(roleMap[key] || key, name);
                });
            }
        }

        // Images preview
        document.getElementById('thumb-path-display').value = work.thumbnail || '';
        if (work.thumbnail) {
            document.getElementById('thumb-preview').innerHTML = `<img src="${work.thumbnail}" onerror="this.src='https://placehold.co/600x400?text=No+Image'">`;
        }

        const stillsContainer = document.getElementById('stills-preview');
        stillsContainer.innerHTML = '';

        // **스틸컷 로드 및 복사 (Data -> currentStills)**
        if (work.stills && Array.isArray(work.stills)) {
            currentStills = [...work.stills]; // Sync array

            work.stills.forEach(path => {
                const div = document.createElement('div');
                div.className = 'still-preview-item';
                div.dataset.path = path;
                div.innerHTML = `
                    <img src="${path}">
                    <button type="button" class="btn-remove-still" onclick="removeStill(this)">×</button>
                `;
                stillsContainer.appendChild(div);
            });
            updateStillsTextDisplay();
        }
    }
}

function handleYoutubeInput(e) {
    const url = e.target.value;
    if (!url) return;

    // Extract ID
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
        }
    }
}

// --- Image Handling Helpers ---

function updateThumbPath() {
    // This is called by ID Change or other events
    // But handleThumbSelect does ITSELF now
}

function updateStillsPath() {
    updateStillsTextDisplay();
}

// ... previous logic remains unchanged until `// --- Form Handling ---` ...
let pendingThumbFile = null;
let pendingStillsFiles = [];

// Helper function to read file as Base64 for GitHub API
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}

// GitHub API Upload Helper
async function uploadToGitHub(path, contentBase64, message) {
    const token = document.getElementById('github-token').value.trim();
    if (!token) throw new Error('GitHub 토큰이 필요합니다.');

    const repo = 'shin9409/shin9409.github.io';
    const apiUrl = `https://api.github.com/repos/${repo}/contents/${path}`;

    // 가져오기 (sha 확인)
    let sha = null;
    try {
        const getRes = await fetch(apiUrl, {
            headers: { 'Authorization': `token ${token}` }
        });
        if (getRes.ok) {
            const data = await getRes.json();
            sha = data.sha;
        }
    } catch (e) {
        console.warn('File might not exist yet:', e);
    }

    // 업로드
    const body = {
        message: message,
        content: contentBase64,
        branch: 'main'
    };
    if (sha) body.sha = sha;

    const putRes = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!putRes.ok) {
        const errorData = await putRes.json();
        throw new Error(`GitHub Upload Failed: ${errorData.message}`);
    }
}

// GitHub API Delete Helper
async function deleteFromGitHub(path, message) {
    const token = document.getElementById('github-token').value.trim();
    if (!token) return;

    const repo = 'shin9409/shin9409.github.io';
    const apiUrl = `https://api.github.com/repos/${repo}/contents/${path}`;

    try {
        // 1. Get SHA
        const getRes = await fetch(apiUrl, {
            headers: { 'Authorization': `token ${token}` }
        });

        if (!getRes.ok) {
            console.warn(`File not found for deletion, skipping: ${path}`);
            return; // 파일이 이미 없으면 무시
        }

        const data = await getRes.json();
        const sha = data.sha;

        // 2. Delete
        const body = {
            message: message,
            sha: sha,
            branch: 'main'
        };

        const delRes = await fetch(apiUrl, {
            method: 'DELETE',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (!delRes.ok) {
            console.warn(`Failed to delete ${path}`);
        }
    } catch (e) {
        console.warn(`Error during deleteFromGitHub for ${path}:`, e);
    }
}

function handleThumbSelect(file) {
    if (!file) return;
    pendingThumbFile = file; // Store File object
    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById('thumb-preview').innerHTML = `<img src="${e.target.result}">`;
    };
    reader.readAsDataURL(file);

    const id = document.getElementById('work-id').value || '{id}';
    const ext = file.name.split('.').pop().toLowerCase();
    const fileName = `thumb.${ext}`;
    document.getElementById('thumb-path-display').value = `images/works/${id}/${fileName}`;
}

// --- localStorage 동기화 ---
function syncToLocalStorage() {
    try {
        localStorage.setItem('portfolioWorksData', JSON.stringify(worksData));
    } catch (e) {
        console.warn('localStorage 저장 실패:', e);
    }
}

// --- Form Handling ---

async function handleFormSubmit(e) {
    e.preventDefault();
    const token = document.getElementById('github-token').value.trim();
    if (!token) {
        alert('저장하려면 GitHub 토큰을 상단에 입력하세요.');
        document.getElementById('github-token').focus();
        return;
    }

    // Save token for next time
    localStorage.setItem('github_pat', token);

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = '업로드 중...';
    submitBtn.disabled = true;

    try {
        const formData = new FormData(e.target);
        const id = formData.get('id');
        const thumbnailPath = document.getElementById('thumb-path-display').value || `images/works/${id}/thumb.jpg`;

        // Upload Thumbnail if newly selected
        if (pendingThumbFile) {
            const base64 = await fileToBase64(pendingThumbFile);
            await uploadToGitHub(thumbnailPath, base64, `Upload thumbnail for ${id}`);
        }

        // Upload Stills if newly selected
        if (pendingStillsFiles.length > 0) {
            for (let i = 0; i < pendingStillsFiles.length; i++) {
                const fileObj = pendingStillsFiles[i];
                const base64 = await fileToBase64(fileObj.file);
                await uploadToGitHub(fileObj.path, base64, `Upload still ${i + 1} for ${id}`);
            }
        }

        const creditRows = document.querySelectorAll('.credit-row');
        const credits = Array.from(creditRows).map(row => {
            const select = row.querySelector('.role-select');
            const customRoleInput = row.querySelector('.custom-role-input');
            const name = row.querySelector('.credit-name-input').value;
            const role = select.value === 'custom' ? customRoleInput.value : select.value;
            return { role, name };
        }).filter(c => c.role || c.name);

        const newWork = {
            id: id,
            title: formData.get('title'),
            majorCategory: formData.get('majorCategory'),
            minorCategory: formData.get('minorCategory'),
            date: formData.get('date'),
            role: formData.get('role'),
            featured: formData.get('featured') === 'on',
            youtubeUrl: formData.get('youtubeUrl'),
            description: formData.get('description'),
            thumbnail: thumbnailPath,
            stills: (currentStills.length === 0 && getStillsFromDOM().length > 0) ? getStillsFromDOM() : currentStills,
            credits: credits
        };

        if (currentEditIndex === -1) {
            worksData.unshift(newWork);
        } else {
            worksData[currentEditIndex] = newWork;
        }

        updateStats();
        renderTable();
        closeEditor();
        syncToLocalStorage();
        localStorage.removeItem('admin_autosave');

        // Upload data.json and data.js
        const jsonContent = JSON.stringify(worksData, null, 2);
        const jsContent = `window.portfolioData = {\n  "works": ${jsonContent}\n};`;

        // Convert string to base64 with UTF-8 support
        const utf8Encoder = new TextEncoder();

        const jsonBytes = utf8Encoder.encode(jsonContent);
        const jsBytes = utf8Encoder.encode(jsContent);

        const b64EncodeUnicode = (bytes) => {
            const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join("");
            return btoa(binString);
        };

        submitBtn.textContent = '데이터 커밋 중...';
        await uploadToGitHub('data.json', b64EncodeUnicode(jsonBytes), `Update data.json for ${id}`);
        await uploadToGitHub('js/data.js', b64EncodeUnicode(jsBytes), `Update data.js for ${id}`);

        showToast('GitHub 업로드 완료!');

        // Reset pending files
        pendingThumbFile = null;
        pendingStillsFiles = [];

    } catch (err) {
        console.error(err);
        alert('오류 발생: ' + err.message);
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

function getStillsFromDOM() {
    const items = document.querySelectorAll('.still-preview-item');
    const paths = [];
    items.forEach(item => {
        if (item.dataset.path) {
            paths.push(item.dataset.path);
        }
    });
    return paths;
}

function handleStillsSelect(files) {
    if (!files.length) return;

    const id = document.getElementById('work-id').value || '{id}';
    const container = document.getElementById('stills-preview');
    const mode = document.querySelector('input[name="stills-mode"]:checked').value;

    if (mode === 'replace') {
        currentStills = [];
        pendingStillsFiles = []; // Clear pending
        container.innerHTML = '';
    }

    const startIdx = currentStills.length;

    files.forEach((file, index) => {
        const ext = file.name.split('.').pop().toLowerCase();
        const fileName = `still${startIdx + 1 + index}.${ext}`;
        const finalPath = `images/works/${id}/${fileName}`;

        currentStills.push(finalPath);

        // Store File object with its target path
        pendingStillsFiles.push({ path: finalPath, file: file });

        const reader = new FileReader();
        reader.onload = e => {
            const div = document.createElement('div');
            div.className = 'still-preview-item';
            div.dataset.path = finalPath;
            div.innerHTML = `
                <img src="${e.target.result}">
                <button type="button" class="btn-remove-still" onclick="removeStill(this)">×</button>
            `;
            container.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
    updateStillsTextDisplay();
    document.getElementById('stills-file').value = '';
}

function updateStillsTextDisplay() {
    document.getElementById('stills-path-display').textContent = currentStills.join('\n');
}

window.removeStill = function (btnElement) {
    const div = btnElement.parentElement;
    const pathToRemove = div.dataset.path;

    currentStills = currentStills.filter(p => p !== pathToRemove);
    pendingStillsFiles = pendingStillsFiles.filter(item => item.path !== pathToRemove);

    div.remove();
    updateStillsTextDisplay();
};

function clearAllStills() {
    if (confirm('모든 스틸컷을 목록에서 제거하시겠습니까?')) {
        currentStills = [];
        pendingStillsFiles = [];
        document.getElementById('stills-preview').innerHTML = '';
        updateStillsTextDisplay();
    }
}
// ... rest of logic ...

async function handleDelete() {
    if (confirm('정말 삭제하시겠습니까?')) {
        const token = document.getElementById('github-token').value.trim();
        if (!token) {
            alert('GitHub 토큰을 먼저 입력하세요.');
            return;
        }

        const deleteBtn = document.getElementById('delete-btn');
        const originalText = deleteBtn.textContent;
        deleteBtn.textContent = '삭제 중...';
        deleteBtn.disabled = true;

        try {
            // 원본 백업 (실패 시 복구용)
            const backupWorksData = [...worksData];

            const workToDelete = worksData[currentEditIndex];
            if (workToDelete) {
                // Delete Thumbnail
                if (workToDelete.thumbnail) {
                    await deleteFromGitHub(workToDelete.thumbnail, `Delete thumbnail for ${workToDelete.id}`);
                }
                // Delete Stills
                if (workToDelete.stills && workToDelete.stills.length > 0) {
                    for (let path of workToDelete.stills) {
                        await deleteFromGitHub(path, `Delete still for ${workToDelete.id}`);
                    }
                }
            }

            worksData.splice(currentEditIndex, 1);

            const jsonContent = JSON.stringify(worksData, null, 2);
            const jsContent = `window.portfolioData = {\n  "works": ${jsonContent}\n};`;

            const utf8Encoder = new TextEncoder();
            const b64EncodeUnicode = (bytes) => {
                const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join("");
                return btoa(binString);
            };

            await uploadToGitHub('data.json', b64EncodeUnicode(utf8Encoder.encode(jsonContent)), 'Delete work from data.json');
            await uploadToGitHub('js/data.js', b64EncodeUnicode(utf8Encoder.encode(jsContent)), 'Delete work from data.js');

            renderTable();
            closeEditor();
            updateStats();
            syncToLocalStorage();
            showToast('삭제 완료!');

        } catch (err) {
            console.error(err);
            alert('삭제 오류: ' + err.message);
            // 실패 시 되돌리기
            worksData.splice(currentEditIndex, 0, worksData[currentEditIndex]);
        } finally {
            deleteBtn.textContent = originalText;
            deleteBtn.disabled = false;
        }
    }
}

// --- Import Logic (New) ---

function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const content = event.target.result;
            let importedData;

            if (file.name.endsWith('.json')) {
                const json = JSON.parse(content);
                importedData = json.works || json;
            } else if (file.name.endsWith('.js')) {
                // JS 파일은 window.portfolioData = {...} 형태
                // 단순하게 window.portfolioData = 부분 제거하고 파싱 시도
                const jsonContent = content.replace(/window\.portfolioData\s*=\s*/, '').replace(/;$/, '');
                const parsed = JSON.parse(jsonContent);
                importedData = parsed.works || parsed;
            } else {
                throw new Error('지원하지 않는 파일 형식입니다. (.json 또는 .js)');
            }

            if (Array.isArray(importedData)) {
                worksData = importedData;
                currentStills = []; // Import 시 초기화
                syncToLocalStorage();
                renderTable();
                updateStats();
                alert('데이터를 성공적으로 불러왔습니다.');
            } else {
                throw new Error('올바르지 않은 데이터 형식입니다.');
            }
        } catch (err) {
            console.error(err);
            alert('파일을 읽는 중 오류가 발생했습니다: ' + err.message);
        }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
}

// --- Bulk Actions ---

async function handleBulkDelete() {
    if (confirm(`선택한 ${selectedIds.size}개 항목을 삭제하시겠습니까?`)) {
        const token = document.getElementById('github-token').value.trim();
        if (!token) {
            alert('GitHub 토큰을 먼저 입력하세요.');
            return;
        }

        const btn = document.getElementById('bulk-delete-btn');
        const originalText = btn.textContent;
        btn.textContent = '삭제 중...';
        btn.disabled = true;

        // 원본 백업
        const backupWorksData = [...worksData];

        try {
            const worksToDelete = worksData.filter(w => selectedIds.has(w.id));

            // Delete associated images
            for (let work of worksToDelete) {
                if (work.thumbnail) {
                    await deleteFromGitHub(work.thumbnail, `Bulk delete thumbnail for ${work.id}`);
                }
                if (work.stills && work.stills.length > 0) {
                    for (let path of work.stills) {
                        await deleteFromGitHub(path, `Bulk delete still for ${work.id}`);
                    }
                }
            }

            worksData = worksData.filter(w => !selectedIds.has(w.id));

            const jsonContent = JSON.stringify(worksData, null, 2);
            const jsContent = `window.portfolioData = {\n  "works": ${jsonContent}\n};`;

            const utf8Encoder = new TextEncoder();
            const b64EncodeUnicode = (bytes) => {
                const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join("");
                return btoa(binString);
            };

            await uploadToGitHub('data.json', b64EncodeUnicode(utf8Encoder.encode(jsonContent)), 'Bulk delete works from data.json');
            await uploadToGitHub('js/data.js', b64EncodeUnicode(utf8Encoder.encode(jsContent)), 'Bulk delete works from data.js');

            selectedIds.clear();
            updateStats();
            renderTable();
            syncToLocalStorage();
            showToast('일괄 삭제 완료!');

        } catch (err) {
            console.error(err);
            alert('삭제 오류: ' + err.message);
            worksData = backupWorksData; // 롤백
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
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
        openEditor(saved.editIndex);
    } else {
        openEditor(-1);
    }

    const data = saved.formData;
    document.getElementById('work-id').value = data.id || '';
    document.getElementById('work-title').value = data.title || '';
    document.getElementById('work-role').value = data.role || '';
    document.getElementById('work-desc').value = data.description || '';
    document.getElementById('work-date').value = data.date || '';
    document.getElementById('work-major').value = data.majorCategory || 'production';
    document.getElementById('work-minor').value = data.minorCategory || 'musicvideo';
    document.getElementById('work-youtube').value = data.youtubeUrl || '';

    elements.autosaveNotice.classList.add('hidden');
    alert('임시 저장된 내용을 복구했습니다.');
}

// --- Preview ---

function showPreview() {
    try {
        const formData = new FormData(elements.form);
        const youtubeUrl = formData.get('youtubeUrl');

        let thumbUrl = '';
        const thumbImg = document.getElementById('thumb-preview').querySelector('img');
        if (thumbImg) {
            thumbUrl = thumbImg.src;
        }

        let heroContent = '';
        if (youtubeUrl) {
            const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
            const match = youtubeUrl.match(regExp);
            let videoId = (match && match[2]) ? match[2] : youtubeUrl;

            const previewThumb = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

            heroContent = `
                <div style="width: 100%; aspect-ratio: 16/9; background: #222; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                   <img src="${previewThumb}" style="width:100%; height:100%; object-fit:cover; opacity: 0.7;">
                   <div style="position: absolute; color: #fff; font-size: 20px; font-weight: bold; text-shadow: 0 2px 4px rgba(0,0,0,0.8);">▶ YouTube Video (${videoId})</div>
                </div>`;
        } else {
            heroContent = `
                <div style="width: 100%; aspect-ratio: 16/9; background: #222; overflow:hidden;">
                    <img src="${thumbUrl}" style="width:100%; height:100%; object-fit:cover;" alt="Preview Thumbnail">
                </div>`;
        }

        let dateStr = formData.get('date');

        const html = `
            <div style="color: #fff; padding: 40px;">
                <h1 style="font-family: 'Playfair Display'; font-size:3rem; margin-bottom: 20px;">${formData.get('title') || 'Untitled Project'}</h1>
                <div style="font-size: 1.2rem; color: var(--accent); margin-bottom: 40px;">
                    ${(formData.get('majorCategory') || '').toUpperCase()} / ${(formData.get('minorCategory') || '').toUpperCase()}
                    &nbsp;|&nbsp;
                    ${dateStr || ''}
                </div>
                
                <div style="margin-bottom: 50px;">
                    ${heroContent}
                </div>

                <div style="max-width: 800px; margin-bottom: 50px;">
                    <p style="font-size: 1.1rem; line-height: 1.8; white-space: pre-wrap;">${formData.get('description') || ''}</p>
                </div>

                <div style="border-top: 1px solid #333; padding-top: 30px;">
                    <h4>Director: ${formData.get('credits.director') || '-'}</h4>
                    <h4>Client: ${formData.get('credits.client') || '-'}</h4>
                </div>
            </div>
        `;

        elements.previewContainer.innerHTML = html;
        elements.modal.classList.remove('hidden');
    } catch (e) {
        console.error('Preview Error:', e);
        alert('프리뷰를 여는 중 오류가 발생했습니다: ' + e.message);
    }
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
// Drag & Drop
let dragSrcEl = null;

function handleDragStart(e) {
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', this.innerHTML);
    this.classList.add('dragging');
}

function handleDragOver(e) {
    if (e.preventDefault) e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    return false;
}

function handleDragEnter(e) {
    this.classList.add('drag-over');
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    const rows = document.querySelectorAll('#works-table tbody tr');
    rows.forEach(row => row.classList.remove('drag-over'));
}

function handleDrop(e) {
    if (e.stopPropagation) e.stopPropagation();

    if (dragSrcEl !== this) {
        if (elements.searchInput.value || elements.filterMajor.value !== 'all' || elements.filterMinor.value !== 'all') {
            alert('필터나 검색이 적용된 상태에서는 순서를 변경할 수 없습니다.');
            return false;
        }

        const srcIdx = parseInt(dragSrcEl.dataset.index);
        let targetIdx = parseInt(this.dataset.index);

        // Adjust target index if moving down (because removal shifts indices)
        if (srcIdx < targetIdx) {
            targetIdx--;
        }

        // Move item in array
        const item = worksData.splice(srcIdx, 1)[0];
        worksData.splice(targetIdx, 0, item);

        renderTable();
        syncToLocalStorage();
    }
    return false;
}

// --- Utilities ---
function showToast(message) {
    let toast = document.getElementById('generic-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'generic-toast';
        toast.className = 'toast hidden';
        document.body.appendChild(toast);
    }
    toast.innerHTML = `<span>${message}</span>`;
    toast.classList.remove('hidden');

    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Main JavaScript Logic

document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupMobileMenu();
});

// Global Data Storage
let allWorks = [];

// 1. 데이터 로드 (data.js 기본 + localStorage 병합)
function loadData() {
    try {
        // data.js에서 기본 데이터 로드
        const baseWorks = (window.portfolioData && window.portfolioData.works)
            ? window.portfolioData.works : [];

        // localStorage에서 관리자 저장 데이터 로드
        const savedData = localStorage.getItem('portfolioWorksData');

        if (savedData) {
            try {
                const savedWorks = JSON.parse(savedData);

                // data.js와 localStorage를 병합:
                // localStorage의 stills가 비어있는데 data.js에는 있으면 data.js 우선 사용
                allWorks = savedWorks.map(savedWork => {
                    const baseWork = baseWorks.find(bw => bw.id === savedWork.id);
                    if (baseWork &&
                        (!savedWork.stills || savedWork.stills.length === 0) &&
                        baseWork.stills && baseWork.stills.length > 0) {
                        // data.js의 스틸 데이터로 보충
                        return { ...savedWork, stills: baseWork.stills };
                    }
                    return savedWork;
                });

                // data.js에만 있고 localStorage에 없는 새 작업도 추가
                baseWorks.forEach(bw => {
                    if (!allWorks.find(w => w.id === bw.id)) {
                        allWorks.push(bw);
                    }
                });

            } catch (parseErr) {
                console.warn('localStorage 파싱 실패, data.js 사용:', parseErr);
                allWorks = baseWorks;
            }
        } else {
            allWorks = baseWorks;
        }

        // 현재 페이지에 맞는 렌더링 실행
        if (document.getElementById('featured-works-grid')) {
            renderFeaturedWorks();
        } else if (document.getElementById('all-works-grid')) {
            renderAllWorks();
        } else if (document.getElementById('work-detail-container')) {
            renderWorkDetail();
        }

    } catch (error) {
        console.error('Error loading data:', error);
        // Show user friendly error on the page
        const grids = document.querySelectorAll('.works-grid');
        grids.forEach(grid => {
            grid.innerHTML = '<p style="color: #fff; text-align: center;">Failed to load works. Please try again later.</p>';
        });

        const detail = document.getElementById('work-detail-container');
        if (detail) {
            detail.innerHTML = '<p style="color: #fff; text-align: center;">Failed to load project details. Please try again later.</p>';
        }
    }
}

// 2. Render Featured Works (Index Page)
function renderFeaturedWorks() {
    const grid = document.getElementById('featured-works-grid');
    const featuredWorks = allWorks.filter(work => work.featured).slice(0, 4); // Show max 4

    grid.innerHTML = featuredWorks.map(work => createWorkCard(work)).join('');
}

// Helper: Create Work Card HTML
function createWorkCard(work) {
    return `
        <div class="work-card" onclick="location.href='work-detail.html?id=${work.id}'">
            <img src="${work.thumbnail}" alt="${work.title}" class="work-thumb" onerror="this.src='https://via.placeholder.com/640x360/1a1a1a/888?text=No+Image'">
            <div class="work-overlay">
                <div class="work-category">${work.majorCategory} / ${work.minorCategory}</div>
                <h3 class="work-title">${work.title}</h3>
            </div>
        </div>
    `;
}

// 3. Render All Works with Filtering (Works Page) - Placeholder for next step
function renderAllWorks() {
    const grid = document.getElementById('all-works-grid');

    // Check for URL parameters
    const params = new URLSearchParams(window.location.search);
    const filter = params.get('filter'); // 'production' or 'lighting'

    // Initial Filter Setup
    let initialMajor = 'all';
    if (filter === 'production') initialMajor = 'production';
    if (filter === 'lighting') initialMajor = 'lighting';

    setupFilters(initialMajor);

    // Filter data based on initial state
    filterWorks(initialMajor, 'all');
}

function renderFilteredGrid(works) {
    const grid = document.getElementById('all-works-grid');
    if (works.length === 0) {
        grid.innerHTML = '<p style="color: #666; text-align: center; grid-column: 1/-1;">No works found for this category.</p>';
        return;
    }
    grid.innerHTML = works.map(work => createWorkCard(work)).join('');
}

function setupFilters(initialMajor = 'all') {
    const majorFilters = document.querySelectorAll('.filter-btn');
    const subFilters = document.querySelectorAll('.sub-filter-btn');

    let currentMajor = initialMajor;
    let currentMinor = 'all';

    // Set initial active state for Major Filters
    majorFilters.forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === initialMajor) {
            btn.classList.add('active');
        }
    });

    // Major Category Filter
    majorFilters.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update UI
            majorFilters.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            currentMajor = btn.dataset.filter;
            filterWorks(currentMajor, currentMinor);
        });
    });

    // Sub Category Filter
    subFilters.forEach(btn => {
        btn.addEventListener('click', () => {
            subFilters.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            currentMinor = btn.dataset.filter;
            filterWorks(currentMajor, currentMinor);
        });
    });
}

function filterWorks(major, minor) {
    let filtered = allWorks;

    if (major !== 'all') {
        filtered = filtered.filter(work => work.majorCategory === major);
    }

    if (minor !== 'all') {
        filtered = filtered.filter(work => work.minorCategory === minor);
    }

    renderFilteredGrid(filtered);
}


// 4. Render Work Detail (Detail Page) - Placeholder for next step
function renderWorkDetail() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    const work = allWorks.find(w => w.id === id);
    const container = document.getElementById('work-detail-container');

    if (!work) {
        container.innerHTML = '<p style="color: #fff; text-align: center;">Project not found.</p>';
        return;
    }

    // Embed Youtube if exists, otherwise show thumbnail (Hero Image)
    let videoHtml = '';
    if (work.youtubeUrl) {
        // Robust YouTube URL parser
        let videoId = '';
        const url = work.youtubeUrl;

        // Handle various formats:
        // 1. https://www.youtube.com/watch?v=ID
        // 2. https://youtu.be/ID
        // 3. https://www.youtube.com/embed/ID

        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);

        if (match && match[2]) {
            videoId = match[2];
        } else {
            // Fallback if already an embed URL or just ID
            videoId = url;
        }

        // Minimal valid params for local/web compatibility
        const embedUrl = `https://www.youtube.com/embed/${videoId}?rel=0&playsinline=1&modestbranding=1`;

        videoHtml = `
            <div class="video-container">
                <iframe src="${embedUrl}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
            </div>
        `;
    } else {
        // Fallback to thumbnail as Hero Image (Using same container size as video)
        videoHtml = `
            <div class="video-container">
                <img src="${work.thumbnail}" alt="${work.title}" style="width: 100%; height: 100%; object-fit: cover;">
            </div>
        `;
    }

    // Credits HTML
    const creditsHtml = Object.entries(work.credits).map(([role, name]) => `
        <div class="credit-item">
            <h4>${role}</h4>
            <p>${name}</p>
        </div>
    `).join('');

    // 스틸 HTML - 클릭 시 라이트박스 열기
    const stillsHtml = work.stills.map((src, idx) => `
        <img src="${src}" alt="Still from ${work.title}" data-index="${idx}" class="still-clickable" onerror="this.src='https://via.placeholder.com/1280x720/1a1a1a/888?text=Image+Not+Found'">
    `).join('');

    container.innerHTML = `
        <!-- Hero / Video -->
        <section class="detail-hero">
            ${videoHtml}
        </section>

        <section class="container detail-info">
            <div class="detail-header">
                <div class="detail-meta">${work.majorCategory} / ${work.minorCategory} &nbsp;|&nbsp; ${work.date}</div>
                <h1 class="section-title">${work.title}</h1>
            </div>

            <div class="detail-desc">
                <p>${work.description}</p>
            </div>

            <div class="detail-credits">
                ${creditsHtml}
            </div>

            <div class="stills-gallery">
                ${stillsHtml}
            </div>
            
            <div style="margin-top: 80px; text-align: center;">
                 <a href="works.html" class="btn">Back to Works</a>
            </div>
        </section>
    `;

    // 라이트박스 갤러리 초기화
    setupLightbox(work.stills);
}

// 라이트박스 갤러리 기능
function setupLightbox(stills) {
    if (!stills || stills.length === 0) return;

    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxCurrent = document.getElementById('lightbox-current');
    const lightboxTotal = document.getElementById('lightbox-total');
    let currentIndex = 0;

    // 총 개수 표시
    lightboxTotal.textContent = stills.length;

    // 이미지 업데이트 함수
    function showImage(index) {
        currentIndex = index;
        lightboxImg.style.opacity = '0';
        lightboxImg.style.transform = 'scale(0.95)';

        setTimeout(() => {
            lightboxImg.src = stills[currentIndex];
            lightboxCurrent.textContent = currentIndex + 1;
            lightboxImg.style.opacity = '1';
            lightboxImg.style.transform = 'scale(1)';
        }, 150);
    }

    // 라이트박스 열기
    function openLightbox(index) {
        currentIndex = index;
        lightboxImg.src = stills[currentIndex];
        lightboxCurrent.textContent = currentIndex + 1;
        lightbox.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    // 라이트박스 닫기
    function closeLightbox() {
        lightbox.classList.add('hidden');
        document.body.style.overflow = '';
    }

    // 이전/다음 이동
    function prevImage() {
        const newIndex = currentIndex <= 0 ? stills.length - 1 : currentIndex - 1;
        showImage(newIndex);
    }

    function nextImage() {
        const newIndex = currentIndex >= stills.length - 1 ? 0 : currentIndex + 1;
        showImage(newIndex);
    }

    // 스틸 이미지 클릭 → 라이트박스 열기
    document.querySelectorAll('.still-clickable').forEach(img => {
        img.addEventListener('click', () => {
            const idx = parseInt(img.dataset.index);
            openLightbox(idx);
        });
    });

    // 닫기 버튼
    document.querySelector('.lightbox-close').addEventListener('click', closeLightbox);

    // 이전/다음 버튼
    document.querySelector('.lightbox-prev').addEventListener('click', (e) => {
        e.stopPropagation();
        prevImage();
    });
    document.querySelector('.lightbox-next').addEventListener('click', (e) => {
        e.stopPropagation();
        nextImage();
    });

    // 배경 클릭 시 닫기
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox) {
            closeLightbox();
        }
    });

    // 키보드 이벤트: ESC(닫기), ←(이전), →(다음)
    document.addEventListener('keydown', (e) => {
        if (lightbox.classList.contains('hidden')) return;

        switch (e.key) {
            case 'Escape':
                closeLightbox();
                break;
            case 'ArrowLeft':
                prevImage();
                break;
            case 'ArrowRight':
                nextImage();
                break;
        }
    });

    // 터치 스와이프 (모바일)
    let touchStartX = 0;
    let touchEndX = 0;

    lightbox.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    lightbox.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const diff = touchStartX - touchEndX;

        if (Math.abs(diff) > 50) {
            if (diff > 0) {
                nextImage(); // 왼쪽 스와이프 → 다음
            } else {
                prevImage(); // 오른쪽 스와이프 → 이전
            }
        }
    }, { passive: true });

    // 이미지 전환 시 부드러운 애니메이션
    lightboxImg.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
}

// Mobile Menu
function setupMobileMenu() {
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');

    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            menuToggle.classList.toggle('active'); // Optional: for animation

            // Toggle body scroll
            if (navLinks.classList.contains('active')) {
                document.body.style.overflow = 'hidden';
            } else {
                document.body.style.overflow = '';
            }
        });

        // Close menu when clicking a link
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
                menuToggle.classList.remove('active');
                document.body.style.overflow = '';
            });
        });
    }
}

// Main JavaScript Logic

document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setupMobileMenu();
});

// Global Data Storage
let allWorks = [];

// 1. Fetch Data (Modified to use js/data.js for local file support)
function loadData() {
    try {
        if (window.portfolioData && window.portfolioData.works) {
            allWorks = window.portfolioData.works;

            // Determine current page and render accordingly
            if (document.getElementById('featured-works-grid')) {
                renderFeaturedWorks();
            } else if (document.getElementById('all-works-grid')) {
                renderAllWorks(); // Will be implemented for works.html
            } else if (document.getElementById('work-detail-container')) {
                renderWorkDetail(); // Will be implemented for work-detail.html
            }
        } else {
            throw new Error("Data not found");
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
        // Ensure parameters for better compatibility
        let embedUrl = work.youtubeUrl.replace('youtube.com', 'youtube-nocookie.com');

        const origin = window.location.origin !== 'null' ? window.location.origin : 'http://localhost:8080';

        if (embedUrl.indexOf('?') === -1) {
            embedUrl += `?rel=0&playsinline=1&modestbranding=1&enablejsapi=1&origin=${origin}`;
        } else {
            embedUrl += `&rel=0&playsinline=1&modestbranding=1&enablejsapi=1&origin=${origin}`;
        }

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

    // Stills HTML
    const stillsHtml = work.stills.map(src => `
        <img src="${src}" alt="Still from ${work.title}" onerror="this.src='https://via.placeholder.com/1280x720/1a1a1a/888?text=Image+Not+Found'">
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

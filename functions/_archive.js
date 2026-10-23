// Shared by /works and /lighting: puts the group's work links and tab counts into the first HTML,
// so crawlers that don't run JS can reach every work page. js/main.js replaces the list with the card grid.
const CONTENT_TYPE_LABELS = { musicvideo: "Music Video", commercial: "Brand & Commercial", highlight: "Highlight Film", webcontent: "Web Content" };
const MINOR_CATEGORY_LABELS = { musicvideo: "Music Video", film: "Film", commercial: "Commercial", etc: "Etc" };

export async function renderArchive({ request, env }, group) {
    const shell = await env.ASSETS.fetch(new URL(group === "lighting" ? "/lighting" : "/works", request.url));
    if (!env.DB || !shell.ok) return shell;

    let rows;
    try {
        ({ results: rows } = await env.DB.prepare(`
            SELECT id, title, major_category, minor_category, content_type, role, work_date
            FROM works ORDER BY position ASC, created_at DESC
        `).all());
    } catch (error) {
        console.error("archive render failed", error);
        return shell;
    }

    const counts = { production: 0, lighting: 0 };
    rows.forEach((row) => { if (row.major_category in counts) counts[row.major_category] += 1; });
    const items = rows.filter((row) => row.major_category === group).map((row) => {
        const type = group === "lighting" ? MINOR_CATEGORY_LABELS[row.minor_category] : CONTENT_TYPE_LABELS[row.content_type] || CONTENT_TYPE_LABELS[row.minor_category];
        const meta = [type, row.role, row.work_date].filter(Boolean).join(" · ");
        return `<li><a href="/work-detail?id=${encodeURIComponent(row.id)}">${html(row.title)}</a>${meta ? ` <span>${html(meta)}</span>` : ""}</li>`;
    });

    const headers = new Headers(shell.headers);
    headers.set("cache-control", "no-cache");
    headers.delete("content-length");

    return new HTMLRewriter()
        .on("#tab-count-production", { element: (el) => el.setInnerContent(String(counts.production)) })
        .on("#tab-count-lighting", { element: (el) => el.setInnerContent(String(counts.lighting)) })
        .on("#all-works-grid", { element: (el) => el.setInnerContent(`<ul class="archive-ssr">${items.join("")}</ul>`, { html: true }) })
        .transform(new Response(shell.body, { status: 200, headers }));
}

function html(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

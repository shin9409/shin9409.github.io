import { SITE_ORIGIN, getWork } from "./api/_lib.js";

// Serves work-detail.html with the work's real title, metadata and a readable summary in the first response,
// so crawlers that don't run JS still see the project. js/main.js then replaces the summary with the full view.
const CONTENT_TYPE_LABELS = { musicvideo: "Music Video", commercial: "Brand & Commercial", highlight: "Highlight Film", webcontent: "Web Content" };
const MINOR_CATEGORY_LABELS = { musicvideo: "Music Video", film: "Film", commercial: "Commercial", etc: "Etc" };

export async function onRequestGet({ request, env }) {
    const url = new URL(request.url);
    const shell = await env.ASSETS.fetch(new URL("/work-detail", url));
    const id = url.searchParams.get("id") || "";
    if (!env.DB || !shell.ok) return shell;

    let work = null;
    let siblings = [];
    try {
        work = id ? await getWork(env, id) : null;
        if (work) {
            const { results } = await env.DB.prepare(`
                SELECT id, title FROM works WHERE major_category = ? ORDER BY position ASC, created_at DESC
            `).bind(work.majorCategory).all();
            siblings = results || [];
        }
    } catch (error) {
        // A D1 hiccup must not take the page down: fall back to the plain shell, which renders client-side.
        console.error("work-detail render failed", error);
        return shell;
    }

    const headers = new Headers(shell.headers);
    headers.set("cache-control", "no-cache");
    headers.delete("content-length");

    if (!work) {
        return new HTMLRewriter()
            .on("title", { element: (el) => el.setInnerContent("작품을 찾을 수 없습니다 — 룩업미디어 LOOKUP MEDIA") })
            .on("head", { element: (el) => el.append('<meta name="robots" content="noindex">', { html: true }) })
            .on("#work-detail-container", {
                element: (el) => el.setInnerContent('<div class="detail-skeleton"><p>작품을 찾을 수 없습니다.</p><a class="text-link" href="/works">Works <span>→</span></a></div>', { html: true })
            })
            .transform(new Response(shell.body, { status: 404, headers }));
    }

    const isLighting = work.majorCategory === "lighting";
    const typeLabel = isLighting ? MINOR_CATEGORY_LABELS[work.minorCategory] || "" : CONTENT_TYPE_LABELS[work.contentType] || "";
    const groupLabel = isLighting ? "Lighting" : "Production";
    const canonical = `${SITE_ORIGIN}/work-detail?id=${encodeURIComponent(work.id)}`;
    const image = work.thumbnail ? new URL(work.thumbnail, SITE_ORIGIN).href : `${SITE_ORIGIN}/images/logo.png`;
    const description = summarize(work, groupLabel, typeLabel);
    // Lighting titles keep the group so a lighting credit is not read as our own production.
    const titleLabel = isLighting ? [groupLabel, typeLabel].filter(Boolean).join(" · ") : typeLabel;
    const pageTitle = `${work.title}${titleLabel ? ` | ${titleLabel}` : ""} — 룩업미디어 LOOKUP MEDIA`;

    const position = siblings.findIndex((item) => item.id === work.id);
    const previous = siblings.length > 1 ? siblings[(position - 1 + siblings.length) % siblings.length] : null;
    const next = siblings.length > 1 ? siblings[(position + 1) % siblings.length] : null;

    const structured = {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        name: work.title,
        url: canonical,
        image,
        genre: typeLabel || undefined,
        description: work.description?.trim() || undefined,
        [isLighting ? "contributor" : "creator"]: { "@type": "Organization", name: "룩업미디어 LOOKUP MEDIA", url: `${SITE_ORIGIN}/` }
    };

    const head = [
        `<link rel="canonical" href="${html(canonical)}">`,
        `<meta property="og:title" content="${html(pageTitle)}">`,
        `<meta property="og:description" content="${html(description)}">`,
        `<meta property="og:url" content="${html(canonical)}">`,
        `<meta property="og:image" content="${html(image)}">`,
        '<meta name="twitter:card" content="summary_large_image">',
        `<script type="application/ld+json">${JSON.stringify(structured).replace(/</g, "\\u003c")}</script>`
    ].join("\n    ");

    const summary = `
        <article class="detail-ssr">
            <p class="detail-ssr__meta">${html(groupLabel)}${typeLabel ? ` · ${html(typeLabel)}` : ""}</p>
            <h1>${html(work.title)}</h1>
            <p class="detail-ssr__meta">${html([work.date, work.role].filter(Boolean).join(" · "))}</p>
            ${work.description?.trim() ? `<p class="detail-ssr__desc">${html(work.description.trim())}</p>` : ""}
            ${work.credits?.length ? `<ul class="detail-ssr__credits">${work.credits.map((credit) => `<li>${html(credit.role)} — ${html(credit.name)}</li>`).join("")}</ul>` : ""}
            <nav class="detail-ssr__nav" aria-label="Adjacent projects">
                <a href="${isLighting ? "/lighting" : "/works"}">← ${isLighting ? "Lighting" : "Works"}</a>
                ${previous ? `<a href="/work-detail?id=${encodeURIComponent(previous.id)}">${html(previous.title)}</a>` : ""}
                ${next && next.id !== previous?.id ? `<a href="/work-detail?id=${encodeURIComponent(next.id)}">${html(next.title)}</a>` : ""}
            </nav>
        </article>`;

    return new HTMLRewriter()
        .on("title", { element: (el) => el.setInnerContent(pageTitle) })
        .on('meta[name="description"]', { element: (el) => el.setAttribute("content", description) })
        .on("head", { element: (el) => el.append(head, { html: true }) })
        .on("#work-detail-container", { element: (el) => el.setInnerContent(summary, { html: true }) })
        .transform(new Response(shell.body, { status: 200, headers }));
}

// Uses the stored description when there is one; otherwise states only facts already on record.
function summarize(work, groupLabel, typeLabel) {
    const text = work.description?.replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim();
    if (text) return text.length > 150 ? `${text.slice(0, 149)}…` : text;
    const kind = [groupLabel, typeLabel].filter(Boolean).join(" · ");
    const role = work.role ? ` 담당: ${work.role}.` : "";
    return `${work.title} — 룩업미디어(LOOKUP MEDIA) ${kind} 포트폴리오.${role}`;
}

function html(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

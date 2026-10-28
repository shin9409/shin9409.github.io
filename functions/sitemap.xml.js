import { SITE_ORIGIN, requireBindings } from "./api/_lib.js";

// Built from D1 on every request so works saved in the admin appear without a redeploy.
const STATIC_PATHS = ["/", "/works", "/lighting", "/about", "/contact"];

export async function onRequestGet({ env }) {
    const missing = requireBindings(env, ["DB"]);
    if (missing) return new Response("Sitemap unavailable", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });

    const [works, pages] = await Promise.all([
        env.DB.prepare("SELECT id, updated_at FROM works ORDER BY position ASC, created_at DESC").all(),
        env.DB.prepare("SELECT slug, updated_at FROM pages WHERE published = 1 ORDER BY sort_order ASC").all()
    ]);

    const entries = [
        ...STATIC_PATHS.map((path) => ({ loc: SITE_ORIGIN + path })),
        ...(works.results || []).map((row) => ({
            loc: `${SITE_ORIGIN}/work-detail?id=${encodeURIComponent(row.id)}`,
            lastmod: row.updated_at
        })),
        ...(pages.results || []).map((row) => ({
            loc: `${SITE_ORIGIN}/page?slug=${encodeURIComponent(row.slug)}`,
            lastmod: row.updated_at
        }))
    ];

    const body = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...entries.map(({ loc, lastmod }) => {
            const date = String(lastmod || "").slice(0, 10);
            return `  <url><loc>${escapeXml(loc)}</loc>${/^\d{4}-\d{2}-\d{2}$/.test(date) ? `<lastmod>${date}</lastmod>` : ""}</url>`;
        }),
        "</urlset>",
        ""
    ].join("\n");

    return new Response(body, {
        headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=300"
        }
    });
}

function escapeXml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]);
}

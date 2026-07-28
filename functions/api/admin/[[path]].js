import {
    badRequest,
    deletePage,
    deleteWork,
    getPage,
    getSiteSettings,
    json,
    listPages,
    listWorks,
    notFound,
    requireBindings,
    upsertPage,
    upsertSiteSettings,
    upsertWork
} from "../_lib.js";

const COOKIE_NAME = "lookup_admin";
const SESSION_MAX_AGE = 60 * 60 * 12;

export async function onRequest({ request, env, params }) {
    const path = "/" + normalizePath(params.path);
    const method = request.method.toUpperCase();

    if (path === "/login" && method === "POST") return login(request, env);
    if (path === "/logout" && method === "POST") return logout();
    if (path === "/session" && method === "GET") return json({ authenticated: await isAuthenticated(request, env) });

    const missing = requireBindings(env, ["DB"]);
    if (missing) return json({ error: missing }, { status: 503 });

    if (!(await isAuthenticated(request, env))) {
        return json({ error: "Unauthorized" }, { status: 401 });
    }

    if (path === "/works" && method === "GET") return json({ works: await listWorks(env) });
    if (path === "/works" && method === "POST") return saveWork(request, env);
    if (path.startsWith("/works/") && method === "PUT") return saveWork(request, env, decodeURIComponent(path.slice("/works/".length)));
    if (path.startsWith("/works/") && method === "DELETE") return removeWork(env, decodeURIComponent(path.slice("/works/".length)));

    if (path === "/site" && method === "GET") return json({ settings: await getSiteSettings(env) });
    if (path === "/site" && method === "PUT") return saveSite(request, env);

    if (path === "/pages" && method === "GET") return json({ pages: await listPages(env) });
    if (path === "/pages" && method === "POST") return savePage(request, env);
    if (path.startsWith("/pages/") && method === "GET") {
        const page = await getPage(env, decodeURIComponent(path.slice("/pages/".length)), true);
        return page ? json({ page }) : notFound("Page not found");
    }
    if (path.startsWith("/pages/") && method === "PUT") return savePage(request, env, decodeURIComponent(path.slice("/pages/".length)));
    if (path.startsWith("/pages/") && method === "DELETE") return removePage(env, decodeURIComponent(path.slice("/pages/".length)));

    if (path === "/assets" && method === "POST") return uploadAsset(request, env);

    return notFound("Admin endpoint not found");
}

async function login(request, env) {
    const { password } = await request.json().catch(() => ({}));
    if (!env.ADMIN_PASSWORD || !env.ADMIN_SESSION_SECRET) {
        return json({ error: "Admin secrets are not configured" }, { status: 503 });
    }
    if (!password || password !== env.ADMIN_PASSWORD) {
        return json({ error: "Invalid password" }, { status: 401 });
    }

    const expires = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
    const payload = `${expires}`;
    const signature = await sign(payload, env.ADMIN_SESSION_SECRET);
    const secure = new URL(request.url).protocol === "https:" ? " Secure;" : "";
    const cookie = `${COOKIE_NAME}=${payload}.${signature}; HttpOnly;${secure} SameSite=Strict; Path=/; Max-Age=${SESSION_MAX_AGE}`;

    return json({ authenticated: true }, { headers: { "set-cookie": cookie } });
}

function logout() {
    return json({ authenticated: false }, {
        headers: { "set-cookie": `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0` }
    });
}

async function saveWork(request, env, idFromPath = "") {
    const payload = await request.json().catch(() => null);
    if (!payload) return badRequest("Invalid JSON body");
    const work = sanitizeWork(payload);
    if (idFromPath && work.id !== idFromPath) return badRequest("Work ID cannot be changed through this endpoint");
    if (!work.id || !work.title) return badRequest("Work ID and title are required");
    const saved = await upsertWork(env, work);
    return json({ work: saved });
}

async function removeWork(env, id) {
    const deleted = await deleteWork(env, id);
    return deleted ? json({ ok: true }) : notFound("Project not found");
}

async function savePage(request, env, slugFromPath = "") {
    const payload = await request.json().catch(() => null);
    if (!payload) return badRequest("Invalid JSON body");
    const page = {
        slug: slugify(payload.slug || slugFromPath),
        title: String(payload.title || "").trim(),
        body: String(payload.body || ""),
        published: Boolean(payload.published),
        sortOrder: Number(payload.sortOrder || 0)
    };
    if (slugFromPath && page.slug !== slugFromPath) return badRequest("Page slug cannot be changed through this endpoint");
    if (!page.slug || !page.title) return badRequest("Page slug and title are required");
    return json({ page: await upsertPage(env, page) });
}

async function removePage(env, slug) {
    const deleted = await deletePage(env, slug);
    return deleted ? json({ ok: true }) : notFound("Page not found");
}

async function saveSite(request, env) {
    const payload = await request.json().catch(() => null);
    if (!payload) return badRequest("Invalid JSON body");
    const settings = {
        heroEyebrow: String(payload.heroEyebrow || "").trim(),
        heroTitle: String(payload.heroTitle || "").trim(),
        heroSubtitle: String(payload.heroSubtitle || "").trim(),
        heroWorkIds: Array.isArray(payload.heroWorkIds)
            ? [...new Set(payload.heroWorkIds.map((id) => slugify(id)).filter(Boolean))].slice(0, 5)
            : [],
        introTitle: String(payload.introTitle || "").trim(),
        introBody: String(payload.introBody || ""),
        contactEmail: String(payload.contactEmail || "").trim(),
        contactPhone: String(payload.contactPhone || "").trim(),
        contactAddress: String(payload.contactAddress || "").trim(),
        instagramUrl: String(payload.instagramUrl || "").trim()
    };
    if (!settings.heroTitle || !settings.introTitle) {
        return badRequest("Hero title and intro title are required");
    }
    return json({ settings: await upsertSiteSettings(env, settings) });
}

async function uploadAsset(request, env) {
    const missing = requireBindings(env, ["MEDIA"]);
    if (missing) return json({ error: missing }, { status: 503 });

    const formData = await request.formData();
    const file = formData.get("file");
    const requestedKind = formData.get("kind");
    const workId = slugify(formData.get("workId") || "misc");
    const pageSlug = slugify(formData.get("pageSlug") || "page");
    const kind = requestedKind === "thumb" ? "thumb" : requestedKind === "page" ? "page" : "still";
    const index = Number(formData.get("index") || 0);

    if (!file || typeof file.arrayBuffer !== "function") return badRequest("Image file is required");

    const key = kind === "page"
        ? `pages/${pageSlug}/${crypto.randomUUID()}.webp`
        : kind === "thumb"
            ? `works/${workId}/thumb.webp`
            : `works/${workId}/stills/${String(index + 1).padStart(3, "0")}.webp`;

    await env.MEDIA.put(key, await file.arrayBuffer(), {
        httpMetadata: {
            contentType: file.type || "image/webp",
            cacheControl: "public, max-age=31536000, immutable"
        }
    });

    return json({ key, url: assetUrlForResponse(env, key) });
}

function sanitizeWork(work) {
    return {
        id: slugify(work.id),
        title: String(work.title || "").trim(),
        majorCategory: ["production", "lighting"].includes(work.majorCategory) ? work.majorCategory : "production",
        minorCategory: ["musicvideo", "film", "commercial", "etc"].includes(work.minorCategory) ? work.minorCategory : "etc",
        date: String(work.date || "").trim(),
        role: String(work.role || "").trim(),
        featured: Boolean(work.featured),
        youtubeUrl: String(work.youtubeUrl || "").trim(),
        description: String(work.description || ""),
        thumbnailKey: String(work.thumbnailKey || work.thumbnail || "").trim(),
        stillKeys: Array.isArray(work.stillKeys || work.stills) ? (work.stillKeys || work.stills).map((key) => String(key).trim()).filter(Boolean) : [],
        credits: Array.isArray(work.credits) ? work.credits.map((credit) => ({
            role: String(credit.role || "").trim(),
            name: String(credit.name || "").trim()
        })).filter((credit) => credit.role || credit.name) : [],
        position: Number.isFinite(Number(work.position)) ? Number(work.position) : undefined
    };
}

async function isAuthenticated(request, env) {
    if (!env.ADMIN_SESSION_SECRET) return false;
    const cookie = request.headers.get("cookie") || "";
    const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
    if (!match) return false;

    const [payload, signature] = match[1].split(".");
    if (!payload || !signature) return false;
    if (Number(payload) < Math.floor(Date.now() / 1000)) return false;

    const expected = await sign(payload, env.ADMIN_SESSION_SECRET);
    return timingSafeEqual(signature, expected);
}

async function sign(payload, secret) {
    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
    return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a, b) {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let index = 0; index < a.length; index += 1) {
        result |= a.charCodeAt(index) ^ b.charCodeAt(index);
    }
    return result === 0;
}

function normalizePath(path) {
    if (!path) return "";
    return Array.isArray(path) ? path.join("/") : path;
}

function slugify(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function assetUrlForResponse(env, key) {
    const base = (env.ASSETS_PUBLIC_URL || "").replace(/\/$/, "");
    return base ? `${base}/${key}` : `/api/assets/${key}`;
}

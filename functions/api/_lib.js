const JSON_HEADERS = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
};

export const DEFAULT_SITE_SETTINGS = {
    heroEyebrow: "LOOKUP MEDIA / SEOUL",
    heroTitle: "PRODUCTION\n& LIGHTING",
    heroSubtitle: "FILM · MUSIC VIDEO · COMMERCIAL",
    heroWorkIds: ["work002", "work003"],
    introTitle: "EVERY FRAME BEGINS WITH A CLEAR POINT OF VIEW.",
    introBody: "LOOKUP MEDIA는 아이디어에서 현장, 마지막 프레임까지 하나의 시선으로 연결합니다. 프로덕션과 조명을 통해 이야기의 가장 정확한 분위기를 만듭니다.",
    contactEmail: "lookupmedia@naver.com",
    contactPhone: "010-2433-0583",
    contactAddress: "경기도 고양시 덕양구 지축4로 45 101,102호",
    instagramUrl: "https://www.instagram.com/lookupmedia_"
};

export function json(data, init = {}) {
    return new Response(JSON.stringify(data), {
        ...init,
        headers: { ...JSON_HEADERS, ...(init.headers || {}) }
    });
}

export function badRequest(message) {
    return json({ error: message }, { status: 400 });
}

export function notFound(message = "Not found") {
    return json({ error: message }, { status: 404 });
}

export function requireBindings(env, bindings) {
    const missing = bindings.filter((binding) => !env[binding]);
    if (missing.length > 0) {
        return `Missing Cloudflare binding(s): ${missing.join(", ")}`;
    }
    return "";
}

export function assetUrl(env, key) {
    if (!key) return "";
    if (/^(https?:)?\/\//.test(key) || key.startsWith("/")) {
        return key;
    }
    if (key.startsWith("images/")) {
        const legacyBase = (env.LEGACY_ASSET_ORIGIN || "").replace(/\/$/, "");
        return legacyBase ? `${legacyBase}/${key}` : key;
    }
    const base = (env.ASSETS_PUBLIC_URL || "").replace(/\/$/, "");
    return base ? `${base}/${key}` : `/api/assets/${key}`;
}

export function mapWork(row, env, images = [], credits = []) {
    return {
        id: row.id,
        title: row.title,
        majorCategory: row.major_category,
        minorCategory: row.minor_category,
        date: row.work_date,
        role: row.role || "",
        featured: Boolean(row.featured),
        youtubeUrl: row.youtube_url || "",
        description: row.description || "",
        thumbnail: assetUrl(env, row.thumbnail_key),
        thumbnailKey: row.thumbnail_key || "",
        stills: images.map((image) => assetUrl(env, image.image_key)),
        stillKeys: images.map((image) => image.image_key),
        credits,
        position: row.position || 0
    };
}

export async function listWorks(env) {
    const { results } = await env.DB.prepare(`
        SELECT *
        FROM works
        ORDER BY position ASC, created_at DESC
    `).all();

    if (!results.length) return [];

    const ids = results.map((work) => work.id);
    const placeholders = ids.map(() => "?").join(",");

    const imageRows = await env.DB.prepare(`
        SELECT work_id, image_key, sort_order
        FROM work_images
        WHERE work_id IN (${placeholders})
        ORDER BY work_id ASC, sort_order ASC
    `).bind(...ids).all();

    const creditRows = await env.DB.prepare(`
        SELECT work_id, role, name, sort_order
        FROM credits
        WHERE work_id IN (${placeholders})
        ORDER BY work_id ASC, sort_order ASC
    `).bind(...ids).all();

    const imagesByWork = groupBy(imageRows.results || [], "work_id");
    const creditsByWork = groupBy(creditRows.results || [], "work_id");

    return results.map((row) => mapWork(row, env, imagesByWork[row.id] || [], (creditsByWork[row.id] || []).map(({ role, name }) => ({ role, name }))));
}

export async function getWork(env, id) {
    const row = await env.DB.prepare("SELECT * FROM works WHERE id = ?").bind(id).first();
    if (!row) return null;

    const images = await env.DB.prepare(`
        SELECT image_key, sort_order
        FROM work_images
        WHERE work_id = ?
        ORDER BY sort_order ASC
    `).bind(id).all();

    const credits = await env.DB.prepare(`
        SELECT role, name, sort_order
        FROM credits
        WHERE work_id = ?
        ORDER BY sort_order ASC
    `).bind(id).all();

    return mapWork(row, env, images.results || [], (credits.results || []).map(({ role, name }) => ({ role, name })));
}

export async function upsertWork(env, work) {
    const now = new Date().toISOString();
    const existing = await env.DB.prepare("SELECT id, position FROM works WHERE id = ?").bind(work.id).first();
    const position = Number.isFinite(work.position) ? work.position : (existing ? existing.position : Date.now() * -1);

    if (existing) {
        await env.DB.prepare(`
            UPDATE works
            SET title = ?, major_category = ?, minor_category = ?, work_date = ?, role = ?,
                featured = ?, youtube_url = ?, description = ?, thumbnail_key = ?,
                position = ?, updated_at = ?
            WHERE id = ?
        `).bind(
            work.title,
            work.majorCategory,
            work.minorCategory,
            work.date,
            work.role || "",
            work.featured ? 1 : 0,
            work.youtubeUrl || "",
            work.description || "",
            work.thumbnailKey || work.thumbnail || "",
            position,
            now,
            work.id
        ).run();
    } else {
        await env.DB.prepare(`
            INSERT INTO works (
                id, title, major_category, minor_category, work_date, role, featured,
                youtube_url, description, thumbnail_key, position, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            work.id,
            work.title,
            work.majorCategory,
            work.minorCategory,
            work.date,
            work.role || "",
            work.featured ? 1 : 0,
            work.youtubeUrl || "",
            work.description || "",
            work.thumbnailKey || work.thumbnail || "",
            position,
            now,
            now
        ).run();
    }

    await env.DB.prepare("DELETE FROM work_images WHERE work_id = ?").bind(work.id).run();
    const stillKeys = work.stillKeys || work.stills || [];
    for (let index = 0; index < stillKeys.length; index += 1) {
        await env.DB.prepare(`
            INSERT INTO work_images (work_id, image_key, sort_order)
            VALUES (?, ?, ?)
        `).bind(work.id, stillKeys[index], index).run();
    }

    await env.DB.prepare("DELETE FROM credits WHERE work_id = ?").bind(work.id).run();
    const credits = Array.isArray(work.credits) ? work.credits : [];
    for (let index = 0; index < credits.length; index += 1) {
        const credit = credits[index];
        if (!credit.role && !credit.name) continue;
        await env.DB.prepare(`
            INSERT INTO credits (work_id, role, name, sort_order)
            VALUES (?, ?, ?, ?)
        `).bind(work.id, credit.role || "", credit.name || "", index).run();
    }

    return getWork(env, work.id);
}

export async function deleteWork(env, id) {
    await env.DB.prepare("DELETE FROM credits WHERE work_id = ?").bind(id).run();
    await env.DB.prepare("DELETE FROM work_images WHERE work_id = ?").bind(id).run();
    const result = await env.DB.prepare("DELETE FROM works WHERE id = ?").bind(id).run();
    return result.meta.changes > 0;
}

export async function listPages(env) {
    const { results } = await env.DB.prepare(`
        SELECT slug, title, body, published, sort_order, created_at, updated_at
        FROM pages
        ORDER BY sort_order ASC, title ASC
    `).all();
    return results.map(mapPage);
}

export async function getPage(env, slug, includeDraft = false) {
    const row = await env.DB.prepare(`
        SELECT slug, title, body, published, sort_order, created_at, updated_at
        FROM pages
        WHERE slug = ? ${includeDraft ? "" : "AND published = 1"}
    `).bind(slug).first();
    return row ? mapPage(row) : null;
}

export async function upsertPage(env, page) {
    const now = new Date().toISOString();
    const existing = await env.DB.prepare("SELECT slug FROM pages WHERE slug = ?").bind(page.slug).first();

    if (existing) {
        await env.DB.prepare(`
            UPDATE pages
            SET title = ?, body = ?, published = ?, sort_order = ?, updated_at = ?
            WHERE slug = ?
        `).bind(page.title, page.body || "", page.published ? 1 : 0, page.sortOrder || 0, now, page.slug).run();
    } else {
        await env.DB.prepare(`
            INSERT INTO pages (slug, title, body, published, sort_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(page.slug, page.title, page.body || "", page.published ? 1 : 0, page.sortOrder || 0, now, now).run();
    }

    return getPage(env, page.slug, true);
}

export async function deletePage(env, slug) {
    const result = await env.DB.prepare("DELETE FROM pages WHERE slug = ?").bind(slug).run();
    return result.meta.changes > 0;
}

export async function getSiteSettings(env) {
    try {
        const row = await env.DB.prepare("SELECT * FROM site_settings WHERE id = 1").first();
        return row ? mapSiteSettings(row) : { ...DEFAULT_SITE_SETTINGS };
    } catch (error) {
        console.warn("site_settings is not ready; using defaults", error);
        return { ...DEFAULT_SITE_SETTINGS };
    }
}

export async function upsertSiteSettings(env, settings) {
    const next = { ...DEFAULT_SITE_SETTINGS, ...settings };
    const now = new Date().toISOString();
    await env.DB.prepare(`
        INSERT INTO site_settings (
            id, hero_eyebrow, hero_title, hero_subtitle, hero_work_ids,
            intro_title, intro_body, contact_email, contact_phone,
            contact_address, instagram_url, updated_at
        ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            hero_eyebrow = excluded.hero_eyebrow,
            hero_title = excluded.hero_title,
            hero_subtitle = excluded.hero_subtitle,
            hero_work_ids = excluded.hero_work_ids,
            intro_title = excluded.intro_title,
            intro_body = excluded.intro_body,
            contact_email = excluded.contact_email,
            contact_phone = excluded.contact_phone,
            contact_address = excluded.contact_address,
            instagram_url = excluded.instagram_url,
            updated_at = excluded.updated_at
    `).bind(
        next.heroEyebrow,
        next.heroTitle,
        next.heroSubtitle,
        JSON.stringify(next.heroWorkIds || []),
        next.introTitle,
        next.introBody,
        next.contactEmail,
        next.contactPhone,
        next.contactAddress,
        next.instagramUrl,
        now
    ).run();
    return getSiteSettings(env);
}

function groupBy(items, key) {
    return items.reduce((acc, item) => {
        const value = item[key];
        if (!acc[value]) acc[value] = [];
        acc[value].push(item);
        return acc;
    }, {});
}

function mapPage(row) {
    return {
        slug: row.slug,
        title: row.title,
        body: row.body || "",
        published: Boolean(row.published),
        sortOrder: row.sort_order || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

function mapSiteSettings(row) {
    let heroWorkIds = [];
    try {
        const parsed = JSON.parse(row.hero_work_ids || "[]");
        heroWorkIds = Array.isArray(parsed) ? parsed.map(String).filter(Boolean).slice(0, 5) : [];
    } catch {
        heroWorkIds = [];
    }
    return {
        heroEyebrow: row.hero_eyebrow || DEFAULT_SITE_SETTINGS.heroEyebrow,
        heroTitle: row.hero_title || DEFAULT_SITE_SETTINGS.heroTitle,
        heroSubtitle: row.hero_subtitle || DEFAULT_SITE_SETTINGS.heroSubtitle,
        heroWorkIds,
        introTitle: row.intro_title || DEFAULT_SITE_SETTINGS.introTitle,
        introBody: row.intro_body || DEFAULT_SITE_SETTINGS.introBody,
        contactEmail: row.contact_email || DEFAULT_SITE_SETTINGS.contactEmail,
        contactPhone: row.contact_phone || DEFAULT_SITE_SETTINGS.contactPhone,
        contactAddress: row.contact_address || DEFAULT_SITE_SETTINGS.contactAddress,
        instagramUrl: row.instagram_url || DEFAULT_SITE_SETTINGS.instagramUrl,
        updatedAt: row.updated_at || ""
    };
}

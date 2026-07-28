import { getSiteSettings, json, listPages, requireBindings } from "./_lib.js";

export async function onRequestGet({ env }) {
    const missing = requireBindings(env, ["DB"]);
    if (missing) return json({ error: missing }, { status: 503 });

    const [settings, pages] = await Promise.all([
        getSiteSettings(env),
        listPages(env)
    ]);

    return json({
        settings,
        navigation: pages
            .filter((page) => page.published)
            .map(({ slug, title, sortOrder }) => ({ slug, title, sortOrder }))
    });
}

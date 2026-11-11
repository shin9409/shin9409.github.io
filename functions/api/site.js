import { cachedPublicJson, json, listPages, readSiteSettings, requireBindings } from "./_lib.js";

export async function onRequestGet(context) {
    const { env } = context;
    const missing = requireBindings(env, ["DB"]);
    if (missing) return json({ error: missing }, { status: 503 });

    return cachedPublicJson(context, "/api/site", async () => {
        const [site, pages] = await Promise.all([
            readSiteSettings(env),
            listPages(env)
        ]);

        return {
            data: {
                settings: site.settings,
                navigation: pages
                    .filter((page) => page.published)
                    .map(({ slug, title, sortOrder }) => ({ slug, title, sortOrder }))
            },
            // Default settings standing in for a failed site_settings read are served but not cached.
            cacheable: !site.fallback
        };
    });
}

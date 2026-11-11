import { cachedPublicJson, json, listWorks, requireBindings } from "./_lib.js";

export async function onRequestGet(context) {
    const { env } = context;
    const missing = requireBindings(env, ["DB"]);
    if (missing) return json({ error: missing }, { status: 503 });

    // A D1 error throws out of listWorks before anything is cached, so failures are never stored.
    return cachedPublicJson(context, "/api/works", async () => ({ data: { works: await listWorks(env) } }));
}

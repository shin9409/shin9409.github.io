import { getPage, json, notFound, requireBindings } from "../_lib.js";

export async function onRequestGet({ env, params }) {
    const missing = requireBindings(env, ["DB"]);
    if (missing) return json({ error: missing }, { status: 503 });

    const page = await getPage(env, params.slug);
    if (!page) return notFound("Page not found");
    return json({ page });
}

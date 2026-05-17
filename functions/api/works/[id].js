import { getWork, json, notFound, requireBindings } from "../_lib.js";

export async function onRequestGet({ env, params }) {
    const missing = requireBindings(env, ["DB"]);
    if (missing) return json({ error: missing }, { status: 503 });

    const work = await getWork(env, params.id);
    if (!work) return notFound("Project not found");
    return json({ work });
}

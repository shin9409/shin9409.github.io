import { json, listWorks, requireBindings } from "./_lib.js";

export async function onRequestGet({ env }) {
    const missing = requireBindings(env, ["DB"]);
    if (missing) return json({ error: missing }, { status: 503 });

    const works = await listWorks(env);
    return json({ works });
}

import { notFound, requireBindings } from "../_lib.js";

export async function onRequestGet({ env, params }) {
    const missing = requireBindings(env, ["MEDIA"]);
    if (missing) return new Response(missing, { status: 503 });

    const key = Array.isArray(params.path) ? params.path.join("/") : params.path;
    if (!key) return notFound("Asset not found");

    const object = await env.MEDIA.get(key);
    if (!object) return notFound("Asset not found");

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("cache-control", "public, max-age=31536000, immutable");

    return new Response(object.body, { headers });
}

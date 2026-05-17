import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const rootDir = resolve(import.meta.dirname, "..");
const siteUrl = (process.env.CLOUDFLARE_ADMIN_URL || "https://lookupmedia-portfolio.pages.dev").replace(/\/$/, "");
const password = process.env.ADMIN_PASSWORD;
const apply = process.argv.includes("--apply");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;
const outputSqlPath = resolve(rootDir, "migrations/0003_migrate_assets_to_r2.sql");

if (!password && apply) {
    throw new Error("ADMIN_PASSWORD 환경 변수가 필요합니다.");
}

const sql = [];
const report = {
    converted: 0,
    uploaded: 0,
    skipped: 0,
    missing: []
};

const tempDir = join(tmpdir(), `lookupmedia-r2-migration-${Date.now()}`);
await mkdir(tempDir, { recursive: true });

const works = await fetchJson(`${siteUrl}/api/works`).then((data) => data.works || []);
const jobs = collectJobs(works).slice(0, limit);

console.log(`Found ${jobs.length} legacy image references.`);
console.log(apply ? "Running migration." : "Dry run only. Add --apply to upload.");

let cookie = "";
if (apply) {
    cookie = await login();
}

for (let index = 0; index < jobs.length; index += 1) {
    const job = jobs[index];
    const sourcePath = resolve(rootDir, job.sourceKey);
    const outputPath = join(tempDir, `${job.workId}-${job.kind}-${job.index + 1}-${basename(job.sourceKey)}.webp`);

    try {
        await convertToWebp(sourcePath, outputPath, job.kind === "thumb" ? 800 : 1800);
    } catch (error) {
        report.missing.push({ key: job.sourceKey, reason: error.message });
        console.warn(`Missing or failed: ${job.sourceKey}`);
        continue;
    }

    report.converted += 1;
    if (apply) {
        const uploadedKey = await uploadAsset({ ...job, outputPath, cookie });
        if (uploadedKey !== job.targetKey) {
            throw new Error(`Unexpected upload key: ${uploadedKey} !== ${job.targetKey}`);
        }
        report.uploaded += 1;
    }

    sql.push(makeUpdateSql(job));
    if ((index + 1) % 25 === 0 || index === jobs.length - 1) {
        console.log(`${index + 1}/${jobs.length} processed`);
    }
}

await writeFile(outputSqlPath, `${sql.join("\n")}\n`, "utf8");

console.log(`SQL written: ${outputSqlPath}`);
console.log(JSON.stringify(report, null, 2));

function collectJobs(items) {
    const rows = [];
    for (const work of items) {
        if (work.thumbnailKey?.startsWith("images/works/")) {
            rows.push({
                workId: work.id,
                kind: "thumb",
                index: 0,
                sourceKey: work.thumbnailKey,
                targetKey: `works/${work.id}/thumb.webp`
            });
        }
        (work.stillKeys || []).forEach((sourceKey, stillIndex) => {
            if (!sourceKey.startsWith("images/works/")) return;
            rows.push({
                workId: work.id,
                kind: "still",
                index: stillIndex,
                sourceKey,
                targetKey: `works/${work.id}/stills/${String(stillIndex + 1).padStart(3, "0")}.webp`
            });
        });
    }
    return rows;
}

async function login() {
    const response = await fetch(`${siteUrl}/api/admin/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password })
    });
    if (!response.ok) {
        throw new Error(`Admin login failed: ${response.status}`);
    }
    return response.headers.get("set-cookie")?.split(";")[0] || "";
}

async function uploadAsset({ outputPath, workId, kind, index, cookie }) {
    const formData = new FormData();
    const blob = new Blob([await readFile(outputPath)], { type: "image/webp" });
    formData.append("file", blob, `${kind}.webp`);
    formData.append("workId", workId);
    formData.append("kind", kind);
    formData.append("index", String(index));

    const response = await fetch(`${siteUrl}/api/admin/assets`, {
        method: "POST",
        headers: { cookie },
        body: formData
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(`Upload failed for ${workId}/${kind}/${index}: ${data.error || response.status}`);
    }
    return data.key;
}

async function convertToWebp(sourcePath, outputPath, maxSize) {
    const { width, height } = await dimensions(sourcePath);
    const scale = Math.min(1, maxSize / Math.max(width, height));
    const targetWidth = Math.max(1, Math.round(width * scale));
    const targetHeight = Math.max(1, Math.round(height * scale));
    await execFileAsync("cwebp", [
        "-quiet",
        "-q",
        "86",
        "-resize",
        String(targetWidth),
        String(targetHeight),
        sourcePath,
        "-o",
        outputPath
    ]);
}

async function dimensions(sourcePath) {
    const { stdout } = await execFileAsync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", sourcePath]);
    const width = Number(stdout.match(/pixelWidth:\s*(\d+)/)?.[1]);
    const height = Number(stdout.match(/pixelHeight:\s*(\d+)/)?.[1]);
    if (!width || !height) throw new Error(`Cannot read image dimensions for ${sourcePath}`);
    return { width, height };
}

async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Fetch failed: ${url} ${response.status}`);
    return response.json();
}

function makeUpdateSql(job) {
    if (job.kind === "thumb") {
        return `UPDATE works SET thumbnail_key = ${q(job.targetKey)}, updated_at = CURRENT_TIMESTAMP WHERE id = ${q(job.workId)} AND thumbnail_key = ${q(job.sourceKey)};`;
    }
    return `UPDATE work_images SET image_key = ${q(job.targetKey)} WHERE work_id = ${q(job.workId)} AND sort_order = ${job.index} AND image_key = ${q(job.sourceKey)};`;
}

function q(value) {
    return `'${String(value).replace(/'/g, "''")}'`;
}

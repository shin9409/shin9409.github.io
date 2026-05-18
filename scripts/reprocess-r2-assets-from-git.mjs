import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const rootDir = resolve(import.meta.dirname, "..");
const sourceRef = process.env.SOURCE_REF || "191c899^";
const siteUrl = (process.env.CLOUDFLARE_ADMIN_URL || "https://lookupmedia.co.kr").replace(/\/$/, "");
const password = process.env.ADMIN_PASSWORD;
const apply = process.argv.includes("--apply");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : Infinity;
const IMAGE_SETTINGS = {
    thumbMaxSize: 1920,
    stillMaxSize: 3840,
    webpQuality: 96
};

if (apply && !password) {
    throw new Error("ADMIN_PASSWORD 환경 변수가 필요합니다.");
}

const tempDir = join(tmpdir(), `lookupmedia-r2-reprocess-${Date.now()}`);
await mkdir(tempDir, { recursive: true });

try {
    const [oldWorks, currentWorks] = await Promise.all([
        loadWorksFromGit(),
        fetchJson(`${siteUrl}/api/works`).then((data) => data.works || [])
    ]);

    const jobs = [];
    for (const currentWork of currentWorks) {
        const oldWork = oldWorks.find((work) => work.id === currentWork.id);
        if (!oldWork) continue;

        if (oldWork.thumbnail) {
            jobs.push({
                workId: currentWork.id,
                kind: "thumb",
                index: 0,
                sourceKey: oldWork.thumbnail,
                targetKey: `works/${currentWork.id}/thumb.webp`
            });
        }

        const currentStillKeys = (currentWork.stillKeys || []).map(assetKey);
        const existingSources = [];
        for (const sourceKey of oldWork.stills || []) {
            if (await gitFileExists(sourceKey)) existingSources.push(sourceKey);
        }

        currentStillKeys.forEach((targetKey, index) => {
            const sourceKey = existingSources[index];
            if (!sourceKey) return;
            jobs.push({
                workId: currentWork.id,
                kind: "still",
                index,
                sourceKey,
                targetKey
            });
        });
    }

    const selectedJobs = jobs.slice(0, limit);
    const report = {
        sourceRef,
        siteUrl,
        totalJobs: jobs.length,
        selectedJobs: selectedJobs.length,
        converted: 0,
        uploaded: 0,
        missing: []
    };

    console.log(`Found ${jobs.length} assets to reprocess from ${sourceRef}.`);
    console.log(apply ? "Uploading high-quality assets to R2." : "Dry run only. Add --apply to upload.");

    let cookie = "";
    if (apply) cookie = await login();

    for (let index = 0; index < selectedJobs.length; index += 1) {
        const job = selectedJobs[index];
        const sourcePath = join(tempDir, `${job.workId}-${job.kind}-${job.index}-${basename(job.sourceKey)}`);
        const outputPath = `${sourcePath}.webp`;

        try {
            await extractFromGit(job.sourceKey, sourcePath);
            await convertToWebp(
                sourcePath,
                outputPath,
                job.kind === "thumb" ? IMAGE_SETTINGS.thumbMaxSize : IMAGE_SETTINGS.stillMaxSize
            );
            report.converted += 1;

            if (apply) {
                const uploadedKey = await uploadAsset({ ...job, outputPath, cookie });
                if (uploadedKey !== job.targetKey) {
                    throw new Error(`Unexpected upload key: ${uploadedKey} !== ${job.targetKey}`);
                }
                report.uploaded += 1;
            }
        } catch (error) {
            report.missing.push({ key: job.sourceKey, target: job.targetKey, reason: error.message });
            console.warn(`Skipped ${job.sourceKey}: ${error.message}`);
        }

        if ((index + 1) % 25 === 0 || index === selectedJobs.length - 1) {
            console.log(`${index + 1}/${selectedJobs.length} processed`);
        }
    }

    console.log(JSON.stringify(report, null, 2));
} finally {
    await rm(tempDir, { recursive: true, force: true });
}

async function loadWorksFromGit() {
    const { stdout } = await execFileAsync("git", ["show", `${sourceRef}:data.json`], {
        cwd: rootDir,
        maxBuffer: 200 * 1024 * 1024
    });
    return JSON.parse(stdout);
}

async function gitFileExists(path) {
    try {
        await execFileAsync("git", ["cat-file", "-e", `${sourceRef}:${path}`], { cwd: rootDir });
        return true;
    } catch {
        return false;
    }
}

async function extractFromGit(path, outputPath) {
    const { stdout } = await execFileAsync("git", ["show", `${sourceRef}:${path}`], {
        cwd: rootDir,
        encoding: "buffer",
        maxBuffer: 200 * 1024 * 1024
    });
    await writeFile(outputPath, stdout);
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
        String(IMAGE_SETTINGS.webpQuality),
        "-sharp_yuv",
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

function assetKey(value) {
    return String(value || "").replace(/^\/api\/assets\//, "");
}

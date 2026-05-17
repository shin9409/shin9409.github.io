import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/data.js', 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);

const works = sandbox.window.portfolioData?.works || [];
const lines = [
    '-- Generated from js/data.js. Re-run: node scripts/generate-d1-seed.mjs',
    'DELETE FROM credits;',
    'DELETE FROM work_images;',
    'DELETE FROM works;',
    'DELETE FROM pages;'
];

works.forEach((work, index) => {
    lines.push(`INSERT INTO works (id, title, major_category, minor_category, work_date, role, featured, youtube_url, description, thumbnail_key, position, created_at, updated_at) VALUES (${[
        q(work.id),
        q(work.title),
        q(work.majorCategory),
        q(work.minorCategory),
        q(work.date || ''),
        q(work.role || ''),
        work.featured ? 1 : 0,
        q(work.youtubeUrl || ''),
        q(work.description || ''),
        q(work.thumbnail || ''),
        index,
        q(new Date().toISOString()),
        q(new Date().toISOString())
    ].join(', ')});`);

    (work.stills || []).forEach((image, imageIndex) => {
        lines.push(`INSERT INTO work_images (work_id, image_key, sort_order) VALUES (${q(work.id)}, ${q(image)}, ${imageIndex});`);
    });

    const credits = Array.isArray(work.credits)
        ? work.credits
        : Object.entries(work.credits || {}).map(([role, name]) => ({ role, name }));

    credits.forEach((credit, creditIndex) => {
        lines.push(`INSERT INTO credits (work_id, role, name, sort_order) VALUES (${q(work.id)}, ${q(credit.role || '')}, ${q(credit.name || '')}, ${creditIndex});`);
    });
});

lines.push(`INSERT INTO pages (slug, title, body, published, sort_order, created_at, updated_at) VALUES ('about', 'About', 'LOOKUP MEDIA page content can be edited in the admin.', 0, 0, ${q(new Date().toISOString())}, ${q(new Date().toISOString())});`);

fs.writeFileSync('migrations/0002_seed.sql', `${lines.join('\n')}\n`);

function q(value) {
    return `'${String(value).replace(/'/g, "''")}'`;
}

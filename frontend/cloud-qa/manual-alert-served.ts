import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, root } from './safety.ts';

await assertCloudDatabase();
const manual = readFileSync(path.join(root, 'docs/manual/help-data.js'));
const sha = createHash('sha256').update(manual).digest('hex');
for (const entry of ['index.html', 'tutorial.html', 'search.html']) {
 const response = await fetch('http://127.0.0.1:4177/manual/' + entry);
 assert.equal(response.status, 200);
 const html = await response.text();
 assert.match(html, new RegExp('help-data\\.js\\?v=' + sha.slice(0, 12)));
}
const data = await fetch('http://127.0.0.1:4177/manual/help-data.js?v=' + sha.slice(0, 12));
assert.equal(data.status, 200);
assert.equal(createHash('sha256').update(Buffer.from(await data.arrayBuffer())).digest('hex'), sha);
const report = { synthetic: true, entries: 3, servedMatchesSource: true, sha256: sha };
writeFileSync(path.join(process.env.QA_ARTIFACTS!, 'manual-served.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));

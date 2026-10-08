// Fail the build when what users download grows past its budget. Run after `npm run build`.
// Raise a budget deliberately, in a PR that says why.
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGETS = [
  { label: 'JS (dist/assets/*.js)', files: () => fs.readdirSync('dist/assets').filter((f) => f.endsWith('.js')).map((f) => path.join('dist/assets', f)), kB: 90 },
  { label: 'graph.json', files: () => ['public/data/graph.json'], kB: 220 },
];

const gz = (file: string) => gzipSync(fs.readFileSync(file), { level: 9 }).length / 1000;
const rows = BUDGETS.map((b) => {
  const kB = b.files().reduce((sum, f) => sum + gz(f), 0);
  return { ...b, actual: kB, ok: kB <= b.kB };
});

const table = ['| | gzip | budget | |', '|---|---:|---:|---|', ...rows.map((r) => `| ${r.label} | ${r.actual.toFixed(1)} kB | ${r.kB} kB | ${r.ok ? 'ok' : '**over**'} |`)].join('\n');
console.log(table);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Size budgets\n\n${table}\n`);
for (const r of rows) if (!r.ok) console.error(`::error::${r.label} is ${r.actual.toFixed(1)} kB gzip, over its ${r.kB} kB budget`);
if (rows.some((r) => !r.ok)) process.exit(1);

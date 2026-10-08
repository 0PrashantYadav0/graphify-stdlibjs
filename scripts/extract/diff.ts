// Compare two graph.json files for the data-refresh PR body.
// Usage: tsx scripts/extract/diff.ts <old.json> <new.json> [body.md]
// Prints changed=true|false (for $GITHUB_OUTPUT) and writes the markdown body when changed.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { GraphFile } from '../../src/graph/types';

const LIST_MAX = 50;
const fmt = new Intl.NumberFormat('en-US');

/** Everything but generatedAt, which changes on every run. */
const content = ({ generatedAt: _, ...rest }: GraphFile) => JSON.stringify(rest);

export function diffGraphFiles(before: GraphFile, after: GraphFile): { changed: boolean; markdown: string } {
  if (content(before) === content(after)) return { changed: false, markdown: '' };
  const row = (label: string, a: number, b: number) => {
    const d = b - a;
    return `| ${label} | ${fmt.format(a)} | ${fmt.format(b)} | ${d > 0 ? '+' : ''}${fmt.format(d)} |`;
  };
  const was = new Set(before.ids);
  const now = new Set(after.ids);
  const added = after.ids.filter((id) => !was.has(id));
  const removed = before.ids.filter((id) => !now.has(id));
  const list = (title: string, ids: string[]) =>
    ids.length === 0
      ? []
      : [
          `**${title} (${ids.length})**${ids.length > LIST_MAX ? `, first ${LIST_MAX}` : ''}: ` +
            ids.slice(0, LIST_MAX).map((id) => `\`${id}\``).join(', '),
          '',
        ];
  const sha = (s: string) => (/^[0-9a-f]{40}$/.test(s) ? `[\`${s.slice(0, 7)}\`](https://github.com/stdlib-js/stdlib/commit/${s})` : `\`${s}\``);
  return {
    changed: true,
    markdown: [
      `Source: ${sha(before.source)} → ${sha(after.source)}`,
      '',
      '| | before | after | Δ |',
      '|---|---:|---:|---:|',
      row('packages', before.ids.length, after.ids.length),
      row('runtime edges', before.runtime.targets.length, after.runtime.targets.length),
      row('dev edges', before.dev.targets.length, after.dev.targets.length),
      row('native edges', before.native.targets.length, after.native.targets.length),
      '',
      ...list('Added', added),
      ...list('Removed', removed),
    ].join('\n'),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [oldPath, newPath, bodyPath] = process.argv.slice(2);
  const read = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8')) as GraphFile;
  const { changed, markdown } = diffGraphFiles(read(oldPath), read(newPath));
  if (changed && bodyPath) fs.writeFileSync(bodyPath, markdown + '\n');
  console.log(`changed=${changed}`);
}

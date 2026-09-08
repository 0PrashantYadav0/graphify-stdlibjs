import { decodeTags, TAG_LABEL, type TagName } from '../graph/tags';

const SHOWN: TagName[] = ['JS', 'C', 'FORTRAN', 'WASM', 'NATIVE', 'CLI'];
const CHAR_W = 7;
const PAD = 6;
const GAP = 4;
const H = 16;

export function shownTags(mask: number): TagName[] {
  return decodeTags(mask).filter((t) => SHOWN.includes(t));
}

export function pillsWidth(mask: number): number {
  const tags = shownTags(mask);
  if (tags.length === 0) return 0;
  return tags.reduce((w, t) => w + TAG_LABEL[t].length * CHAR_W + PAD * 2, 0) + GAP * (tags.length - 1);
}

interface Props {
  mask: number;
  /** Right edge when align is 'end', left edge otherwise. */
  x: number;
  y: number;
  align?: 'start' | 'end';
}

export function SvgPills({ mask, x, y, align = 'end' }: Props) {
  const tags = shownTags(mask);
  if (tags.length === 0) return null;
  let cursor = align === 'end' ? x - pillsWidth(mask) : x;
  return (
    <g className="spills">
      {tags.map((t) => {
        const label = TAG_LABEL[t];
        const w = label.length * CHAR_W + PAD * 2;
        const el = (
          <g key={t} className={`spill spill-${label}`} transform={`translate(${cursor}, ${y - H / 2})`}>
            <rect width={w} height={H} rx={3} />
            <text x={w / 2} y={H / 2 + 3.5} textAnchor="middle">{label}</text>
          </g>
        );
        cursor += w + GAP;
        return el;
      })}
    </g>
  );
}

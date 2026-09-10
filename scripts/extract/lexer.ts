/**
 * A minimal JavaScript tokeniser, just deep enough to tell code from comments,
 * strings, template literals and regular expression literals.
 *
 * `extractRequires` used to regex whole file text, which counted every
 * `require()` written inside a JSDoc `@example` block, a commented-out line or
 * a string as a real dependency — 35.3% of all `require('@stdlib/…')`
 * occurrences under stdlib's `lib/` (see docs/adr/0002). A regex that strips
 * comments cannot fix that: `//` appears inside strings, `/*` appears inside
 * regex literals, and `/` is ambiguous between division and a regex.
 *
 * This is a tokeniser rather than a full parse because it must never throw on
 * input it does not understand: it runs over 22k third-party files and a parse
 * error would silently drop a whole package's edges. It emits only the token
 * kinds the require-matching needs; everything else collapses to `other`.
 */

export type TokenKind = 'name' | 'punct' | 'string' | 'other';

export interface Token {
  kind: TokenKind;
  /** For `string`, the literal's contents; for `name`/`punct`, its text. */
  value: string;
}

const WHITESPACE = new Set([' ', '\t', '\r', '\n', '\f', '\v', '\u00a0', '\ufeff']);

/**
 * Keywords after which a `/` starts a regular expression rather than dividing.
 * After any other name — an identifier, `this`, a literal — `/` is division.
 */
const REGEX_PRECEDING_KEYWORDS = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void',
  'throw', 'case', 'do', 'else', 'yield', 'await',
]);

const isIdentStart = (c: string): boolean =>
  (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_' || c === '$' || c > '\u007f';

const isIdentPart = (c: string): boolean => isIdentStart(c) || (c >= '0' && c <= '9');

const isDigit = (c: string): boolean => c >= '0' && c <= '9';

/**
 * Whether a `/` at this point opens a regex literal, given the last
 * significant token. The cases that matter in practice are `foo(x) / y`
 * (division, so `)` means division) and `return /re/` (regex).
 */
function regexAllowed(prev: Token | undefined): boolean {
  if (!prev) return true;
  if (prev.kind === 'name') return REGEX_PRECEDING_KEYWORDS.has(prev.value);
  if (prev.kind === 'punct') return prev.value !== ')' && prev.value !== ']' && prev.value !== '}';
  // After a string, a template or a number, `/` divides.
  return false;
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  const n = source.length;
  let i = 0;
  let prev: Token | undefined;
  /** Brace depth outside each currently open `${` substitution. */
  const templates: number[] = [];
  let depth = 0;

  const push = (kind: TokenKind, value: string): void => {
    const t = { kind, value };
    tokens.push(t);
    prev = t;
  };

  /**
   * Consume template characters from `at`, stopping after the closing
   * backtick or after a `${`. Returns where to resume and which it hit.
   */
  const scanTemplatePart = (at: number): { next: number; interpolated: boolean } => {
    let j = at;
    while (j < n) {
      const c = source[j];
      if (c === '\\') {
        j += 2;
        continue;
      }
      if (c === '`') return { next: j + 1, interpolated: false };
      if (c === '$' && source[j + 1] === '{') return { next: j + 2, interpolated: true };
      j++;
    }
    return { next: n, interpolated: false };
  };

  const enterTemplate = (at: number): number => {
    const r = scanTemplatePart(at);
    if (r.interpolated) {
      templates.push(depth);
      depth++;
    } else {
      // A finished template is a value: `\`a\` / 2` divides.
      push('other', '`');
    }
    return r.next;
  };

  while (i < n) {
    const c = source[i];

    if (WHITESPACE.has(c)) {
      i++;
      continue;
    }

    // Comments produce no token, so they cannot affect regex/division
    // disambiguation for the `/` that may follow them.
    if (c === '/' && source[i + 1] === '/') {
      while (i < n && source[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      // An unterminated block comment runs to end of file, as JS engines read it.
      i = end < 0 ? n : end + 2;
      continue;
    }

    if (c === '"' || c === "'") {
      i++;
      let value = '';
      while (i < n) {
        const d = source[i];
        if (d === '\\') {
          // Escapes are not decoded: nothing in an `@stdlib/…` spec needs it,
          // and skipping the pair is what keeps `'it\'s'` from ending early.
          value += source[i + 1] ?? '';
          i += 2;
          continue;
        }
        if (d === c) {
          i++;
          break;
        }
        // A newline in a quoted string means the source is malformed; stop
        // here rather than swallowing the rest of the file.
        if (d === '\n') break;
        value += d;
        i++;
      }
      push('string', value);
      continue;
    }

    if (c === '`') {
      i = enterTemplate(i + 1);
      continue;
    }

    if (c === '{') {
      depth++;
      push('punct', '{');
      i++;
      continue;
    }

    if (c === '}') {
      if (templates.length > 0 && depth === templates[templates.length - 1] + 1) {
        // Closes a `${` substitution; the template's text resumes.
        templates.pop();
        depth--;
        i = enterTemplate(i + 1);
        continue;
      }
      if (depth > 0) depth--;
      push('punct', '}');
      i++;
      continue;
    }

    if (c === '/' && regexAllowed(prev)) {
      const start = i;
      let j = i + 1;
      let inClass = false;
      let closed = false;
      while (j < n) {
        const d = source[j];
        if (d === '\\') {
          j += 2;
          continue;
        }
        // A regex literal cannot span a line. Hitting one means this `/` was
        // division after all, so fall back rather than swallowing real code.
        if (d === '\n') break;
        if (d === '[') inClass = true;
        else if (d === ']') inClass = false;
        else if (d === '/' && !inClass) {
          j++;
          closed = true;
          break;
        }
        j++;
      }
      if (closed) {
        while (j < n && isIdentPart(source[j])) j++; // flags
        push('other', 'regex');
        i = j;
        continue;
      }
      i = start; // fall through and treat as punctuation
    }

    if (isIdentStart(c)) {
      let j = i;
      while (j < n && isIdentPart(source[j])) j++;
      push('name', source.slice(i, j));
      i = j;
      continue;
    }

    if (isDigit(c) || (c === '.' && isDigit(source[i + 1] ?? ''))) {
      let j = i;
      while (j < n && (isIdentPart(source[j]) || source[j] === '.')) j++;
      push('other', 'number');
      i = j;
      continue;
    }

    push('punct', c);
    i++;
  }

  return tokens;
}

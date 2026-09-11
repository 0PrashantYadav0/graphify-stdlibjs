import { execFileSync } from 'node:child_process';

export interface SourceInfo {
  /** 40-char commit SHA, or "unknown" when `stdlibRoot` is not a git checkout. */
  source: string;
  isGitCheckout: boolean;
}

/**
 * Resolves the provenance commit for a stdlib checkout. Mirrors the existing
 * behaviour of falling back to "unknown" for a non-git or otherwise
 * unreadable checkout (detached HEAD still resolves fine here) — callers
 * must not treat that fallback as "dirty", only as "unknown provenance".
 */
export function resolveSource(stdlibRoot: string): SourceInfo {
  try {
    const source = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: stdlibRoot,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    return { source, isGitCheckout: true };
  } catch {
    return { source: 'unknown', isGitCheckout: false };
  }
}

export interface DirtyState {
  dirty: boolean;
  fileCount: number;
}

/**
 * Checks whether `scopeRelPath` (a path relative to `cwd`, e.g.
 * "lib/node_modules/@stdlib") has any uncommitted or untracked changes
 * against HEAD. Only untracked/modified files *within that scope* affect the
 * scan, so the pathspec is what keeps this precise: work-in-progress
 * elsewhere in a stdlib checkout (docs, a README edit, an unrelated script)
 * is not dirtiness this tool cares about.
 *
 * Only meaningful when `cwd` is a git checkout — callers should confirm that
 * with `resolveSource` first. If `git status` itself fails unexpectedly,
 * this reports clean rather than blocking extraction on an unrelated
 * environment problem.
 */
export function checkDirty(cwd: string, scopeRelPath: string): DirtyState {
  try {
    const status = execFileSync(
      'git',
      ['status', '--porcelain', '--untracked-files=all', '--', scopeRelPath],
      { cwd, stdio: ['ignore', 'pipe', 'ignore'] },
    ).toString();
    const lines = status.split('\n').filter((line) => line.trim().length > 0);
    return { dirty: lines.length > 0, fileCount: lines.length };
  } catch {
    return { dirty: false, fileCount: 0 };
  }
}

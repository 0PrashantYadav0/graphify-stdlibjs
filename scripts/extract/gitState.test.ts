import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkDirty, resolveSource } from './gitState';

function git(cwd: string, ...cmdArgs: string[]): void {
  execFileSync('git', cmdArgs, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
}

function initRepo(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q');
  git(dir, 'config', 'user.email', 'test@example.com');
  git(dir, 'config', 'user.name', 'Test');
  git(dir, 'config', 'commit.gpgsign', 'false');
}

function commitAll(dir: string, message: string): void {
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', message);
}

describe('resolveSource', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'graphify-gitstate-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns the commit SHA and isGitCheckout=true for a clean git checkout', () => {
    initRepo(dir);
    fs.writeFileSync(path.join(dir, 'a.txt'), 'a');
    commitAll(dir, 'initial');

    const info = resolveSource(dir);

    expect(info.isGitCheckout).toBe(true);
    expect(info.source).toMatch(/^[0-9a-f]{40}$/);
  });

  it('falls back to "unknown" for a non-git directory — not "dirty", just unknown provenance', () => {
    const info = resolveSource(dir);

    expect(info.isGitCheckout).toBe(false);
    expect(info.source).toBe('unknown');
  });
});

describe('checkDirty', () => {
  let dir: string;
  const scope = 'lib/node_modules/@stdlib';

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'graphify-gitstate-'));
    initRepo(dir);
    fs.mkdirSync(path.join(dir, scope, 'math', 'base', 'special', 'abs'), { recursive: true });
    fs.writeFileSync(path.join(dir, scope, 'math', 'base', 'special', 'abs', 'index.js'), 'module.exports = {};');
    fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'docs', 'readme.md'), 'hi');
    commitAll(dir, 'initial');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('reports clean when nothing has changed since HEAD', () => {
    const state = checkDirty(dir, scope);

    expect(state).toEqual({ dirty: false, fileCount: 0 });
  });

  it('reports dirty for an untracked package under the scope — the #20 bug scenario', () => {
    // Reproduces the actual bug: a work-in-progress ndarray/tensor3d package
    // left untracked while HEAD stays at an already-committed, "clean" SHA.
    // Before this guard existed, `source` would stamp that clean SHA while
    // graph.json silently contained the untracked package.
    fs.mkdirSync(path.join(dir, scope, 'ndarray', 'tensor3d'), { recursive: true });
    fs.writeFileSync(path.join(dir, scope, 'ndarray', 'tensor3d', 'index.js'), 'module.exports = {};');

    const state = checkDirty(dir, scope);

    expect(state.dirty).toBe(true);
    expect(state.fileCount).toBeGreaterThan(0);
  });

  it('reports dirty for a modified tracked file under the scope', () => {
    fs.writeFileSync(
      path.join(dir, scope, 'math', 'base', 'special', 'abs', 'index.js'),
      'module.exports = { changed: true };',
    );

    const state = checkDirty(dir, scope);

    expect(state.dirty).toBe(true);
    expect(state.fileCount).toBe(1);
  });

  it('ignores changes outside the scope — noise elsewhere in the checkout is not this tool\'s problem', () => {
    fs.writeFileSync(path.join(dir, 'NOTES.md'), 'unrelated wip notes');
    fs.writeFileSync(path.join(dir, 'docs', 'readme.md'), 'edited outside scope');

    const state = checkDirty(dir, scope);

    expect(state).toEqual({ dirty: false, fileCount: 0 });
  });

  it('is deterministic — the same source and tree state always yields the same verdict', () => {
    fs.mkdirSync(path.join(dir, scope, 'stats', 'base', 'ndarray', 'nanvariance'), { recursive: true });
    fs.writeFileSync(path.join(dir, scope, 'stats', 'base', 'ndarray', 'nanvariance', 'index.js'), 'module.exports = {};');

    const first = checkDirty(dir, scope);
    const second = checkDirty(dir, scope);

    expect(second).toEqual(first);
    expect(first.dirty).toBe(true);
  });
});

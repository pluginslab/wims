import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Claude Code honours CLAUDE_CONFIG_DIR; fall back to ~/.claude.
 * Never hardcode a home directory — this ships to other people's machines.
 */
export function claudeDir(): string {
  const override = process.env.CLAUDE_CONFIG_DIR?.trim();
  if (override) return path.resolve(untildify(override));
  return path.join(os.homedir(), '.claude');
}

export function projectsDir(): string {
  return path.join(claudeDir(), 'projects');
}

export function historyFile(): string {
  return path.join(claudeDir(), 'history.jsonl');
}

/** Our own state lives beside Claude's, not inside the user's project. */
export function wimsDir(): string {
  return path.join(claudeDir(), 'wims');
}

export function cacheFile(): string {
  return path.join(wimsDir(), 'cache.json');
}

export function untildify(p: string): string {
  if (p === '~') return os.homedir();
  if (p.startsWith('~/') || p.startsWith('~\\')) {
    return path.join(os.homedir(), p.slice(2));
  }
  return p;
}

/** Shorten $HOME to ~ for display. */
export function tildify(p: string): string {
  const home = os.homedir();
  if (p === home) return '~';
  if (p.startsWith(home + path.sep)) return '~' + p.slice(home.length);
  return p;
}

export function exists(p: string): boolean {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

export function isDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

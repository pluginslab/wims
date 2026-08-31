import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type ShellName = 'zsh' | 'bash' | 'fish';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** shim/ sits next to dist/ in both the repo and the published package. */
export function shimPath(shell: ShellName): string {
  const file = shell === 'fish' ? 'wims.fish' : 'wims.sh';
  return path.resolve(HERE, '..', 'shim', file);
}

export function readShim(shell: ShellName): string {
  return fs.readFileSync(shimPath(shell), 'utf8');
}

export function detectShell(): ShellName {
  const s = process.env.SHELL ?? '';
  if (s.includes('fish')) return 'fish';
  if (s.includes('bash')) return 'bash';
  return 'zsh';
}

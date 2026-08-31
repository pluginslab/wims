import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import type { Action, Session } from './types.js';

/** The one extra flag wims is willing to hand to Claude. */
export const SKIP_FLAG = '--dangerously-skip-permissions';

/**
 * The shell shim exports WIMS_ACTION_FILE and reads back a single tab-separated
 * line: kind, cwd, sessionId, extra-args. That indirection exists because no
 * child process can change its parent's working directory — the shim has to run
 * the `cd` itself. The fourth field is empty unless the user armed skip-perms.
 */
export function emitAction(action: Action): boolean {
  const target = process.env.WIMS_ACTION_FILE;
  if (!target) return false;
  try {
    const extra = action.skipPermissions ? SKIP_FLAG : '';
    fs.writeFileSync(target, [action.kind, action.cwd, action.sessionId, extra].join('\t') + '\n');
    return true;
  } catch {
    return false;
  }
}

/** Cross-platform clipboard. Returns the tool that worked, or null. */
export function copyToClipboard(text: string): string | null {
  const candidates: [string, string[]][] =
    process.platform === 'darwin'
      ? [['pbcopy', []]]
      : process.platform === 'win32'
        ? [['clip', []]]
        : [
            ['wl-copy', []],
            ['xclip', ['-selection', 'clipboard']],
            ['xsel', ['--clipboard', '--input']],
          ];

  for (const [cmd, args] of candidates) {
    try {
      const res = spawnSync(cmd, args, { input: text });
      if (!res.error && res.status === 0) return cmd;
    } catch {
      // Try the next tool.
    }
  }
  return null;
}

/**
 * Deleting a session removes the transcript and any subagent transcripts nested
 * beneath it. This is irreversible, so callers must confirm first.
 */
export function deleteSession(session: Session): { ok: boolean; error?: string } {
  try {
    fs.rmSync(session.file, { force: true });
    const sidecar = path.join(path.dirname(session.file), session.id);
    fs.rmSync(sidecar, { recursive: true, force: true });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function resumeCommand(session: Session, skipPermissions = false): string {
  const flag = skipPermissions ? ` ${SKIP_FLAG}` : '';
  return `cd ${shellQuote(session.cwd)} && claude --resume ${session.id}${flag}`;
}

export function shellQuote(s: string): string {
  return /^[A-Za-z0-9_@%+=:,.\/-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`;
}

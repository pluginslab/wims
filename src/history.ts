import fs from 'node:fs';
import { historyFile } from './env.js';
import type { HistoryEntry, HistoryIndex } from './types.js';

/**
 * ~/.claude/history.jsonl records every prompt you have ever submitted, tagged
 * with its sessionId and project path. It is small (single-digit MB) and gives
 * us exact prompt counts plus a ready-made full-text search index, which is
 * why wims never has to read the (often hundreds of MB) transcripts themselves.
 *
 * It is best-effort: entries may be rotated away, and Claude Code is free to
 * change the format. Every field access here tolerates absence.
 */
export function loadHistory(): HistoryIndex {
  const empty: HistoryIndex = { bySession: new Map(), all: [] };
  const file = historyFile();

  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch {
    return empty;
  }

  const all: HistoryEntry[] = [];
  const bySession = new Map<string, HistoryEntry[]>();

  for (const line of raw.split('\n')) {
    if (!line) continue;
    let d: any;
    try {
      d = JSON.parse(line);
    } catch {
      continue;
    }
    const sessionId = typeof d?.sessionId === 'string' ? d.sessionId : '';
    if (!sessionId) continue;

    const entry: HistoryEntry = {
      sessionId,
      project: typeof d.project === 'string' ? d.project : '',
      display: typeof d.display === 'string' ? d.display : '',
      timestamp: Number(d.timestamp) || 0,
    };
    all.push(entry);

    let bucket = bySession.get(sessionId);
    if (!bucket) {
      bucket = [];
      bySession.set(sessionId, bucket);
    }
    bucket.push(entry);
  }

  return { bySession, all };
}

/**
 * A prompt only counts as "real" if you actually typed something. Slash-command
 * invocations and empty submissions are noise for the <2-prompt filter.
 */
export function isRealPrompt(display: string): boolean {
  const t = display.trim();
  if (!t) return false;
  if (t.startsWith('/')) return false;
  return true;
}

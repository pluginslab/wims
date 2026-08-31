import { fuzzyMatchAll } from './fuzzy.js';
import { isRealPrompt } from './history.js';
import { tildify } from './env.js';
import type { HistoryIndex, Session } from './types.js';

export interface Row {
  session: Session;
  score: number;
  /** Set in deep-search mode: the prompt text that matched. */
  hit?: string;
}

/**
 * Two modes, one input box:
 *   "cloudflare"   fuzzy-match the title and the folder path (instant)
 *   "/cloudflare"  full-text search everything you ever typed, then map the
 *                  matching prompts back onto their sessions
 */
export function search(sessions: Session[], history: HistoryIndex, query: string): Row[] {
  const q = query.trim();

  if (q.startsWith('/')) {
    return deepSearch(sessions, history, q.slice(1).trim());
  }

  if (!q) return sessions.map((session) => ({ session, score: 0 }));

  const rows: Row[] = [];
  for (const session of sessions) {
    // Match against title and path as one string so "hawk cloud" can span both.
    const m = fuzzyMatchAll(`${session.title}  ${tildify(session.cwd)}`, q);
    if (m) rows.push({ session, score: m.score });
  }
  rows.sort((a, b) => b.score - a.score || b.session.updatedAt - a.session.updatedAt);
  return rows;
}

function deepSearch(sessions: Session[], history: HistoryIndex, term: string): Row[] {
  if (!term) return sessions.map((session) => ({ session, score: 0 }));

  const needle = term.toLowerCase();
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const best = new Map<string, Row>();

  for (const entry of history.all) {
    if (!isRealPrompt(entry.display)) continue;
    const idx = entry.display.toLowerCase().indexOf(needle);
    if (idx === -1) continue;

    const session = byId.get(entry.sessionId);
    // History outlives transcripts, so plenty of hits have no resumable session.
    if (!session) continue;

    const existing = best.get(session.id);
    if (!existing || entry.timestamp > (existing.score || 0)) {
      best.set(session.id, { session, score: entry.timestamp, hit: snippet(entry.display, idx, needle.length) });
    }
  }

  const rows = [...best.values()];
  rows.sort((a, b) => b.session.updatedAt - a.session.updatedAt);
  return rows;
}

/** Keep the matched term visible in a one-line excerpt. */
function snippet(text: string, idx: number, len: number, width = 120): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  // Re-locate after flattening; whitespace collapse shifts the index.
  const at = flat.toLowerCase().indexOf(text.slice(idx, idx + len).toLowerCase());
  const start = Math.max(0, (at === -1 ? 0 : at) - Math.floor(width / 3));
  const end = Math.min(flat.length, start + width);
  return (start > 0 ? '…' : '') + flat.slice(start, end) + (end < flat.length ? '…' : '');
}

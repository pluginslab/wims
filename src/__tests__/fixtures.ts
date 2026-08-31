import type { HistoryIndex, Session } from '../types.js';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 7, 31, 12, 0, 0);

export function makeSession(over: Partial<Session> & { id: string }): Session {
  return {
    file: `/home/u/.claude/projects/-home-u-${over.id}/${over.id}.jsonl`,
    cwd: '/home/u/work',
    cwdMissing: false,
    title: 'untitled',
    titleSource: 'ai',
    updatedAt: NOW,
    size: 1024,
    promptCount: 5,
    subagentCount: 0,
    ...over,
  };
}

export const SESSIONS: Session[] = [
  makeSession({
    id: 'aaa',
    title: 'Configure secondary domain with Cloudflare',
    cwd: '/home/u/code/acme-storefront',
    updatedAt: NOW - 2 * DAY,
    promptCount: 124,
    lastPrompt: 'post it',
  }),
  makeSession({
    id: 'bbb',
    title: 'Fix DNS propagation on staging',
    cwd: '/home/u/code/api-gateway',
    updatedAt: NOW - 6 * DAY,
    promptCount: 31,
  }),
  makeSession({
    id: 'ccc',
    title: 'Build the invoice exporter',
    cwd: '/home/u/localdev/nodejs/unlocal',
    updatedAt: NOW - 12 * DAY,
    promptCount: 88,
  }),
  // Deliberately trivial: must be hidden until ctrl+a.
  makeSession({
    id: 'ddd',
    title: 'One-off question',
    cwd: '/home/u/scratch',
    updatedAt: NOW - 1 * DAY,
    promptCount: 1,
  }),
  // Deliberately dangling: folder no longer exists.
  makeSession({
    id: 'eee',
    title: 'Old deleted project',
    cwd: '/home/u/gone',
    cwdMissing: true,
    updatedAt: NOW - 30 * DAY,
    promptCount: 9,
  }),
];

export const HISTORY: HistoryIndex = (() => {
  const all = [
    { sessionId: 'aaa', project: '/home/u/code/acme-storefront', display: 'set up the cloudflare tunnel', timestamp: NOW - 2 * DAY },
    { sessionId: 'bbb', project: '/home/u/code/api-gateway', display: 'why is the zone not propagating', timestamp: NOW - 6 * DAY },
    { sessionId: 'ccc', project: '/home/u/localdev/nodejs/unlocal', display: 'add a PDF invoice exporter please', timestamp: NOW - 12 * DAY },
    { sessionId: 'eee', project: '/home/u/gone', display: 'invoice numbering scheme', timestamp: NOW - 30 * DAY },
  ];
  const bySession = new Map<string, typeof all>();
  for (const e of all) {
    const b = bySession.get(e.sessionId) ?? [];
    b.push(e);
    bySession.set(e.sessionId, b);
  }
  return { all, bySession } as HistoryIndex;
})();

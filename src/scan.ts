import fs from 'node:fs';
import path from 'node:path';
import { projectsDir, isDir, exists } from './env.js';
import { MetaCache } from './cache.js';
import { loadHistory, isRealPrompt } from './history.js';
import type { Session } from './types.js';

/** Metadata we can derive from the transcript file alone. Cached on disk. */
export interface TranscriptMeta {
  cwd: string;
  branch?: string;
  version?: string;
  startedAt?: number;
  lastTs?: number;
  aiTitle?: string;
  lastPrompt?: string;
  subagentCount: number;
}

/**
 * Transcripts are append-only JSONL and can reach hundreds of megabytes. The
 * fields we need cluster at the two ends: `cwd`/`gitBranch`/`version` land in
 * the first user entry, while `ai-title` and `last-prompt` are rewritten near
 * the tail. So we read a window from each end and never touch the middle.
 */
const WINDOW = 64 * 1024;

function readEnds(file: string, size: number): { head: string; tail: string } {
  if (size <= WINDOW * 2) {
    const whole = fs.readFileSync(file, 'utf8');
    return { head: whole, tail: whole };
  }
  const fd = fs.openSync(file, 'r');
  try {
    const headBuf = Buffer.alloc(WINDOW);
    fs.readSync(fd, headBuf, 0, WINDOW, 0);
    const tailBuf = Buffer.alloc(WINDOW);
    fs.readSync(fd, tailBuf, 0, WINDOW, size - WINDOW);
    return { head: headBuf.toString('utf8'), tail: tailBuf.toString('utf8') };
  } finally {
    fs.closeSync(fd);
  }
}

function parseLines(chunk: string, dropFirstPartial: boolean): any[] {
  const lines = chunk.split('\n');
  if (dropFirstPartial) lines.shift();
  const out: any[] = [];
  for (const line of lines) {
    if (!line || line[0] !== '{') continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      // Truncated line at a window boundary — expected, skip it.
    }
  }
  return out;
}

function ts(entry: any): number | undefined {
  const t = entry?.timestamp;
  if (typeof t !== 'string' && typeof t !== 'number') return undefined;
  const ms = new Date(t).getTime();
  return Number.isFinite(ms) ? ms : undefined;
}

/**
 * Fallback only. Claude Code encodes a project path into a directory name by
 * replacing separators with '-', which is lossy for paths that contain dashes.
 * We prefer the `cwd` recorded inside the transcript and use this only when the
 * transcript has no usable entry.
 */
function decodeProjectDir(dirName: string): string {
  return dirName.replace(/^-/, '/').replace(/-/g, '/');
}

function countSubagents(projectDir: string, sessionId: string): number {
  const dir = path.join(projectDir, sessionId, 'subagents');
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl')).length;
  } catch {
    return 0;
  }
}

function readTranscriptMeta(file: string, size: number, projectDir: string, id: string): TranscriptMeta {
  const meta: TranscriptMeta = {
    cwd: decodeProjectDir(path.basename(projectDir)),
    subagentCount: countSubagents(projectDir, id),
  };

  let head: string;
  let tail: string;
  try {
    ({ head, tail } = readEnds(file, size));
  } catch {
    return meta;
  }

  for (const e of parseLines(head, false)) {
    if (!meta.startedAt) meta.startedAt = ts(e);
    if (typeof e?.cwd === 'string' && e.cwd) {
      meta.cwd = e.cwd;
      if (typeof e.gitBranch === 'string' && e.gitBranch) meta.branch = e.gitBranch;
      if (typeof e.version === 'string') meta.version = e.version;
      break;
    }
  }

  // Later entries win: the tail holds the most recent title and prompt.
  for (const e of parseLines(tail, size > WINDOW * 2)) {
    const t = ts(e);
    if (t && (!meta.lastTs || t > meta.lastTs)) meta.lastTs = t;
    if (e?.type === 'ai-title' && typeof e.aiTitle === 'string' && e.aiTitle.trim()) {
      meta.aiTitle = e.aiTitle.trim();
    }
    if (e?.type === 'last-prompt' && typeof e.lastPrompt === 'string' && e.lastPrompt.trim()) {
      meta.lastPrompt = e.lastPrompt.trim();
    }
  }

  return meta;
}

/** Resumable sessions are exactly the top-level `<project>/<uuid>.jsonl` files. */
function listTranscripts(): { file: string; projectDir: string; id: string }[] {
  const root = projectsDir();
  let projects: string[];
  try {
    projects = fs.readdirSync(root);
  } catch {
    return [];
  }

  const out: { file: string; projectDir: string; id: string }[] = [];
  for (const name of projects) {
    const projectDir = path.join(root, name);
    if (!isDir(projectDir)) continue;
    let files: string[];
    try {
      files = fs.readdirSync(projectDir);
    } catch {
      continue;
    }
    for (const f of files) {
      if (!f.endsWith('.jsonl')) continue;
      // Nested `<uuid>/subagents/agent-*.jsonl` transcripts are not sessions
      // you can resume, and readdir at this level never returns them anyway.
      out.push({ file: path.join(projectDir, f), projectDir, id: f.slice(0, -6) });
    }
  }
  return out;
}

function firstLine(s: string, max: number): string {
  const line = s.split('\n').find((l) => l.trim()) ?? '';
  const clean = line.trim().replace(/\s+/g, ' ');
  return clean.length > max ? clean.slice(0, max - 1) + '…' : clean;
}

export interface ScanResult {
  /** Every resumable session, newest activity first. Filtering is the UI's job. */
  sessions: Session[];
  history: ReturnType<typeof loadHistory>;
}

export function scan(): ScanResult {
  const history = loadHistory();
  const cache = new MetaCache();
  cache.load();

  const transcripts = listTranscripts();
  const live = new Set(transcripts.map((t) => t.file));
  const all: Session[] = [];

  for (const { file, projectDir, id } of transcripts) {
    let stat: fs.Stats;
    try {
      stat = fs.statSync(file);
    } catch {
      continue;
    }

    let meta = cache.get(file, stat.mtimeMs, stat.size);
    if (!meta) {
      meta = readTranscriptMeta(file, stat.size, projectDir, id);
      cache.set(file, stat.mtimeMs, stat.size, meta);
    }

    const prompts = (history.bySession.get(id) ?? []).filter((h) => isRealPrompt(h.display));
    const firstPrompt = prompts[0]?.display;
    const lastPrompt = meta.lastPrompt ?? prompts[prompts.length - 1]?.display;

    let title = meta.aiTitle;
    let titleSource: Session['titleSource'] = 'ai';
    if (!title && firstPrompt) {
      title = firstLine(firstPrompt, 70);
      titleSource = 'prompt';
    }
    if (!title) {
      title = path.basename(meta.cwd) || 'untitled session';
      titleSource = 'folder';
    }

    all.push({
      id,
      file,
      cwd: meta.cwd,
      cwdMissing: !exists(meta.cwd),
      title,
      titleSource,
      branch: meta.branch,
      version: meta.version,
      startedAt: meta.startedAt ?? prompts[0]?.timestamp,
      updatedAt: Math.max(meta.lastTs ?? 0, stat.mtimeMs),
      size: stat.size,
      promptCount: prompts.length,
      lastPrompt,
      firstPrompt,
      subagentCount: meta.subagentCount,
    });
  }

  cache.prune(live);
  cache.save();

  all.sort((a, b) => b.updatedAt - a.updatedAt);
  return { sessions: all, history };
}

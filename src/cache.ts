import fs from 'node:fs';
import path from 'node:path';
import { cacheFile, wimsDir } from './env.js';
import type { TranscriptMeta } from './scan.js';

const CACHE_VERSION = 1;

interface CacheShape {
  version: number;
  entries: Record<string, { mtimeMs: number; size: number; meta: TranscriptMeta }>;
}

export class MetaCache {
  private data: CacheShape = { version: CACHE_VERSION, entries: {} };
  private dirty = false;

  load(): void {
    try {
      const parsed = JSON.parse(fs.readFileSync(cacheFile(), 'utf8')) as CacheShape;
      // A version bump invalidates everything rather than risking stale shapes.
      if (parsed?.version === CACHE_VERSION && parsed.entries) this.data = parsed;
    } catch {
      // Missing or corrupt cache is not an error — we just rebuild it.
    }
  }

  get(file: string, mtimeMs: number, size: number): TranscriptMeta | undefined {
    const hit = this.data.entries[file];
    if (!hit) return undefined;
    // mtime+size is enough: transcripts are append-only.
    if (hit.mtimeMs !== mtimeMs || hit.size !== size) return undefined;
    return hit.meta;
  }

  set(file: string, mtimeMs: number, size: number, meta: TranscriptMeta): void {
    this.data.entries[file] = { mtimeMs, size, meta };
    this.dirty = true;
  }

  /** Drop entries for transcripts that no longer exist, so the cache can't grow forever. */
  prune(liveFiles: Set<string>): void {
    for (const key of Object.keys(this.data.entries)) {
      if (!liveFiles.has(key)) {
        delete this.data.entries[key];
        this.dirty = true;
      }
    }
  }

  save(): void {
    if (!this.dirty) return;
    try {
      fs.mkdirSync(wimsDir(), { recursive: true });
      // Write-then-rename so a crash mid-write can't leave a corrupt cache.
      const tmp = path.join(wimsDir(), `cache.${process.pid}.tmp`);
      fs.writeFileSync(tmp, JSON.stringify(this.data));
      fs.renameSync(tmp, cacheFile());
    } catch {
      // A cache we cannot persist is a performance problem, not a correctness one.
    }
  }
}

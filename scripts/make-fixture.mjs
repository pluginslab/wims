#!/usr/bin/env node
/**
 * Builds a throwaway Claude config directory full of invented sessions.
 *
 * wims honours CLAUDE_CONFIG_DIR, so pointing it at the result runs the real
 * scanner over real (if fictional) transcripts, which is what makes both
 * `npm run demo` and the README screenshot honest rather than mocked up.
 *
 *   node scripts/make-fixture.mjs [outDir]
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { DEMO_SESSIONS, timestampsFor, FIXTURE_NOW } from './demo-data.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEMO = path.resolve(process.argv[2] ?? path.join(HERE, '..', '.demo'));
const OUT = path.join(DEMO, 'claude');
/**
 * The fixture gets its own HOME so the invented project folders genuinely
 * exist. Without that every row would render as "folder no longer exists",
 * and the screenshot would advertise a broken tool.
 */
const DEMO_HOME = path.join(DEMO, 'home');

/** Claude Code encodes a project path into a directory name by swapping / for -. */
const encodeDir = (abs) => abs.replace(/\//g, '-');

const expand = (p) => (p.startsWith('~/') ? path.join(DEMO_HOME, p.slice(2)) : p);

/** Filler so transcripts have believable sizes; never read for metadata. */
function filler(sessionId, targetBytes, used) {
  const lines = [];
  let n = used;
  let i = 0;
  const chunk =
    'Looked at the surrounding code, checked the tests, and confirmed the change is safe to apply here. ';
  while (n < targetBytes) {
    const line =
      JSON.stringify({
        type: i % 2 ? 'assistant' : 'user',
        sessionId,
        uuid: `${sessionId}-f${i}`,
        message: { role: i % 2 ? 'assistant' : 'user', content: chunk.repeat(6) },
      }) + '\n';
    lines.push(line);
    n += Buffer.byteLength(line);
    i++;
  }
  return lines.join('');
}

function main() {
  fs.rmSync(DEMO, { recursive: true, force: true });
  const projects = path.join(OUT, 'projects');
  fs.mkdirSync(projects, { recursive: true });
  fs.mkdirSync(DEMO_HOME, { recursive: true });

  // WIMS_FIXTURE_NOW pins the clock for reproducible screenshots.
  const now = process.env.WIMS_FIXTURE_NOW ? Number(process.env.WIMS_FIXTURE_NOW) : Date.now();
  const history = [];

  for (const s of DEMO_SESSIONS) {
    const abs = expand(s.dir);
    // The project folder itself must exist for wims to treat it as resumable.
    fs.mkdirSync(abs, { recursive: true });
    const dir = path.join(projects, encodeDir(abs));
    fs.mkdirSync(dir, { recursive: true });

    const { start, end, perPrompt } = timestampsFor(s, now);

    // Head: the first user entry is where scan() reads cwd, branch and version.
    const head =
      JSON.stringify({
        type: 'user',
        sessionId: s.id,
        uuid: `${s.id}-0`,
        cwd: abs,
        gitBranch: s.branch || undefined,
        version: '2.1.251',
        timestamp: new Date(start).toISOString(),
        userType: 'external',
        message: { role: 'user', content: s.prompts[0] },
      }) + '\n';

    // Tail: ai-title and last-prompt are what scan() reads for the row and preview.
    const tail =
      JSON.stringify({
        type: 'assistant',
        sessionId: s.id,
        uuid: `${s.id}-z`,
        timestamp: new Date(end).toISOString(),
        message: { role: 'assistant', content: 'Done.' },
      }) +
      '\n' +
      JSON.stringify({ type: 'ai-title', aiTitle: s.title, sessionId: s.id }) +
      '\n' +
      JSON.stringify({
        type: 'last-prompt',
        lastPrompt: s.prompts[s.prompts.length - 1],
        leafUuid: `${s.id}-z`,
        sessionId: s.id,
      }) +
      '\n';

    const used = Buffer.byteLength(head) + Buffer.byteLength(tail);
    const body = filler(s.id, s.size, used);
    fs.writeFileSync(path.join(dir, `${s.id}.jsonl`), head + body + tail);

    // Set mtime so "3d ago" lines up with the invented timeline.
    fs.utimesSync(path.join(dir, `${s.id}.jsonl`), new Date(end), new Date(end));

    for (const [i, p] of s.prompts.entries()) {
      history.push({
        display: p,
        pastedContents: '{}',
        timestamp: String(perPrompt[i]),
        project: abs,
        sessionId: s.id,
      });
    }
  }

  history.sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
  fs.writeFileSync(
    path.join(OUT, 'history.jsonl'),
    history.map((h) => JSON.stringify(h)).join('\n') + '\n',
  );

  const bytes = DEMO_SESSIONS.reduce((n, s) => n + s.size, 0);
  process.stdout.write(
    `Fixture: ${DEMO_SESSIONS.length} sessions, ${(bytes / 1e6).toFixed(1)} MB\n` +
      `  config: ${OUT}\n  home:   ${DEMO_HOME}\n\n` +
      `Try it:\n  HOME=${DEMO_HOME} CLAUDE_CONFIG_DIR=${OUT} wims-tui\n`,
  );
}

main();

#!/usr/bin/env node
/**
 * Renders the README screenshots.
 *
 * Points the real scanner at the demo fixture, renders the real Ink component
 * at a fixed size, and converts the resulting frame to SVG. Nothing here mocks
 * the UI. It is the same code path the CLI runs, so the screenshots cannot
 * drift away from what the tool actually looks like.
 *
 *   npm run screenshot
 */
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const FIXTURE = path.join(ROOT, '.demo', 'claude');
const DEMO_HOME = path.join(ROOT, '.demo', 'home');
const ASSETS = path.join(ROOT, 'assets');

const COLS = 100;

// Colour must be forced: nothing here is attached to a TTY.
process.env.FORCE_COLOR = '3';
process.env.CLAUDE_CONFIG_DIR = FIXTURE;
// So the invented ~/code/... folders resolve, and tildify shortens them to "~".
process.env.HOME = DEMO_HOME;

const { FIXTURE_NOW } = await import('./demo-data.mjs');

// Rebuild against a pinned clock, and freeze Date.now() to the same instant, so
// "2h ago" and "May 14" are identical on every run. Without this the SVGs would
// change every single time anybody regenerated them.
process.env.TZ = 'UTC';
execFileSync(process.execPath, [path.join(HERE, 'make-fixture.mjs')], {
  stdio: 'inherit',
  env: { ...process.env, WIMS_FIXTURE_NOW: String(FIXTURE_NOW) },
});
Date.now = () => FIXTURE_NOW;

const React = (await import('react')).default;
const { render } = await import('ink');
const { ansiToSvg } = await import('./ansi-to-svg.mjs');
const { scan } = await import('../dist/scan.js');
const { App } = await import('../dist/ui/App.js');

const { sessions, history } = scan();
if (sessions.length === 0) {
  throw new Error(`No sessions in the fixture at ${FIXTURE}. Run: node scripts/make-fixture.mjs`);
}

/**
 * Ink sizes itself from stdout.columns/rows. ink-testing-library's stub
 * hardcodes 100 columns and has no rows at all, so drive Ink directly with a
 * stub we control.
 */
class CaptureStdout extends EventEmitter {
  constructor(columns, rows) {
    super();
    this.columns = columns;
    this.rows = rows;
    this.lastFrame = '';
  }
  write(frame) {
    this.lastFrame = frame;
  }
}

class InertStdin extends EventEmitter {
  isTTY = true;
  setEncoding() {}
  setRawMode() {}
  resume() {}
  pause() {}
  ref() {}
  unref() {}
  read() {
    return null;
  }
}

async function frameFor(query, rows) {
  const stdout = new CaptureStdout(COLS, rows);
  const app = render(
    React.createElement(App, {
      initialSessions: sessions,
      history,
      initialQuery: query,
      minPrompts: 2,
      shimActive: true,
      onChoose() {},
    }),
    // debug:true makes Ink write whole frames instead of incremental diffs.
    { stdout, stdin: new InertStdin(), debug: true, exitOnCtrlC: false, patchConsole: false },
  );
  await new Promise((res) => setTimeout(res, 80));
  const frame = stdout.lastFrame;
  app.unmount();
  return frame;
}

const SHOTS = [
  { file: 'wims.svg', query: '', rows: 27, title: 'wims: every Claude Code session, from any folder' },
  {
    file: 'wims-search.svg',
    query: '/webhook',
    rows: 16,
    title: 'wims: searching every prompt you have ever sent',
  },
];

fs.mkdirSync(ASSETS, { recursive: true });

for (const shot of SHOTS) {
  const frame = await frameFor(shot.query, shot.rows);
  const lines = frame.replace(/\n$/, '').split('\n').length;
  const svg = ansiToSvg(frame, { title: shot.title, cols: COLS });
  fs.writeFileSync(path.join(ASSETS, shot.file), svg);
  process.stdout.write(`${shot.file.padEnd(18)} ${lines} rows  ${(svg.length / 1024).toFixed(1)} KB\n`);
}

process.stdout.write(`\nWrote ${SHOTS.length} screenshots to ${path.relative(ROOT, ASSETS)}/\n`);
process.exit(0);

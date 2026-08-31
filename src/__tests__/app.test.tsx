import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { render } from 'ink-testing-library';
import { App } from '../ui/App.js';
import { SESSIONS, HISTORY } from './fixtures.js';
import type { Action } from '../types.js';

const ESC = '\x1B';
const ARROW_DOWN = `${ESC}[B`;
const ARROW_UP = `${ESC}[A`;
const ENTER = '\r';
const BACKSPACE = '\x7F';
const CTRL_O = '\x0F';
const CTRL_N = '\x0E';
const CTRL_A = '\x01';
const CTRL_G = '\x07';
const CTRL_D = '\x04';
const CTRL_X = '\x18';

/** Render the app and give the effects a tick to settle. */
async function mount() {
  const actions: Action[] = [];
  const r = render(
    <App
      initialSessions={SESSIONS}
      history={HISTORY}
      initialQuery=""
      minPrompts={2}
      shimActive
      onChoose={(a) => actions.push(a)}
    />,
  );
  await tick();
  return { ...r, actions };
}

const tick = () => new Promise((r) => setTimeout(r, 20));

async function type(r: { stdin: { write: (s: string) => void } }, s: string) {
  r.stdin.write(s);
  await tick();
}

const screen = (r: { lastFrame: () => string | undefined }) => r.lastFrame() ?? '';

test('lists sessions and hides trivial ones by default', async () => {
  const r = await mount();
  const out = screen(r);
  assert.match(out, /Configure secondary domain/);
  // 'ddd' has a single prompt and must be filtered out.
  assert.doesNotMatch(out, /One-off question/);
  // 4 of 5 shown, 1 hidden.
  assert.match(out, /4\/4/);
  assert.match(out, /\+1 hidden/);
});

test('ctrl+a reveals the hidden one-off sessions', async () => {
  const r = await mount();
  await type(r, CTRL_A);
  assert.match(screen(r), /One-off question/);
  assert.match(screen(r), /5\/5/);
});

test('typing filters the list', async () => {
  const r = await mount();
  await type(r, 'cloudflare');
  const out = screen(r);
  assert.match(out, /Configure secondary domain/);
  assert.doesNotMatch(out, /Fix DNS propagation/);
  assert.match(out, /1\/4/);
});

test('backspace edits the query', async () => {
  const r = await mount();
  await type(r, 'cloudflareXX');
  assert.match(screen(r), /0\/4/);
  await type(r, BACKSPACE);
  await type(r, BACKSPACE);
  assert.match(screen(r), /1\/4/);
});

test('escape clears a query before it quits', async () => {
  const r = await mount();
  await type(r, 'cloudflare');
  await type(r, ESC);
  assert.match(screen(r), /4\/4/);
  assert.match(screen(r), /Fix DNS propagation/);
});

test('/ runs a full-text search over past prompts', async () => {
  const r = await mount();
  await type(r, '/propagating');
  const out = screen(r);
  assert.match(out, /Fix DNS propagation/);
  assert.doesNotMatch(out, /Configure secondary domain/);
});

test('enter resumes the highlighted session', async () => {
  const r = await mount();
  await type(r, ENTER);
  assert.deepEqual(r.actions, [
    { kind: 'resume', cwd: '/home/u/code/acme-storefront', sessionId: 'aaa', skipPermissions: false },
  ]);
});

test('arrow keys move the selection before acting', async () => {
  const r = await mount();
  await type(r, ARROW_DOWN);
  await type(r, ARROW_DOWN);
  await type(r, ARROW_UP);
  await type(r, ENTER);
  assert.equal(r.actions[0]?.sessionId, 'bbb');
});

test('selection stops at the top and bottom instead of wrapping', async () => {
  const r = await mount();
  await type(r, ARROW_UP);
  await type(r, ENTER);
  assert.equal(r.actions[0]?.sessionId, 'aaa');
});

test('ctrl+o asks for a cd without resuming', async () => {
  const r = await mount();
  await type(r, CTRL_O);
  assert.equal(r.actions[0]?.kind, 'cd');
  assert.equal(r.actions[0]?.cwd, '/home/u/code/acme-storefront');
});

test('ctrl+n asks for a brand new session in that folder', async () => {
  const r = await mount();
  await type(r, CTRL_N);
  assert.equal(r.actions[0]?.kind, 'new');
});

test('the action targets the session selected after filtering', async () => {
  const r = await mount();
  await type(r, 'invoice');
  await type(r, ENTER);
  assert.equal(r.actions[0]?.sessionId, 'ccc');
});

test('ctrl+g opens help and any key closes it', async () => {
  const r = await mount();
  await type(r, CTRL_G);
  assert.match(screen(r), /where is my session/);
  await type(r, 'x');
  assert.doesNotMatch(screen(r), /where is my session/);
  // The key that dismissed help must not leak into the query.
  assert.match(screen(r), /4\/4/);
});

test('? opens help only when the query is empty', async () => {
  const r = await mount();
  await type(r, '?');
  assert.match(screen(r), /where is my session/);

  const r2 = await mount();
  await type(r2, 'dns');
  await type(r2, '?');
  assert.doesNotMatch(screen(r2), /where is my session/);
});

test('ctrl+d asks before deleting and n cancels', async () => {
  const r = await mount();
  await type(r, CTRL_D);
  assert.match(screen(r), /Delete .* permanently\?/);
  await type(r, 'n');
  assert.doesNotMatch(screen(r), /permanently\?/);
  // Still there — nothing was removed.
  assert.match(screen(r), /Configure secondary domain/);
});

test('a dangling folder is flagged in the preview', async () => {
  const r = await mount();
  await type(r, 'deleted');
  assert.match(screen(r), /folder no longer exists/);
});

test('the preview shows the last prompt', async () => {
  const r = await mount();
  assert.match(screen(r), /post it/);
});

test('an empty result set does not crash and offers nothing to act on', async () => {
  const r = await mount();
  await type(r, 'zzzznotathing');
  assert.match(screen(r), /No matching sessions/);
  await type(r, ENTER);
  assert.deepEqual(r.actions, []);
});

test('actions carry skipPermissions=false unless it is armed', async () => {
  const r = await mount();
  await type(r, CTRL_O);
  assert.equal(r.actions[0]?.skipPermissions, false);
});

test('ctrl+x arms skip-permissions and shows an unmissable badge', async () => {
  const r = await mount();
  assert.doesNotMatch(screen(r), /SKIP PERMISSIONS/);
  await type(r, CTRL_X);
  assert.match(screen(r), /SKIP PERMISSIONS/);
  // Arming also announces itself in the footer.
  assert.match(screen(r), /Armed: Claude will launch with --dangerously-skip-permissions/);
});

test('the header does not wrap when the badge is showing', async () => {
  const r = await mount();
  await type(r, CTRL_X);
  const lines = screen(r).split('\n');
  // The badge must live on the header line, not overflow onto the row below.
  assert.match(lines[0] ?? '', /SKIP PERMISSIONS/);
  assert.match(lines[1] ?? '', /Configure secondary domain/);
  assert.doesNotMatch(lines[1] ?? '', /hidden\)/);
});

test('a long query is truncated rather than pushing the header onto two lines', async () => {
  const r = await mount();
  await type(r, CTRL_X);
  await type(r, 'x'.repeat(200));
  const lines = screen(r).split('\n');
  assert.match(lines[0] ?? '', /SKIP PERMISSIONS/);
  assert.match(lines[1] ?? '', /No matching sessions/);
});

test('ctrl+x is a toggle, not a latch', async () => {
  const r = await mount();
  await type(r, CTRL_X);
  await type(r, CTRL_X);
  assert.doesNotMatch(screen(r), /SKIP PERMISSIONS/);
  await type(r, ENTER);
  assert.equal(r.actions[0]?.skipPermissions, false);
});

test('armed resume carries the flag', async () => {
  const r = await mount();
  await type(r, CTRL_X);
  await type(r, ENTER);
  assert.deepEqual(r.actions, [
    { kind: 'resume', cwd: '/home/u/code/acme-storefront', sessionId: 'aaa', skipPermissions: true },
  ]);
});

test('armed ctrl+n carries the flag too', async () => {
  const r = await mount();
  await type(r, CTRL_X);
  await type(r, CTRL_N);
  assert.equal(r.actions[0]?.kind, 'new');
  assert.equal(r.actions[0]?.skipPermissions, true);
});

test('a plain cd never carries the flag, even when armed', async () => {
  const r = await mount();
  await type(r, CTRL_X);
  await type(r, CTRL_O);
  assert.equal(r.actions[0]?.kind, 'cd');
  // ctrl+o does not launch Claude, so the flag would be meaningless.
  assert.equal(r.actions[0]?.skipPermissions, false);
});

test('--yolo arms it from the start', async () => {
  const actions: Action[] = [];
  const r = render(
    <App
      initialSessions={SESSIONS}
      history={HISTORY}
      initialQuery=""
      minPrompts={2}
      shimActive
      initialSkipPermissions
      onChoose={(a) => actions.push(a)}
    />,
  );
  await tick();
  assert.match(screen(r), /SKIP PERMISSIONS/);
  assert.match(screen(r), /resume WITHOUT permission checks/);
  r.stdin.write(ENTER);
  await tick();
  assert.equal(actions[0]?.skipPermissions, true);
});

test('the help screen spells out what arming actually does', async () => {
  const r = await mount();
  await type(r, CTRL_G);
  assert.match(screen(r), /without asking you first/);
});

test('the footer never wraps onto a second line', async () => {
  const r = await mount();
  const lines = screen(r).split('\n');
  const footer = lines.findIndex((l) => l.includes('resume'));
  assert.ok(footer > 0, 'footer should render');
  // Whatever follows the footer must be blank, never a spilled second line.
  for (const rest of lines.slice(footer + 1)) assert.equal(rest.trim(), '');
});

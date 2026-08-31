import test from 'node:test';
import assert from 'node:assert/strict';
import { search } from '../search.js';
import { fuzzyMatch, fuzzyMatchAll } from '../fuzzy.js';
import { SESSIONS, HISTORY } from './fixtures.js';

const titles = (q: string) => search(SESSIONS, HISTORY, q).map((r) => r.session.title);

test('empty query returns every session in order', () => {
  assert.equal(search(SESSIONS, HISTORY, '').length, SESSIONS.length);
});

test('matches on title', () => {
  assert.deepEqual(titles('cloudflare'), ['Configure secondary domain with Cloudflare']);
});

test('matches on folder path, not just title', () => {
  // "api-gateway" appears only in the cwd.
  assert.deepEqual(titles('api-gateway'), ['Fix DNS propagation on staging']);
});

test('is case insensitive', () => {
  assert.deepEqual(titles('CLOUDFLARE'), titles('cloudflare'));
});

test('every space-separated term must match', () => {
  assert.deepEqual(titles('dns staging'), ['Fix DNS propagation on staging']);
  assert.deepEqual(titles('dns cloudflare'), []);
});

test('terms may span title and path', () => {
  assert.deepEqual(titles('invoice unlocal'), ['Build the invoice exporter']);
});

test('fuzzy subsequence matches when no substring does', () => {
  // d-n-s-p-r-o-p is not a substring but is a subsequence.
  assert.ok(fuzzyMatch('Fix DNS propagation', 'dnsprop'));
  assert.equal(fuzzyMatch('Fix DNS propagation', 'zzzz'), null);
});

test('exact substrings outrank scattered subsequences', () => {
  const exact = fuzzyMatch('cloudflare tunnel', 'cloud')!;
  const scattered = fuzzyMatch('c-l-o-u-d-x', 'cloud')!;
  assert.ok(exact.score > scattered.score);
});

test('fuzzyMatchAll returns null if any term misses', () => {
  assert.equal(fuzzyMatchAll('alpha beta', 'alpha gamma'), null);
});

test('/ switches to full-text search over past prompts', () => {
  // "propagating" appears only inside a prompt, never in a title or path.
  assert.deepEqual(titles('/propagating'), ['Fix DNS propagation on staging']);
});

test('deep search reports the matching prompt as the hit', () => {
  const rows = search(SESSIONS, HISTORY, '/PDF invoice');
  assert.equal(rows.length, 1);
  assert.match(rows[0]!.hit ?? '', /PDF invoice exporter/);
});

test('deep search can match several sessions', () => {
  assert.equal(search(SESSIONS, HISTORY, '/invoice').length, 2);
});

test('deep search ignores history entries with no surviving transcript', () => {
  const orphan = { ...HISTORY, all: [...HISTORY.all, { sessionId: 'zzz', project: '/x', display: 'invoice ghost', timestamp: 1 }] };
  assert.equal(search(SESSIONS, orphan, '/invoice ghost').length, 0);
});

test('a bare / behaves like an empty query rather than matching nothing', () => {
  assert.equal(search(SESSIONS, HISTORY, '/').length, SESSIONS.length);
});

test('rejects subsequence matches too diffuse to be intentional', () => {
  // d-o-g appears in order across this string, but only by coincidence.
  assert.equal(fuzzyMatch('Configure secondary domain with a big Cloudflare zone', 'dog'), null);
});

test('keeps acronym-style matches however far apart they sit', () => {
  // Every letter lands on a word boundary, so this is intent, not coincidence.
  assert.ok(fuzzyMatch('Add Stripe Webhook Retries', 'aswr'));
});

test('keeps tight subsequence matches', () => {
  assert.ok(fuzzyMatch('Fix DNS propagation', 'dnsprop'));
});

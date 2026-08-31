/**
 * Invented sessions for the demo fixture and the README screenshot.
 *
 * Every project, path and prompt in here is fictional. The point is to show
 * the real tool against a believable spread of work without putting anybody's
 * actual clients, hostnames or conversations into a public repository.
 */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * Screenshots pin the clock here so regenerating them produces no diff.
 * `npm run demo` leaves it unset and uses the real clock, so an interactive
 * demo still reads "2h ago" rather than "some date last spring".
 */
export const FIXTURE_NOW = Date.UTC(2026, 4, 14, 9, 30, 0);

/** @typedef {{id:string,dir:string,title:string,branch:string,ago:number,size:number,prompts:string[]}} DemoSession */

/** @type {DemoSession[]} */
export const DEMO_SESSIONS = [
  {
    id: '9f2c1a44-7b3e-4c18-9a52-1d6e0b8f3a71',
    dir: '~/code/acme-storefront',
    title: 'Add Stripe webhook retries',
    branch: 'main',
    ago: 2 * HOUR,
    size: 890_000,
    prompts: [
      'the stripe webhook handler drops events when our api is down, can we add retries with backoff?',
      'use an exponential backoff, cap it at 6 attempts',
      'what happens to events that still fail after the last attempt?',
      'add a dead letter table then, and a small admin page to replay them',
      'ship it',
    ],
  },
  {
    id: '3e8b52d0-11af-42c7-8f19-6c4a9e2d5b83',
    dir: '~/code/acme-storefront',
    title: 'Fix flaky checkout tests',
    branch: 'fix/flaky-checkout',
    ago: 6 * HOUR,
    size: 412_000,
    prompts: [
      'the checkout suite fails maybe one run in five on CI but never locally',
      'it looks timing related, the cart total renders after the assertion runs',
      'replace the sleeps with a proper waitFor',
    ],
  },
  {
    id: 'b7d40c96-58e1-4a3f-b2c8-0f9a1e7d4c22',
    dir: '~/code/api-gateway',
    title: 'Refactor the auth middleware',
    branch: 'main',
    ago: 1 * DAY,
    size: 1_240_000,
    prompts: [
      'the auth middleware does token parsing, rate limiting and logging in one function, split it',
      'keep the public signature identical so nothing downstream changes',
      'now add tests for the rate limit branch',
      'good, squash and open the PR',
    ],
  },
  {
    id: '5a1e7f38-9c2d-4b60-a7e3-8d5b2c1f0e94',
    dir: '~/code/analytics-api',
    title: 'Debug slow dashboard query',
    branch: 'main',
    ago: 2 * DAY,
    size: 2_100_000,
    prompts: [
      'the dashboard takes 11 seconds to load and its all one query',
      'here is the explain analyze output, whats the worst part?',
      'add the composite index and re-run it',
      'down to 300ms, can we cache it too?',
      'no, leave the cache out for now, ship the index',
    ],
  },
  {
    id: 'c4f91b27-6d83-4e15-9b7a-2e0c8a5d3f61',
    dir: '~/code/docs-site',
    title: 'Set up Cloudflare Pages deploy',
    branch: 'main',
    ago: 3 * DAY,
    size: 356_000,
    prompts: [
      'deploy this astro site to cloudflare pages on every push to main',
      'the build works locally but fails on pages with a node version error',
      'pin node 20 in the build settings and try again',
    ],
  },
  {
    id: '2b6d8e15-4a07-49f2-8c31-7f5e9b0a2d48',
    dir: '~/code/ui-kit',
    title: 'Add dark mode to the design system',
    branch: 'feat/dark-mode',
    ago: 4 * DAY,
    size: 1_680_000,
    prompts: [
      'add a dark theme to the token layer without touching every component',
      'use css custom properties on :root and flip them with a data attribute',
      'what about the charts, they hardcode colours',
      'pull those into tokens too',
    ],
  },
  {
    id: '8c3a0f64-2e91-4d78-b5c6-1a9f4e7b3d05',
    dir: '~/code/queue-worker',
    title: 'Investigate memory leak in the worker',
    branch: 'main',
    ago: 6 * DAY,
    size: 3_400_000,
    prompts: [
      'the worker grows to 2gb over about a day and then gets oom killed',
      'here is a heap snapshot diff between hour 1 and hour 8',
      'the listener is being added per job and never removed, thats it',
      'fix it and add a regression test that asserts listener count stays flat',
    ],
  },
  {
    id: '1d7e4b82-3c50-4a69-9e18-6b2d0f8c5a37',
    dir: '~/code/cli-tools',
    title: 'Write release notes for v2.1',
    branch: 'release/2.1',
    ago: 8 * DAY,
    size: 198_000,
    prompts: [
      'draft release notes for 2.1 from the commits since 2.0',
      'group them by user visible change, not by commit',
      'shorter, and lead with the breaking change',
    ],
  },
  {
    id: '6e0b9d43-8f27-4c51-a3d9-4c7e1b5a0f28',
    dir: '~/code/legacy-import',
    title: 'Port CI from Travis to GitHub Actions',
    branch: 'chore/gha',
    ago: 12 * DAY,
    size: 720_000,
    prompts: [
      'translate this travis config to github actions, matrix over node 18 and 20',
      'the cache key needs to include the lockfile hash',
      'why is the macos job 4x slower than linux?',
    ],
  },
  {
    id: 'f5c28a71-0d64-4b39-8e27-9a3f1c6d4e80',
    dir: '~/notes',
    title: 'Sketch the onboarding flow',
    branch: '',
    ago: 15 * DAY,
    size: 143_000,
    prompts: [
      'help me think through a three step onboarding for the new signup flow',
      'the second step is doing too much, split it',
    ],
  },
  {
    id: 'a9247e30-5b81-4f6c-92da-3e8b7c0f1a56',
    dir: '~/code/analytics-api',
    title: 'Tune the Postgres connection pool',
    branch: 'main',
    ago: 21 * DAY,
    size: 534_000,
    prompts: [
      'we exhaust the connection pool under load, whats a sane max for 4 workers?',
      'add pgbouncer in front instead',
      'what transaction mode should we use?',
    ],
  },
  {
    id: '7b1f6c58-4e29-40d3-a8b7-5c2e9f0a3d14',
    dir: '~/code/personal-site',
    title: 'Migrate the blog to Astro',
    branch: 'main',
    ago: 28 * DAY,
    size: 1_950_000,
    prompts: [
      'move this jekyll blog to astro, keep every url exactly the same',
      'the rss feed changed shape, fix it to match the old one',
      'now add redirects for the three urls that did move',
      'run a link check over the built site',
    ],
  },
];

/** Absolute epoch-ms for a session, relative to the fixture build time. */
export function timestampsFor(session, now) {
  const end = now - session.ago;
  const start = end - Math.max(20 * 60_000, session.prompts.length * 7 * 60_000);
  const step = (end - start) / Math.max(1, session.prompts.length);
  return {
    start,
    end,
    perPrompt: session.prompts.map((_, i) => Math.round(start + step * (i + 1))),
  };
}

# Contributing to wims

Thanks for taking a look. wims is small on purpose, so most changes are easy to
reason about — this file exists to save you the archaeology.

## Getting set up

```bash
git clone https://github.com/pluginslab/wims.git
cd wims
npm install
npm run build
npm test
```

You need **Node 20+**. You do not need Claude Code installed to work on wims —
only to actually resume a session.

To run your working copy against your real sessions:

```bash
node dist/cli.js
```

## Working against fake data

You almost certainly do not want to develop against your own transcripts. wims
honours `CLAUDE_CONFIG_DIR`, so the repo ships a generator that builds a
throwaway config directory full of invented sessions:

```bash
npm run demo          # build the fixture and open wims against it
npm run demo:fixture  # just build it, into .demo/
```

The fixture gets its own `HOME` too (`.demo/home`), so the invented
`~/code/acme-storefront` folders genuinely exist on disk and resolve the way
real ones would. Everything in `scripts/demo-data.mjs` is fictional — please
keep it that way, and never commit anything derived from your real sessions.

## How the code fits together

```
src/
  cli.tsx        argument parsing, the alt-screen wrapper, the no-shim fallback
  scan.ts        finds transcripts and extracts metadata (the interesting part)
  cache.ts       on-disk metadata cache, keyed by path + size + mtime
  history.ts     reads ~/.claude/history.jsonl
  search.ts      the two search modes
  fuzzy.ts       the matcher
  actions.ts     clipboard, deletion, and the action-file protocol
  ui/            the Ink components
shim/            the shell functions that make `cd` stick
scripts/         demo fixture and screenshot generation
```

Three design constraints worth knowing before you change things:

1. **Never read the middle of a transcript.** They reach hundreds of megabytes.
   `scan.ts` reads a 64 KB window from each end because everything it needs
   lives there. If you need a new field, check it is reachable from an end
   before adding a full scan.
2. **A child process cannot `cd` its parent shell.** That is the entire reason
   the shell shim exists. The TUI writes a tab-separated line to
   `$WIMS_ACTION_FILE` and the shim performs the `cd`. If you add an action,
   update `shim/wims.sh` *and* `shim/wims.fish`, and keep the fallback in
   `runFallback()` working for people without the shim.
3. **The shim only passes through arguments it recognises.** Do not let
   arbitrary text from the action file reach the `claude` command line.

## Tests

```bash
npm test        # builds, then runs everything
```

The suite drives the real Ink component through `ink-testing-library` —
keystrokes in, rendered frames and emitted actions out. If you add a keybinding,
add a test that presses it and asserts the action or the frame.

Layout bugs are real bugs here. Two of them (a pane silently shrinking, a footer
wrapping onto a second line) shipped and were only caught by rendering, so there
are regression tests asserting that nothing spills past the frame. Please keep
them passing rather than adjusting them.

## Screenshots

`assets/*.svg` are generated, not hand-drawn:

```bash
npm run screenshot
```

This runs the real scanner over the demo fixture, renders the real component,
and converts the frame to SVG. If you change the UI, regenerate them in the same
PR so the README cannot drift.

## Style

- TypeScript, strict mode, ES modules.
- 2 spaces, single quotes, semicolons, ~110 columns. `.editorconfig` covers the
  basics; there is deliberately no linter or formatter to argue with.
- Comment the *why*, not the *what*. If a line looks odd, the comment should
  explain the constraint that made it odd.

## Pull requests

- One change per PR.
- Add or update tests.
- Update `CHANGELOG.md` under an `## [Unreleased]` heading. Maintainers pick the
  version at release time — please do not bump `package.json` yourself.
- Regenerate screenshots if the UI moved.
- Say what you tested, and on which shell and OS. The fish shim in particular is
  under-tested; reports are genuinely useful.

## Reporting bugs

Include your OS, shell, `node --version`, `claude --version`, and `wims
--version`. If it is a display problem, the terminal and its width help a lot.

`wims --json` prints the metadata it derived without opening the TUI, which is
usually the fastest way to show what it saw — but **read it before pasting it**,
since it contains your real folder paths and prompt text.

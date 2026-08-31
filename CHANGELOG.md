# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-08-31

First public release.

### Added

- **Session browser.** A two-pane Ink TUI listing every Claude Code session on
  the machine, newest first, regardless of which folder you are standing in.
  The preview pane shows the full path, git branch, prompt count, transcript
  size, activity range and the last thing you typed.
- **Fuzzy search** across session title and folder path, with acronym-style
  matching and scattered-subsequence rejection so short queries stay useful.
- **Deep search.** `/query` searches the text of every prompt in
  `history.jsonl` and maps the matches back onto their sessions, showing the
  matching excerpt in the preview. For finding a session by something you said
  in it rather than by what it was named.
- **cd-and-resume.** `enter` puts your shell *in the session's folder* and
  resumes the conversation, via a shell function for zsh, bash and fish. Without
  the shim installed, wims falls back to launching Claude with the right cwd.
- **Actions.** `ctrl+o` cd only, `ctrl+n` new session in that folder, `ctrl+y`
  copy the resume command, `ctrl+d` delete a transcript with confirmation,
  `ctrl+a` reveal one-off sessions, `?` help.
- **`ctrl+x` arms `--dangerously-skip-permissions`** for the next launch, with a
  red badge in the header and an altered footer so it can never be armed
  invisibly. Armed per run; `--yolo` arms it from startup. Ignored by `ctrl+o`,
  which never launches Claude.
- **Fast by construction.** Reads only a 64 KB window from each end of a
  transcript, takes prompt counts from `history.jsonl`, and caches metadata in
  `<claude-config>/wims/cache.json` keyed by path, size and mtime. ~220 ms cold
  and ~130 ms warm against 125 sessions and ~330 MB of transcripts.
- **One-off sessions** with fewer than two real prompts are hidden by default.
- **Flags:** `--here`, `--all`, `--json`, `--yolo`, `--print-shim`, `--help`,
  `--version`.
- **`install.sh`** with idempotent rc-file editing, backups, a PATH warning and
  `--uninstall`.
- **`CLAUDE_CONFIG_DIR` support**, which also powers the demo fixture: `npm run
  demo` builds a throwaway config directory of invented sessions so you can try
  or develop against fake data instead of your own.
- **Generated screenshots.** `npm run screenshot` runs the real scanner over the
  demo fixture, renders the real component and converts the frame to SVG against
  a pinned clock, so the README cannot drift and regeneration is a no-op.
- **Test suite** driving the real Ink component through `ink-testing-library`,
  plus a CI job that exercises the shell shim under both bash and zsh.

### Security

- The shell shim passes through only the exact flag
  `--dangerously-skip-permissions`; nothing else in the action file can reach
  the `claude` command line.
- Paths are shell-quoted in the command that `ctrl+y` copies.

[1.0.0]: https://github.com/pluginslab/wims/releases/tag/v1.0.0

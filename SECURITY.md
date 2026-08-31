# Security Policy

## Supported versions

The latest release on `main` is the only supported version.

## Reporting a vulnerability

Please report privately rather than opening a public issue:

- GitHub: [private vulnerability reporting](https://github.com/pluginslab/wims/security/advisories/new)
- Email: hi@pluginslab.com

Expect an acknowledgement within a few days. Please include what you did, what
happened, and what you expected.

## What wims touches

Useful context if you are assessing risk:

- **It reads** your Claude Code config directory: the session transcripts under
  `projects/` and the prompt log `history.jsonl`. That data is personal: it
  contains your folder paths and everything you have typed to Claude.
- **It writes** a metadata cache at `<claude-config>/wims/cache.json`, and a
  temporary action file in `$TMPDIR` that the shell shim reads and deletes.
- **It deletes** a transcript only when you press `ctrl+d` and confirm.
- **It makes no network requests at all.** Nothing leaves your machine.
- **It launches `claude`** with `--resume <id>`, optionally with
  `--dangerously-skip-permissions` when you have explicitly armed it.

The install script appends a sourcing line to your shell rc file, backs up the
original, and can be reversed with `./install.sh --uninstall`.

## Things we already think about

- The shell shim passes through **only** the exact flag
  `--dangerously-skip-permissions` from the action file. Nothing else in that
  file can reach the `claude` command line.
- Paths are shell-quoted before they appear in the command that `ctrl+y` copies.
- The action file is created with `mktemp` and removed after it is read.

If you find a way around any of these, that is exactly the kind of report we
want.

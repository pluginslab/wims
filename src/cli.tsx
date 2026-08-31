#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { App } from './ui/App.js';
import { scan } from './scan.js';
import { emitAction, shellQuote, SKIP_FLAG } from './actions.js';
import { claudeDir, projectsDir, tildify } from './env.js';
import { detectShell, readShim, type ShellName } from './shim.js';
import type { Action, Session } from './types.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function version(): string {
  try {
    return JSON.parse(fs.readFileSync(path.resolve(HERE, '..', 'package.json'), 'utf8')).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const HELP = `wims — where is my session

  Find, preview and resume any Claude Code session, from any folder.

USAGE
  wims [query]

OPTIONS
  --here            only sessions started in the current directory (or below)
  -a, --all         include one-off sessions (fewer than 2 real prompts)
  --json            print session metadata as JSON and exit (no TUI)
  --yolo            start with --dangerously-skip-permissions already armed
  --print-shim [S]  print the shell function for zsh|bash|fish
  -h, --help        this help
  -v, --version     print version

KEYS
  type            fuzzy filter on title and folder
  /text           full-text search across every prompt you have ever sent
  enter           cd to the folder and resume
  ctrl+o          cd to the folder only
  ctrl+n          cd to the folder and start a new session
  ctrl+x          arm/disarm --dangerously-skip-permissions
  ctrl+y          copy the resume command
  ctrl+d          delete the transcript (asks first)
  ctrl+a          toggle one-off sessions
  ?               full help
`;

interface Args {
  query: string;
  here: boolean;
  all: boolean;
  json: boolean;
  skipPermissions: boolean;
  printShim?: ShellName;
  help: boolean;
  version: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    query: '',
    here: false,
    all: false,
    json: false,
    skipPermissions: false,
    help: false,
    version: false,
  };
  const words: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    switch (a) {
      case '-h':
      case '--help':
        args.help = true;
        break;
      case '-v':
      case '--version':
        args.version = true;
        break;
      case '--here':
        args.here = true;
        break;
      case '-a':
      case '--all':
        args.all = true;
        break;
      case '--json':
        args.json = true;
        break;
      case '--yolo':
      case '--dangerously-skip-permissions':
        args.skipPermissions = true;
        break;
      case '--print-shim': {
        const next = argv[i + 1];
        if (next && !next.startsWith('-')) {
          args.printShim = next as ShellName;
          i++;
        } else {
          args.printShim = detectShell();
        }
        break;
      }
      default:
        if (a.startsWith('-')) {
          process.stderr.write(`wims: unknown option ${a}\n`);
          process.exit(2);
        }
        words.push(a);
    }
  }

  args.query = words.join(' ');
  return args;
}

function altScreen(on: boolean): void {
  if (process.stdout.isTTY) process.stdout.write(on ? '\x1b[?1049h\x1b[H' : '\x1b[?1049l');
}

/**
 * Without the shell shim we cannot change the caller's directory, so we do the
 * next best thing: run Claude with its cwd set to the session's folder.
 */
function runFallback(action: Action): number {
  if (action.kind === 'cd') {
    process.stdout.write(
      `${action.cwd}\n\n` +
        `wims cannot change your shell's directory on its own.\n` +
        `Install the shell shim (see install.sh) or run:\n  cd ${shellQuote(action.cwd)}\n`,
    );
    return 0;
  }

  const args = action.kind === 'resume' ? ['--resume', action.sessionId] : [];
  if (action.skipPermissions) args.push(SKIP_FLAG);
  const res = spawnSync('claude', args, { cwd: action.cwd, stdio: 'inherit' });

  if (res.error && (res.error as NodeJS.ErrnoException).code === 'ENOENT') {
    process.stderr.write(`wims: 'claude' is not on your PATH.\nRun manually:\n  cd ${shellQuote(action.cwd)} && claude${args.length ? ' ' + args.join(' ') : ''}\n`);
    return 127;
  }
  return res.status ?? 0;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    process.stdout.write(HELP);
    return;
  }
  if (args.version) {
    process.stdout.write(`${version()}\n`);
    return;
  }
  if (args.printShim) {
    if (!['zsh', 'bash', 'fish'].includes(args.printShim)) {
      process.stderr.write(`wims: --print-shim expects zsh, bash or fish\n`);
      process.exitCode = 2;
      return;
    }
    process.stdout.write(readShim(args.printShim));
    return;
  }

  if (!fs.existsSync(projectsDir())) {
    process.stderr.write(
      `wims: no Claude Code sessions found.\n` +
        `Looked in ${tildify(projectsDir())}.\n` +
        `If your config lives elsewhere, set CLAUDE_CONFIG_DIR.\n`,
    );
    process.exitCode = 1;
    return;
  }

  const { sessions: allSessions, history } = scan();

  let sessions: Session[] = allSessions;
  if (args.here) {
    const here = process.cwd();
    sessions = sessions.filter((s) => s.cwd === here || s.cwd.startsWith(here + path.sep));
  }

  if (args.json) {
    process.stdout.write(JSON.stringify(sessions, null, 2) + '\n');
    return;
  }

  if (sessions.length === 0) {
    process.stderr.write(
      args.here
        ? `wims: no sessions started in ${tildify(process.cwd())}.\n`
        : `wims: no sessions found under ${tildify(claudeDir())}.\n`,
    );
    process.exitCode = 1;
    return;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    process.stderr.write(`wims: needs an interactive terminal. Use --json for scripting.\n`);
    process.exitCode = 1;
    return;
  }

  let chosen: Action | null = null;
  const shimActive = Boolean(process.env.WIMS_ACTION_FILE);

  altScreen(true);
  const app = render(
    <App
      initialSessions={sessions}
      history={history}
      initialQuery={args.query}
      minPrompts={args.all ? 0 : 2}
      shimActive={shimActive}
      initialSkipPermissions={args.skipPermissions}
      onChoose={(a) => {
        chosen = a;
      }}
    />,
    { exitOnCtrlC: false },
  );

  try {
    await app.waitUntilExit();
  } finally {
    altScreen(false);
  }

  if (!chosen) return;

  // The shim takes it from here when it is installed; otherwise fall back to
  // launching Claude ourselves with the right cwd.
  if (!emitAction(chosen)) process.exitCode = runFallback(chosen);
}

main().catch((err) => {
  altScreen(false);
  process.stderr.write(`wims: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
  process.exitCode = 1;
});

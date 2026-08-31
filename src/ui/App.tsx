import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import { SessionList } from './SessionList.js';
import { Preview } from './Preview.js';
import { Help } from './Help.js';
import { search } from '../search.js';
import { copyToClipboard, deleteSession, resumeCommand, SKIP_FLAG } from '../actions.js';
import { tildify } from '../env.js';
import { truncate } from '../format.js';
import type { Action, ActionKind, HistoryIndex, Session } from '../types.js';

type Mode = 'list' | 'help' | 'confirm';

const HINTS = '↵ resume · ^O cd · ^N new · ^X skip-perms · ^Y copy · ^D delete · ? help';

export interface AppProps {
  initialSessions: Session[];
  history: HistoryIndex;
  initialQuery: string;
  /** Sessions with fewer than this many prompts are hidden until ctrl+a. */
  minPrompts: number;
  shimActive: boolean;
  /** Start with --dangerously-skip-permissions already armed. */
  initialSkipPermissions?: boolean;
  onChoose: (action: Action) => void;
}

export function App({
  initialSessions,
  history,
  initialQuery,
  minPrompts,
  shimActive,
  initialSkipPermissions = false,
  onChoose,
}: AppProps) {
  const { exit } = useApp();
  const { stdout } = useStdout();

  const [sessions, setSessions] = useState(initialSessions);
  const [query, setQuery] = useState(initialQuery);
  const [selected, setSelected] = useState(0);
  const [offset, setOffset] = useState(0);
  const [mode, setMode] = useState<Mode>('list');
  const [showAll, setShowAll] = useState(false);
  // Armed per-run only: quitting wims always disarms it again.
  const [skipPerms, setSkipPerms] = useState(initialSkipPermissions);
  const [flash, setFlash] = useState<{ text: string; color: string } | null>(null);

  const [cols, setCols] = useState(stdout?.columns ?? 100);
  const [termRows, setTermRows] = useState(stdout?.rows ?? 30);

  useEffect(() => {
    if (!stdout) return;
    const onResize = () => {
      setCols(stdout.columns);
      setTermRows(stdout.rows);
    };
    stdout.on('resize', onResize);
    return () => {
      stdout.off('resize', onResize);
    };
  }, [stdout]);

  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 2500);
    return () => clearTimeout(t);
  }, [flash]);

  const pool = useMemo(
    () => (showAll ? sessions : sessions.filter((s) => s.promptCount >= minPrompts)),
    [sessions, showAll, minPrompts],
  );
  const hiddenCount = sessions.length - pool.length;

  const rows = useMemo(() => search(pool, history, query), [pool, history, query]);

  // Layout: query line + list/preview + footer.
  const bodyHeight = Math.max(4, termRows - 3);
  const listWidth = Math.min(60, Math.max(24, Math.floor(cols * 0.42)));
  // The preview pane owns everything to the right of the list, minus its
  // 1-column left border and the 1 column of padding inside it.
  const previewWidth = Math.max(20, cols - listWidth - 3);
  const visibleRows = Math.max(1, Math.floor(bodyHeight / 2));
  // Whatever the hints don't use, minus the 2 padding columns and the " · ".
  const pathBudget = Math.max(8, cols - 2 - HINTS.length - 3);

  // Keep the selection inside the viewport whenever either end moves.
  useEffect(() => {
    if (selected >= rows.length) setSelected(Math.max(0, rows.length - 1));
  }, [rows.length, selected]);

  useEffect(() => {
    if (selected < offset) setOffset(selected);
    else if (selected >= offset + visibleRows) setOffset(selected - visibleRows + 1);
  }, [selected, offset, visibleRows]);

  const current = rows[selected]?.session;

  const choose = (kind: ActionKind) => {
    if (!current) return;
    // A plain `cd` never launches Claude, so the flag is meaningless there.
    const skipPermissions = kind !== 'cd' && skipPerms;
    onChoose({ kind, cwd: current.cwd, sessionId: current.id, skipPermissions });
    exit();
  };

  const move = (delta: number) => {
    setSelected((prev) => Math.min(Math.max(0, prev + delta), Math.max(0, rows.length - 1)));
  };

  useInput((input, key) => {
    if (mode === 'help') {
      setMode('list');
      return;
    }

    if (mode === 'confirm') {
      if (input === 'y' || input === 'Y') {
        const target = current;
        if (target) {
          const res = deleteSession(target);
          if (res.ok) {
            setSessions((prev) => prev.filter((s) => s.id !== target.id));
            setFlash({ text: `Deleted ${truncate(target.title, 40)}`, color: 'green' });
          } else {
            setFlash({ text: `Delete failed: ${res.error}`, color: 'red' });
          }
        }
      }
      setMode('list');
      return;
    }

    if (key.escape) {
      if (query) setQuery('');
      else exit();
      return;
    }

    if (key.ctrl) {
      switch (input) {
        case 'c':
          exit();
          return;
        case 'o':
          choose('cd');
          return;
        case 'n':
          choose('new');
          return;
        case 'x':
          setSkipPerms((v) => {
            setFlash(
              v
                ? { text: 'Permission checks back on', color: 'green' }
                : { text: `⚠ Armed: Claude will launch with ${SKIP_FLAG}`, color: 'red' },
            );
            return !v;
          });
          return;
        case 'y': {
          if (!current) return;
          const tool = copyToClipboard(resumeCommand(current, skipPerms));
          setFlash(
            tool
              ? { text: 'Resume command copied to clipboard', color: 'green' }
              : { text: 'No clipboard tool found (pbcopy/wl-copy/xclip/xsel)', color: 'red' },
          );
          return;
        }
        case 'd':
          if (current) setMode('confirm');
          return;
        case 'a':
          setShowAll((v) => !v);
          setSelected(0);
          return;
        case 'g':
          setMode('help');
          return;
        case 'u':
          move(-visibleRows);
          return;
      }
      return;
    }

    if (key.return) {
      choose('resume');
      return;
    }
    if (key.upArrow) return move(-1);
    if (key.downArrow) return move(1);
    if (key.pageUp) return move(-visibleRows);
    if (key.pageDown) return move(visibleRows);
    if (key.backspace || key.delete) return setQuery((q) => q.slice(0, -1));

    // '?' is only help when there is nothing to type it into.
    if (input === '?' && query === '') {
      setMode('help');
      return;
    }

    if (input && !key.meta) {
      setQuery((q) => q + input);
      setSelected(0);
    }
  });

  if (mode === 'help') return <Help shimActive={shimActive} />;

  const deep = query.trim().startsWith('/');

  return (
    <Box flexDirection="column" width={cols} height={termRows}>
      {/* Query line. The badge and the counter never shrink or wrap; the query
          itself gives up columns first, so a long query can't push the header
          onto a second line and corrupt the pane below it. */}
      <Box paddingX={1} overflow="hidden">
        <Box flexGrow={1} flexShrink={1} overflow="hidden">
          <Text wrap="truncate-end">
            <Text color={deep ? 'magenta' : 'cyan'}>{deep ? '≡ ' : '> '}</Text>
            {query}
            <Text color="cyan">▌</Text>
          </Text>
        </Box>
        {skipPerms && (
          <Box flexShrink={0}>
            <Text backgroundColor="red" color="white" bold>
              {' ⚠ SKIP PERMISSIONS '}
            </Text>
          </Box>
        )}
        <Box flexShrink={0}>
          <Text dimColor>
            {skipPerms ? '  ' : ''}
            {rows.length}/{pool.length}
            {hiddenCount > 0 ? ` (+${hiddenCount} hidden)` : ''}
          </Text>
        </Box>
      </Box>

      {/* Body. Both panes are pinned: without flexShrink={0} yoga steals
          columns from the list to fit the preview's long, unbreakable strings
          (session ids, deep paths), which silently clips the age column. */}
      <Box flexGrow={1}>
        <Box width={listWidth} flexShrink={0} flexGrow={0} flexDirection="column" overflow="hidden">
          <SessionList
            rows={rows}
            selected={selected}
            offset={offset}
            height={bodyHeight}
            width={listWidth}
          />
        </Box>
        <Box
          borderStyle="single"
          borderTop={false}
          borderBottom={false}
          borderRight={false}
          borderDimColor
          width={cols - listWidth}
          flexShrink={0}
          flexGrow={0}
          flexDirection="column"
          overflow="hidden"
        >
          <Preview session={current} width={previewWidth} hit={rows[selected]?.hit} />
        </Box>
      </Box>

      {/* Footer. Every branch truncates rather than wraps. A second footer
          line would push the whole layout off the bottom of the screen. */}
      <Box paddingX={1} overflow="hidden">
        {mode === 'confirm' && current ? (
          <Text color="red" wrap="truncate-end">
            Delete “{truncate(current.title, 40)}” permanently?{' '}
            <Text bold>y</Text>
            /<Text bold>n</Text>
          </Text>
        ) : flash ? (
          <Text color={flash.color} wrap="truncate-end">
            {flash.text}
          </Text>
        ) : skipPerms ? (
          <Text wrap="truncate-end">
            <Text color="red" bold>
              ↵ resume WITHOUT permission checks
            </Text>
            <Text dimColor> · ^X re-enable · ^O cd · ^N new · ^Y copy · ? help</Text>
          </Text>
        ) : (
          <Text dimColor wrap="truncate-end">
            {HINTS}
            {current ? ` · ${truncate(tildify(current.cwd), pathBudget)}` : ''}
          </Text>
        )}
      </Box>
    </Box>
  );
}

import React from 'react';
import { Box, Text } from 'ink';

const KEYS: [string, string][] = [
  ['type', 'fuzzy filter on session title and folder'],
  ['/text', 'full-text search everything you ever typed'],
  ['↑ ↓', 'move selection'],
  ['PgUp PgDn', 'jump a page'],
  ['enter', 'cd to the folder and resume the session'],
  ['ctrl+o', 'cd to the folder only, no Claude'],
  ['ctrl+n', 'cd to the folder and start a NEW session'],
  ['ctrl+x', 'arm/disarm --dangerously-skip-permissions'],
  ['ctrl+y', 'copy the resume command to the clipboard'],
  ['ctrl+d', 'delete this transcript (asks first)'],
  ['ctrl+a', 'toggle one-off sessions (<2 prompts)'],
  ['ctrl+g / ?', 'this help'],
  ['esc', 'clear the filter, or quit when empty'],
];

export function Help({ shimActive }: { shimActive: boolean }) {
  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold color="cyan">
        wims — where is my session
      </Text>
      <Box height={1} />
      {KEYS.map(([k, d]) => (
        <Box key={k}>
          <Box width={12}>
            <Text color="yellow">{k}</Text>
          </Box>
          <Text>{d}</Text>
        </Box>
      ))}
      <Box height={1} />
      <Text color="red">
        ctrl+x arms --dangerously-skip-permissions: Claude will then run every tool call, including file
        writes and shell commands, without asking you first.
      </Text>
      <Text dimColor>It is armed per run of wims and is always off again next time you open it.</Text>
      <Box height={1} />
      {shimActive ? (
        <Text color="green">Shell shim active — your shell will stay in the session's folder.</Text>
      ) : (
        <Text color="yellow">
          Shell shim not installed. Claude will run in the right folder, but your shell returns to where you
          started. Run install.sh to enable cd-on-exit.
        </Text>
      )}
      <Box height={1} />
      <Text dimColor>Press any key to go back.</Text>
    </Box>
  );
}

import React from 'react';
import { Box, Text } from 'ink';
import path from 'node:path';
import { relTime, truncate, truncateStart } from '../format.js';
import type { Row } from '../search.js';

/**
 * Rows are composed as fixed-width strings rather than nested flex boxes.
 * Flexbox inside a narrow pane silently steals columns from the right-hand
 * cell, which quietly truncated the age into "47" and "no".
 */
export function SessionList({
  rows,
  selected,
  offset,
  height,
  width,
}: {
  rows: Row[];
  selected: number;
  offset: number;
  height: number;
  width: number;
}) {
  if (rows.length === 0) {
    return (
      <Box paddingX={1}>
        <Text dimColor>No matching sessions.</Text>
      </Box>
    );
  }

  const LINES_PER_ROW = 2;
  const visible = Math.max(1, Math.floor(height / LINES_PER_ROW));
  const slice = rows.slice(offset, offset + visible);

  // One column of breathing room before the divider.
  const avail = Math.max(12, width - 1);
  const indent = 2;
  const body = avail - indent;

  return (
    <Box flexDirection="column">
      {slice.map((row, i) => {
        const idx = offset + i;
        const active = idx === selected;
        const s = row.session;

        const age = relTime(s.updatedAt);
        const mark = s.cwdMissing ? '✗ ' : '';
        const folderRoom = Math.max(4, body - age.length - 1 - mark.length);
        const folder = mark + truncateStart(path.basename(s.cwd) || s.cwd, folderRoom);
        const gap = Math.max(1, body - folder.length - age.length);

        return (
          <Box key={s.id} flexDirection="column">
            <Text wrap="truncate-end">
              <Text color={active ? 'cyan' : undefined}>{active ? '▸ ' : '  '}</Text>
              <Text bold={active} color={active ? 'cyan' : undefined}>
                {truncate(s.title, body)}
              </Text>
            </Text>
            <Text wrap="truncate-end">
              {'  '}
              <Text color={s.cwdMissing ? 'red' : active ? 'green' : undefined} dimColor={!active && !s.cwdMissing}>
                {folder}
              </Text>
              {' '.repeat(gap)}
              <Text dimColor>{age}</Text>
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}

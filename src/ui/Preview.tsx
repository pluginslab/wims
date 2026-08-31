import React from 'react';
import { Box, Text } from 'ink';
import { tildify } from '../env.js';
import { absDate, bytes, plural, relTime, truncate } from '../format.js';
import type { Session } from '../types.js';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Box width={9}>
        <Text dimColor>{label}</Text>
      </Box>
      <Box flexGrow={1}>{children}</Box>
    </Box>
  );
}

/** "3d" reads as "3d ago", but "now" must not become "now ago". */
function ago(ms: number): string {
  const r = relTime(ms);
  return r === 'now' ? '(just now)' : `(${r} ago)`;
}

/** Wrap a path across lines so a deep path stays fully readable. */
function wrap(text: string, width: number): string[] {
  if (width <= 0) return [text];
  const out: string[] = [];
  for (let i = 0; i < text.length; i += width) out.push(text.slice(i, i + width));
  return out.length ? out : [''];
}

export function Preview({ session, width, hit }: { session?: Session; width: number; hit?: string }) {
  if (!session) {
    return (
      <Box paddingX={1}>
        <Text dimColor>No session selected.</Text>
      </Box>
    );
  }

  const inner = Math.max(10, width - 2);
  const valueWidth = Math.max(8, inner - 9);
  const range =
    session.startedAt && absDate(session.startedAt) !== absDate(session.updatedAt)
      ? `${absDate(session.startedAt)} → ${absDate(session.updatedAt)}`
      : absDate(session.updatedAt);

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold color="cyan" wrap="wrap">
        {session.title}
      </Text>
      {session.titleSource !== 'ai' && (
        <Text dimColor>{session.titleSource === 'prompt' ? '(from first prompt)' : '(from folder name)'}</Text>
      )}

      <Box height={1} />

      {wrap(tildify(session.cwd), inner).map((line, i) => (
        <Text key={i} color={session.cwdMissing ? 'red' : 'green'}>
          {line}
        </Text>
      ))}
      {session.cwdMissing && <Text color="red">folder no longer exists — resume will fail</Text>}

      <Box height={1} />

      {session.branch && (
        <Field label="branch">
          <Text>{truncate(session.branch, valueWidth)}</Text>
        </Field>
      )}
      <Field label="activity">
        <Text>
          {range} <Text dimColor>{ago(session.updatedAt)}</Text>
        </Text>
      </Field>
      <Field label="size">
        <Text>
          {plural(session.promptCount, 'prompt')} · {bytes(session.size)}
          {session.subagentCount > 0 ? ` · ${plural(session.subagentCount, 'subagent')}` : ''}
        </Text>
      </Field>
      {session.version && (
        <Field label="cc ver">
          <Text dimColor>{session.version}</Text>
        </Field>
      )}
      <Field label="id">
        <Text dimColor>{truncate(session.id, valueWidth)}</Text>
      </Field>

      {hit && (
        <>
          <Box height={1} />
          <Text dimColor>match</Text>
          <Text color="yellow" wrap="truncate-end">
            {hit}
          </Text>
        </>
      )}

      {session.lastPrompt && (
        <>
          <Box height={1} />
          <Text dimColor>last prompt</Text>
          <Text wrap="wrap">{truncate(session.lastPrompt.replace(/\s+/g, ' '), inner * 4)}</Text>
        </>
      )}
    </Box>
  );
}

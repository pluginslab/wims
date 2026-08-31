export interface Session {
  /** Claude Code session UUID — the thing `claude --resume` wants. */
  id: string;
  /** Absolute path to the session transcript (.jsonl). */
  file: string;
  /** Absolute path to the directory the session was started in. */
  cwd: string;
  /** True when `cwd` no longer exists on disk (resume would fail). */
  cwdMissing: boolean;
  /** Human title: Claude's own ai-title, else the first prompt, else folder name. */
  title: string;
  /** Where the title came from, so the UI can style it honestly. */
  titleSource: 'ai' | 'prompt' | 'folder';
  /** Git branch recorded at session start, if any. */
  branch?: string;
  /** Claude Code version that wrote the transcript. */
  version?: string;
  /** First and last activity, epoch ms. */
  startedAt?: number;
  updatedAt: number;
  /** Transcript size in bytes. */
  size: number;
  /** Count of top-level prompts you submitted (from history.jsonl). */
  promptCount: number;
  /** The last thing you typed in this session. */
  lastPrompt?: string;
  /** The first thing you typed in this session. */
  firstPrompt?: string;
  /** Number of subagent transcripts nested under this session. */
  subagentCount: number;
}

/** One entry from ~/.claude/history.jsonl */
export interface HistoryEntry {
  sessionId: string;
  project: string;
  display: string;
  timestamp: number;
}

export interface HistoryIndex {
  /** sessionId -> prompts, oldest first. */
  bySession: Map<string, HistoryEntry[]>;
  /** Every entry, for full-text search. */
  all: HistoryEntry[];
}

export type ActionKind = 'resume' | 'cd' | 'new';

export interface Action {
  kind: ActionKind;
  cwd: string;
  sessionId: string;
  /** Launch Claude with --dangerously-skip-permissions. */
  skipPermissions: boolean;
}

/**
 * Small subsequence matcher. Not as clever as fzf, but dependency-free and
 * more than fast enough for a few thousand rows: it rewards consecutive hits
 * and word-boundary hits, so "hawk" beats a scattered h-a-w-k across a path.
 */
export interface MatchResult {
  score: number;
  /** Indices in the haystack that matched, for highlighting. */
  positions: number[];
}

export function fuzzyMatch(haystack: string, needle: string): MatchResult | null {
  if (!needle) return { score: 0, positions: [] };

  const hay = haystack.toLowerCase();
  const need = needle.toLowerCase();

  // Exact substring wins outright, scored by how early and how tight it lands.
  const direct = hay.indexOf(need);
  if (direct !== -1) {
    const positions = Array.from({ length: need.length }, (_, i) => direct + i);
    const boundary = direct === 0 || /[\s/\-_.]/.test(hay[direct - 1]!) ? 40 : 0;
    return { score: 1000 + boundary - direct, positions };
  }

  const positions: number[] = [];
  let score = 0;
  let hayIdx = 0;
  let lastMatch = -2;
  let atWordStart = 0;

  for (let i = 0; i < need.length; i++) {
    const ch = need[i]!;
    const found = hay.indexOf(ch, hayIdx);
    if (found === -1) return null;

    if (found === lastMatch + 1) score += 8; // consecutive
    if (isWordStart(hay, found)) {
      score += 6;
      atWordStart++;
    }
    score -= Math.min(found - hayIdx, 10) * 0.5; // penalise long gaps

    positions.push(found);
    lastMatch = found;
    hayIdx = found + 1;
  }

  // Reject matches so diffuse they are coincidence rather than intent: "dns"
  // should not match "Configure secondary domain … acme-storefront" just
  // because those three letters appear in order across 40 characters.
  // Acronym-style matches (every letter on a word boundary, e.g. "aswr" for
  // "Add Stripe Webhook Retries") are always kept, however far apart they sit.
  const span = positions[positions.length - 1]! - positions[0]! + 1;
  const maxSpan = Math.max(need.length * 4, need.length + 8);
  if (atWordStart < need.length && span > maxSpan) return null;

  return { score, positions };
}

function isWordStart(hay: string, i: number): boolean {
  return i === 0 || /[\s/\-_.]/.test(hay[i - 1]!);
}

/**
 * Every whitespace-separated term must match somewhere. Returns the summed
 * score, or null if any term misses.
 */
export function fuzzyMatchAll(haystack: string, query: string): MatchResult | null {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return { score: 0, positions: [] };

  let total = 0;
  const positions: number[] = [];
  for (const term of terms) {
    const m = fuzzyMatch(haystack, term);
    if (!m) return null;
    total += m.score;
    positions.push(...m.positions);
  }
  return { score: total, positions };
}

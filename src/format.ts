export function relTime(ms: number | undefined, now = Date.now()): string {
  if (!ms) return '—';
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return 'now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 365) return `${d}d`;
  return `${Math.round(d / 365)}y`;
}

export function absDate(ms: number | undefined): string {
  if (!ms) return '—';
  const d = new Date(ms);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(1)} GB`;
}

/** Truncate to a column budget, keeping the end of a path rather than the start. */
export function truncate(s: string, max: number): string {
  if (max <= 1) return '';
  return s.length <= max ? s : s.slice(0, max - 1) + '…';
}

export function truncateStart(s: string, max: number): string {
  if (max <= 1) return '';
  return s.length <= max ? s : '…' + s.slice(s.length - max + 1);
}

export function plural(n: number, one: string, many = one + 's'): string {
  return `${n} ${n === 1 ? one : many}`;
}

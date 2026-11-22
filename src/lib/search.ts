/**
 * Builds a safe "contains" pattern for an ILIKE filter from free text.
 * Characters that PostgREST filter strings treat as syntax are removed; LIKE wildcards are escaped.
 */
export function toIlikePattern(query: string): string | null {
  const cleaned = query.replace(/[,()"'*]/g, "").trim();
  if (!cleaned) return null;
  const escaped = cleaned.replace(/[\\%_]/g, (c) => `\\${c}`);
  return `%${escaped}%`;
}

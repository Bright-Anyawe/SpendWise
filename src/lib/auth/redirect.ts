/**
 * Returns `next` only if it is a same-site relative path ("/something"), otherwise "/".
 * Blocks protocol-relative ("//evil.com"), backslash tricks ("/\evil.com") and absolute URLs.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/")) return "/";
  if (next.startsWith("//") || next.startsWith("/\\")) return "/";
  try {
    const url = new URL(next, "http://localhost");
    if (url.origin !== "http://localhost") return "/";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/";
  }
}

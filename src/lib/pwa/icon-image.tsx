import { ImageResponse } from "next/og";

/**
 * The app icon (a coin with a tick, on deep emerald) rendered to PNG.
 * `safeZone` shrinks the mark so it survives the circular/rounded crop of maskable icons.
 */
export function appIconResponse(size: number, { safeZone = false }: { safeZone?: boolean } = {}) {
  const mark = Math.round(size * (safeZone ? 0.5 : 0.66));
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, background: "#065f46", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width={mark} height={mark} viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="12" fill="none" stroke="#6ee7b7" strokeWidth="2.2" />
          <path d="M10.5 16.5l3.6 3.6L21.5 12.6" fill="none" stroke="#ffffff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}

import { BRAND } from "@/config/brand";

/** Coin-with-a-tick mark and wordmark ("counted"). */
export function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
        <circle cx="16" cy="16" r="16" fill="var(--primary)" />
        <circle cx="16" cy="16" r="11" fill="none" stroke="var(--mint-400)" strokeWidth="2" />
        <path d="M11 16.5l3.2 3.2L21 13" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[19px] leading-6 font-bold tracking-[-0.02em] text-primary">{BRAND.name}</span>
    </div>
  );
}

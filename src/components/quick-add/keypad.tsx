"use client";

import { Delete } from "lucide-react";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "del"] as const;

/** On-screen number pad for phones: no system keyboard jumping in, and the decimal key is always there. */
export function Keypad({ onKey }: { onKey: (key: string) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Number pad">
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => onKey(key)}
          aria-label={key === "del" ? "Delete last digit" : key === "." ? "Decimal point" : key}
          className="flex h-[50px] items-center justify-center rounded-[14px] bg-muted text-[22px] font-semibold tabular-nums text-foreground transition-colors active:bg-border"
        >
          {key === "del" ? <Delete aria-hidden="true" className="size-6" /> : key}
        </button>
      ))}
    </div>
  );
}

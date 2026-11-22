import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { ComparisonTone } from "@/lib/view/dashboard";
import { cn } from "@/lib/utils";

/** "23% less than yesterday": green when spending went down, neutral grey otherwise (never scolding). */
export function Comparison({ text, tone, pill = false }: { text: string; tone: ComparisonTone; pill?: boolean }) {
  const Icon = tone === "less" ? TrendingDown : tone === "more" ? TrendingUp : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[13px] leading-[18px] font-medium",
        tone === "less" ? "text-positive" : "text-muted-foreground",
        pill && tone === "less" && "rounded-full bg-positive-bg px-2.5 py-0.5",
        pill && tone !== "less" && "rounded-full bg-muted px-2.5 py-0.5",
      )}
    >
      {tone === "none" ? null : <Icon aria-hidden="true" className="size-3.5 shrink-0" />}
      {text}
    </span>
  );
}

import type { ReactNode } from "react";

export function AuthHeading({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.01em]">{title}</h1>
      {children ? <p className="text-[15px] leading-[22px] text-muted-foreground">{children}</p> : null}
    </div>
  );
}

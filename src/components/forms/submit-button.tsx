"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function SubmitButton({ children, pendingText }: { children: ReactNode; pendingText: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      aria-disabled={pending}
      className="h-[52px] w-full rounded-[14px] text-base font-semibold hover:bg-primary-hover"
    >
      {pending ? pendingText : children}
    </Button>
  );
}

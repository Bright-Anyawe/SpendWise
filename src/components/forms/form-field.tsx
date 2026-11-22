import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FormFieldProps = {
  id: string;
  label: string;
  error?: string[];
  hint?: string;
} & ComponentProps<"input">;

/** Label + input + hint + error, wired up for screen readers. The input's name defaults to its id. */
export function FormField({ id, label, error, hint, className, name, ...inputProps }: FormFieldProps) {
  const hasError = Boolean(error?.length);
  const describedBy = [hint ? `${id}-hint` : null, hasError ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-sm font-semibold">
        {label}
      </Label>
      <Input
        id={id}
        name={name ?? id}
        aria-invalid={hasError || undefined}
        aria-describedby={describedBy}
        className={cn("h-12 rounded-md bg-card px-3.5 text-base md:text-base", className)}
        {...inputProps}
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-[13px] leading-[18px] text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {hasError ? (
        <p id={`${id}-error`} className="text-[13px] leading-[18px] font-medium text-destructive">
          {error?.[0]}
        </p>
      ) : null}
    </div>
  );
}

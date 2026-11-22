"use client";

import { useActionState, useState } from "react";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { Label } from "@/components/ui/label";
import { CURRENCIES } from "@/config/currencies";
import { useBrowserValue } from "@/hooks/use-browser-value";
import { isValidTimeZone } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { completeOnboarding } from "@/server/actions/profile";

export interface OnboardingDefaults {
  currency: string;
  timezone: string;
  weekStartsOn: number;
}

function readDeviceZone(): string | null {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return zone && isValidTimeZone(zone) ? zone : null;
}

let zoneList: string[] | null = null;
/** The browser's full IANA list, computed once (it is stable for the page's lifetime). */
function allZones(): string[] {
  zoneList ??= Intl.supportedValuesOf("timeZone");
  return zoneList;
}

const chip =
  "flex h-12 cursor-pointer flex-col items-center justify-center rounded-md border border-input bg-card text-foreground " +
  "has-[:checked]:border-2 has-[:checked]:border-primary has-[:checked]:bg-secondary has-[:checked]:text-primary " +
  "has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50";

export function OnboardingForm({ defaults }: { defaults: OnboardingDefaults }) {
  const [state, action] = useActionState(completeOnboarding, null);
  const echo = state && !state.ok ? state.values : undefined;
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  const [currency, setCurrency] = useState(echo?.currency ?? defaults.currency);
  // null until the person picks one: until then we suggest the device's time zone.
  const [chosenZone, setChosenZone] = useState<string | null>(echo?.timezone ?? null);

  // Browser-only, so the server render and first client render agree.
  const detectedZone = useBrowserValue(readDeviceZone, null);
  const isBrowser = useBrowserValue(() => true, false);
  const timezone = chosenZone ?? detectedZone ?? defaults.timezone;
  const zones = isBrowser ? allZones() : [timezone];

  const weekStart = echo?.weekStartsOn ?? String(defaults.weekStartsOn);

  return (
    <form action={action} noValidate className="flex flex-col gap-7">
      <FormMessage state={state} />

      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2.5 text-sm font-semibold">Currency</legend>
        <div className="grid grid-cols-3 gap-2">
          {CURRENCIES.map((c) => (
            <label key={c.code} className={chip}>
              <input
                type="radio"
                name="currency"
                value={c.code}
                checked={currency === c.code}
                onChange={() => setCurrency(c.code)}
                className="sr-only"
              />
              <span className="text-[15px] leading-[18px] font-bold">{c.code}</span>
              <span className="max-w-full truncate px-1 text-[11px] leading-[14px] text-muted-foreground">{c.name}</span>
            </label>
          ))}
        </div>
        <p className="text-[13px] leading-[18px] text-muted-foreground">
          Amounts will look like{" "}
          <strong className="font-semibold text-foreground tabular-nums">{formatMoney(1234.5, currency)}</strong>
        </p>
        {errors?.currency ? <p className="text-[13px] font-medium text-destructive">{errors.currency[0]}</p> : null}
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="timezone" className="text-sm font-semibold">
          Time zone
        </Label>
        <select
          id="timezone"
          name="timezone"
          value={timezone}
          onChange={(e) => setChosenZone(e.target.value)}
          aria-describedby="timezone-hint"
          className="h-12 rounded-md border border-input bg-card px-3.5 text-base focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {(zones.includes(timezone) ? zones : [timezone, ...zones]).map((z) => (
            <option key={z} value={z}>
              {z.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <p id="timezone-hint" className="text-[13px] leading-[18px] text-muted-foreground">
          We use it to work out when your day starts and ends. Detected from this device.
        </p>
        {errors?.timezone ? <p className="text-[13px] font-medium text-destructive">{errors.timezone[0]}</p> : null}
      </div>

      <fieldset>
        <legend className="mb-2.5 text-sm font-semibold">Week starts on</legend>
        <div className="grid grid-cols-2 rounded-md bg-muted p-[3px]">
          {[
            { value: "1", label: "Monday" },
            { value: "0", label: "Sunday" },
          ].map((d) => (
            <label
              key={d.value}
              className={cn(
                "flex h-10 cursor-pointer items-center justify-center rounded-[9px] text-sm font-semibold text-muted-foreground",
                "has-[:checked]:bg-card has-[:checked]:text-primary has-[:checked]:shadow-sm has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
              )}
            >
              <input type="radio" name="weekStartsOn" value={d.value} defaultChecked={weekStart === d.value} className="sr-only" />
              {d.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <Label htmlFor="monthlyBudget" className="text-sm font-semibold">
          Monthly budget <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <div className="flex h-[52px] overflow-hidden rounded-md border border-input bg-card focus-within:ring-3 focus-within:ring-ring/50">
          <span className="flex items-center border-r border-input bg-muted px-3.5 text-[15px] font-semibold text-muted-foreground">
            {currency}
          </span>
          <input
            id="monthlyBudget"
            name="monthlyBudget"
            inputMode="decimal"
            placeholder="e.g. 3,000"
            defaultValue={echo?.monthlyBudget}
            aria-describedby="monthlyBudget-hint"
            aria-invalid={errors?.monthlyBudget ? true : undefined}
            className="min-w-0 flex-1 bg-transparent px-3.5 text-base outline-none placeholder:text-muted-foreground"
          />
        </div>
        <p id="monthlyBudget-hint" className="text-[13px] leading-[18px] text-muted-foreground">
          Leave it empty to skip. You can add budgets any time.
        </p>
        {errors?.monthlyBudget ? <p className="text-[13px] font-medium text-destructive">{errors.monthlyBudget[0]}</p> : null}
      </div>

      <SubmitButton pendingText="Saving…">Continue</SubmitButton>
    </form>
  );
}

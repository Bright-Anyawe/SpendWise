"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { CURRENCIES } from "@/config/currencies";
import { useBrowserValue } from "@/hooks/use-browser-value";
import { formatMoney } from "@/lib/money";
import type { Profile } from "@/lib/types/database";
import { cn } from "@/lib/utils";
import { saveProfileSettings } from "@/server/actions/settings";

let zones: string[] | null = null;
const allZones = () => (zones ??= Intl.supportedValuesOf("timeZone"));

const field = "h-12 rounded-md border border-input bg-card px-3.5 text-base focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";

export function ProfileSettings({ profile }: { profile: Profile }) {
  const ids = useId();
  const isBrowser = useBrowserValue(() => true, false);
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [currency, setCurrency] = useState(profile.currency);
  const [timezone, setTimezone] = useState(profile.timezone);
  const [weekStartsOn, setWeekStartsOn] = useState(profile.week_starts_on);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const zoneOptions = isBrowser ? allZones() : [timezone];
  const currencyChanged = currency !== profile.currency;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await saveProfileSettings({ displayName, currency, timezone, weekStartsOn });
          if (!result.ok) setError(result.error);
          else toast("Settings saved");
        });
      }}
    >
      <label htmlFor={`${ids}-name`} className="flex flex-col gap-1.5 text-sm font-semibold">
        Your name
        <input id={`${ids}-name`} value={displayName} maxLength={60} onChange={(e) => setDisplayName(e.target.value)} autoComplete="given-name" className={cn(field, "font-normal")} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label htmlFor={`${ids}-currency`} className="flex flex-col gap-1.5 text-sm font-semibold">
          Currency
          <select id={`${ids}-currency`} value={currency} onChange={(e) => setCurrency(e.target.value)} className={cn(field, "font-normal")}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.name}
              </option>
            ))}
          </select>
          <span className="text-xs font-normal text-muted-foreground">Amounts look like {formatMoney(1234.5, currency)}</span>
        </label>

        <label htmlFor={`${ids}-tz`} className="flex flex-col gap-1.5 text-sm font-semibold">
          Time zone
          <select id={`${ids}-tz`} value={timezone} onChange={(e) => setTimezone(e.target.value)} className={cn(field, "font-normal")}>
            {(zoneOptions.includes(timezone) ? zoneOptions : [timezone, ...zoneOptions]).map((z) => (
              <option key={z} value={z}>
                {z.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <span className="text-xs font-normal text-muted-foreground">Decides when your day starts and ends.</span>
        </label>
      </div>

      {currencyChanged ? (
        <p role="status" className="rounded-md bg-warning-bg px-4 py-3 text-sm text-warning">
          Changing the currency only changes how amounts are labelled. Existing amounts are not converted.
        </p>
      ) : null}

      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">Week starts on</legend>
        <div className="grid max-w-xs grid-cols-2 rounded-md bg-muted p-[3px]">
          {[
            { value: 1, label: "Monday" },
            { value: 0, label: "Sunday" },
          ].map((d) => (
            <label
              key={d.value}
              className="flex h-10 cursor-pointer items-center justify-center rounded-[9px] text-sm font-semibold text-muted-foreground has-[:checked]:bg-card has-[:checked]:text-primary has-[:checked]:shadow-sm has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
            >
              <input type="radio" name={`${ids}-week`} className="sr-only" checked={weekStartsOn === d.value} onChange={() => setWeekStartsOn(d.value)} />
              {d.label}
            </label>
          ))}
        </div>
      </fieldset>

      {error ? (
        <p role="alert" className="rounded-md bg-danger-bg px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="h-12 self-start rounded-md bg-primary px-6 text-[15px] font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60">
        {pending ? "Saving…" : "Save preferences"}
      </button>
    </form>
  );
}

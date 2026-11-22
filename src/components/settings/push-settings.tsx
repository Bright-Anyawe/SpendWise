"use client";

import { Bell, BellOff, Send, Share } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { useBrowserValue } from "@/hooks/use-browser-value";
import { pushSupport, readBrowserTraits, vapidKeyToBytes, type PushSupport } from "@/lib/pwa/push-client";
import { isThisDeviceSubscribed, removePushSubscription, savePushSubscription, sendTestPush } from "@/server/actions/push";

type DeviceState = "checking" | "no-worker" | "blocked" | "off" | "on";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

let cachedSupport: PushSupport | undefined;
function readSupport(): PushSupport {
  cachedSupport ??= pushSupport(readBrowserTraits());
  return cachedSupport;
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration();
  return registration ? registration.pushManager.getSubscription() : null;
}

/** "Notifications on this device": turn on (asks permission, subscribes), send a test, turn off. */
export function PushSettings() {
  const support = useBrowserValue<PushSupport | "server">(readSupport, "server");
  const [state, setState] = useState<DeviceState>("checking");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (support !== "supported") return;
    let cancelled = false;
    (async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) return "no-worker" as const;
      if (Notification.permission === "denied") return "blocked" as const;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) return "off" as const;
      return (await isThisDeviceSubscribed(subscription.endpoint)) ? ("on" as const) : ("off" as const);
    })().then(
      (next) => !cancelled && setState(next),
      () => !cancelled && setState("off"),
    );
    return () => {
      cancelled = true;
    };
  }, [support]);

  function turnOn() {
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "blocked" : "off");
          return;
        }
        const registration = await navigator.serviceWorker.ready;
        const subscription =
          (await registration.pushManager.getSubscription()) ??
          (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKeyToBytes(VAPID_PUBLIC_KEY) }));
        const result = await savePushSubscription(subscription.toJSON());
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        setState("on");
        toast("Notifications are on for this device.");
      } catch {
        toast.error("We couldn’t turn notifications on. Check your connection and try again.");
      }
    });
  }

  function turnOff() {
    startTransition(async () => {
      try {
        const subscription = await currentSubscription();
        if (subscription) {
          const result = await removePushSubscription(subscription.endpoint);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          await subscription.unsubscribe();
        }
        setState("off");
        toast("Notifications are off for this device.");
      } catch {
        toast.error("We couldn’t turn notifications off. Check your connection and try again.");
      }
    });
  }

  function sendTest() {
    startTransition(async () => {
      try {
        const subscription = await currentSubscription();
        const result = await sendTestPush(subscription?.endpoint);
        if (result.ok) toast("Test sent. It should appear in a few seconds.");
        else toast.error(result.error);
      } catch {
        toast.error("We couldn’t send a test. Check your connection and try again.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
          {state === "on" ? <Bell aria-hidden="true" className="size-5" /> : <BellOff aria-hidden="true" className="size-5" />}
        </span>
        <div className="flex flex-1 flex-col gap-0.5">
          <h3 className="text-[15px] font-semibold">Notifications on this device</h3>
          <p className="text-[13px] leading-5 text-muted-foreground" aria-live="polite">
            <DeviceMessage support={support} state={state} />
          </p>
        </div>
      </div>

      {support === "ios-needs-install" ? (
        <ol className="ml-[52px] flex list-decimal flex-col gap-1.5 pl-4 text-sm leading-5">
          <li>
            In Safari, tap <Share aria-label="Share" className="inline size-4 align-[-2px] text-primary" /> Share.
          </li>
          <li>Choose “Add to Home Screen”, then Add.</li>
          <li>Open SpendWise from your Home Screen and come back here to turn notifications on.</li>
        </ol>
      ) : null}

      {support === "supported" && (state === "off" || state === "on") ? (
        <div className="ml-[52px] flex flex-wrap gap-2">
          {state === "off" ? (
            <button
              type="button"
              onClick={turnOn}
              disabled={pending || !VAPID_PUBLIC_KEY}
              className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-4 text-[15px] font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
            >
              <Bell aria-hidden="true" className="size-4" />
              {pending ? "Turning on…" : "Turn on notifications"}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={sendTest}
                disabled={pending}
                className="inline-flex h-11 items-center gap-2 rounded-md border border-primary px-4 text-[15px] font-semibold text-primary disabled:opacity-60"
              >
                <Send aria-hidden="true" className="size-4" />
                Send a test
              </button>
              <button
                type="button"
                onClick={turnOff}
                disabled={pending}
                className="inline-flex h-11 items-center rounded-md px-4 text-[15px] font-semibold text-muted-foreground hover:bg-muted disabled:opacity-60"
              >
                Turn off
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function DeviceMessage({ support, state }: { support: PushSupport | "server"; state: DeviceState }) {
  if (support === "server") return <>Checking this device…</>;
  if (support === "ios-needs-install") return <>On iPhone and iPad, notifications work once SpendWise is on your Home Screen.</>;
  if (support === "unsupported") return <>This browser can’t show notifications from SpendWise. Try Chrome, Edge, Firefox or Safari.</>;
  if (!VAPID_PUBLIC_KEY) return <>Notifications aren’t set up on this server yet.</>;
  switch (state) {
    case "checking":
      return <>Checking this device…</>;
    case "no-worker":
      return process.env.NODE_ENV === "production" ? (
        <>Reload this page, then try again. SpendWise needs a moment to finish installing.</>
      ) : (
        <>Notifications need the service worker, which only runs in a production build (npm run build, then npm start).</>
      );
    case "blocked":
      return <>Notifications are blocked for SpendWise in this browser’s settings. Allow them there, then reload this page.</>;
    case "on":
      return <>On. Reminders and summaries you’ve chosen below arrive here.</>;
    case "off":
      return <>Get the reminders and summaries you choose below as notifications on this phone or computer.</>;
  }
}

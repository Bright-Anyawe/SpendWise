import type { ActionResult } from "@/server/action-result";

/** Shows an action's overall error or success message. Field errors are shown next to each field. */
export function FormMessage({ state }: { state: ActionResult<unknown> | null }) {
  if (!state) return null;
  if (state.ok) {
    if (!state.message) return null;
    return (
      <p role="status" className="rounded-md bg-positive-bg px-4 py-3 text-sm leading-5 text-positive">
        {state.message}
      </p>
    );
  }
  return (
    <p role="alert" className="rounded-md bg-danger-bg px-4 py-3 text-sm leading-5 text-destructive">
      {state.error}
    </p>
  );
}

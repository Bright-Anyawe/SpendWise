import "server-only";
import { after } from "next/server";
import { withOwnerTransaction } from "@/lib/db/owner-transaction";
import { sendPush } from "../push/send";
import { checkBudgetAlerts } from "./budget-alerts";
import type { NotifyDeps } from "./deliver";

/** The real database and push service. */
export const liveNotifyDeps: NotifyDeps = { owner: withOwnerTransaction, send: sendPush };

/** After the response is sent: check whether that save crossed a budget's alert point. */
export function scheduleBudgetAlerts(userId: string): void {
  after(async () => {
    try {
      await checkBudgetAlerts(userId, new Date(), liveNotifyDeps);
    } catch (error) {
      console.error(`Budget alert check failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
}
